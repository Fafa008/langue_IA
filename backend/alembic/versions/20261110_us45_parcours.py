"""US45 tables parcours, exercice, parcours_exercice."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20261110_us45_parcours"
down_revision: str | None = "20261027_diag_scoring"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "parcours",
        sa.Column("id_parcours", sa.Integer(), nullable=False),
        sa.Column("id_test", sa.Integer(), nullable=False),
        sa.Column("id_langue", sa.Integer(), nullable=False),
        sa.Column("id_niveau_vise", sa.Integer(), nullable=False),
        sa.Column("date_creation", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("statut", sa.SmallInteger(), server_default=sa.text("1"), nullable=False),
        sa.Column("lecon_atteinte", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.CheckConstraint("lecon_atteinte >= 1", name="ck_parcours_lecon_atteinte_positive"),
        sa.ForeignKeyConstraint(["id_langue"], ["langue.id_langue"], name="fk_parcours_id_langue"),
        sa.ForeignKeyConstraint(["id_niveau_vise"], ["niveau.id_niveau"], name="fk_parcours_id_niveau_vise"),
        sa.ForeignKeyConstraint(["id_test"], ["test_diagnostic.id_test"], name="fk_parcours_id_test"),
        sa.PrimaryKeyConstraint("id_parcours"),
        sa.UniqueConstraint("id_test", name="uq_parcours_id_test"),
    )
    op.create_table(
        "exercice",
        sa.Column("id_exercice", sa.Integer(), nullable=False),
        sa.Column("type", sa.SmallInteger(), nullable=False),
        sa.Column("contenu", sa.Text(), nullable=False),
        sa.Column("difficulte", sa.Integer(), nullable=False),
        sa.Column("id_langue", sa.Integer(), nullable=False),
        sa.Column("id_niveau", sa.Integer(), nullable=False),
        sa.CheckConstraint("difficulte BETWEEN 1 AND 5", name="ck_exercice_difficulte_1_5"),
        sa.ForeignKeyConstraint(["id_langue"], ["langue.id_langue"], name="fk_exercice_id_langue"),
        sa.ForeignKeyConstraint(["id_niveau"], ["niveau.id_niveau"], name="fk_exercice_id_niveau"),
        sa.PrimaryKeyConstraint("id_exercice"),
    )
    op.create_table(
        "parcours_exercice",
        sa.Column("id_parcours_exercice", sa.Integer(), nullable=False),
        sa.Column("id_parcours", sa.Integer(), nullable=False),
        sa.Column("id_exercice", sa.Integer(), nullable=False),
        sa.Column("numero_lecon", sa.Integer(), nullable=False),
        sa.Column("score_obtenu", sa.Integer(), nullable=True),
        sa.CheckConstraint("numero_lecon >= 1", name="ck_parcours_exercice_numero_lecon_positive"),
        sa.CheckConstraint(
            "score_obtenu IS NULL OR score_obtenu BETWEEN 0 AND 100",
            name="ck_parcours_exercice_score_0_100",
        ),
        sa.ForeignKeyConstraint(
            ["id_exercice"],
            ["exercice.id_exercice"],
            name="fk_parcours_exercice_id_exercice",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["id_parcours"],
            ["parcours.id_parcours"],
            name="fk_parcours_exercice_id_parcours",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id_parcours_exercice"),
        sa.UniqueConstraint(
            "id_parcours",
            "numero_lecon",
            "id_exercice",
            name="uq_parcours_exercice_parcours_lecon_exercice",
        ),
    )


def downgrade() -> None:
    op.drop_table("parcours_exercice")
    op.drop_table("exercice")
    op.drop_table("parcours")
