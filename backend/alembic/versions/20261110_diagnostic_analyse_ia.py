"""Persiste l'analyse IA du diagnostic sur la tentative (PRE-05)."""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20261110_diag_analyse_ia"
# Suite de la migration US45 pour garder une seule tête Alembic sur `develop`.
down_revision: str | None = "20261110_us45_parcours"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("test_diagnostic", sa.Column("analyse_ia", postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column("test_diagnostic", "analyse_ia")
