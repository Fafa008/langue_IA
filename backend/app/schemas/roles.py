"""Schémas de consultation des rôles et de gestion de leurs permissions."""

from pydantic import BaseModel, ConfigDict


class PermissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    description: str


class RoleOut(BaseModel):
    id_role: int
    code: str
    libelle: str
    permissions: list[str]


class RolePermissionsUpdate(BaseModel):
    permissions: list[str]
