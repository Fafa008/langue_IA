"""REC-03 : recommandations de parcours persistées par le backend (``parcours.recommandation_ia``).

Le service IA reste sans état : seule la colonne JSONB du parcours conserve la proposition validée, l'empreinte de
la requête qui l'a produite (idempotence) et, pour l'audit, l'enveloppe IA brute. Une valeur NULL signifie que
l'apprenant n'a pas encore demandé de recommandation.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20261121_rec_recommandation_ia"
down_revision: str | None = "20261121_us48_exercice_lecon"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("parcours", sa.Column("recommandation_ia", postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column("parcours", "recommandation_ia")
