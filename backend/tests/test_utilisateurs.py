"""Administration des utilisateurs : GET /users et PATCH /users/{id_user}."""

from app.models import Role
from tests.conftest import creer_utilisateur, entete


def lister(client, en_tete, **params):
    return client.get("/api/v1/users", headers=en_tete, params=params)


class TestAcces:
    def test_reserve_aux_administrateurs(self, client, db):
        apprenant = creer_utilisateur(db)
        assert lister(client, entete(apprenant)).status_code == 403
        assert client.patch(f"/api/v1/users/{apprenant.id_user}", headers=entete(apprenant), json={}).status_code == 403


class TestListe:
    def test_pagine_et_compte_toutes_les_pages(self, client, db, admin_entete):
        for i in range(24):
            creer_utilisateur(db, email=f"user{i:02d}@exemple.com", nom=f"NOM{i:02d}")
        corps = lister(client, admin_entete, page=3, page_size=10).json()
        assert corps["total"] == 25  # 24 + l'administrateur
        assert (corps["page"], corps["page_size"], len(corps["items"])) == (3, 10, 5)

    def test_recherche_sans_tenir_compte_de_la_casse_ni_des_accents(self, client, db, admin_entete):
        creer_utilisateur(db, email="helene@exemple.com", prenom="Hélène", nom="RAZAFY")
        creer_utilisateur(db, email="paul@exemple.com", prenom="Paul", nom="RABE")
        noms = [u["prenom"] for u in lister(client, admin_entete, search="HELENE").json()["items"]]
        assert noms == ["Hélène"]
        assert lister(client, admin_entete, search="paul@exemple").json()["total"] == 1

    def test_filtre_par_role(self, client, db, admin_entete):
        creer_utilisateur(db)
        creer_utilisateur(db, Role.FORMATEUR, email="hery@exemple.com")
        corps = lister(client, admin_entete, role="FORMATEUR").json()
        assert [u["role"] for u in corps["items"]] == ["FORMATEUR"]

    def test_taille_de_page_limitee_a_10_20_ou_50(self, client, admin_entete):
        assert lister(client, admin_entete, page_size=15).status_code == 422


class TestModification:
    def test_modifie_seulement_les_champs_envoyes(self, client, db, admin_entete):
        cible = creer_utilisateur(db)
        reponse = client.patch(f"/api/v1/users/{cible.id_user}", headers=admin_entete, json={"prenom": "Jean"})
        assert reponse.status_code == 200
        assert (reponse.json()["prenom"], reponse.json()["nom"]) == ("Jean", "RAKOTO")

    def test_changer_de_role_cree_la_specialisation(self, client, db, admin_entete):
        cible = creer_utilisateur(db)
        reponse = client.patch(f"/api/v1/users/{cible.id_user}", headers=admin_entete, json={"role": "FORMATEUR"})
        assert reponse.json()["role"] == "FORMATEUR"
        db.refresh(cible)
        assert cible.formateur is not None

    def test_desactiver_un_compte_bloque_la_connexion(self, client, db, admin_entete):
        cible = creer_utilisateur(db)
        reponse = client.patch(f"/api/v1/users/{cible.id_user}", headers=admin_entete, json={"statut": "INACTIF"})
        assert reponse.json()["statut"] == "INACTIF"
        login = client.post("/api/v1/auth/login", json={"email": "rova@exemple.com", "mot_de_passe": "Langue2026"})
        assert login.status_code == 403

    def test_erreurs_404_et_409(self, client, db, admin_entete):
        creer_utilisateur(db)
        autre = creer_utilisateur(db, email="autre@exemple.com")
        assert client.patch("/api/v1/users/9999", headers=admin_entete, json={"prenom": "Jean"}).status_code == 404
        reponse = client.patch(
            f"/api/v1/users/{autre.id_user}", headers=admin_entete, json={"email": "rova@exemple.com"}
        )
        assert reponse.status_code == 409

    def test_un_administrateur_ne_peut_ni_se_desactiver_ni_changer_son_role(self, client, admin, admin_entete):
        url = f"/api/v1/users/{admin.id_user}"
        assert client.patch(url, headers=admin_entete, json={"statut": "INACTIF"}).status_code == 403
        assert client.patch(url, headers=admin_entete, json={"role": "APPRENANT"}).status_code == 403
        # Mais il peut modifier ses autres informations
        assert (
            client.patch(url, headers=admin_entete, json={"prenom": "Fanja", "role": "ADMINISTRATEUR"}).status_code
            == 200
        )
