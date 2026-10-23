"""Ajoute les champs publics du contenu des questions (US diagnostic).

Révision : 20261023_diag_qpayload
Précédente : bd6763f7f861
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20261023_diag_qpayload"
down_revision: str | None = "bd6763f7f861"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "question",
        sa.Column("type_reponse", sa.String(length=10), server_default="choix", nullable=False),
    )
    op.alter_column("question", "type_reponse", server_default=None)
    op.add_column("question", sa.Column("choix", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("question", sa.Column("support", sa.Text(), nullable=True))
    op.add_column("question", sa.Column("audio_url", sa.Text(), nullable=True))
    op.add_column("question", sa.Column("audio_texte", sa.Text(), nullable=True))
    op.create_check_constraint(
        "ck_question_type_reponse", "question", "type_reponse IN ('choix', 'texte', 'audio')"
    )
    op.create_index("ix_question_id_langue_id_niveau", "question", ["id_langue", "id_niveau"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_question_id_langue_id_niveau", table_name="question")
    op.drop_constraint("ck_question_type_reponse", "question", type_="check")
    op.drop_column("question", "audio_texte")
    op.drop_column("question", "audio_url")
    op.drop_column("question", "support")
    op.drop_column("question", "choix")
    op.drop_column("question", "type_reponse")
