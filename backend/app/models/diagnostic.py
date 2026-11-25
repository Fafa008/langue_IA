"""Modèles persistants du test de diagnostic linguistique.

Persistance du diagnostic linguistique : les questions sont des exercices de la banque unique
(`app.models.parcours.Exercice`, US-N01), avec une tentative d'apprenant sur une cible (langue +
niveau) et les réponses fournies. L'évaluation, destinée à être renseignée par le service IA,
reste nulle tant qu'elle n'a pas été calculée.
"""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym

from app.core.database import Base
from app.models.enums import EnumEntier, StatutDiagnostic
from app.models.pedagogie import Langue, Niveau

# La table `question` a fusionné dans `exercice` (US-N01). Les anciens attributs sont
# conservés comme alias transitoires sur `Exercice` ; voir `app/models/parcours.py`.


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
    # Questions exactes de cette tentative, ordonnées et figées à son démarrage.
    questions_ids: Mapped[list[int]] = mapped_column(
        JSONB, default=list, server_default=text("'[]'::jsonb"), nullable=False
    )
    # Niveau de référence estimé à l'issue du diagnostic.
    id_niveau_final: Mapped[int | None] = mapped_column(ForeignKey("niveau.id_niveau", ondelete="RESTRICT"))
    # Enveloppe validée de l'agent Diagnostic (PRE-05) ; null tant que l'analyse n'a pas abouti.
    analyse_ia: Mapped[dict | None] = mapped_column(JSONB)

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

    # Une seule réponse par exercice donné dans une même tentative
    __table_args__ = (UniqueConstraint("id_tentative", "id_exercice", name="uq_reponse_tentative_exercice"),)

    id_reponse: Mapped[int] = mapped_column(primary_key=True)
    id_tentative: Mapped[int] = mapped_column(ForeignKey("test_diagnostic.id_test", ondelete="CASCADE"))
    # Un exercice supprimé emporterait l'historique des réponses : refusé tant qu'il est utilisé
    id_exercice: Mapped[int] = mapped_column(
        ForeignKey("exercice.id_exercice", name="fk_reponse_id_exercice", ondelete="RESTRICT"), index=True
    )
    id_question = synonym("id_exercice")  # alias transitoire, contrat IA inchangé (T2)
    reponse_fournie: Mapped[str] = mapped_column(Text)
    # Données d'évaluation (juste/faux, score, commentaire IA) ; null tant qu'elle est en attente
    evaluation: Mapped[dict | None] = mapped_column(JSONB)

    tentative: Mapped[TestDiagnostic] = relationship(back_populates="reponses")
    exercice: Mapped["Exercice"] = relationship()  # noqa: F821
    question = synonym("exercice")
