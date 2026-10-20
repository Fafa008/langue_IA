"""Ajoute les rôles, permissions et associations RBAC.

Révision : 20261020_rbac
Précédente : bcf9fe169c84
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20261020_rbac"
down_revision: str | None = "bcf9fe169c84"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


ROLES = [
    {"id_role": 1, "code": "APPRENANT", "libelle": "Apprenant"},
    {"id_role": 2, "code": "FORMATEUR", "libelle": "Formateur"},
    {"id_role": 3, "code": "ADMINISTRATEUR", "libelle": "Administrateur"},
]

PERMISSIONS = [
    {"id_permission": 1, "code": "profile:read", "description": "Consulter son propre profil."},
    {"id_permission": 2, "code": "profile:write", "description": "Modifier son propre profil."},
    {"id_permission": 3, "code": "users:read", "description": "Consulter la liste des utilisateurs."},
    {"id_permission": 4, "code": "users:manage", "description": "Modifier le rôle et le statut des utilisateurs."},
    {"id_permission": 5, "code": "trainers:read", "description": "Consulter la liste des formateurs."},
    {"id_permission": 6, "code": "trainers:manage", "description": "Créer et modifier les formateurs."},
    {"id_permission": 7, "code": "pedagogy:manage", "description": "Gérer les langues et les niveaux."},
    {"id_permission": 8, "code": "stats:read", "description": "Consulter les statistiques d'administration."},
    {"id_permission": 9, "code": "roles:manage", "description": "Consulter les rôles et gérer leurs permissions."},
]

ROLE_PERMISSIONS = [
    (1, 1),
    (1, 2),
    (2, 1),
    (2, 2),
    *((3, id_permission) for id_permission in range(1, 10)),
]


def upgrade() -> None:
    op.create_table(
        "roles",
        sa.Column("id_role", sa.SmallInteger(), nullable=False),
        sa.Column("code", sa.String(length=32), nullable=False),
        sa.Column("libelle", sa.String(length=100), nullable=False),
        sa.PrimaryKeyConstraint("id_role"),
        sa.UniqueConstraint("code"),
    )
    op.create_table(
        "permissions",
        sa.Column("id_permission", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=80), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id_permission"),
        sa.UniqueConstraint("code"),
    )
    op.create_table(
        "role_permission",
        sa.Column("id_role", sa.SmallInteger(), nullable=False),
        sa.Column("id_permission", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["id_permission"], ["permissions.id_permission"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["id_role"], ["roles.id_role"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id_role", "id_permission"),
    )

    roles_table = sa.table(
        "roles",
        sa.column("id_role", sa.SmallInteger()),
        sa.column("code", sa.String()),
        sa.column("libelle", sa.String()),
    )
    permissions_table = sa.table(
        "permissions",
        sa.column("id_permission", sa.Integer()),
        sa.column("code", sa.String()),
        sa.column("description", sa.String()),
    )
    role_permission_table = sa.table(
        "role_permission", sa.column("id_role", sa.SmallInteger()), sa.column("id_permission", sa.Integer())
    )
    op.bulk_insert(roles_table, ROLES)
    op.bulk_insert(permissions_table, PERMISSIONS)
    op.bulk_insert(
        role_permission_table,
        [{"id_role": id_role, "id_permission": id_permission} for id_role, id_permission in ROLE_PERMISSIONS],
    )
    op.execute(
        "SELECT setval(pg_get_serial_sequence('permissions', 'id_permission'), "
        "(SELECT MAX(id_permission) FROM permissions))"
    )
    op.create_foreign_key(
        "fk_utilisateur_role_roles", "utilisateur", "roles", ["role"], ["id_role"], ondelete="RESTRICT"
    )


def downgrade() -> None:
    op.drop_constraint("fk_utilisateur_role_roles", "utilisateur", type_="foreignkey")
    op.drop_table("role_permission")
    op.drop_table("permissions")
    op.drop_table("roles")
