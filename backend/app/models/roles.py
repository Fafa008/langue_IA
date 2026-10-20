"""Rôles et permissions utilisés par le contrôle d'accès RBAC."""

from sqlalchemy import Column, ForeignKey, Integer, SmallInteger, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

PERMISSIONS_INITIALES = (
    ("profile:read", "Consulter son propre profil."),
    ("profile:write", "Modifier son propre profil."),
    ("users:read", "Consulter la liste des utilisateurs."),
    ("users:manage", "Modifier le rôle et le statut des utilisateurs."),
    ("trainers:read", "Consulter la liste des formateurs."),
    ("trainers:manage", "Créer et modifier les formateurs."),
    ("pedagogy:manage", "Gérer les langues et les niveaux."),
    ("stats:read", "Consulter les statistiques d'administration."),
    ("roles:manage", "Consulter les rôles et gérer leurs permissions."),
)

DROITS_PAR_ROLE = {
    "APPRENANT": ("profile:read", "profile:write"),
    "FORMATEUR": ("profile:read", "profile:write"),
    "ADMINISTRATEUR": tuple(code for code, _ in PERMISSIONS_INITIALES),
}

role_permission = Table(
    "role_permission",
    Base.metadata,
    Column("id_role", ForeignKey("roles.id_role", ondelete="CASCADE"), primary_key=True),
    Column("id_permission", ForeignKey("permissions.id_permission", ondelete="CASCADE"), primary_key=True),
)


class RoleRBAC(Base):
    __tablename__ = "roles"

    id_role: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True)
    libelle: Mapped[str] = mapped_column(String(100))
    permissions: Mapped[list["Permission"]] = relationship(
        secondary=role_permission, lazy="selectin", order_by="Permission.code"
    )


class Permission(Base):
    __tablename__ = "permissions"

    id_permission: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(80), unique=True)
    description: Mapped[str] = mapped_column(String(255))
