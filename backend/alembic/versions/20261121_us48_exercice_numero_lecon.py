"""Rattache un exercice du catalogue à une leçon du parcours (US48) : colonne ``exercice.numero_lecon``."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20261121_us48_exercice_lecon"
down_revision: str | None = "20261120_us48_progression"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("exercice", sa.Column("numero_lecon", sa.Integer(), nullable=True))
    op.create_check_constraint(
        "ck_exercice_numero_lecon_positif", "exercice", "numero_lecon IS NULL OR numero_lecon >= 1"
    )


def downgrade() -> None:
    op.drop_constraint("ck_exercice_numero_lecon_positif", "exercice", type_="check")
    op.drop_column("exercice", "numero_lecon")
