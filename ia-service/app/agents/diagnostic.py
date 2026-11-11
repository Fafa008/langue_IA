"""Agent Diagnostic : estimation de niveau et détection des lacunes.

L'agent reçoit les réponses du test, le score et le niveau préliminaire calculés par le backend, ainsi que le
contexte apprenant. Il récupère les descripteurs pertinents, laisse le registre de prompts sélectionner l'exemple
few-shot du scénario et de la langue, puis appelle le client LLM partagé. Le résultat est validé par Pydantic,
comparé au contexte transmis et aux réponses disponibles, et un écart important est signalé dans les journaux.

Contraintes : aucun accès PostgreSQL, aucune mémoire apprenant persistée, aucun recalcul du score objectif, aucune
sortie du pipeline du Harness. Quand les descripteurs manquent ou que les preuves sont insuffisantes, le prompt
impose une estimation prudente ; l'agent ne fabrique jamais de descripteur ni de réponse.
"""

import logging

from pydantic import Field, ValidationError, field_validator

from app.core.erreurs import ErreurCorpusIndisponible, ErreurRegistre, ErreurReponseLlm, ErreurServiceIA
from app.harness.agent import ContexteExecution, DefinitionAgent
from app.prompts import RegistrePrompts
from app.prompts.variables import (
    DescripteurRAGPrompt,
    ReponseDiagnosticPrompt,
    ScenarioDiagnostic,
    VariablesEvaluationDiagnostic,
    preuves_depuis_reponses,
)
from app.rag.base import DESCRIPTEURS_MAX, TEXTE_REQUETE_MAX, RequeteRAG
from app.schemas.base import ModeleStrict
from app.schemas.contexte import ContexteApprenant
from app.schemas.diagnostic import DiagnosticIncoherent, PreuveReponse, ResultatDiagnostic
from app.schemas.regles import erreur

logger = logging.getLogger(__name__)

CODE_AGENT = "diagnostic"
VERSION_AGENT = "1.0.0"
BUDGET_MS = 45_000
SEUIL_ECART_IMPORTANT = 2


class EntreeDiagnostic(ModeleStrict):
    """Données du test fournies par le backend à l'agent Diagnostic.

    Le niveau préliminaire et la mémoire pédagogique arrivent dans ``ContexteApprenant`` ; le score objectif du
    test reste une donnée du backend, transmise telle quelle pour contextualiser les preuves.
    """

    scenario: ScenarioDiagnostic = "quotidien"
    reponses: list[ReponseDiagnosticPrompt] = Field(min_length=1, max_length=100)
    score_preliminaire: float = Field(ge=0, le=100)

    @field_validator("score_preliminaire", mode="before")
    @classmethod
    def refuser_booleen(cls, valeur: object) -> object:
        """Un score se mesure en nombre : ``true`` n'est pas un score valide."""
        if isinstance(valeur, bool):
            raise erreur("Le score préliminaire doit être un nombre entre 0 et 100.")
        return valeur

    @field_validator("reponses")
    @classmethod
    def verifier_identifiants_uniques(cls, reponses: list[ReponseDiagnosticPrompt]) -> list[ReponseDiagnosticPrompt]:
        """Un point faible cite une question : deux réponses ne peuvent pas porter le même identifiant."""
        identifiants = [reponse.id_question for reponse in reponses]
        if len(identifiants) != len(set(identifiants)):
            raise erreur("Deux réponses ne peuvent pas partager le même identifiant de question.")
        return reponses


def est_ecart_important(ecart: int, seuil: int = SEUIL_ECART_IMPORTANT) -> bool:
    """Indiquer si l'estimation s'écarte du niveau préliminaire d'au moins ``seuil`` niveaux.

    L'écart est signé : un écart de ``-2`` (estimation nettement inférieure) est aussi important qu'un ``+2``.
    """
    if isinstance(ecart, bool) or not isinstance(ecart, int):
        raise TypeError("L'écart doit être un entier.")
    if isinstance(seuil, bool) or not isinstance(seuil, int) or seuil < 1:
        raise ValueError("Le seuil d'écart doit être un entier positif.")
    return abs(ecart) >= seuil


