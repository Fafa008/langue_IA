"""Tests de la lecture du parcours personnalisé (US41 à US44) : parcours en cours, exercices, leçon.

Le contenu d'un exercice contient une bonne réponse : les tests vérifient qu'elle ne sort jamais de la lecture.
"""

import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import ProgressionLecon, Role, StatutParcours, Utilisateur
from app.services.lecture_parcours import CHAMPS_VISIBLES, statut_exercice
from tests.conftest import creer_utilisateur, entete
from tests.fabriques_parcours import ajouter_exercice, creer_parcours_vide

CONTENU_QCM = {
    "format": "choix",
    "intitule": "Le passé composé",
    "consigne": "Choisissez la bonne forme.",
    "enonce": "Hier, je ___ au marché.",
    "choix": ["suis allé", "vais aller"],
    "reponses": ["suis allé"],
    "explication": "« Aller » se conjugue avec être au passé composé.",
}


@pytest.fixture
def apprenant(db: Session) -> Utilisateur:
    return creer_utilisateur(db)


def test_parcours_en_cours_decrit_niveau_langue_et_phase(client: TestClient, db: Session, apprenant) -> None:
    parcours = creer_parcours_vide(db, apprenant, lecon_atteinte=23, niveau_final="A2")
    db.commit()

    reponse = client.get("/api/v1/parcours/en-cours", headers=entete(apprenant))

    assert reponse.status_code == 200
    corps = reponse.json()
    assert corps["id_parcours"] == parcours.id_parcours
    assert corps["statut"] == "EN_COURS"
    assert corps["code_langue"] == "en"
    assert corps["cadre"] == "CECRL"
    assert corps["niveau_depart"] == "A2"
    assert corps["niveau_vise"] == "B1"
    assert "A1" in corps["niveaux_cadre"] and "C2" in corps["niveaux_cadre"]
    assert corps["lecon_atteinte"] == 23
    assert corps["phase"] == "PASSIVE"
    assert corps["est_lecon_de_revision"] is False


def test_parcours_en_cours_absent_si_aucun_parcours(client: TestClient, apprenant) -> None:
    reponse = client.get("/api/v1/parcours/en-cours", headers=entete(apprenant))

    assert reponse.status_code == 404


def test_parcours_termine_n_est_pas_en_cours(client: TestClient, db: Session, apprenant) -> None:
    parcours = creer_parcours_vide(db, apprenant)
    parcours.statut = StatutParcours.TERMINE
    db.commit()

    reponse = client.get("/api/v1/parcours/en-cours", headers=entete(apprenant))

    assert reponse.status_code == 404


def test_exercices_limites_a_la_lecon_atteinte_avec_leur_statut(client: TestClient, db: Session, apprenant) -> None:
    parcours = creer_parcours_vide(db, apprenant, lecon_atteinte=23)
    ajouter_exercice(db, parcours, numero_lecon=5, contenu=CONTENU_QCM, score=80)
    ajouter_exercice(db, parcours, numero_lecon=23, contenu=CONTENU_QCM, score=40)
    ajouter_exercice(db, parcours, numero_lecon=23, contenu=CONTENU_QCM, score=None)
    ajouter_exercice(db, parcours, numero_lecon=30, contenu=CONTENU_QCM, score=None)  # leçon future
    db.commit()

    reponse = client.get(f"/api/v1/parcours/{parcours.id_parcours}/exercices", headers=entete(apprenant))

    assert reponse.status_code == 200
    corps = reponse.json()
    assert [(e["numero_lecon"], e["statut"]) for e in corps] == [(5, "REUSSI"), (23, "A_REVOIR"), (23, "A_FAIRE")]
    assert corps[0]["intitule"] == "Le passé composé"
    assert corps[0]["type"] == "GRAMMAIRE"
    assert corps[0]["score_obtenu"] == 80
    assert "contenu" not in corps[0]


def test_lecon_ne_renvoie_que_le_contenu_visible(client: TestClient, db: Session, apprenant) -> None:
    parcours = creer_parcours_vide(db, apprenant, lecon_atteinte=23)
    ajouter_exercice(db, parcours, numero_lecon=23, contenu=CONTENU_QCM)
    db.commit()

    reponse = client.get(f"/api/v1/parcours/{parcours.id_parcours}/lecons/23", headers=entete(apprenant))

    assert reponse.status_code == 200
    corps = reponse.json()
    assert corps["numero_lecon"] == 23
    assert corps["est_lecon_de_revision"] is False
    assert corps["code_langue"] == "en"
    contenu = json.loads(corps["exercices"][0]["contenu"])
    assert set(contenu) <= set(CHAMPS_VISIBLES)
    assert "consigne" in contenu and "choix" in contenu
    # La bonne réponse et l'explication ne quittent jamais le backend
    assert "reponses" not in contenu and "explication" not in contenu
    assert "reponses" not in reponse.text and "explication" not in reponse.text


def test_lecon_non_atteinte_refusee(client: TestClient, db: Session, apprenant) -> None:
    parcours = creer_parcours_vide(db, apprenant, lecon_atteinte=23)
    db.commit()

    reponse = client.get(f"/api/v1/parcours/{parcours.id_parcours}/lecons/24", headers=entete(apprenant))

    assert reponse.status_code == 403


def test_parcours_d_un_autre_apprenant_introuvable(client: TestClient, db: Session, apprenant) -> None:
    autre = creer_utilisateur(db, email="autre@exemple.com", prenom="Hery")
    parcours = creer_parcours_vide(db, autre, lecon_atteinte=23)
    db.commit()

    for chemin in (
        f"/api/v1/parcours/{parcours.id_parcours}/exercices",
        f"/api/v1/parcours/{parcours.id_parcours}/lecons/1",
    ):
        assert client.get(chemin, headers=entete(apprenant)).status_code == 404


def test_formateur_refuse(client: TestClient, db: Session, apprenant) -> None:
    formateur = creer_utilisateur(db, Role.FORMATEUR, email="formateur@exemple.com", prenom="Lalao")

    assert client.get("/api/v1/parcours/en-cours", headers=entete(formateur)).status_code == 403


@pytest.mark.parametrize(
    ("score", "statut"),
    [(None, "A_FAIRE"), (0, "A_REVOIR"), (49, "A_REVOIR"), (50, "REUSSI"), (100, "REUSSI")],
)
def test_statut_exercice_selon_le_seuil(score: int | None, statut: str) -> None:
    assert statut_exercice(score) == statut


def test_en_cours_expose_les_lecons_notees(client: TestClient, db: Session, apprenant) -> None:
    """La progression par leçon (US48) apparaît dans « en-cours » ; une leçon sans score n'y figure pas."""
    parcours = creer_parcours_vide(db, apprenant, lecon_atteinte=24)
    db.add(
        ProgressionLecon(
            id_parcours=parcours.id_parcours, numero_lecon=23, last_score=78, best_score=78, is_validated=True
        )
    )
    db.add(ProgressionLecon(id_parcours=parcours.id_parcours, numero_lecon=24, last_score=None, best_score=None))
    db.commit()

    corps = client.get("/api/v1/parcours/en-cours", headers=entete(apprenant)).json()

    assert corps["progressions"] == [
        {"numero_lecon": 23, "last_score": 78, "best_score": 78, "is_validated": True},
    ]


def test_en_cours_sans_progression_renvoie_une_liste_vide(client: TestClient, db: Session, apprenant) -> None:
    creer_parcours_vide(db, apprenant)
    db.commit()

    corps = client.get("/api/v1/parcours/en-cours", headers=entete(apprenant)).json()

    assert corps["progressions"] == []
