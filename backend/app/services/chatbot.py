"""Orchestration du chat apprenant (US67/US74).

Le backend reste l'autorité : il authentifie, lit le niveau depuis le parcours, applique le quota, appelle le
service IA sans transaction PostgreSQL ouverte, revalide le bloc ``corrections[]`` puis enregistre l'historique de
session et un journal sans texte brut. Aucun contenu n'est journalisé.
"""

import logging
import time
from enum import StrEnum
from uuid import uuid4

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.models.chatbot import JournalChatbot
from app.schemas.chatbot import ChatbotMessageIn, ChatbotMessageOut, ChatbotSessionSupprimeeOut
from app.schemas.ia import (
    ContexteApprenantIA,
    EntreeChatbotIA,
    MessageHistoriqueChatbotIA,
    RequeteChatbotIA,
    ResultatChatbotIA,
)
from app.services.analyse_diagnostic import LANGUES_IA, NIVEAUX_IA
from app.services.historique_chatbot import ajouter_tours, lire, supprimer
from app.services.ia import ErreurServiceIA, envoyer_message_chatbot
from app.services.lecture_parcours import parcours_en_cours
from app.services.parcours import niveau_estime, referentiel_de_langue
from app.services.quota_chatbot import QuotaDepasseChatbot, consommer_echange, terminer_session

logger = logging.getLogger(__name__)


class CodeErreurChatbot(StrEnum):
    PARCOURS_INCONNU = "parcours_inconnu"
    LANGUE_NON_PRISE_EN_CHARGE = "langue_non_prise_en_charge"
    QUOTA_DEPASSE = "quota_depasse"
    IA_TIMEOUT = "ia_timeout"
    IA_INDISPONIBLE = "ia_indisponible"
    IA_REPONSE_INVALIDE = "ia_reponse_invalide"


class ErreurChatbot(Exception):
    def __init__(self, code: CodeErreurChatbot) -> None:
        self.code = code
        super().__init__(code.value)


_CODE_IA = {
    "timeout": CodeErreurChatbot.IA_TIMEOUT,
    "indisponible": CodeErreurChatbot.IA_INDISPONIBLE,
    "non_configure": CodeErreurChatbot.IA_INDISPONIBLE,
    "reponse_invalide": CodeErreurChatbot.IA_REPONSE_INVALIDE,
}


def _code_pour_erreur_ia(code: str) -> CodeErreurChatbot:
    if code in _CODE_IA:
        return _CODE_IA[code]
    if code.startswith("http_"):
        return CodeErreurChatbot.IA_INDISPONIBLE
    return CodeErreurChatbot.IA_REPONSE_INVALIDE


def _normaliser(texte: str) -> str:
    return " ".join(texte.split()).casefold()


def verifier_corrections(resultat: ResultatChatbotIA, message: str) -> bool:
    """Les corrections citent le message de l'apprenant et restent au nombre de trois au plus."""
    if len(resultat.corrections) > 3:
        return False
    texte = _normaliser(message)
    return all(_normaliser(correction.extrait) in texte for correction in resultat.corrections)


def envoyer_message(id_user: int, corps: ChatbotMessageIn) -> ChatbotMessageOut:
    """Répondre à un message du chat, ou lever ``ErreurChatbot`` sans exposer de contenu dans les journaux."""
    debut = time.monotonic()
    with SessionLocal() as db:
        parcours = parcours_en_cours(db, id_user)
        if parcours is None:
            raise ErreurChatbot(CodeErreurChatbot.PARCOURS_INCONNU)
        code_langue = parcours.langue.code
        referentiel = referentiel_de_langue(code_langue)
        niveau = niveau_estime(parcours.test_diagnostic).code
        if code_langue not in LANGUES_IA or niveau not in NIVEAUX_IA[referentiel]:
            raise ErreurChatbot(CodeErreurChatbot.LANGUE_NON_PRISE_EN_CHARGE)

        historique = lire(db, id_apprenant=id_user, identifiant_session=corps.identifiant_session)
        try:
            quota = consommer_echange(db, id_apprenant=id_user, identifiant_session=corps.identifiant_session)
        except QuotaDepasseChatbot:
            raise ErreurChatbot(CodeErreurChatbot.QUOTA_DEPASSE) from None
        db.commit()
        quota_restant = max(0, get_settings().chatbot_quota_echanges - quota.nombre_echanges)
        contexte = ContexteApprenantIA(
            code_langue=code_langue,
            referentiel=referentiel,
            niveau_preliminaire=niveau,
        )

    requete = RequeteChatbotIA(
        request_id=uuid4(),
        contexte=contexte,
        entree=EntreeChatbotIA(
            message=corps.message,
            historique=[MessageHistoriqueChatbotIA(role=tour.role, contenu=tour.contenu) for tour in historique],
        ),
    )
    try:
        enveloppe = envoyer_message_chatbot(requete)
    except ErreurServiceIA as erreur:
        logger.warning("Chat IA indisponible (code=%s)", erreur.code)
        raise ErreurChatbot(_code_pour_erreur_ia(erreur.code)) from None

    resultat = enveloppe.resultat
    if not verifier_corrections(resultat, corps.message):
        logger.warning("Corrections IA incohérentes refusées")
        raise ErreurChatbot(CodeErreurChatbot.IA_REPONSE_INVALIDE)

    duree_ms = max(0, int(round((time.monotonic() - debut) * 1000)))
    with SessionLocal() as db:
        ajouter_tours(
            db,
            id_apprenant=id_user,
            identifiant_session=corps.identifiant_session,
            tours=[("apprenant", corps.message), ("assistant", resultat.reponse)],
        )
        db.add(
            JournalChatbot(
                identifiant_session=corps.identifiant_session,
                scenario=None,
                duree_ms=duree_ms,
                modele=enveloppe.meta.modele,
                version_prompt=enveloppe.version_prompt,
                nombre_corrections=len(resultat.corrections),
            )
        )
        db.commit()

    return ChatbotMessageOut(
        reponse=resultat.reponse,
        corrections=[correction.model_dump() for correction in resultat.corrections],
        quota_restant=quota_restant,
        version_prompt=enveloppe.version_prompt,
    )


def terminer_session_chat(id_user: int, identifiant_session: str) -> ChatbotSessionSupprimeeOut:
    """Supprimer l'historique et le quota d'une session ; le journal anonymisé reste intact."""
    with SessionLocal() as db:
        supprimer(db, id_apprenant=id_user, identifiant_session=identifiant_session)
        terminer_session(db, id_apprenant=id_user, identifiant_session=identifiant_session)
        db.commit()
    return ChatbotSessionSupprimeeOut()
