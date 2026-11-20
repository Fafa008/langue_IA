"""Modèles persistants des parcours pédagogiques et de leurs exercices."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.diagnostic import TestDiagnostic
from app.models.enums import EnumEntier, StatutParcours, TypeExercice
from app.models.pedagogie import Langue, Niveau
from app.services.phase_parcours import PhaseParcours, est_lecon_de_revision, phase_parcours


class Parcours(Base):
    __tablename__ = "parcours"
    __table_args__ = (
        CheckConstraint("lecon_atteinte >= 1", name="ck_parcours_lecon_atteinte_positive"),
        UniqueConstraint("id_test", name="uq_parcours_id_test"),
    )

    id_parcours: Mapped[int] = mapped_column(primary_key=True)
    id_test: Mapped[int] = mapped_column(
        ForeignKey("test_diagnostic.id_test", name="fk_parcours_id_test"),
    )
    id_langue: Mapped[int] = mapped_column(ForeignKey("langue.id_langue", name="fk_parcours_id_langue"))
    id_niveau_vise: Mapped[int] = mapped_column(
        ForeignKey("niveau.id_niveau", name="fk_parcours_id_niveau_vise"),
    )
    date_creation: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    statut: Mapped[StatutParcours] = mapped_column(
        EnumEntier(StatutParcours),
        default=StatutParcours.EN_COURS,
        server_default=text("1"),
    )
    lecon_atteinte: Mapped[int] = mapped_column(Integer, default=1, server_default=text("1"))

    test_diagnostic: Mapped[TestDiagnostic] = relationship()
    langue: Mapped[Langue] = relationship()
    niveau_vise: Mapped[Niveau] = relationship()
    parcours_exercices: Mapped[list[ParcoursExercice]] = relationship(
        back_populates="parcours",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    @property
    def phase(self) -> PhaseParcours:
        return phase_parcours(self.lecon_atteinte)

    @property
    def est_lecon_de_revision(self) -> bool:
        return est_lecon_de_revision(self.lecon_atteinte)


class Exercice(Base):
    __tablename__ = "exercice"
    __table_args__ = (
        CheckConstraint("difficulte BETWEEN 1 AND 5", name="ck_exercice_difficulte_1_5"),
        CheckConstraint("numero_lecon IS NULL OR numero_lecon >= 1", name="ck_exercice_numero_lecon_positif"),
    )

    id_exercice: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[TypeExercice] = mapped_column(EnumEntier(TypeExercice))
    contenu: Mapped[str] = mapped_column(Text)
    difficulte: Mapped[int] = mapped_column(Integer)
    id_langue: Mapped[int] = mapped_column(ForeignKey("langue.id_langue", name="fk_exercice_id_langue"))
    id_niveau: Mapped[int] = mapped_column(ForeignKey("niveau.id_niveau", name="fk_exercice_id_niveau"))
    # Leçon à laquelle l'exercice est rattaché (US48). NULL : exercice du catalogue sans leçon fixée.
    numero_lecon: Mapped[int | None] = mapped_column(Integer)

    langue: Mapped[Langue] = relationship()
    niveau: Mapped[Niveau] = relationship()
    parcours_exercices: Mapped[list[ParcoursExercice]] = relationship(
        back_populates="exercice",
        passive_deletes="all",
    )


class ParcoursExercice(Base):
    __tablename__ = "parcours_exercice"
    __table_args__ = (
        CheckConstraint("numero_lecon >= 1", name="ck_parcours_exercice_numero_lecon_positive"),
        CheckConstraint(
            "score_obtenu IS NULL OR score_obtenu BETWEEN 0 AND 100",
            name="ck_parcours_exercice_score_0_100",
        ),
        UniqueConstraint(
            "id_parcours",
            "numero_lecon",
            "id_exercice",
            name="uq_parcours_exercice_parcours_lecon_exercice",
        ),
    )

    id_parcours_exercice: Mapped[int] = mapped_column(primary_key=True)
    id_parcours: Mapped[int] = mapped_column(
        ForeignKey("parcours.id_parcours", ondelete="CASCADE", name="fk_parcours_exercice_id_parcours"),
    )
    id_exercice: Mapped[int] = mapped_column(
        ForeignKey("exercice.id_exercice", ondelete="RESTRICT", name="fk_parcours_exercice_id_exercice"),
    )
    numero_lecon: Mapped[int] = mapped_column(Integer)
    score_obtenu: Mapped[int | None] = mapped_column(Integer)
    # US157 : dernière réponse libre et enveloppe du feedback IA validée (la correction suivante les remplace)
    reponse_apprenant: Mapped[str | None] = mapped_column(Text)
    feedback_ia: Mapped[dict | None] = mapped_column(JSONB)
    date_reponse: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    parcours: Mapped[Parcours] = relationship(back_populates="parcours_exercices")
    exercice: Mapped[Exercice] = relationship(back_populates="parcours_exercices")


class ProgressionLecon(Base):
    """Progression sur une leçon (US48) : dernier et meilleur score de leçon, validation.

    Le score de leçon est calculé par ``services/progression_lecon.py`` ; la validation se lit sur ``best_score``.
    """

    __tablename__ = "progression_lecon"
    __table_args__ = (
        CheckConstraint("numero_lecon >= 1", name="ck_progression_lecon_numero_lecon_positif"),
        CheckConstraint(
            "last_score IS NULL OR last_score BETWEEN 0 AND 100", name="ck_progression_lecon_last_score_0_100"
        ),
        CheckConstraint(
            "best_score IS NULL OR best_score BETWEEN 0 AND 100", name="ck_progression_lecon_best_score_0_100"
        ),
        UniqueConstraint("id_parcours", "numero_lecon", name="uq_progression_lecon_parcours_lecon"),
    )

    id_progression: Mapped[int] = mapped_column(primary_key=True)
    id_parcours: Mapped[int] = mapped_column(
        ForeignKey("parcours.id_parcours", ondelete="CASCADE", name="fk_progression_lecon_id_parcours"),
    )
    numero_lecon: Mapped[int] = mapped_column(Integer)
    last_score: Mapped[int | None] = mapped_column(Integer)
    best_score: Mapped[int | None] = mapped_column(Integer)
    is_validated: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
