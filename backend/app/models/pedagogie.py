"""Paquetage Pédagogie : Langue, Niveau et l'association LangueNiveau (docs/uml/evolutions.md)."""

from sqlalchemy import Column, ForeignKey, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

# Niveaux ouverts pour chaque langue : supprimés avec la langue ou avec le niveau (cascade)
langue_niveau = Table(
    "langue_niveau",
    Base.metadata,
    Column("id_langue", ForeignKey("langue.id_langue", ondelete="CASCADE"), primary_key=True),
    Column("id_niveau", ForeignKey("niveau.id_niveau", ondelete="CASCADE"), primary_key=True),
)


class Niveau(Base):
    __tablename__ = "niveau"

    id_niveau: Mapped[int] = mapped_column(primary_key=True)
    # « A1 », « HSK 3 »
    code: Mapped[str] = mapped_column(String(20), unique=True)
    libelle: Mapped[str] = mapped_column(String(100))


class Langue(Base):
    __tablename__ = "langue"

    id_langue: Mapped[int] = mapped_column(primary_key=True)
    # Code ISO 639 en minuscules : « fr », « zh »
    code: Mapped[str] = mapped_column(String(3), unique=True)
    libelle: Mapped[str] = mapped_column(String(100))

    # Pas de relation inverse vers les formules, apprenants ou formateurs : leurs clés étrangères
    # (ON DELETE RESTRICT) empêchent alors la suppression d'une langue utilisée.
    niveaux: Mapped[list[Niveau]] = relationship(secondary=langue_niveau, lazy="selectin", order_by=Niveau.code)