class DiagnosticAgent:
    """Premier agent métier du Harness : évaluation diagnostique d'un apprenant."""

    async def executer(self, entree: EntreeDiagnostic, contexte: ContexteExecution) -> ResultatDiagnostic:
        """Produire une estimation validée et cohérente avec le contexte transmis."""
        apprenant = contexte.contexte
        descripteurs = await self._recuperer_descripteurs(entree, contexte)
        variables = self._construire_variables(entree, apprenant, descripteurs)
        rendu = contexte.outils.registre_prompts.rendre_evaluation_diagnostic(variables)

        resultat, _meta_llm = await contexte.outils.client_llm.generer_json(
            rendu.messages,
            schema=ResultatDiagnostic,
            temperature=rendu.temperature,
            max_tokens=rendu.max_tokens,
        )

        self._verifier_coherence(resultat, apprenant, entree.reponses)
        self._signaler_ecart(resultat, contexte)
        return resultat

    async def _recuperer_descripteurs(
        self,
        entree: EntreeDiagnostic,
        contexte: ContexteExecution,
    ) -> tuple[DescripteurRAGPrompt, ...]:
        """Interroger le port RAG puis ne garder que des descripteurs sûrs et bornés."""
        apprenant = contexte.contexte
        texte = "\n".join(reponse.contenu for reponse in entree.reponses)[:TEXTE_REQUETE_MAX]
        requete = RequeteRAG(
            code_langue=apprenant.code_langue,
            referentiel=apprenant.referentiel,
            niveau=apprenant.niveau_preliminaire,
            competences=tuple(dict.fromkeys(reponse.competence for reponse in entree.reponses)),
            texte=texte,
            limite=DESCRIPTEURS_MAX,
        )

        try:
            bruts = tuple(await contexte.outils.recuperateur_rag.rechercher(requete))
        except ErreurServiceIA:
            raise
        except Exception as exc:
            raise ErreurCorpusIndisponible("Le récupérateur documentaire a échoué.") from exc

        descripteurs = self._valider_descripteurs(bruts, apprenant)
        if not descripteurs:
            logger.warning(
                "Aucun descripteur RAG disponible, estimation prudente attendue "
                "(request_id=%s, agent=%s, code_langue=%s)",
                contexte.request_id,
                CODE_AGENT,
                apprenant.code_langue,
            )
        return descripteurs

    @staticmethod
    def _valider_descripteurs(
        bruts: tuple[object, ...],
        apprenant: ContexteApprenant,
    ) -> tuple[DescripteurRAGPrompt, ...]:
        """Refuser un corpus incohérent plutôt que de transmettre un descripteur hors contexte au modèle."""
        descripteurs: list[DescripteurRAGPrompt] = []
        vus: set[str] = set()
        for brut in bruts:
            try:
                descripteur = DescripteurRAGPrompt.model_validate(brut)
            except ValidationError:
                raise ErreurCorpusIndisponible("Un descripteur du corpus est invalide.") from None
            if descripteur.code_langue != apprenant.code_langue or descripteur.referentiel != apprenant.referentiel:
                raise ErreurCorpusIndisponible("Un descripteur du corpus ne correspond pas au contexte du diagnostic.")
            if descripteur.identifiant in vus:
                continue
            vus.add(descripteur.identifiant)
            descripteurs.append(descripteur)
            if len(descripteurs) >= DESCRIPTEURS_MAX:
                break
        return tuple(descripteurs)

    @staticmethod
    def _construire_variables(
        entree: EntreeDiagnostic,
        apprenant: ContexteApprenant,
        descripteurs: tuple[DescripteurRAGPrompt, ...],
    ) -> VariablesEvaluationDiagnostic:
        """Assembler les sept variables du prompt ; le registre sélectionne ensuite le few-shot adapté."""
        try:
            return VariablesEvaluationDiagnostic(
                scenario=entree.scenario,
                code_langue=apprenant.code_langue,
                referentiel=apprenant.referentiel,
                reponses=entree.reponses,
                score_preliminaire=entree.score_preliminaire,
                contexte_apprenant=apprenant,
                descripteurs_rag=list(descripteurs),
            )
        except ValidationError as exc:
            # Entrée et contexte sont déjà validés, descripteurs vérifiés : une incohérence ici est un défaut interne.
            raise ErreurRegistre("Les variables du diagnostic ne respectent pas le contrat du prompt.") from exc

    @staticmethod
    def _verifier_coherence(
        resultat: ResultatDiagnostic,
        apprenant: ContexteApprenant,
        reponses: list[ReponseDiagnosticPrompt],
    ) -> None:
        """Une estimation qui ne concerne pas le contexte reçu ou une preuve absente est inexploitable."""
        preuves: tuple[PreuveReponse, ...] = preuves_depuis_reponses(reponses)
        try:
            resultat.verifier_coherence(apprenant, preuves)
        except DiagnosticIncoherent as exc:
            raise ErreurReponseLlm(f"Le résultat est incohérent avec le contexte ou les preuves : {exc}") from exc

    @staticmethod
    def _signaler_ecart(resultat: ResultatDiagnostic, contexte: ContexteExecution) -> None:
        """Signaler un écart important sans journaliser de contenu d'apprenant.

        Le résultat conserve déjà l'écart exact : le backend reste libre de le retenir ou de demander une
        vérification. Le journal fournit le signal d'exploitation.
        """
        if not est_ecart_important(resultat.ecart_avec_niveau_preliminaire):
            return
        logger.warning(
            "Écart important avec le niveau préliminaire " "(request_id=%s, agent=%s, code_langue=%s, ecart=%+d)",
            contexte.request_id,
            CODE_AGENT,
            resultat.code_langue,
            resultat.ecart_avec_niveau_preliminaire,
        )


def construire_definition(registre_prompts: RegistrePrompts) -> DefinitionAgent[EntreeDiagnostic, ResultatDiagnostic]:
    """Déclarer l'agent dans le registre partagé, avec la version et l'empreinte du prompt publié."""
    version_prompt, empreinte_prompt = registre_prompts.identite_evaluation_diagnostic()
    return DefinitionAgent(
        code=CODE_AGENT,
        version=VERSION_AGENT,
        schema_entree=EntreeDiagnostic,
        schema_sortie=ResultatDiagnostic,
        budget_ms=BUDGET_MS,
        version_prompt=version_prompt,
        empreinte_prompt=empreinte_prompt,
        executer=DiagnosticAgent().executer,
    )
