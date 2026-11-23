"""Quota, journal, historique volatil et mémoire long terme du chat (P1-2, US-IA-CHAT-04).

Seul le backend possède ces tables PostgreSQL. Le service IA renvoie une charge utile typée à la clôture ; aucun
message brut n'est conservé au-delà de la session, et le profil persistant est pseudonyme.
"""

from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
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


class ProfilMemoireChatbot(Base):
    """Profil pseudonyme d'un apprenant, alimenté par la clôture d'une session de chat."""

    __tablename__ = "profil_memoire_chatbot"
    __table_args__ = (
        UniqueConstraint("id_apprenant", name="uq_profil_memoire_chatbot_apprenant"),
        UniqueConstraint("profil_id", name="uq_profil_memoire_chatbot_profil_id"),
    )

    id_profil: Mapped[int] = mapped_column(primary_key=True)
    id_apprenant: Mapped[int] = mapped_column(ForeignKey("apprenant.id_user", ondelete="CASCADE"))
    profil_id: Mapped[str] = mapped_column(String(128))
    code_langue: Mapped[str] = mapped_column(String(5))
    niveau_effectif: Mapped[str] = mapped_column(String(20))
    date_mise_a_jour: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    apprenant: Mapped[Apprenant] = relationship()
    erreurs: Mapped[list["ErreurRecurrenteChatbot"]] = relationship(
        back_populates="profil", cascade="all, delete-orphan", passive_deletes=True
    )


class ErreurRecurrenteChatbot(Base):
    """Erreur pédagogique agrégée au fil des sessions, sans extrait de conversation brute."""

    __tablename__ = "erreur_recurrente_chatbot"
    __table_args__ = (
        CheckConstraint("type IN ('grammaire', 'orthographe', 'syntaxe')", name="ck_erreur_recurrente_chatbot_type"),
        CheckConstraint("frequence > 0", name="ck_erreur_recurrente_chatbot_frequence"),
        UniqueConstraint("id_profil", "type", "erreur", name="uq_erreur_recurrente_chatbot_profil_type_erreur"),
    )

    id_erreur: Mapped[int] = mapped_column(primary_key=True)
    id_profil: Mapped[int] = mapped_column(ForeignKey("profil_memoire_chatbot.id_profil", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(20))
    erreur: Mapped[str] = mapped_column(String(120))
    frequence: Mapped[int] = mapped_column(Integer, default=1, server_default=text("1"))
    date_derniere_occurrence: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    profil: Mapped[ProfilMemoireChatbot] = relationship(back_populates="erreurs")


class SessionMemoireChatbot(Base):
    """Bilan d'une session clôturée ; le texte du journal reste limité au résumé pédagogique."""

    __tablename__ = "session_memoire_chatbot"
    __table_args__ = (
        CheckConstraint("nombre_tours >= 0", name="ck_session_memoire_chatbot_nombre_tours"),
        CheckConstraint(
            "phase_atteinte IN ('impregnation', 'activation')",
            name="ck_session_memoire_chatbot_phase",
        ),
        UniqueConstraint(
            "id_apprenant",
            "identifiant_session",
            name="uq_session_memoire_chatbot_apprenant_session",
        ),
    )

    id_session_memoire: Mapped[int] = mapped_column(primary_key=True)
    id_apprenant: Mapped[int] = mapped_column(
        ForeignKey("apprenant.id_user", ondelete="CASCADE"),
    )
    identifiant_session: Mapped[str] = mapped_column(String(64))
    nombre_tours: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    phase_atteinte: Mapped[str] = mapped_column(String(20))
    resume: Mapped[str] = mapped_column(Text)
    date_cloture: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    apprenant: Mapped[Apprenant] = relationship()
