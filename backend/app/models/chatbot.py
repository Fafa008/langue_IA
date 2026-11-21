"""Compteur de quota du chat par session (P1-2)."""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, UniqueConstraint, func, text
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
