"""Authentification : POST /auth/login, /auth/register, /auth/forgot-password, /auth/reset-password."""

from sqlalchemy import select

from app.core.security import creer_jeton_acces, creer_jeton_reinitialisation
from app.models import Abonnement, Role, StatutAbonnement, StatutUtilisateur, Utilisateur
from tests.conftest import MOT_DE_PASSE, creer_utilisateur

INSCRIPTION = {
    "prenom": "Rova",
    "nom": "RAKOTO",
    "email": "Rova@Exemple.com",
    "mot_de_passe": "Langue2026",
    "date_naissance": "2000-05-01",
    "langues": ["en", "zh"],
    "id_formule": 2,
}


def connexion(client, email="rova@exemple.com", mot_de_passe=MOT_DE_PASSE):
    return client.post("/api/v1/auth/login", json={"email": email, "mot_de_passe": mot_de_passe})


class TestConnexion:
    def test_renvoie_le_jeton_et_l_utilisateur_sans_mot_de_passe(self, client, db):
        creer_utilisateur(db)
        reponse = connexion(client, email=" ROVA@exemple.com ")

        assert reponse.status_code == 200
        corps = reponse.json()
        assert corps["token_type"] == "bearer" and corps["access_token"]
        assert corps["utilisateur"]["email"] == "rova@exemple.com"
        assert corps["utilisateur"]["role"] == "APPRENANT"
        assert corps["utilisateur"]["statut"] == "ACTIF"
        assert "mot_de_passe" not in corps["utilisateur"]

    def test_meme_refus_401_pour_un_mauvais_mot_de_passe_et_un_email_inconnu(self, client, db):
        creer_utilisateur(db)
        assert connexion(client, mot_de_passe="Mauvais2026").status_code == 401
        assert connexion(client, email="inconnu@exemple.com").status_code == 401

    def test_refuse_un_compte_inactif_ou_suspendu_avec_403(self, client, db):
        creer_utilisateur(db, email="inactif@exemple.com", statut=StatutUtilisateur.INACTIF)
        creer_utilisateur(db, email="suspendu@exemple.com", statut=StatutUtilisateur.SUSPENDU)
        assert connexion(client, email="inactif@exemple.com").status_code == 403
        assert connexion(client, email="suspendu@exemple.com").status_code == 403


class TestInscription:
    def test_cree_l_apprenant_ses_langues_et_son_abonnement(self, client, db):
        reponse = client.post("/api/v1/auth/register", json=INSCRIPTION)

        assert reponse.status_code == 201, reponse.text
        corps = reponse.json()
        assert corps["email"] == "rova@exemple.com"
        assert corps["role"] == "APPRENANT"
        assert corps["date_naissance"] == "2000-05-01"
        assert {"pays", "ville", "objectif"} <= corps.keys()
        assert "mot_de_passe" not in corps

        utilisateur = db.scalar(select(Utilisateur).where(Utilisateur.email == "rova@exemple.com"))
        assert sorted(langue.code for langue in utilisateur.apprenant.langues) == ["en", "zh"]
        abonnement = db.scalar(select(Abonnement).where(Abonnement.id_apprenant == utilisateur.id_user))
        assert abonnement.statut == StatutAbonnement.ACTIF
        assert abonnement.formule.libelle == "Luxe"
        assert (abonnement.quota_heures, abonnement.quota_ateliers) == (12, 3)
        # L'apprenant peut ensuite se connecter
        assert connexion(client).status_code == 200

    def test_refuse_un_email_deja_utilise_avec_409(self, client, db):
        creer_utilisateur(db)
        assert client.post("/api/v1/auth/register", json=INSCRIPTION).status_code == 409

    def test_refuse_une_formule_ou_une_langue_inconnue_avec_422(self, client):
        assert client.post("/api/v1/auth/register", json={**INSCRIPTION, "id_formule": 999}).status_code == 422
        reponse = client.post("/api/v1/auth/register", json={**INSCRIPTION, "langues": ["xx"]})
        assert reponse.status_code == 422
        assert "xx" in reponse.json()["detail"]

    def test_applique_les_regles_du_frontend(self, client):
        cas = [
            ({"mot_de_passe": "court1A"}, "au moins 8 caractères"),
            ({"mot_de_passe": "toutminuscule1"}, "une majuscule et une minuscule"),
            ({"mot_de_passe": "SansChiffre"}, "un chiffre"),
            ({"prenom": "Rova2"}, "Le prénom ne doit contenir que des lettres"),
            ({"email": "pas-un-email"}, "Adresse e-mail invalide."),
            ({"date_naissance": "2999-01-01"}, "dans le futur"),
            ({"langues": []}, None),
        ]
        for champs, message in cas:
            reponse = client.post("/api/v1/auth/register", json={**INSCRIPTION, **champs})
            assert reponse.status_code == 422, champs
            if message:
                # Message affiché tel quel par le frontend (sans préfixe « Value error, »)
                assert message in reponse.json()["detail"][0]["msg"], champs


class TestMotDePasseOublie:
    def test_repond_204_que_le_compte_existe_ou_non(self, client, db, monkeypatch):
        envoyes = []
        monkeypatch.setattr("app.api.routes.auth.envoyer_lien_reinitialisation", lambda *args: envoyes.append(args))
        creer_utilisateur(db)

        assert client.post("/api/v1/auth/forgot-password", json={"email": "inconnu@exemple.com"}).status_code == 204
        assert client.post("/api/v1/auth/forgot-password", json={"email": "rova@exemple.com"}).status_code == 204
        assert [args[0] for args in envoyes] == ["rova@exemple.com"]

    def test_le_lien_change_le_mot_de_passe_une_seule_fois(self, client, db):
        utilisateur = creer_utilisateur(db)
        jeton = creer_jeton_reinitialisation(utilisateur.id_user, utilisateur.mot_de_passe)
        corps = {"token": jeton, "nouveau_mot_de_passe": "Nouveau2026"}

        assert client.post("/api/v1/auth/reset-password", json=corps).status_code == 204
        assert connexion(client, mot_de_passe="Nouveau2026").status_code == 200
        assert connexion(client).status_code == 401
        # Le même lien ne sert plus : il dépendait de l'ancien mot de passe
        assert client.post("/api/v1/auth/reset-password", json=corps).status_code == 400

    def test_refuse_un_jeton_invalide_ou_un_jeton_de_session(self, client, db):
        utilisateur = creer_utilisateur(db)
        for jeton in ("pas-un-jeton", creer_jeton_acces(utilisateur.id_user)):
            reponse = client.post(
                "/api/v1/auth/reset-password", json={"token": jeton, "nouveau_mot_de_passe": "Nouveau2026"}
            )
            assert reponse.status_code == 400

    def test_un_jeton_de_reinitialisation_n_ouvre_pas_de_session(self, client, db):
        utilisateur = creer_utilisateur(db, role=Role.APPRENANT)
        jeton = creer_jeton_reinitialisation(utilisateur.id_user, utilisateur.mot_de_passe)
        assert client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {jeton}"}).status_code == 401
