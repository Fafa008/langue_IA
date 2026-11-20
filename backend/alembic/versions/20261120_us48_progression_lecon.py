"""Progression par leçon : dernier et meilleur score de leçon, validation (US48)."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20261120_us48_progression"
down_revision: str | None = "20261119_us157_feedback"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "progression_lecon",
        sa.Column("id_progression", sa.Integer(), primary_key=True),
        sa.Column("id_parcours", sa.Integer(), nullable=False),
        sa.Column("numero_lecon", sa.Integer(), nullable=False),
        sa.Column("last_score", sa.Integer(), nullable=True),
        sa.Column("best_score", sa.Integer(), nullable=True),
        sa.Column("is_validated", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.CheckConstraint("numero_lecon >= 1", name="ck_progression_lecon_numero_lecon_positif"),
        sa.CheckConstraint(
            "last_score IS NULL OR last_score BETWEEN 0 AND 100", name="ck_progression_lecon_last_score_0_100"
        ),
        sa.CheckConstraint(
            "best_score IS NULL OR best_score BETWEEN 0 AND 100", name="ck_progression_lecon_best_score_0_100"
        ),
        sa.ForeignKeyConstraint(
            ["id_parcours"],
            ["parcours.id_parcours"],
            name="fk_progression_lecon_id_parcours",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("id_parcours", "numero_lecon", name="uq_progression_lecon_parcours_lecon"),
    )


def downgrade() -> None:
    op.drop_table("progression_lecon")
