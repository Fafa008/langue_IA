"""Tests backend du test de positionnement 4 compétences (phase 2)."""

import json

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Langue, Niveau, Question, StatutDiagnostic, TypeExercice
from app.models import TestDiagnostic as TentativeDiagnostic
from app.schemas.ia import ReponsePositionnementIA
from app.services import analyse_diagnostic
from tests.conftest import creer_utilisateur, entete

COMPETENCES = ("lecture", "ecoute", "ecrit", "oral")
FORMATS = ("qcm", "dictee", "texte_a_trous", "parler")


@pytest.fixture
def ia_positionnement(monkeypatch: pytest.MonkeyPatch) -> list:
    """Remplace l'appel HTTP : le test vérifie la persistance de l'enveloppe v2, pas la disponibilité du service IA."""
    appels: list = []

    def faux_positionnement(requete):
        appels.append(requete)
        return ReponsePositionnementIA.model_validate(
            {
                "request_id": str(requete.request_id),
                "agent": "diagnostic",
                "version_agent": "1.2.0",
                "version_prompt": "diagnostic/evaluation@1.2.0",
                "statut": "succes",
                "resultat": {
                    "code_langue": requete.contexte.code_langue,
                    "referentiel": requete.contexte.referentiel,
                    "niveau_estime": requete.contexte.niveau_preliminaire,
                    "phase_assimil": "impregnation",
                    "points_faibles": [],
                    "score_confiance": 0.6,
                    "niveau_preliminaire": requete.contexte.niveau_preliminaire,
                    "ecart_avec_niveau_preliminaire": 0,
                    "justification": "Les faits transmis montrent une production écrite correcte.",
                    "statut": "succes",
                },
                "meta": {
                    "duree_ms": 1200,
                    "fournisseur": "factice",
                    "modele": "modele-test",
                    "version_corpus": None,
                    "empreinte_prompt": "sha256:" + "a" * 64,
                },
            }
        )

    monkeypatch.setattr(analyse_diagnostic, "evaluer_positionnement", faux_positionnement)
    return appels


def _creer_exercice_enrichi(
    db: Session,
    *,
    competence: str,
    format_exercice: str,
    type_reponse: str = "choix",
    reponse_correcte: str | None = "is",
    enonce: str = "Exercice de positionnement",
) -> Question:
    contenu = {
        "enonce": enonce,
        "competence": competence,
        "format": type_reponse,
        "format_exercice": format_exercice,
        "choix": ["is", "are"] if type_reponse == "choix" else None,
        "reponses": [reponse_correcte] if reponse_correcte is not None else None,
        "lettres_melangees": ["s", "i"] if format_exercice == "texte_a_trous" else None,
        "duree_secondes": 45,
        "duree_minimale_secondes": 30 if format_exercice == "parler" else None,
        "mots_minimum": 30 if format_exercice == "texte_a_trous" else None,
    }
    exercice = Question(
        type=TypeExercice.COMPREHENSION,
        contenu=json.dumps(contenu, ensure_ascii=False),
        difficulte=2,
        usage="diagnostic",
        statut="publié",
        langue=db.scalar(select(Langue).where(Langue.code == "en")),
        niveau=db.scalar(select(Niveau).where(Niveau.code == "A1")),
    )
    db.add(exercice)
    db.commit()
    return exercice


def test_expose_les_champs_du_positionnement_sans_correction(db: Session, client):
    apprenant = creer_utilisateur(db)
    _creer_exercice_enrichi(
        db, competence="ecrit", format_exercice="texte_a_trous", type_reponse="texte", reponse_correcte="élève"
    )

    reponse = client.get(
        "/api/v1/diagnostic/questions",
        headers=entete(apprenant),
        params={"code_langue": "en", "code_niveau": "A1"},
    )

    assert reponse.status_code == 200
    question = reponse.json()[0]
    assert question["format"] == "texte_a_trous"
    assert question["lettres_melangees"] == ["s", "i"]
    assert question["duree_secondes"] == 45
    assert question["mots_minimum"] == 30
    assert question["type_reponse"] == "texte"
    assert "reponses" not in question
    assert "élève" not in reponse.text


def test_score_sur_100_et_dossier_factuel_par_exercice(db: Session, client, ia_positionnement: list):
    apprenant = creer_utilisateur(db)
    tentative = TentativeDiagnostic(
        apprenant=apprenant.apprenant,
        langue=db.scalar(select(Langue).where(Langue.code == "en")),
        niveau=db.scalar(select(Niveau).where(Niveau.code == "A1")),
    )
    db.add(tentative)
    db.commit()

    exercices: list[Question] = []
    for competence, format_exercice in zip(COMPETENCES, FORMATS, strict=True):
        for index in range(5):
            est_oral = format_exercice == "parler"
            exercices.append(
                _creer_exercice_enrichi(
                    db,
                    competence=competence,
                    format_exercice=format_exercice,
                    type_reponse="audio" if est_oral else ("texte" if index % 2 else "choix"),
                    reponse_correcte=None if est_oral else "is",
                    enonce=f"{competence} {index}",
                )
            )

    # 15 bonnes réponses sur 20 : les 5 exercices oraux restent sans réponse (audio non enregistrable).
    for exercice in exercices[:15]:
        assert (
            client.post(
                "/api/v1/diagnostic/reponse",
                headers=entete(apprenant),
                json={
                    "id_tentative": tentative.id_test,
                    "id_question": str(exercice.id_question),
                    "reponse_fournie": "is",
                },
            ).status_code
            == 201
        )

    resultat = client.post(f"/api/v1/diagnostic/tentatives/{tentative.id_test}/terminer", headers=entete(apprenant))

    assert resultat.status_code == 200
    donnees = resultat.json()
    assert donnees["score"] == 75.0
    assert donnees["max_score"] == 100
    assert donnees["percentage"] == 75.0
    assert {item["competence"]: item["score"] for item in donnees["competences"]} == {
        "lecture": 5,
        "ecoute": 5,
        "ecrit": 5,
        "oral": 0,
    }
    analyse = donnees["donnees_analyse"]
    assert len(analyse) == 20
    assert {item["format"] for item in analyse} == set(FORMATS)
    assert sum(item["justesse"] for item in analyse) == 15
    assert all(item["temps_reponse_secondes"] >= 0 for item in analyse)
    assert all("transcription" not in item and "confiance_stt" not in item for item in analyse)

    db.refresh(tentative)
    assert tentative.statut == StatutDiagnostic.TERMINE
    assert len(ia_positionnement) == 1
    assert tentative.analyse_ia["version_agent"] == "1.2.0"
    assert tentative.analyse_ia["version_prompt"] == "diagnostic/evaluation@1.2.0"
    assert "justification" in tentative.analyse_ia["resultat"]
    assert isinstance(donnees["points_faibles"], list)
    assert "justification" not in donnees
