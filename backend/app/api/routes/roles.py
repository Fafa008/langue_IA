"""Consultation des rôles et gestion des permissions associées."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DbSession, permission_requise
from app.models import Permission, RoleRBAC, Utilisateur, role_permission
from app.schemas.roles import PermissionOut, RoleOut, RolePermissionsUpdate

router = APIRouter(prefix="/roles", tags=["rôles et permissions"])
GestionRoles = Annotated[Utilisateur, Depends(permission_requise("roles:manage"))]


def _role_out(role: RoleRBAC) -> RoleOut:
    return RoleOut(
        id_role=role.id_role,
        code=role.code,
        libelle=role.libelle,
        permissions=[permission.code for permission in role.permissions],
    )


@router.get("", response_model=list[RoleOut])
def lister_roles(db: DbSession, _admin: GestionRoles) -> list[RoleOut]:
    roles = db.scalars(select(RoleRBAC).options(selectinload(RoleRBAC.permissions)).order_by(RoleRBAC.id_role)).all()
    return [_role_out(role) for role in roles]


@router.get("/permissions", response_model=list[PermissionOut])
def lister_permissions(db: DbSession, _admin: GestionRoles) -> list[Permission]:
    return list(db.scalars(select(Permission).order_by(Permission.code)).all())


@router.put("/{id_role}/permissions", response_model=RoleOut)
def modifier_permissions_role(
    id_role: int, donnees: RolePermissionsUpdate, db: DbSession, _admin: GestionRoles
) -> RoleOut:
    db.scalars(select(RoleRBAC.id_role).order_by(RoleRBAC.id_role).with_for_update()).all()
    role = db.scalar(select(RoleRBAC).options(selectinload(RoleRBAC.permissions)).where(RoleRBAC.id_role == id_role))
    if role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Rôle introuvable.")

    codes = donnees.permissions
    if len(codes) != len(set(codes)):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Une permission ne peut apparaître qu'une seule fois."
        )
    permissions = list(db.scalars(select(Permission).where(Permission.code.in_(codes))).all()) if codes else []
    if len(permissions) != len(codes):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Une ou plusieurs permissions sont inconnues.")

    if "roles:manage" not in codes:
        autre_gestionnaire = db.scalar(
            select(role_permission.c.id_role)
            .join(Permission, Permission.id_permission == role_permission.c.id_permission)
            .where(role_permission.c.id_role != id_role, Permission.code == "roles:manage")
            .limit(1)
        )
        if autre_gestionnaire is None:
            raise HTTPException(status.HTTP_409_CONFLICT, "Au moins un rôle doit conserver la permission roles:manage.")

    role.permissions = permissions
    db.commit()
    return _role_out(role)
