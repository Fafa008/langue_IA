"""Agent de correction d'une réponse libre (US157) : feedback selon la leçon atteinte.

L'agent reçoit la réponse rédigée par l'apprenant et l'exercice qui l'a demandée ; la leçon atteinte arrive dans
``ContexteApprenant.lecon_atteinte``. Il en déduit la phase (passive ou active), récupère les descripteurs du niveau
de l'apprenant pour l'expression écrite, rend le prompt versionné et appelle le client LLM partagé. Le résultat est
validé par ``ResultatCorrection`` (forme du retour imposée par la phase), puis confronté au contexte et à la
réponse : un extrait qui n'est pas dans la réponse est une invention du modèle, refusée.

Contraintes : aucun accès PostgreSQL, rien n'est persisté, le score n'est qu'une proposition revalidée par le
backend. Aucun contenu d'apprenant n'est journalisé.
"""

import logging

from pydantic import ValidationError

from app.core.erreurs import (
    ErreurCorpusIndisponible,
    ErreurEntreeInvalide,
    ErreurRegistre,
    ErreurReponseLlm,
    ErreurServiceIA,
)
from app.harness.agent import ContexteExecution, DefinitionAgent
from app.prompts import RegistrePrompts
from app.prompts.registre import VERSION_CORRECTION_REPONSE_LIBRE
from app.prompts.variables import DescripteurRAGPrompt, VariablesCorrectionReponseLibre
from app.rag.base import (
    DESCRIPTEURS_MAX,
    PROVENANCE_EXPERIMENTALE,
    PROVENANCE_OFFICIELLE,
    PROVENANCE_SYNTHETIQUE,
    TEXTE_REQUETE_MAX,
    VERSION_CORPUS_EXPERIMENTAL,
    RequeteRAG,
    est_descripteur_experimental,
)
from app.rag.repli import est_descripteur_synthetique
from app.schemas.contexte import ContexteApprenant
from app.schemas.correction import CorrectionIncoherente, EntreeCorrection, ResultatCorrection, phase_de_lecon

logger = logging.getLogger(__name__)

CODE_AGENT_CORRECTION = "correction"
VERSION_AGENT_CORRECTION = "1.0.0"
BUDGET_CORRECTION_MS = 45_000
# Une réponse libre relève de l'expression écrite : ce sont les descripteurs utiles pour la juger.
COMPETENCE_REPONSE_LIBRE = "ecrit"


