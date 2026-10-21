"""Gestion RBAC : rôles fixes, permissions configurables et contrôle des routes."""

from app.models import Role
from tests.conftest import creer_utilisateur, entete


class TestGestionRoles:
    def test_catalogue_reserve_et_contient_les_trois_roles(self, client, db, admin_entete):
        assert client.get("/api/v1/roles").status_code == 401
        apprenant = creer_utilisateur(db)
        assert client.get("/api/v1/roles", headers=entete(apprenant)).status_code == 403

        reponse = client.get("/api/v1/roles", headers=admin_entete)
        assert reponse.status_code == 200
        roles = {role["code"]: role for role in reponse.json()}
        assert set(roles) == {"APPRENANT", "FORMATEUR", "ADMINISTRATEUR"}
        assert "profile:read" in roles["APPRENANT"]["permissions"]
        assert "roles:manage" in roles["ADMINISTRATEUR"]["permissions"]
        assert client.get("/api/v1/roles/permissions", headers=admin_entete).status_code == 200

    def test_modification_des_permissions_change_immediatement_les_acces(self, client, db, admin_entete):
        formateur = creer_utilisateur(db, role=Role.FORMATEUR)
        roles = {role["code"]: role for role in client.get("/api/v1/roles", headers=admin_entete).json()}
        id_formateur = roles["FORMATEUR"]["id_role"]

        octroi = client.put(
            f"/api/v1/roles/{id_formateur}/permissions",
            headers=admin_entete,
            json={"permissions": ["profile:read", "profile:write", "users:read"]},
        )
        assert octroi.status_code == 200
        assert client.get("/api/v1/users", headers=entete(formateur)).status_code == 200

        retrait = client.put(
            f"/api/v1/roles/{id_formateur}/permissions",
            headers=admin_entete,
            json={"permissions": ["profile:read", "profile:write"]},
        )
        assert retrait.status_code == 200
        assert client.get("/api/v1/users", headers=entete(formateur)).status_code == 403

    def test_valide_roles_permissions_et_preserve_un_gestionnaire(self, client, admin_entete):
        roles = {role["code"]: role for role in client.get("/api/v1/roles", headers=admin_entete).json()}
        id_admin = roles["ADMINISTRATEUR"]["id_role"]

        inconnu = client.put(
            f"/api/v1/roles/{id_admin}/permissions", headers=admin_entete, json={"permissions": ["no:such"]}
        )
        assert inconnu.status_code == 422
        doublon = client.put(
            f"/api/v1/roles/{id_admin}/permissions",
            headers=admin_entete,
            json={"permissions": ["roles:manage", "roles:manage"]},
        )
        assert doublon.status_code == 422
        dernier_gestionnaire = client.put(
            f"/api/v1/roles/{id_admin}/permissions", headers=admin_entete, json={"permissions": []}
        )
        assert dernier_gestionnaire.status_code == 409
        assert (
            client.put("/api/v1/roles/999/permissions", headers=admin_entete, json={"permissions": []}).status_code
            == 404
        )
