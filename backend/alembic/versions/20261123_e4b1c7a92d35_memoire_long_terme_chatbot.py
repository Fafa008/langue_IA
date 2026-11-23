"""Mémoire long terme du chat et exercices ciblés générés par l'IA (US-IA-CHAT-04).

Le backend seul possède ces tables : le service IA renvoie une charge utile à la clôture d'une session, sans accès
PostgreSQL. Le résumé et les erreurs agrégées remplacent la conservation des messages bruts, supprimés avec la
session. L'origine `systeme:ia_chat` est ajoutée à la banque unique d'exercices pour les exercices ciblés en
brouillon.

Révision : e4b1c7a92d35
Précédente : c1a9e4b7d203
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "e4b1c7a92d35"
down_revision: str | None = "c1a9e4b7d203"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "profil_memoire_chatbot",
        sa.Column("id_profil", sa.Integer(), nullable=False),
        sa.Column("id_apprenant", sa.Integer(), nullable=False),
        sa.Column("profil_id", sa.String(length=128), nullable=False),
        sa.Column("code_langue", sa.String(length=5), nullable=False),
        sa.Column("niveau_effectif", sa.String(length=20), nullable=False),
        sa.Column("date_mise_a_jour", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["id_apprenant"], ["apprenant.id_user"], name="fk_profil_memoire_chatbot_id_apprenant", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id_profil"),
        sa.UniqueConstraint("id_apprenant", name="uq_profil_memoire_chatbot_apprenant"),
        sa.UniqueConstraint("profil_id", name="uq_profil_memoire_chatbot_profil_id"),
    )
    op.create_table(
        "erreur_recurrente_chatbot",
        sa.Column("id_erreur", sa.Integer(), nullable=False),
        sa.Column("id_profil", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("erreur", sa.String(length=120), nullable=False),
        sa.Column("frequence", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column(
            "date_derniere_occurrence", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.CheckConstraint("type IN ('grammaire', 'orthographe', 'syntaxe')", name="ck_erreur_recurrente_chatbot_type"),
        sa.CheckConstraint("frequence > 0", name="ck_erreur_recurrente_chatbot_frequence"),
        sa.ForeignKeyConstraint(
            ["id_profil"],
            ["profil_memoire_chatbot.id_profil"],
            name="fk_erreur_recurrente_chatbot_id_profil",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id_erreur"),
        sa.UniqueConstraint("id_profil", "type", "erreur", name="uq_erreur_recurrente_chatbot_profil_type_erreur"),
    )
    op.create_table(
        "session_memoire_chatbot",
        sa.Column("id_session_memoire", sa.Integer(), nullable=False),
        sa.Column("id_apprenant", sa.Integer(), nullable=False),
        sa.Column("identifiant_session", sa.String(length=64), nullable=False),
        sa.Column("nombre_tours", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("phase_atteinte", sa.String(length=20), nullable=False),
        sa.Column("resume", sa.Text(), nullable=False),
        sa.Column("date_cloture", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("nombre_tours >= 0", name="ck_session_memoire_chatbot_nombre_tours"),
        sa.CheckConstraint("phase_atteinte IN ('impregnation', 'activation')", name="ck_session_memoire_chatbot_phase"),
        sa.ForeignKeyConstraint(
            ["id_apprenant"], ["apprenant.id_user"], name="fk_session_memoire_chatbot_id_apprenant", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id_session_memoire"),
        sa.UniqueConstraint("id_apprenant", "identifiant_session", name="uq_session_memoire_chatbot_apprenant_session"),
    )
    op.drop_constraint("ck_exercice_origine", "exercice", type_="check")
    op.create_check_constraint(
        "ck_exercice_origine",
        "exercice",
        "origine IN ('humain', 'systeme:seed_parcours', 'systeme:seed_diagnostic', 'systeme:ia_chat')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_exercice_origine", "exercice", type_="check")
    op.create_check_constraint(
        "ck_exercice_origine",
        "exercice",
        "origine IN ('humain', 'systeme:seed_parcours', 'systeme:seed_diagnostic')",
    )
    op.drop_table("session_memoire_chatbot")
    op.drop_table("erreur_recurrente_chatbot")
    op.drop_table("profil_memoire_chatbot")
