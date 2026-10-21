"""Paquetage Utilisateurs : Utilisateur et ses spécialisations Apprenant, Formateur, Administrateur.

Chaque spécialisation a sa table, liée à `utilisateur` par la même clé (id_user). Un changement de rôle
par l'administrateur crée la ligne de la nouvelle spécialisation et conserve les autres (pas de perte de données).
"""

from datetime import date, datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, SmallInteger, String, Table, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import EnumEntier, Role, StatutUtilisateur
from app.models.pedagogie import Langue

# Langues choisies par l'apprenant à l'inscription (proposition : voir docs/uml/evolutions.md)
apprenant_langue = Table(
    "apprenant_langue",
    Base.metadata,
    Column("id_apprenant", ForeignKey("apprenant.id_user", ondelete="CASCADE"), primary_key=True),
    Column("id_langue", ForeignKey("langue.id_langue", ondelete="RESTRICT"), primary_key=True),
)

# Formateur.langues_enseignees
formateur_langue = Table(
    "formateur_langue",
    Base.metadata,
    Column("id_formateur", ForeignKey("formateur.id_user", ondelete="CASCADE"), primary_key=True),
    Column("id_langue", ForeignKey("langue.id_langue", ondelete="RESTRICT"), primary_key=True),
)


class Utilisateur(Base):
    __tablename__ = "utilisateur"

    id_user: Mapped[int] = mapped_column(primary_key=True)
    nom: Mapped[str] = mapped_column(String(100))
    prenom: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    # Hachage bcrypt, jamais renvoyé par l'API
    mot_de_passe: Mapped[str] = mapped_column(String(255))
    telephone: Mapped[str | None] = mapped_column(String(20))
    role: Mapped[Role] = mapped_column(EnumEntier(Role), ForeignKey("roles.id_role", ondelete="RESTRICT"), index=True)
    statut: Mapped[StatutUtilisateur] = mapped_column(EnumEntier(StatutUtilisateur), default=StatutUtilisateur.ACTIF)
    date_inscription: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    # Chemin servi sous /media (« /media/photos/7-1700000000.jpg ») ou URL complète ; null sans photo
    photo_url: Mapped[str | None] = mapped_column(String(500))

    apprenant: Mapped["Apprenant | None"] = relationship(back_populates="utilisateur", cascade="all, delete-orphan")
    formateur: Mapped["Formateur | None"] = relationship(back_populates="utilisateur", cascade="all, delete-orphan")
    administrateur: Mapped["Administrateur | None"] = relationship(
        back_populates="utilisateur", cascade="all, delete-orphan"
    )


class Apprenant(Base):
    __tablename__ = "apprenant"

    id_user: Mapped[int] = mapped_column(ForeignKey("utilisateur.id_user", ondelete="CASCADE"), primary_key=True)
    date_naissance: Mapped[date | None] = mapped_column(Date)
    pays: Mapped[str | None] = mapped_column(String(100))
    ville: Mapped[str | None] = mapped_column(String(100))
    objectif: Mapped[str | None] = mapped_column(Text)

    utilisateur: Mapped[Utilisateur] = relationship(back_populates="apprenant")
    langues: Mapped[list[Langue]] = relationship(secondary=apprenant_langue, lazy="selectin", order_by=Langue.libelle)
    abonnements: Mapped[list["Abonnement"]] = relationship(  # noqa: F821
        back_populates="apprenant", cascade="all, delete-orphan", order_by="Abonnement.date_debut.desc()"
    )


class Formateur(Base):
    __tablename__ = "formateur"

    id_user: Mapped[int] = mapped_column(ForeignKey("utilisateur.id_user", ondelete="CASCADE"), primary_key=True)
    certifications: Mapped[str | None] = mapped_column(Text)
    type_contrat: Mapped[str | None] = mapped_column(String(50))

    utilisateur: Mapped[Utilisateur] = relationship(back_populates="formateur")
    langues_enseignees: Mapped[list[Langue]] = relationship(secondary=formateur_langue, lazy="selectin")


class Administrateur(Base):
    __tablename__ = "administrateur"

    id_user: Mapped[int] = mapped_column(ForeignKey("utilisateur.id_user", ondelete="CASCADE"), primary_key=True)
    # Signification des valeurs à définir par l'équipe (UML : niveau_acces : int)
    niveau_acces: Mapped[int] = mapped_column(SmallInteger, default=1)

    utilisateur: Mapped[Utilisateur] = relationship(back_populates="administrateur")
