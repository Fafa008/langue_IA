"""Ajoute l'historique temporaire du chat et son journal anonymisé (P3-3, P5)."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20261121_p3_3_historique_chatbot"
down_revision: str | None = "20261121_p1_2_quota_chatbot"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "message_chatbot",
        sa.Column("id_message", sa.Integer(), nullable=False),
        sa.Column("id_apprenant", sa.Integer(), nullable=False),
        sa.Column("identifiant_session", sa.String(length=64), nullable=False),
        sa.Column("role", sa.String(length=10), nullable=False),
        sa.Column("contenu", sa.Text(), nullable=False),
        sa.Column("date_creation", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("role IN ('apprenant', 'assistant')", name="ck_message_chatbot_role"),
        sa.ForeignKeyConstraint(
            ["id_apprenant"], ["apprenant.id_user"], name="fk_message_chatbot_id_apprenant", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id_message"),
    )
    op.create_index(
        "ix_message_chatbot_session", "message_chatbot", ["id_apprenant", "identifiant_session", "id_message"]
    )
    op.create_table(
        "journal_chatbot",
        sa.Column("id_journal", sa.Integer(), nullable=False),
        sa.Column("identifiant_session", sa.String(length=64), nullable=False),
        sa.Column("scenario", sa.String(length=20), nullable=True),
        sa.Column("duree_ms", sa.Integer(), nullable=False),
        sa.Column("modele", sa.String(length=128), nullable=False),
        sa.Column("version_prompt", sa.String(length=128), nullable=False),
        sa.Column("nombre_corrections", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("date_creation", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id_journal"),
    )
    op.create_index("ix_journal_chatbot_identifiant_session", "journal_chatbot", ["identifiant_session"])


def downgrade() -> None:
    op.drop_index("ix_journal_chatbot_identifiant_session", table_name="journal_chatbot")
    op.drop_table("journal_chatbot")
    op.drop_index("ix_message_chatbot_session", table_name="message_chatbot")
    op.drop_table("message_chatbot")
