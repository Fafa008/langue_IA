"""Administration des formateurs : GET /formateurs, POST /formateurs, PATCH /formateurs/{id_user}."""

from app.core.security import USAGE_REINITIALISATION, lire_jeton
from app.models import Role, StatutUtilisateur
from tests.conftest import creer_utilisateur, entete

# Référentiel chargé avant chaque test : 1 Français, 2 Anglais, 3 Mandarin, 4 Italien, 5 Allemand
NOUVEAU = {
    "prenom": "Lova",
    "nom": "RABE",
    "email": "Lova.Rabe@Digitheque.mg",
    "telephone": "+261 34 12 345 67",
    "type_contrat": "CDD",
    "certifications": "  DALF C1  ",
    "id_langues": [3, 1, 3],
}


def lister(client, en_tete, **params):
    return client.get("/api/v1/formateurs", headers=en_tete, params=params)


def creer(client, en_tete, **champs):
    return client.post("/api/v1/formateurs", headers=en_tete, json={**NOUVEAU, **champs})


def modifier(client, en_tete, id_user, **champs):
    return client.patch(f"/api/v1/formateurs/{id_user}", headers=en_tete, json=champs)


class TestAcces:
    def test_reserve_aux_administrateurs(self, client, db):
        formateur = creer_utilisateur(db, Role.FORMATEUR, email="hery@exemple.com")
        en_tete = entete(formateur)
        assert lister(client, en_tete).status_code == 403
        assert creer(client, en_tete).status_code == 403
        assert modifier(client, en_tete, formateur.id_user, prenom="Jean").status_code == 403
        assert client.get("/api/v1/formateurs").status_code == 401


class TestListe:
    def test_ne_renvoie_que_les_formateurs_tries_par_nom(self, client, db, admin_entete):
        creer_utilisateur(db)  # apprenant
        creer_utilisateur(db, Role.FORMATEUR, email="zo@exemple.com", prenom="Zo", nom="RAKOTOBE")
        creer_utilisateur(db, Role.FORMATEUR, email="hery@exemple.com", prenom="Hery", nom="RANDRIA")
        creer_utilisateur(db, Role.FORMATEUR, email="lova@exemple.com", prenom="Lova", nom="RABE")

        corps = lister(client, admin_entete).json()
        assert corps["total"] == 3
        assert [f["nom"] for f in corps["items"]] == ["RABE", "RAKOTOBE", "RANDRIA"]
        premier = corps["items"][0]
        assert premier["role"] == "FORMATEUR"
        assert {"type_contrat", "certifications", "langues_enseignees"} <= premier.keys()
        assert "mot_de_passe" not in premier

    def test_recherche_filtre_par_statut_et_pagine(self, client, db, admin_entete):
        for i in range(12):
            creer_utilisateur(db, Role.FORMATEUR, email=f"f{i:02d}@exemple.com", nom=f"NOM{i:02d}")
        creer_utilisateur(
            db,
            Role.FORMATEUR,
            email="helene@exemple.com",
            prenom="Hélène",
            nom="RAZAFY",
            statut=StatutUtilisateur.INACTIF,
        )

        assert [f["prenom"] for f in lister(client, admin_entete, search="HELENE").json()["items"]] == ["Hélène"]
        inactifs = lister(client, admin_entete, statut="INACTIF").json()
        assert (inactifs["total"], inactifs["items"][0]["statut"]) == (1, "INACTIF")
        page2 = lister(client, admin_entete, page=2, page_size=10).json()
        assert (page2["total"], len(page2["items"])) == (13, 3)
        assert lister(client, admin_entete, page_size=15).status_code == 422


