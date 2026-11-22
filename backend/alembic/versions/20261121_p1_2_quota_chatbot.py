"""Ajoute le compteur de quota du chat par session (P1-2)."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20261121_p1_2_quota_chatbot"
down_revision: str | None = "20261121_us48_exercice_lecon"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "quota_chatbot",
        sa.Column("id_quota", sa.Integer(), nullable=False),
        sa.Column("id_apprenant", sa.Integer(), nullable=False),
        sa.Column("identifiant_session", sa.String(length=64), nullable=False),
        sa.Column("nombre_echanges", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("date_creation", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "date_derniere_conversation", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("nombre_echanges >= 0", name="ck_quota_chatbot_nombre_echanges"),
        sa.ForeignKeyConstraint(
            ["id_apprenant"], ["apprenant.id_user"], name="fk_quota_chatbot_id_apprenant", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id_quota"),
        sa.UniqueConstraint("id_apprenant", "identifiant_session", name="uq_quota_chatbot_apprenant_session"),
    )


def downgrade() -> None:
    op.drop_table("quota_chatbot")
