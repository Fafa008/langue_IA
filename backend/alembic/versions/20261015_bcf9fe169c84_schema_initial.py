"""Schéma initial : utilisateurs, pédagogie (langues, niveaux), facturation (formules, abonnements), ateliers.

Les colonnes role / statut sont des SMALLINT : codes définis dans app/models/enums.py (CODES).

Révision : bcf9fe169c84
Précédente :
Créée le : 2026-10-15 06:23:21.518910
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "bcf9fe169c84"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Recherche insensible aux accents (« coreen » trouve « Coréen ») : app/services/recherche.py
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent")
    op.create_table(
        "formule",
        sa.Column("id_formule", sa.Integer(), nullable=False),
        sa.Column("libelle", sa.String(length=100), nullable=False),
        sa.Column("prix_mensuel", sa.Float(), nullable=False),
        sa.Column("duree_mois", sa.Integer(), nullable=False),
        sa.Column("quota_heures", sa.Integer(), nullable=False),
        sa.Column("quota_ateliers", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id_formule"),
    )
    op.create_table(
        "langue",
        sa.Column("id_langue", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=3), nullable=False),
        sa.Column("libelle", sa.String(length=100), nullable=False),
        sa.PrimaryKeyConstraint("id_langue"),
        sa.UniqueConstraint("code"),
    )
    op.create_table(
        "niveau",
        sa.Column("id_niveau", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=20), nullable=False),
        sa.Column("libelle", sa.String(length=100), nullable=False),
        sa.PrimaryKeyConstraint("id_niveau"),
        sa.UniqueConstraint("code"),
    )
    op.create_table(
        "utilisateur",
        sa.Column("id_user", sa.Integer(), nullable=False),
        sa.Column("nom", sa.String(length=100), nullable=False),
        sa.Column("prenom", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("mot_de_passe", sa.String(length=255), nullable=False),
        sa.Column("telephone", sa.String(length=20), nullable=True),
        sa.Column("role", sa.SmallInteger(), nullable=False),
        sa.Column("statut", sa.SmallInteger(), nullable=False),
        sa.Column("date_inscription", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("photo_url", sa.String(length=500), nullable=True),
        sa.PrimaryKeyConstraint("id_user"),
    )
    op.create_index(op.f("ix_utilisateur_date_inscription"), "utilisateur", ["date_inscription"], unique=False)
    op.create_index(op.f("ix_utilisateur_email"), "utilisateur", ["email"], unique=True)
    op.create_index(op.f("ix_utilisateur_role"), "utilisateur", ["role"], unique=False)
    op.create_table(
        "administrateur",
        sa.Column("id_user", sa.Integer(), nullable=False),
        sa.Column("niveau_acces", sa.SmallInteger(), nullable=False),
        sa.ForeignKeyConstraint(["id_user"], ["utilisateur.id_user"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id_user"),
    )
    op.create_table(
        "apprenant",
        sa.Column("id_user", sa.Integer(), nullable=False),
        sa.Column("date_naissance", sa.Date(), nullable=True),
        sa.Column("pays", sa.String(length=100), nullable=True),
        sa.Column("ville", sa.String(length=100), nullable=True),
        sa.Column("objectif", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["id_user"], ["utilisateur.id_user"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id_user"),
    )
    op.create_table(
        "formateur",
        sa.Column("id_user", sa.Integer(), nullable=False),
        sa.Column("certifications", sa.Text(), nullable=True),
        sa.Column("type_contrat", sa.String(length=50), nullable=True),
        sa.ForeignKeyConstraint(["id_user"], ["utilisateur.id_user"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id_user"),
    )
    op.create_table(
        "formule_langue",
        sa.Column("id_formule", sa.Integer(), nullable=False),
        sa.Column("id_langue", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["id_formule"], ["formule.id_formule"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["id_langue"], ["langue.id_langue"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id_formule", "id_langue"),
    )
    op.create_table(
        "langue_niveau",
        sa.Column("id_langue", sa.Integer(), nullable=False),
        sa.Column("id_niveau", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["id_langue"], ["langue.id_langue"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["id_niveau"], ["niveau.id_niveau"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id_langue", "id_niveau"),
    )
    op.create_table(
        "abonnement",
        sa.Column("id_abonnement", sa.Integer(), nullable=False),
        sa.Column("id_apprenant", sa.Integer(), nullable=False),
        sa.Column("id_formule", sa.Integer(), nullable=False),
        sa.Column("date_debut", sa.Date(), nullable=False),
        sa.Column("date_fin", sa.Date(), nullable=False),
        sa.Column("statut", sa.SmallInteger(), nullable=False),
        sa.Column("quota_heures", sa.Integer(), nullable=False),
        sa.Column("quota_ateliers", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["id_apprenant"], ["apprenant.id_user"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["id_formule"], ["formule.id_formule"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id_abonnement"),
    )
    op.create_index(op.f("ix_abonnement_id_apprenant"), "abonnement", ["id_apprenant"], unique=False)
    op.create_table(
        "apprenant_langue",
        sa.Column("id_apprenant", sa.Integer(), nullable=False),
        sa.Column("id_langue", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["id_apprenant"], ["apprenant.id_user"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["id_langue"], ["langue.id_langue"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id_apprenant", "id_langue"),
    )
    op.create_table(
        "atelier",
        sa.Column("id_atelier", sa.Integer(), nullable=False),
        sa.Column("date_heure", sa.DateTime(timezone=True), nullable=False),
        sa.Column("capacite_max", sa.Integer(), nullable=False),
        sa.Column("niveau_requis", sa.String(length=20), nullable=True),
        sa.Column("statut", sa.SmallInteger(), nullable=False),
        sa.Column("id_langue", sa.Integer(), nullable=False),
        sa.Column("id_formateur", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["id_formateur"], ["formateur.id_user"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["id_langue"], ["langue.id_langue"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id_atelier"),
    )
    op.create_index(op.f("ix_atelier_date_heure"), "atelier", ["date_heure"], unique=False)
    op.create_table(
        "formateur_langue",
        sa.Column("id_formateur", sa.Integer(), nullable=False),
        sa.Column("id_langue", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["id_formateur"], ["formateur.id_user"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["id_langue"], ["langue.id_langue"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id_formateur", "id_langue"),
    )


def downgrade() -> None:
    op.drop_table("formateur_langue")
    op.drop_index(op.f("ix_atelier_date_heure"), table_name="atelier")
    op.drop_table("atelier")
    op.drop_table("apprenant_langue")
    op.drop_index(op.f("ix_abonnement_id_apprenant"), table_name="abonnement")
    op.drop_table("abonnement")
    op.drop_table("langue_niveau")
    op.drop_table("formule_langue")
    op.drop_table("formateur")
    op.drop_table("apprenant")
    op.drop_table("administrateur")
    op.drop_index(op.f("ix_utilisateur_role"), table_name="utilisateur")
    op.drop_index(op.f("ix_utilisateur_email"), table_name="utilisateur")
    op.drop_index(op.f("ix_utilisateur_date_inscription"), table_name="utilisateur")
    op.drop_table("utilisateur")
    op.drop_table("niveau")
    op.drop_table("langue")
    op.drop_table("formule")
    op.execute("DROP EXTENSION IF EXISTS unaccent")