class TestCreation:
    def test_cree_le_compte_et_envoie_le_lien_pour_choisir_le_mot_de_passe(self, client, admin_entete, monkeypatch):
        envoyes = []
        monkeypatch.setattr("app.api.routes.formateurs.envoyer_invitation_formateur", lambda *a: envoyes.append(a))

        reponse = creer(client, admin_entete)
        assert reponse.status_code == 201
        corps = reponse.json()
        assert (corps["email"], corps["telephone"], corps["role"], corps["statut"]) == (
            "lova.rabe@digitheque.mg",
            "034 12 345 67",
            "FORMATEUR",
            "ACTIF",
        )
        assert (corps["type_contrat"], corps["certifications"]) == ("CDD", "DALF C1")
        assert sorted(lg["code"] for lg in corps["langues_enseignees"]) == ["fr", "zh"]

        # Lien d'invitation : jeton de réinitialisation qui permet de choisir le mot de passe
        [(destinataire, prenom, jeton)] = envoyes
        assert (destinataire, prenom) == ("lova.rabe@digitheque.mg", "Lova")
        assert lire_jeton(jeton, USAGE_REINITIALISATION)["sub"] == str(corps["id_user"])
        assert (
            client.post(
                "/api/v1/auth/reset-password", json={"token": jeton, "nouveau_mot_de_passe": "Formateur2026"}
            ).status_code
            == 204
        )
        login = client.post(
            "/api/v1/auth/login", json={"email": "lova.rabe@digitheque.mg", "mot_de_passe": "Formateur2026"}
        )
        assert login.status_code == 200
        assert lister(client, admin_entete).json()["total"] == 1

    def test_erreurs_409_et_422(self, client, db, admin_entete):
        creer_utilisateur(db, email="lova.rabe@digitheque.mg")
        assert creer(client, admin_entete).status_code == 409

        cas = [
            ({"email": "autre@exemple.com", "id_langues": []}, None),
            ({"email": "autre@exemple.com", "id_langues": [1, 999]}, "Langue inconnue : 999."),
            ({"email": "autre@exemple.com", "type_contrat": "STAGE"}, None),
            ({"email": "autre@exemple.com", "type_contrat": None}, None),
            ({"email": "autre@exemple.com", "certifications": "x" * 501}, "500 caractères"),
            ({"email": "autre@exemple.com", "prenom": "J3an"}, "lettres"),
        ]
        for champs, message in cas:
            reponse = creer(client, admin_entete, **champs)
            assert reponse.status_code == 422, champs
            if message:
                detail = reponse.json()["detail"]
                texte = detail if isinstance(detail, str) else detail[0]["msg"]
                assert message in texte, champs


class TestModification:
    def test_modifie_seulement_les_champs_envoyes_et_remplace_les_langues(self, client, admin_entete):
        cree = creer(client, admin_entete).json()

        reponse = modifier(client, admin_entete, cree["id_user"], type_contrat="CDI", id_langues=[2])
        assert reponse.status_code == 200
        corps = reponse.json()
        assert (corps["prenom"], corps["type_contrat"], corps["certifications"]) == ("Lova", "CDI", "DALF C1")
        assert [lg["code"] for lg in corps["langues_enseignees"]] == ["en"]

        corps = modifier(client, admin_entete, cree["id_user"], telephone=None, certifications="").json()
        assert (corps["telephone"], corps["certifications"]) == (None, None)

    def test_desactiver_bloque_la_connexion_puis_reactiver(self, client, db, admin_entete):
        formateur = creer_utilisateur(db, Role.FORMATEUR, email="hery@exemple.com")
        identifiants = {"email": "hery@exemple.com", "mot_de_passe": "Langue2026"}

        assert modifier(client, admin_entete, formateur.id_user, statut="INACTIF").json()["statut"] == "INACTIF"
        assert client.post("/api/v1/auth/login", json=identifiants).status_code == 403
        assert modifier(client, admin_entete, formateur.id_user, statut="ACTIF").json()["statut"] == "ACTIF"
        assert client.post("/api/v1/auth/login", json=identifiants).status_code == 200

    def test_erreurs_404_409_et_422(self, client, db, admin_entete):
        apprenant = creer_utilisateur(db)
        formateur = creer_utilisateur(db, Role.FORMATEUR, email="hery@exemple.com")

        assert modifier(client, admin_entete, 9999, prenom="Jean").status_code == 404
        # Un utilisateur d'un autre rôle n'est pas un formateur
        assert modifier(client, admin_entete, apprenant.id_user, prenom="Jean").status_code == 404
        assert modifier(client, admin_entete, formateur.id_user, email="rova@exemple.com").status_code == 409
        assert modifier(client, admin_entete, formateur.id_user, id_langues=[]).status_code == 422
        assert modifier(client, admin_entete, formateur.id_user, id_langues=[999]).status_code == 422
