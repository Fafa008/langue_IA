"""Fige la banque de questions sélectionnée au démarrage d'un diagnostic."""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20261125_diag_questions"
down_revision: str | None = "e4b1c7a92d35"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "test_diagnostic",
        sa.Column(
            "questions_ids",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("test_diagnostic", "questions_ids")