class CorrectionAgent:
    """Professeur IA : corrige une réponse libre selon la phase passive ou active du parcours."""

    async def executer(self, entree: EntreeCorrection, contexte: ContexteExecution) -> ResultatCorrection:
        apprenant = contexte.contexte
        if apprenant.lecon_atteinte is None:
            raise ErreurEntreeInvalide("La leçon atteinte est obligatoire pour corriger une réponse libre.")

        descripteurs = await self._recuperer_descripteurs(entree, apprenant, contexte)
        try:
            variables = VariablesCorrectionReponseLibre(
                contexte_apprenant=apprenant,
                phase=phase_de_lecon(apprenant.lecon_atteinte),
                exercice=entree,
                descripteurs_rag=list(descripteurs),
            )
        except ValidationError as exc:
            # Entrée, contexte et descripteurs sont déjà validés : une incohérence ici est un défaut interne.
            raise ErreurRegistre("Les variables de la correction ne respectent pas le contrat du prompt.") from exc

        rendu = contexte.outils.registre_prompts.rendre_correction_reponse_libre(variables)
        resultat, _meta_llm = await contexte.outils.client_llm.generer_json(
            rendu.messages,
            schema=ResultatCorrection,
            temperature=rendu.temperature,
            max_tokens=rendu.max_tokens,
        )

        try:
            resultat.verifier_coherence(apprenant.lecon_atteinte, entree.reponse)
        except CorrectionIncoherente as exc:
            raise ErreurReponseLlm(f"Le feedback est incohérent avec le contexte ou la réponse : {exc}") from exc
        return resultat

    @staticmethod
    async def _recuperer_descripteurs(
        entree: EntreeCorrection,
        apprenant: ContexteApprenant,
        contexte: ContexteExecution,
    ) -> tuple[DescripteurRAGPrompt, ...]:
        """Descripteurs d'expression écrite au niveau de l'apprenant ; aucun descripteur n'est un cas valide."""
        requete = RequeteRAG(
            code_langue=apprenant.code_langue,
            referentiel=apprenant.referentiel,
            niveau=apprenant.niveau_preliminaire,
            competences=(COMPETENCE_REPONSE_LIBRE,),
            texte=entree.reponse[:TEXTE_REQUETE_MAX],
            limite=DESCRIPTEURS_MAX,
        )
        try:
            bruts = tuple(await contexte.outils.recuperateur_rag.rechercher(requete))
        except ErreurServiceIA:
            raise
        except Exception as exc:
            raise ErreurCorpusIndisponible("Le récupérateur documentaire a échoué.") from exc

        descripteurs: dict[str, DescripteurRAGPrompt] = {}
        for brut in bruts:
            try:
                descripteur = DescripteurRAGPrompt.model_validate(brut)
            except ValidationError:
                raise ErreurCorpusIndisponible("Un descripteur du corpus est invalide.") from None
            if descripteur.code_langue != apprenant.code_langue or descripteur.referentiel != apprenant.referentiel:
                raise ErreurCorpusIndisponible("Un descripteur ne correspond pas au contexte de la correction.")
            descripteurs.setdefault(descripteur.identifiant, descripteur)
            if len(descripteurs) >= DESCRIPTEURS_MAX:
                break

        # Même signalement que l'agent Diagnostic : la provenance des repères est tracée dans ``meta``.
        if descripteurs and all(est_descripteur_synthetique(d) for d in descripteurs.values()):
            contexte.signalement.provenance = PROVENANCE_SYNTHETIQUE
            contexte.signalement.version_corpus_effective = PROVENANCE_SYNTHETIQUE
            logger.info(
                "Repli RAG synthetique pour la correction (request_id=%s, agent=%s, code_langue=%s)",
                contexte.request_id,
                CODE_AGENT_CORRECTION,
                apprenant.code_langue,
            )
        elif descripteurs and any(est_descripteur_experimental(d) for d in descripteurs.values()):
            # Un repère CARCL est un exercice pédagogique : jamais une preuve de niveau officielle.
            contexte.signalement.provenance = PROVENANCE_EXPERIMENTALE
            contexte.signalement.version_corpus_effective = VERSION_CORPUS_EXPERIMENTAL
            logger.warning(
                "Repères pédagogiques non officiels pour la correction, jugement prudent attendu "
                "(request_id=%s, agent=%s, code_langue=%s)",
                contexte.request_id,
                CODE_AGENT_CORRECTION,
                apprenant.code_langue,
            )
        elif descripteurs:
            contexte.signalement.provenance = PROVENANCE_OFFICIELLE
        else:
            logger.info(
                "Correction sans descripteur RAG, jugement prudent (request_id=%s, agent=%s, code_langue=%s)",
                contexte.request_id,
                CODE_AGENT_CORRECTION,
                apprenant.code_langue,
            )
        return tuple(descripteurs.values())


def definir_agent_correction(
    registre_prompts: RegistrePrompts,
) -> DefinitionAgent[EntreeCorrection, ResultatCorrection]:
    """Déclarer l'agent avec la version et l'empreinte du prompt réellement chargé."""
    version_prompt, empreinte_prompt = registre_prompts.definition(
        "correction", "reponse-libre", VERSION_CORRECTION_REPONSE_LIBRE
    )
    return DefinitionAgent(
        code=CODE_AGENT_CORRECTION,
        version=VERSION_AGENT_CORRECTION,
        schema_entree=EntreeCorrection,
        schema_sortie=ResultatCorrection,
        budget_ms=BUDGET_CORRECTION_MS,
        version_prompt=version_prompt,
        empreinte_prompt=empreinte_prompt,
        executer=CorrectionAgent().executer,
    )
