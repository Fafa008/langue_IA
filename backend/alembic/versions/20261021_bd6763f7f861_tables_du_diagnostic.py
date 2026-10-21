"""Ajoute les tables du diagnostic : question, test_diagnostic et reponse (US34).

Création seule, sans modification ni suppression de tables existantes (non destructive) ;
le downgrade retire exactement ces trois tables.

Révision : bd6763f7f861
Précédente : 20261020_rbac
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "bd6763f7f861"
down_revision: str | None = "20261020_rbac"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "question",
        sa.Column("id_question", sa.Integer(), nullable=False),
        sa.Column("enonce", sa.Text(), nullable=False),
        sa.Column("competence", sa.String(length=50), nullable=False),
        sa.Column("id_langue", sa.Integer(), nullable=False),
        sa.Column("id_niveau", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["id_langue"], ["langue.id_langue"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["id_niveau"], ["niveau.id_niveau"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id_question"),
    )
    op.create_table(
        "test_diagnostic",
        sa.Column("id_test", sa.Integer(), nullable=False),
        sa.Column("id_apprenant", sa.Integer(), nullable=False),
        sa.Column("id_langue", sa.Integer(), nullable=False),
        sa.Column("id_niveau", sa.Integer(), nullable=False),
        sa.Column("statut", sa.SmallInteger(), nullable=False),
        sa.Column("date_debut", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("date_fin", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id_niveau_final", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["id_apprenant"], ["apprenant.id_user"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["id_langue"], ["langue.id_langue"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["id_niveau"], ["niveau.id_niveau"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["id_niveau_final"], ["niveau.id_niveau"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id_test"),
    )
    op.create_index(op.f("ix_test_diagnostic_id_apprenant"), "test_diagnostic", ["id_apprenant"], unique=False)
    op.create_table(
        "reponse",
        sa.Column("id_reponse", sa.Integer(), nullable=False),
        sa.Column("id_tentative", sa.Integer(), nullable=False),
        sa.Column("id_question", sa.Integer(), nullable=False),
        sa.Column("reponse_fournie", sa.Text(), nullable=False),
        sa.Column("evaluation", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(["id_question"], ["question.id_question"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["id_tentative"], ["test_diagnostic.id_test"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id_reponse"),
        sa.UniqueConstraint("id_tentative", "id_question"),
    )
    op.create_index(op.f("ix_reponse_id_question"), "reponse", ["id_question"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_reponse_id_question"), table_name="reponse")
    op.drop_table("reponse")
    op.drop_index(op.f("ix_test_diagnostic_id_apprenant"), table_name="test_diagnostic")
    op.drop_table("test_diagnostic")
    op.drop_table("question")
