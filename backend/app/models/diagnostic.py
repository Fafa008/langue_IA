"""Modèles persistants du test de diagnostic linguistique.

Persistance du diagnostic linguistique : banque de questions par langue et niveau, tentative d'un
apprenant sur une cible (langue + niveau) et réponses fournies. L'évaluation, destinée à être
renseignée par le service IA, reste nulle tant qu'elle n'a pas été calculée.
"""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import EnumEntier, StatutDiagnostic
from app.models.pedagogie import Langue, Niveau


class Question(Base):
    __tablename__ = "question"
    __table_args__ = (
        CheckConstraint("type_reponse IN ('choix', 'texte', 'audio')", name="ck_question_type_reponse"),
        CheckConstraint(
            "reponse_correcte IS NULL OR (type_reponse = 'choix' AND choix IS NOT NULL)",
            name="ck_question_reponse_correcte_choix",
        ),
        Index("ix_question_id_langue_id_niveau", "id_langue", "id_niveau"),
    )

    id_question: Mapped[int] = mapped_column(primary_key=True)
    enonce: Mapped[str] = mapped_column(Text)
    # Compétence évaluée (« compréhension orale », « expression écrite »…) : vocabulaire ouvert,
    # à confirmer avec l'équipe avant de figer une énumération (comme Administrateur.niveau_acces)
    competence: Mapped[str] = mapped_column(String(50))
    type_reponse: Mapped[str] = mapped_column(String(10), default="choix")
    choix: Mapped[list[str] | None] = mapped_column(JSONB)
    # Clé privée du scoring déterministe, jamais incluse dans QuestionOut.
    reponse_correcte: Mapped[str | None] = mapped_column(Text)
    support: Mapped[str | None] = mapped_column(Text)
    audio_url: Mapped[str | None] = mapped_column(Text)
    audio_texte: Mapped[str | None] = mapped_column(Text)
    id_langue: Mapped[int] = mapped_column(ForeignKey("langue.id_langue", ondelete="RESTRICT"))
    # Une question d'une langue ne porte que des niveaux ouverts pour cette langue (contrôle des routes)
    id_niveau: Mapped[int] = mapped_column(ForeignKey("niveau.id_niveau", ondelete="RESTRICT"))

    # Pas de relation inverse depuis Langue ou Niveau : les clés étrangères ON DELETE RESTRICT
    # empêchent seules la suppression d'une langue ou d'un niveau encore utilisés.
    langue: Mapped[Langue] = relationship()
    niveau: Mapped[Niveau] = relationship()


class TestDiagnostic(Base):
    __tablename__ = "test_diagnostic"
    __table_args__ = (
        CheckConstraint("score IS NULL OR (score >= 0 AND score <= 100)", name="ck_test_diagnostic_score"),
    )

    id_test: Mapped[int] = mapped_column(primary_key=True)
    id_apprenant: Mapped[int] = mapped_column(ForeignKey("apprenant.id_user", ondelete="CASCADE"), index=True)
    id_langue: Mapped[int] = mapped_column(ForeignKey("langue.id_langue", ondelete="RESTRICT"))
    id_niveau: Mapped[int] = mapped_column(ForeignKey("niveau.id_niveau", ondelete="RESTRICT"))
    statut: Mapped[StatutDiagnostic] = mapped_column(EnumEntier(StatutDiagnostic), default=StatutDiagnostic.EN_COURS)
    date_debut: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    date_fin: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Pourcentage déterministe sur 100, calculé à la clôture du test.
    score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    # Niveau de référence estimé à l'issue du diagnostic.
    id_niveau_final: Mapped[int | None] = mapped_column(ForeignKey("niveau.id_niveau", ondelete="RESTRICT"))

    apprenant: Mapped["Apprenant"] = relationship()  # noqa: F821
    langue: Mapped[Langue] = relationship()
    niveau: Mapped[Niveau] = relationship(foreign_keys=[id_niveau])
    niveau_final: Mapped[Niveau | None] = relationship(foreign_keys=[id_niveau_final])
    # Supprimées avec la tentative ; les réponses d'un apprenant supprimé partent donc en cascade
    reponses: Mapped[list["Reponse"]] = relationship(
        back_populates="tentative", cascade="all, delete-orphan", order_by="Reponse.id_reponse"
    )


class Reponse(Base):
    __tablename__ = "reponse"

    # Une seule réponse par question donnée dans une même tentative
    __table_args__ = (UniqueConstraint("id_tentative", "id_question"),)

    id_reponse: Mapped[int] = mapped_column(primary_key=True)
    id_tentative: Mapped[int] = mapped_column(ForeignKey("test_diagnostic.id_test", ondelete="CASCADE"))
    # Une question supprimée emporterait l'historique des réponses : refusée tant qu'elle est utilisée
    id_question: Mapped[int] = mapped_column(ForeignKey("question.id_question", ondelete="RESTRICT"), index=True)
    reponse_fournie: Mapped[str] = mapped_column(Text)
    # Données d'évaluation (juste/faux, score, commentaire IA) ; null tant qu'elle est en attente
    evaluation: Mapped[dict | None] = mapped_column(JSONB)

    tentative: Mapped[TestDiagnostic] = relationship(back_populates="reponses")
    question: Mapped[Question] = relationship()
