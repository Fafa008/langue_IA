"""Ajoute les clés de correction et le score final du diagnostic."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20261027_diag_scoring"
down_revision: str | None = "20261023_diag_qpayload"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("question", sa.Column("reponse_correcte", sa.Text(), nullable=True))
    op.create_check_constraint(
        "ck_question_reponse_correcte_choix",
        "question",
        "reponse_correcte IS NULL OR (type_reponse = 'choix' AND choix IS NOT NULL)",
    )
    op.add_column("test_diagnostic", sa.Column("score", sa.Numeric(5, 2), nullable=True))
    op.create_check_constraint(
        "ck_test_diagnostic_score",
        "test_diagnostic",
        "score IS NULL OR (score >= 0 AND score <= 100)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_test_diagnostic_score", "test_diagnostic", type_="check")
    op.drop_column("test_diagnostic", "score")
    op.drop_constraint("ck_question_reponse_correcte_choix", "question", type_="check")
    op.drop_column("question", "reponse_correcte")
