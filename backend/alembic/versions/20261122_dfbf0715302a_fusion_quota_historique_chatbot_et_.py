"""Fusionne les branches Alembic du chatbot (quota/historique) et de la recommandation (REC-00)."""

from collections.abc import Sequence

revision: str = "dfbf0715302a"
down_revision: str | tuple[str, ...] | None = ("20261121_p3_3_historique_chatbot", "20261121_rec_recommandation_ia")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
