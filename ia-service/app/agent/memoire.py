"""Clôture d'une session de chat : synthèse pédagogique renvoyée au backend pour persistance (US-IA-CHAT-04).

Le service IA ne possède ni base ni historique durable : il relit ses tours Redis et son résumé glissant, demande au
LLM une synthèse courte et des erreurs récurrentes, puis compose une charge utile typée. Le profil transmis par le
backend est pseudonyme ; aucun nom, aucune date d'occurrence inventée ni aucune donnée personnelle n'est produit par
le modèle. C'est le backend qui décide de la persistance et de la suppression de l'historique de session.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from app.cecrl.assimil import phase_pour_tours
from app.harness.agent import ContexteExecution, DefinitionAgent
from app.memory import clefs
from app.prompts import RegistrePrompts
from app.prompts.registre import VERSION_MEMOIRE_CHATBOT
from app.prompts.variables import VariablesMemoireChatbot
from app.schemas.chatbot import (
    ChargeMemoireLongTerme,
    EntreeClotureSession,
    ErreurRecurrente,
    MemoireGeneree,
    MessageHistorique,
    ResumeSession,
    SessionMemoire,
)

logger = logging.getLogger(__name__)

CODE_AGENT_MEMOIRE_CHATBOT = "chatbot-memoire"
VERSION_AGENT_MEMOIRE_CHATBOT = "1.0.0"
BUDGET_MEMOIRE_CHATBOT_MS = 20_000
RESUME_SESSION_VIDE = "Session sans échange enregistré."


async def clore(entree: EntreeClotureSession, contexte: ContexteExecution) -> ChargeMemoireLongTerme:
    """Composer la mémoire long terme à partir de la mémoire courte et de la synthèse du LLM."""
    identifiant_session = clefs.valider_identifiant_session(entree.identifiant_session)
    tours = await contexte.outils.memoire.lire_tours(identifiant_session)
    resume = await contexte.outils.memoire.lire_resume(identifiant_session)
    nombre_tours = len(tours)

    if tours or resume is not None:
        variables = VariablesMemoireChatbot(
            code_langue=contexte.contexte.code_langue,
            referentiel=contexte.contexte.referentiel,
            niveau_effectif=entree.profil.niveau_effectif,
            phase_assimil=resume.phase if resume is not None else phase_pour_tours(nombre_tours),
            resume_session=resume or _resume_neutre(entree, nombre_tours),
            tours=[MessageHistorique(role=tour.role, contenu=tour.contenu) for tour in tours],
        )
        rendu = contexte.outils.registre_prompts.rendre_memoire_chatbot(variables)
        generee, _ = await contexte.outils.client_llm.generer_json(
            rendu.messages,
            schema=MemoireGeneree,
            temperature=rendu.temperature,
            max_tokens=rendu.max_tokens,
        )
        resume_ecrit = generee.resume
        erreurs_generees = generee.erreurs
    else:
        resume_ecrit = RESUME_SESSION_VIDE
        erreurs_generees = []

    date_occurrence = datetime.now(UTC).isoformat(timespec="seconds")
    erreurs = [
        ErreurRecurrente(
            type=erreur.type,
            erreur=erreur.erreur,
            frequence=erreur.frequence,
            derniere_occurrence=date_occurrence,
        )
        for erreur in erreurs_generees
    ]
    session = SessionMemoire(
        identifiant_session=identifiant_session,
        nombre_tours=min(1000, nombre_tours),
        phase_atteinte=resume.phase if resume is not None else phase_pour_tours(nombre_tours),
        resume=resume_ecrit,
    )
    return ChargeMemoireLongTerme(profil=entree.profil, erreurs=erreurs, session=session)


def _resume_neutre(entree: EntreeClotureSession, nombre_tours: int) -> ResumeSession:
    """Résumé minimal quand Redis n'a pas de résumé : aucun contenu n'est inventé."""
    return ResumeSession(
        phase=phase_pour_tours(nombre_tours),
        niveau_effectif=entree.profil.niveau_effectif,
        compteur_tours=min(1000, nombre_tours),
    )


def definir_agent_memoire_chatbot(
    registre_prompts: RegistrePrompts,
) -> DefinitionAgent[EntreeClotureSession, ChargeMemoireLongTerme]:
    """Déclarer la tâche de clôture dans le registre partagé du Harness."""
    version_prompt, empreinte_prompt = registre_prompts.definition("chatbot", "memoire", VERSION_MEMOIRE_CHATBOT)
    return DefinitionAgent(
        code=CODE_AGENT_MEMOIRE_CHATBOT,
        version=VERSION_AGENT_MEMOIRE_CHATBOT,
        schema_entree=EntreeClotureSession,
        schema_sortie=ChargeMemoireLongTerme,
        budget_ms=BUDGET_MEMOIRE_CHATBOT_MS,
        version_prompt=version_prompt,
        empreinte_prompt=empreinte_prompt,
        executer=clore,
    )
