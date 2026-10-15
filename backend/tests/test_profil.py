"""Profil de l'utilisateur connecté : GET/PATCH /users/me, photo."""

import base64

from app.models import StatutUtilisateur
from tests.conftest import MOT_DE_PASSE, creer_utilisateur, entete

# Plus petit PNG valide (1 × 1 pixel)
PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)


class TestSession:
    def test_401_sans_jeton_ou_avec_un_jeton_invalide(self, client):
        assert client.get("/api/v1/users/me").status_code == 401
        assert client.get("/api/v1/users/me", headers={"Authorization": "Bearer faux"}).status_code == 401

    def test_401_si_le_compte_a_ete_desactive_depuis_la_connexion(self, client, db):
        utilisateur = creer_utilisateur(db)
        en_tete = entete(utilisateur)
        utilisateur.statut = StatutUtilisateur.INACTIF
        db.commit()
        assert client.get("/api/v1/users/me", headers=en_tete).status_code == 401

    def test_renvoie_l_utilisateur_connecte(self, client, db):
        utilisateur = creer_utilisateur(db)
        corps = client.get("/api/v1/users/me", headers=entete(utilisateur)).json()
        assert corps["id_user"] == utilisateur.id_user
        assert corps["photo_url"] is None


class TestModification:
    def test_met_a_jour_les_informations_et_normalise_le_telephone(self, client, db):
        utilisateur = creer_utilisateur(db)
        reponse = client.patch(
            "/api/v1/users/me",
            headers=entete(utilisateur),
            json={
                "prenom": "  Rova   Marie ",
                "nom": "RAKOTO",
                "email": "rova@exemple.com",
                "telephone": "+261 34 12 345 67",
            },
        )
        assert reponse.status_code == 200, reponse.text
        assert reponse.json()["prenom"] == "Rova Marie"
        assert reponse.json()["telephone"] == "034 12 345 67"

    def test_telephone_null_retire_le_numero(self, client, db):
        utilisateur = creer_utilisateur(db)
        client.patch("/api/v1/users/me", headers=entete(utilisateur), json={"telephone": "034 12 345 67"})
        reponse = client.patch("/api/v1/users/me", headers=entete(utilisateur), json={"telephone": None})
        assert reponse.json()["telephone"] is None

    def test_le_role_et_le_statut_ne_sont_pas_modifiables(self, client, db):
        utilisateur = creer_utilisateur(db)
        corps = client.patch(
            "/api/v1/users/me", headers=entete(utilisateur), json={"role": "ADMINISTRATEUR", "statut": "INACTIF"}
        ).json()
        assert (corps["role"], corps["statut"]) == ("APPRENANT", "ACTIF")

    def test_mot_de_passe_actuel_incorrect_400_et_rien_n_est_modifie(self, client, db):
        utilisateur = creer_utilisateur(db)
        reponse = client.patch(
            "/api/v1/users/me",
            headers=entete(utilisateur),
            json={"prenom": "Autre", "mot_de_passe": "Nouveau2026", "mot_de_passe_actuel": "Faux2026"},
        )
        # 400 et surtout pas 401 (qui déconnecterait l'utilisateur)
        assert reponse.status_code == 400
        assert client.get("/api/v1/users/me", headers=entete(utilisateur)).json()["prenom"] == "Rova"

    def test_change_le_mot_de_passe_avec_le_mot_de_passe_actuel(self, client, db):
        utilisateur = creer_utilisateur(db)
        reponse = client.patch(
            "/api/v1/users/me",
            headers=entete(utilisateur),
            json={"mot_de_passe": "Nouveau2026", "mot_de_passe_actuel": MOT_DE_PASSE},
        )
        assert reponse.status_code == 200
        login = client.post("/api/v1/auth/login", json={"email": "rova@exemple.com", "mot_de_passe": "Nouveau2026"})
        assert login.status_code == 200

    def test_email_deja_utilise_409(self, client, db):
        utilisateur = creer_utilisateur(db)
        creer_utilisateur(db, email="autre@exemple.com")
        reponse = client.patch("/api/v1/users/me", headers=entete(utilisateur), json={"email": "autre@exemple.com"})
        assert reponse.status_code == 409


class TestPhoto:
    def test_envoi_service_puis_suppression(self, client, db):
        utilisateur = creer_utilisateur(db)
        reponse = client.post(
            "/api/v1/users/me/photo", headers=entete(utilisateur), files={"photo": ("photo.png", PNG, "image/png")}
        )
        assert reponse.status_code == 200, reponse.text
        url = reponse.json()["photo_url"]
        assert url.startswith(f"/media/photos/{utilisateur.id_user}-") and url.endswith(".png")
        # Le fichier est servi en lecture publique
        assert client.get(url).content == PNG

        reponse = client.delete("/api/v1/users/me/photo", headers=entete(utilisateur))
        assert reponse.json()["photo_url"] is None
        assert client.get(url).status_code == 404

    def test_refuse_un_format_non_image_415_et_un_fichier_trop_lourd_413(self, client, db):
        utilisateur = creer_utilisateur(db)
        texte = client.post(
            "/api/v1/users/me/photo",
            headers=entete(utilisateur),
            files={"photo": ("photo.jpg", b"pas une image", "image/jpeg")},
        )
        assert texte.status_code == 415
        lourd = client.post(
            "/api/v1/users/me/photo",
            headers=entete(utilisateur),
            files={"photo": ("photo.png", PNG + b"0" * (2 * 1024 * 1024), "image/png")},
        )
        assert lourd.status_code == 413
