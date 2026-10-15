"""Formules (GET /formules, publique) et tableau de bord (GET /admin/statistiques…)."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.models import Atelier, Langue, Role, StatutAtelier
from tests.conftest import creer_utilisateur, entete


def inscrire(client, email, langues, id_formule=1):
    corps = {
        "prenom": "Rova", "nom": "RAKOTO", "email": email, "mot_de_passe": "Langue2026",
        "date_naissance": "2000-05-01", "langues": langues, "id_formule": id_formule,
    }  # fmt: skip
    assert client.post("/api/v1/auth/register", json=corps).status_code == 201


def test_formules_publiques_triees_par_prix(client):
    formules = client.get("/api/v1/formules").json()
    assert [f["libelle"] for f in formules] == ["Simple", "Luxe", "Premium"]
    assert formules[0] == {
        "id_formule": formules[0]["id_formule"],
        "libelle": "Simple",
        "prix_mensuel": 60000,
        "duree_mois": 1,
        "quota_heures": 6,
        "quota_ateliers": 1,
        "langues": [],
    }


class TestStatistiques:
    def test_reservees_aux_administrateurs(self, client, db):
        en_tete = entete(creer_utilisateur(db))
        assert client.get("/api/v1/admin/statistiques", headers=en_tete).status_code == 403
        assert client.get("/api/v1/admin/statistiques/inscriptions", headers=en_tete).status_code == 403

    def test_totaux_langues_et_dernieres_inscriptions(self, client, db, admin_entete):
        inscrire(client, "a@exemple.com", ["en", "fr"])
        inscrire(client, "b@exemple.com", ["en"], id_formule=3)
        formateur = creer_utilisateur(db, Role.FORMATEUR, email="hery@exemple.com")
        anglais = db.scalar(select(Langue).where(Langue.code == "en"))
        maintenant = datetime.now(UTC)
        atelier = {"capacite_max": 10, "id_langue": anglais.id_langue, "id_formateur": formateur.id_user}
        db.add_all(
            [
                Atelier(date_heure=maintenant + timedelta(days=2), **atelier),
                Atelier(date_heure=maintenant + timedelta(days=3), statut=StatutAtelier.ANNULE, **atelier),
                Atelier(date_heure=maintenant - timedelta(days=1), **atelier),
            ]
        )
        db.commit()

        corps = client.get("/api/v1/admin/statistiques", headers=admin_entete).json()

        # 2 apprenants + 1 formateur + 1 administrateur ; seul l'atelier à venir non annulé compte
        assert corps["totaux"] == {"utilisateurs": 4, "apprenants": 2, "formateurs": 1, "ateliers_programmes": 1}
        assert [(p["langue"]["code"], p["apprenants"]) for p in corps["apprenants_par_langue"]] == [
            ("en", 2),
            ("fr", 1),
        ]

        derniere = corps["dernieres_inscriptions"][0]
        assert derniere["apprenant"]["email"] == "b@exemple.com"
        assert derniere["apprenant"]["date_naissance"] == "2000-05-01"
        assert [langue["code"] for langue in derniere["langues"]] == ["en"]
        assert derniere["abonnement"]["statut"] == "ACTIF"
        assert derniere["abonnement"]["formule"]["libelle"] == "Premium"

    def test_inscriptions_un_point_par_jour_jours_vides_compris(self, client, admin_entete):
        inscrire(client, "a@exemple.com", ["en"])
        points = client.get("/api/v1/admin/statistiques/inscriptions", headers=admin_entete, params={"jours": 7}).json()
        assert len(points) == 7
        assert [p["date"] for p in points] == sorted(p["date"] for p in points)
        # Aujourd'hui : l'administrateur et l'apprenant viennent d'être créés
        assert points[-1]["nombre"] == 2
        assert sum(p["nombre"] for p in points[:-1]) == 0

    def test_periode_limitee_a_7_30_ou_90_jours(self, client, admin_entete):
        reponse = client.get("/api/v1/admin/statistiques/inscriptions", headers=admin_entete, params={"jours": 5})
        assert reponse.status_code == 422
        par_defaut = client.get("/api/v1/admin/statistiques/inscriptions", headers=admin_entete).json()
        assert len(par_defaut) == 30
