"""Tuteur IA v2 (US-IA-CHAT-03) : dialogue CECRL/Assimil alimenté par la mémoire courte.

Cette version remplace la v1.2.0 par défaut sur ``POST /chatbot/message`` sans changer le contrat public
``ResultatChatbot``. Elle lit les tours et le résumé de Redis, résout le niveau effectif (A1/HSK 1 tant que le
diagnostic n'est pas clos), déduit la phase Assimil du nombre de tours, sélectionne un descripteur via le RAG
existant, puis rend le prompt ``chatbot/conversation@1.3.0``. Les deux tours de l'échange et le résumé glissant sont
ensuite réécrits en mémoire courte. Redis absent ou en panne : l'historique transmis par le backend sert de repli et
la conversation continue.
"""

from __future__ import annotations

import logging

from app.agent.chatbot import CODE_AGENT_CHATBOT
from app.cecrl.assimil import phase_pour_tours
from app.cecrl.niveau import niveau_effectif as resoudre_niveau_effectif
from app.cecrl.selection import selectionner_descripteurs
from app.harness.agent import ContexteExecution, DefinitionAgent
from app.memory import clefs
from app.prompts import RegistrePrompts
from app.prompts.registre import VERSION_CONVERSATION_CHATBOT_V2
from app.prompts.variables import VariablesConversationChatbotV2
from app.rag.repli import est_descripteur_synthetique
from app.schemas.chatbot import (
    EntreeConversation,
    MessageHistorique,
    ResultatChatbot,
    ResumeSession,
    TourMemoire,
)

logger = logging.getLogger(__name__)

VERSION_AGENT_CHATBOT_V2 = "2.0.0"
BUDGET_CONVERSATION_V2_MS = 35_000
COMPETENCE_CONVERSATION = "oral"


async def repondre(entree: EntreeConversation, contexte: ContexteExecution) -> ResultatChatbot:
    """Conduire un échange adapté au niveau et à la phase, puis rafraîchir la mémoire courte."""
    apprenant = contexte.contexte
    identifiant_session: str | None = None
    tours: tuple[TourMemoire, ...] = ()
    resume: ResumeSession | None = None

    if entree.identifiant_session:
        identifiant_session = clefs.valider_identifiant_session(entree.identifiant_session)
        tours = await contexte.outils.memoire.lire_tours(identifiant_session)
        resume = await contexte.outils.memoire.lire_resume(identifiant_session)

    nombre_tours = len(tours) if tours else len(entree.historique)
    phase = phase_pour_tours(nombre_tours, entree.phase_assimil)
    niveau = resoudre_niveau_effectif(
        apprenant.niveau_preliminaire,
        confirme=apprenant.niveau_confirme,
        referentiel=apprenant.referentiel,
    )
    niveau_confirme = apprenant.niveau_confirme and niveau == apprenant.niveau_preliminaire

    historique = (
        [MessageHistorique(role=tour.role, contenu=tour.contenu) for tour in tours[-20:]]
        if tours
        else list(entree.historique)
    )

    descripteurs = await selectionner_descripteurs(
        contexte.outils.recuperateur_rag,
        code_langue=apprenant.code_langue,
        referentiel=apprenant.referentiel,
        niveau=niveau,
        competence=COMPETENCE_CONVERSATION,
        texte=entree.message,
        limite=1,
    )
    if descripteurs and all(est_descripteur_synthetique(descripteur) for descripteur in descripteurs):
        contexte.signalement.provenance = "synthetique_fallback"
        contexte.signalement.statut_verification = "A_VERIFIER"
        contexte.signalement.version_corpus_effective = "synthetique_fallback"
        logger.info("descripteur_conversation_synthetique niveau=%s", niveau)

    variables = VariablesConversationChatbotV2(
        contexte_apprenant=apprenant,
        historique=historique,
        message=entree.message,
        descripteurs_rag=list(descripteurs),
        phase_assimil=phase,
        niveau_effectif=niveau,
        niveau_confirme=niveau_confirme,
    )
    rendu = contexte.outils.registre_prompts.rendre_conversation_chatbot_v2(variables)
    resultat, _ = await contexte.outils.client_llm.generer_json(
        rendu.messages,
        schema=ResultatChatbot,
        temperature=rendu.temperature,
        max_tokens=rendu.max_tokens,
    )

    if identifiant_session is not None:
        for tour in (
            TourMemoire(role="apprenant", contenu=entree.message, phase=phase),
            TourMemoire(role="assistant", contenu=resultat.reponse, phase=phase),
        ):
            await contexte.outils.memoire.ajouter_tour(identifiant_session, tour)
        points_forts = list(resume.points_forts) if resume else []
        points_faibles = list(resume.points_faibles) if resume else []
        if apprenant.memoire_pedagogique is not None:
            points_forts = points_forts or list(apprenant.memoire_pedagogique.points_forts)
            points_faibles = points_faibles or list(apprenant.memoire_pedagogique.points_faibles)
        resume_a_ecrire = ResumeSession(
            phase=phase,
            niveau_effectif=niveau,
            compteur_tours=min(1000, nombre_tours + 2),
            points_forts=points_forts,
            points_faibles=points_faibles,
        )
        await contexte.outils.memoire.ecrire_resume(identifiant_session, resume_a_ecrire)

    return resultat


def definir_agent_conversation_chatbot(
    registre_prompts: RegistrePrompts,
) -> DefinitionAgent[EntreeConversation, ResultatChatbot]:
    """Enregistrer la v2 sous le même code : la v1.2.0 reste appelable par ``version_agent``."""
    version_prompt, empreinte_prompt = registre_prompts.definition(
        "chatbot", "conversation", VERSION_CONVERSATION_CHATBOT_V2
    )
    return DefinitionAgent(
        code=CODE_AGENT_CHATBOT,
        version=VERSION_AGENT_CHATBOT_V2,
        schema_entree=EntreeConversation,
        schema_sortie=ResultatChatbot,
        budget_ms=BUDGET_CONVERSATION_V2_MS,
        version_prompt=version_prompt,
        empreinte_prompt=empreinte_prompt,
        executer=repondre,
    )
