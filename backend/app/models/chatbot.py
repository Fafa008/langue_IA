"""Compteur de quota du chat par session (P1-2)."""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.utilisateurs import Apprenant


class QuotaChatbot(Base):
    """Une ligne par couple apprenant/session : aucun texte de conversation n'est conservé."""

    __tablename__ = "quota_chatbot"
    __table_args__ = (
        CheckConstraint("nombre_echanges >= 0", name="ck_quota_chatbot_nombre_echanges"),
        UniqueConstraint("id_apprenant", "identifiant_session", name="uq_quota_chatbot_apprenant_session"),
    )

    id_quota: Mapped[int] = mapped_column(primary_key=True)
    id_apprenant: Mapped[int] = mapped_column(ForeignKey("apprenant.id_user", ondelete="CASCADE"))
    identifiant_session: Mapped[str] = mapped_column(String(64))
    nombre_echanges: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    date_creation: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    date_derniere_conversation: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    apprenant: Mapped[Apprenant] = relationship()


class JournalChatbot(Base):
    """Journal anonymisé d'un échange : aucun message ni réponse n'est conservé (D3)."""

    __tablename__ = "journal_chatbot"

    id_journal: Mapped[int] = mapped_column(primary_key=True)
    identifiant_session: Mapped[str] = mapped_column(String(64), index=True)
    scenario: Mapped[str | None] = mapped_column(String(20))
    duree_ms: Mapped[int] = mapped_column(Integer)
    modele: Mapped[str] = mapped_column(String(128))
    version_prompt: Mapped[str] = mapped_column(String(128))
    nombre_corrections: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    date_creation: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MessageChatbot(Base):
    """Tour de parole conservé le temps de la session ; jamais inclus dans un journal persistant."""

    __tablename__ = "message_chatbot"
    __table_args__ = (
        CheckConstraint("role IN ('apprenant', 'assistant')", name="ck_message_chatbot_role"),
        Index("ix_message_chatbot_session", "id_apprenant", "identifiant_session", "id_message"),
    )

    id_message: Mapped[int] = mapped_column(primary_key=True)
    id_apprenant: Mapped[int] = mapped_column(ForeignKey("apprenant.id_user", ondelete="CASCADE"))
    identifiant_session: Mapped[str] = mapped_column(String(64))
    role: Mapped[str] = mapped_column(String(10))
    contenu: Mapped[str] = mapped_column(Text)
    date_creation: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    apprenant: Mapped[Apprenant] = relationship()
