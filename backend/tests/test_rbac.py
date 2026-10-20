"""RBAC (US12) : rôles, permissions et révocation des accès.

Le RBAC du projet est à rôles fixes : `Utilisateur.role` (APPRENANT, FORMATEUR, ADMINISTRATEUR),
sans table de permissions. Deux dépendances FastAPI portent le contrôle : `utilisateur_connecte`
(401 si le jeton est absent/invalide ou le compte non actif) puis `administrateur_connecte` (403).
Le jeton JWT ne porte que l'identifiant : le rôle et le statut sont relu(e)s en base à chaque
requête, d'où l'effet immédiat de la suspension ou du changement de rôle.
"""

import pytest
from sqlalchemy import select

from app.core.security import verifier_mot_de_passe
from app.models import Role, StatutUtilisateur, Utilisateur
from app.seed import charger_comptes_demo
from tests.conftest import creer_utilisateur, entete

# Chaque route réservée à l'administrateur, avec une variante « id inexistant » : le contrôle
# de rôle doit être déclenché avant toute logique de route (403, jamais 404).
ROUTES_ADMIN = [
    ("GET", "/api/v1/users", None),
    ("PATCH", "/api/v1/users/9999", {}),
    ("GET", "/api/v1/formateurs", None),
    ("POST", "/api/v1/formateurs", {}),
    ("PATCH", "/api/v1/formateurs/9999", {}),
    ("GET", "/api/v1/langues", None),
    ("POST", "/api/v1/langues", {}),
    ("PATCH", "/api/v1/langues/9999", {}),
    ("DELETE", "/api/v1/langues/9999", None),
    ("GET", "/api/v1/niveaux", None),
    ("POST", "/api/v1/niveaux", {}),
    ("PATCH", "/api/v1/niveaux/9999", {}),
    ("DELETE", "/api/v1/niveaux/9999", None),
    ("GET", "/api/v1/admin/statistiques", None),
    ("GET", "/api/v1/admin/statistiques/inscriptions", None),
]


class TestMatricePermissions:
    @pytest.mark.parametrize("role", [Role.APPRENANT, Role.FORMATEUR])
    @pytest.mark.parametrize("methode, url, corps", ROUTES_ADMIN)
    def test_les_routes_admin_sont_refusees_aux_autres_roles(self, client, db, role, methode, url, corps):
        """N'importe quelle route admin refuse l'apprenant et le formateur, écriture comprise."""
        en_tete = entete(creer_utilisateur(db, role, email=f"{role.name.lower()}@exemple.com"))
        assert client.request(methode, url, headers=en_tete, json=corps).status_code == 403

    @pytest.mark.parametrize(
        "methode, url, corps",
        [
            ("GET", "/api/v1/users", None),
            ("POST", "/api/v1/langues", {}),
            ("GET", "/api/v1/admin/statistiques", None),
        ],
    )
    def test_les_routes_admin_refusent_une_requete_sans_jeton(self, client, methode, url, corps):
        """`utilisateur_connecte` est la porte d'entrée commune : 401 avant toute vérification de rôle."""
        assert client.request(methode, url, json=corps).status_code == 401


class TestRevocationImmediate:
    def test_suspension_revoque_les_droits_deja_delivres(self, client, db, admin, admin_entete):
        """Un jeton émis tant que le compte était actif est refusé dès la suspension."""
        assert client.get("/api/v1/users", headers=admin_entete).status_code == 200

        # Un autre administrateur suspend le compte (l'interdiction ne vaut que sur soi-même)
        second = creer_utilisateur(db, Role.ADMINISTRATEUR, email="autre.admin@exemple.com")
        reponse = client.patch(f"/api/v1/users/{admin.id_user}", headers=entete(second), json={"statut": "SUSPENDU"})
        assert reponse.status_code == 200

        assert client.get("/api/v1/users", headers=admin_entete).status_code == 401

    def test_retrogradation_retire_immediatement_l_acces_administrateur(self, client, db, admin, admin_entete):
        """Le jeton reste valide mais le rôle relu en base retire les droits : 403, pas 401."""
        cible = creer_utilisateur(db, Role.ADMINISTRATEUR, email="cible@exemple.com")
        en_tete_cible = entete(cible)
        assert client.get("/api/v1/users", headers=en_tete_cible).status_code == 200

        reponse = client.patch(f"/api/v1/users/{cible.id_user}", headers=admin_entete, json={"role": "APPRENANT"})
        assert reponse.status_code == 200

        assert client.get("/api/v1/users", headers=en_tete_cible).status_code == 403


class TestInscription:
    def test_un_role_supplie_dans_le_corps_est_ignore(self, client, db):
        """POST /auth/register crée toujours un apprenant : impossible de s'attribuer un rôle."""
        corps = {
            "prenom": "Rova",
            "nom": "RAKOTO",
            "email": "rova@exemple.com",
            "mot_de_passe": "Langue2026",
            "date_naissance": "2000-05-01",
            "langues": ["en"],
            "id_formule": 1,
            "role": "ADMINISTRATEUR",  # champs non prévus par RegisterIn : ignorés
            "statut": "SUSPENDU",
        }
        reponse = client.post("/api/v1/auth/register", json=corps)

        assert reponse.status_code == 201
        assert reponse.json()["role"] == "APPRENANT"
        cree = db.scalar(select(Utilisateur).where(Utilisateur.email == "rova@exemple.com"))
        assert cree.role == Role.APPRENANT
        assert cree.statut == StatutUtilisateur.ACTIF
        assert cree.administrateur is None  # aucune spécialisation administrateur créée


class TestComptesDemo:
    def test_les_roles_initiaux_sont_surs_et_reproductibles(self, db):
        """Un compte par rôle, mot de passe bcrypt jamais en clair, seed rejouable sans doublon."""
        charger_comptes_demo(db)

        comptes = {u.email: u for u in db.scalars(select(Utilisateur)).all()}
        assert set(comptes) == {"apprenant@digitheque.mg", "formateur@digitheque.mg", "admin@digitheque.mg"}
        admin = comptes["admin@digitheque.mg"]
        assert admin.role == Role.ADMINISTRATEUR
        assert admin.administrateur is not None
        assert admin.mot_de_passe.startswith("$2")  # hachage bcrypt, jamais le clair
        assert verifier_mot_de_passe("Demo2026", admin.mot_de_passe) is True

        ids_avant = [u.id_user for u in db.scalars(select(Utilisateur))]
        charger_comptes_demo(db)
        assert [u.id_user for u in db.scalars(select(Utilisateur))] == ids_avant
