"""Quota d'échanges du chat par session (P1-2).

Le compteur ne contient aucun contenu d'apprenant : ni message, ni réponse, ni historique. La suppression
d'une ligne correspond à la fin de la session (D2).
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.chatbot import QuotaChatbot


class QuotaDepasseChatbot(Exception):
    """La session a atteint le nombre maximal d'échanges autorisé."""


def obtenir_quota(
    db: Session, *, id_apprenant: int, identifiant_session: str, creer: bool = True
) -> QuotaChatbot | None:
    """Lire le compteur d'une session, éventuellement en le créant."""
    quota = db.scalar(
        select(QuotaChatbot).where(
            QuotaChatbot.id_apprenant == id_apprenant,
            QuotaChatbot.identifiant_session == identifiant_session,
        )
    )
    if quota is None and creer:
        quota = QuotaChatbot(id_apprenant=id_apprenant, identifiant_session=identifiant_session, nombre_echanges=0)
        db.add(quota)
        db.flush()
    return quota


def consommer_echange(db: Session, *, id_apprenant: int, identifiant_session: str) -> QuotaChatbot:
    """Réserver un échange, ou lever ``QuotaDepasseChatbot`` sans modifier le compteur."""
    limite = get_settings().chatbot_quota_echanges
    quota = obtenir_quota(db, id_apprenant=id_apprenant, identifiant_session=identifiant_session)
    assert quota is not None
    if quota.nombre_echanges >= limite:
        raise QuotaDepasseChatbot
    quota.nombre_echanges += 1
    db.flush()
    return quota


def terminer_session(db: Session, *, id_apprenant: int, identifiant_session: str) -> None:
    """Supprimer le compteur à la fin de la session."""
    quota = obtenir_quota(db, id_apprenant=id_apprenant, identifiant_session=identifiant_session, creer=False)
    if quota is not None:
        db.delete(quota)
        db.flush()
