"""Paquetage Ateliers : Atelier (« animé par » un Formateur, dans une Langue).

Table créée dès le MVP pour le compteur « ateliers programmés » du tableau de bord ;
les routes de gestion des ateliers et des réservations viendront avec leurs user stories.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.enums import EnumEntier, StatutAtelier


class Atelier(Base):
    __tablename__ = "atelier"

    id_atelier: Mapped[int] = mapped_column(primary_key=True)
    date_heure: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    capacite_max: Mapped[int] = mapped_column(Integer)
    niveau_requis: Mapped[str | None] = mapped_column(String(20))
    statut: Mapped[StatutAtelier] = mapped_column(EnumEntier(StatutAtelier), default=StatutAtelier.OUVERT)
    id_langue: Mapped[int] = mapped_column(ForeignKey("langue.id_langue", ondelete="RESTRICT"))
    id_formateur: Mapped[int] = mapped_column(ForeignKey("formateur.id_user", ondelete="RESTRICT"))
