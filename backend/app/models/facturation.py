"""Paquetage Facturation : Formule (et les langues qu'elle couvre) et Abonnement."""

from datetime import date

from sqlalchemy import Column, Date, Float, ForeignKey, Integer, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import EnumEntier, StatutAbonnement
from app.models.pedagogie import Langue

# Formule.langues : aucune ligne = la formule couvre toutes les langues
formule_langue = Table(
    "formule_langue",
    Base.metadata,
    Column("id_formule", ForeignKey("formule.id_formule", ondelete="CASCADE"), primary_key=True),
    Column("id_langue", ForeignKey("langue.id_langue", ondelete="RESTRICT"), primary_key=True),
)


class Formule(Base):
    __tablename__ = "formule"

    id_formule: Mapped[int] = mapped_column(primary_key=True)
    libelle: Mapped[str] = mapped_column(String(100))
    prix_mensuel: Mapped[float] = mapped_column(Float)
    duree_mois: Mapped[int] = mapped_column(Integer)
    quota_heures: Mapped[int] = mapped_column(Integer)
    quota_ateliers: Mapped[int] = mapped_column(Integer)

    langues: Mapped[list[Langue]] = relationship(secondary=formule_langue, lazy="selectin", order_by=Langue.libelle)


class Abonnement(Base):
    __tablename__ = "abonnement"

    id_abonnement: Mapped[int] = mapped_column(primary_key=True)
    id_apprenant: Mapped[int] = mapped_column(ForeignKey("apprenant.id_user", ondelete="CASCADE"), index=True)
    id_formule: Mapped[int] = mapped_column(ForeignKey("formule.id_formule", ondelete="RESTRICT"))
    date_debut: Mapped[date] = mapped_column(Date)
    date_fin: Mapped[date] = mapped_column(Date)
    statut: Mapped[StatutAbonnement] = mapped_column(EnumEntier(StatutAbonnement), default=StatutAbonnement.ACTIF)
    # Quotas copiés de la formule à la souscription (une formule modifiée plus tard ne change pas l'abonnement)
    quota_heures: Mapped[int] = mapped_column(Integer)
    quota_ateliers: Mapped[int] = mapped_column(Integer)

    apprenant: Mapped["Apprenant"] = relationship(back_populates="abonnements")  # noqa: F821
    formule: Mapped[Formule] = relationship(lazy="joined")
