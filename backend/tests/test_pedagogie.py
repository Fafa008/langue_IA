"""Langues et niveaux : /langues, /niveaux et l'association LangueNiveau."""

from sqlalchemy import select

from app.models import Langue
from tests.conftest import creer_utilisateur, entete


def ids_niveaux(client, en_tete, *codes):
    niveaux = {n["code"]: n["id_niveau"] for n in client.get("/api/v1/niveaux", headers=en_tete).json()}
    return [niveaux[c] for c in codes]


class TestNiveaux:
    def test_liste_du_referentiel_reservee_aux_administrateurs(self, client, db, admin_entete):
        codes = [n["code"] for n in client.get("/api/v1/niveaux", headers=admin_entete).json()]
        assert {"A1", "C2", "HSK 1", "HSK 6"} <= set(codes)
        assert client.get("/api/v1/niveaux", headers=entete(creer_utilisateur(db))).status_code == 403

    def test_cree_modifie_et_refuse_un_code_deja_pris(self, client, admin_entete):
        cree = client.post("/api/v1/niveaux", headers=admin_entete, json={"code": " hsk   7 ", "libelle": "Expert"})
        assert cree.status_code == 201
        assert cree.json()["code"] == "HSK 7"

        doublon = client.post("/api/v1/niveaux", headers=admin_entete, json={"code": "A1", "libelle": "Autre"})
        assert doublon.status_code == 409

        id_niveau = cree.json()["id_niveau"]
        modifie = client.patch(
            f"/api/v1/niveaux/{id_niveau}", headers=admin_entete, json={"code": "HSK 7", "libelle": "Maîtrise+"}
        )
        assert modifie.json()["libelle"] == "Maîtrise+"
        assert (
            client.patch("/api/v1/niveaux/9999", headers=admin_entete, json={"code": "X", "libelle": "Y"}).status_code
            == 404
        )

    def test_supprimer_un_niveau_le_retire_des_langues(self, client, admin_entete):
        (id_a1,) = ids_niveaux(client, admin_entete, "A1")
        assert client.delete(f"/api/v1/niveaux/{id_a1}", headers=admin_entete).status_code == 204
        francais = client.get("/api/v1/langues", headers=admin_entete, params={"search": "fr"}).json()["items"][0]
        assert "A1" not in [n["code"] for n in francais["niveaux"]]


class TestLangues:
    def test_liste_paginee_avec_les_niveaux_de_chaque_langue(self, client, admin_entete):
        corps = client.get("/api/v1/langues", headers=admin_entete).json()
        assert corps["total"] == 5
        mandarin = next(langue for langue in corps["items"] if langue["code"] == "zh")
        assert {n["code"] for n in mandarin["niveaux"]} == {f"HSK {i}" for i in range(1, 7)}

    def test_recherche_sans_accents(self, client, admin_entete):
        corps = client.get("/api/v1/langues", headers=admin_entete, params={"search": "FRANCAIS"}).json()
        assert [langue["libelle"] for langue in corps["items"]] == ["Français"]

    def test_cree_une_langue_avec_ses_niveaux(self, client, admin_entete):
        ids = ids_niveaux(client, admin_entete, "A1", "A2")
        reponse = client.post(
            "/api/v1/langues", headers=admin_entete, json={"libelle": "Swahili", "code": "SW", "id_niveaux": ids}
        )
        assert reponse.status_code == 201, reponse.text
        assert reponse.json()["code"] == "sw"
        assert sorted(n["code"] for n in reponse.json()["niveaux"]) == ["A1", "A2"]

    def test_erreurs_de_creation(self, client, admin_entete):
        ids = ids_niveaux(client, admin_entete, "A1")
        base = {"libelle": "Swahili", "code": "sw", "id_niveaux": ids}
        assert client.post("/api/v1/langues", headers=admin_entete, json={**base, "code": "fr"}).status_code == 409
        assert client.post("/api/v1/langues", headers=admin_entete, json={**base, "id_niveaux": []}).status_code == 422
        assert (
            client.post("/api/v1/langues", headers=admin_entete, json={**base, "id_niveaux": [9999]}).status_code == 422
        )
        assert client.post("/api/v1/langues", headers=admin_entete, json={**base, "code": "s"}).status_code == 422

    def test_id_niveaux_remplace_toute_la_liste(self, client, db, admin_entete):
        allemand = db.scalar(select(Langue).where(Langue.code == "de"))
        ids = ids_niveaux(client, admin_entete, "B1", "C1")
        reponse = client.patch(f"/api/v1/langues/{allemand.id_langue}", headers=admin_entete, json={"id_niveaux": ids})
        assert sorted(n["code"] for n in reponse.json()["niveaux"]) == ["B1", "C1"]
        assert reponse.json()["libelle"] == "Allemand"

    def test_supprime_une_langue_inutilisee_et_refuse_une_langue_suivie(self, client, db, admin_entete):
        langues = {langue.code: langue.id_langue for langue in db.scalars(select(Langue))}
        assert client.delete(f"/api/v1/langues/{langues['it']}", headers=admin_entete).status_code == 204

        inscription = {
            "prenom": "Rova", "nom": "RAKOTO", "email": "rova@exemple.com", "mot_de_passe": "Langue2026",
            "date_naissance": "2000-05-01", "langues": ["de"], "id_formule": 1,
        }  # fmt: skip
        assert client.post("/api/v1/auth/register", json=inscription).status_code == 201
        assert client.delete(f"/api/v1/langues/{langues['de']}", headers=admin_entete).status_code == 409
        assert client.delete("/api/v1/langues/9999", headers=admin_entete).status_code == 404
