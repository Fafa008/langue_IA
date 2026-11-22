"""Agent Recommandation : propositions d'actions à partir des points faibles du diagnostic.

L'agent reçoit des points faibles déjà validés par le diagnostic et le niveau visé calculé par le backend. Il ne
dispose ni du RAG ni de la mémoire pédagogique en v1 : il travaille uniquement sur ces données non identifiantes.
Quand aucun domaine ne peut être associé à un type d'exercice, il renvoie une proposition vide et une confiance
nulle sans appeler le LLM — le backend traduit alors ce cas en résultat partiel.

Comme les autres agents, il n'accède à aucune base, ne persiste rien et ne sort jamais du pipeline du Harness.
"""

import logging

from pydantic import ValidationError

from app.core.erreurs import ErreurRegistre, ErreurReponseLlm
from app.harness.agent import ContexteExecution, DefinitionAgent
from app.prompts import RegistrePrompts
from app.prompts.variables import VariablesRecommandation
from app.schemas.contexte import ContexteApprenant
from app.schemas.diagnostic import PointFaible
from app.schemas.recommandation import (
    BUDGET_MS,
    CODE_AGENT,
    TYPE_PAR_DOMAINE,
    VERSION_AGENT,
    EntreeRecommandation,
    RecommandationIncoherente,
    ResultatRecommandation,
)

logger = logging.getLogger(__name__)

RESUME_SANS_DOMAINE = "Aucun point faible exploitable pour une recommandation d'exercice."


class RecommandationAgent:
    """Troisième agent métier du Harness : proposition d'actions de remédiation."""

    async def executer(self, entree: EntreeRecommandation, contexte: ContexteExecution) -> ResultatRecommandation:
        """Produire une proposition validée et cohérente avec le contexte transmis."""
        apprenant = contexte.contexte
        points = [point for point in entree.points_faibles if point.domaine in TYPE_PAR_DOMAINE]
        if not points:
            logger.info(
                "Aucun domaine exploitable pour la recommandation " "(request_id=%s, agent=%s, code_langue=%s)",
                contexte.request_id,
                CODE_AGENT,
                apprenant.code_langue,
            )
            return self._sans_recommandation(entree, apprenant)

        variables = self._construire_variables(entree, apprenant, points)
        rendu = contexte.outils.registre_prompts.rendre_actions_recommandation(variables)

        resultat, _meta_llm = await contexte.outils.client_llm.generer_json(
            rendu.messages,
            schema=ResultatRecommandation,
            temperature=rendu.temperature,
            max_tokens=rendu.max_tokens,
        )
        self._verifier_coherence(resultat, entree, apprenant)
        return resultat

    @staticmethod
    def _construire_variables(
        entree: EntreeRecommandation,
        apprenant: ContexteApprenant,
        points: list[PointFaible],
    ) -> VariablesRecommandation:
        """Assembler les variables du prompt ; une incohérence ici est un défaut interne."""
        try:
            return VariablesRecommandation(
                contexte_apprenant=apprenant,
                points_faibles=points,
                niveau_vise=entree.niveau_vise,
            )
        except ValidationError as exc:
            raise ErreurRegistre("Les variables de la recommandation ne respectent pas le contrat du prompt.") from exc

    @staticmethod
    def _sans_recommandation(entree: EntreeRecommandation, apprenant: ContexteApprenant) -> ResultatRecommandation:
        """Réponse déterministe quand aucun type d'exercice ne correspond aux points faibles reçus."""
        try:
            return ResultatRecommandation(
                code_langue=apprenant.code_langue,
                referentiel=apprenant.referentiel,
                niveau_cible=entree.niveau_vise,
                recommandations=[],
                resume=RESUME_SANS_DOMAINE,
                confiance=0.0,
            )
        except ValidationError as exc:
            raise ErreurRegistre("Le niveau visé ne correspond pas au référentiel du contexte.") from exc

    @staticmethod
    def _verifier_coherence(
        resultat: ResultatRecommandation,
        entree: EntreeRecommandation,
        apprenant: ContexteApprenant,
    ) -> None:
        """Refuser une proposition qui ne concerne pas le contexte ou les domaines demandés."""
        try:
            resultat.verifier_coherence(entree, apprenant)
        except RecommandationIncoherente as exc:
            raise ErreurReponseLlm(f"Le résultat est incohérent avec la demande de recommandation : {exc}") from exc


def definir_agent_recommandation(
    registre_prompts: RegistrePrompts,
) -> DefinitionAgent[EntreeRecommandation, ResultatRecommandation]:
    """Déclarer l'agent dans le registre partagé, avec la version et l'empreinte du prompt publié."""
    version_prompt, empreinte_prompt = registre_prompts.identite_actions_recommandation()
    return DefinitionAgent(
        code=CODE_AGENT,
        version=VERSION_AGENT,
        schema_entree=EntreeRecommandation,
        schema_sortie=ResultatRecommandation,
        budget_ms=BUDGET_MS,
        version_prompt=version_prompt,
        empreinte_prompt=empreinte_prompt,
        executer=RecommandationAgent().executer,
    )
