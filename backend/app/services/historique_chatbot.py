"""Historique de conversation conservé côté backend, 20 tours au plus (D2).

Les messages restent dans la base uniquement pendant la session et sont supprimés à sa fin. Ce service ne
journalise aucun contenu : ni message de l'apprenant, ni réponse de l'assistant.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.chatbot import MessageChatbot
from app.schemas.chatbot import HISTORIQUE_CHATBOT_MAX, MessageHistoriqueChatbotIn


def lire(db: Session, *, id_apprenant: int, identifiant_session: str) -> list[MessageHistoriqueChatbotIn]:
    """Lire les tours de la session dans l'ordre chronologique."""
    messages = db.scalars(
        select(MessageChatbot)
        .where(
            MessageChatbot.id_apprenant == id_apprenant,
            MessageChatbot.identifiant_session == identifiant_session,
        )
        .order_by(MessageChatbot.id_message)
    ).all()
    return [MessageHistoriqueChatbotIn(role=m.role, contenu=m.contenu) for m in messages]


def ajouter_tours(db: Session, *, id_apprenant: int, identifiant_session: str, tours: list[tuple[str, str]]) -> None:
    """Ajouter les tours produits puis conserver les 20 plus récents."""
    for role, contenu in tours:
        db.add(
            MessageChatbot(
                id_apprenant=id_apprenant,
                identifiant_session=identifiant_session,
                role=role,
                contenu=contenu,
            )
        )
    db.flush()

    ids = db.scalars(
        select(MessageChatbot.id_message)
        .where(
            MessageChatbot.id_apprenant == id_apprenant,
            MessageChatbot.identifiant_session == identifiant_session,
        )
        .order_by(MessageChatbot.id_message.desc())
    ).all()
    for id_message in ids[HISTORIQUE_CHATBOT_MAX:]:
        db.delete(db.get(MessageChatbot, id_message))
    db.flush()


def supprimer(db: Session, *, id_apprenant: int, identifiant_session: str) -> None:
    """Supprimer l'historique et le compteur d'une session terminée."""
    messages = db.scalars(
        select(MessageChatbot).where(
            MessageChatbot.id_apprenant == id_apprenant,
            MessageChatbot.identifiant_session == identifiant_session,
        )
    ).all()
    for message in messages:
        db.delete(message)
    db.flush()
