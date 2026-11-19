"""Conserve la dernière réponse libre et son feedback IA sur l'exercice du parcours (US157)."""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20261119_us157_feedback"
down_revision: str | None = "20261110_diag_analyse_ia"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("parcours_exercice", sa.Column("reponse_apprenant", sa.Text(), nullable=True))
    op.add_column("parcours_exercice", sa.Column("feedback_ia", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("parcours_exercice", sa.Column("date_reponse", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("parcours_exercice", "date_reponse")
    op.drop_column("parcours_exercice", "feedback_ia")
    op.drop_column("parcours_exercice", "reponse_apprenant")
