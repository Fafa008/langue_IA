"""Tests du scoring déterministe des tentatives de diagnostic."""

from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Langue, Niveau, Question, Role, StatutDiagnostic
from app.models import TestDiagnostic as TentativeDiagnostic
from app.services.scoring import CadreReference, niveau_de_reference
from tests.conftest import creer_utilisateur, entete


def _creer_tentative(db: Session, apprenant, code_langue: str = "en") -> TentativeDiagnostic:
    code_niveau = "HSK 1" if code_langue == "zh" else "A1"
    tentative = TentativeDiagnostic(
        apprenant=apprenant.apprenant,
        langue=db.scalar(select(Langue).where(Langue.code == code_langue)),
        niveau=db.scalar(select(Niveau).where(Niveau.code == code_niveau)),
    )
    db.add(tentative)
    db.commit()
    return tentative


def _creer_question(
    db: Session,
    code_langue: str = "en",
    *,
    reponse_correcte: str | None = "is",
) -> Question:
    code_niveau = "HSK 1" if code_langue == "zh" else "A1"
    question = Question(
        enonce="She ___ a student.",
        competence="grammaire",
        type_reponse="choix",
        choix=["is", "are"],
        reponse_correcte=reponse_correcte,
        langue=db.scalar(select(Langue).where(Langue.code == code_langue)),
        niveau=db.scalar(select(Niveau).where(Niveau.code == code_niveau)),
    )
    db.add(question)
    db.commit()
    return question


def _repondre(client, apprenant, tentative: TentativeDiagnostic, question: Question, valeur: str) -> None:
    response = client.post(
        "/api/v1/diagnostic/reponse",
        headers=entete(apprenant),
        json={
            "id_tentative": tentative.id_test,
            "id_question": str(question.id_question),
            "reponse_fournie": valeur,
        },
    )
    assert response.status_code == 201


@pytest.mark.parametrize(
    ("score", "niveau"),
    [
        ("0", "A1"), ("19.99", "A1"), ("20", "A2"), ("39.99", "A2"),
        ("40", "B1"), ("59.99", "B1"), ("60", "B2"), ("74.99", "B2"),
        ("75", "C1"), ("89.99", "C1"), ("90", "C2"), ("100", "C2"),
    ],
)
def test_applique_les_seuils_cecrl(score: str, niveau: str):
    assert niveau_de_reference(Decimal(score), CadreReference.CECRL) == niveau


@pytest.mark.parametrize(
    ("score", "niveau"),
    [
        ("0", "HSK 1"), ("20", "HSK 2"), ("40", "HSK 3"),
        ("60", "HSK 4"), ("75", "HSK 5"), ("90", "HSK 6"), ("100", "HSK 6"),
    ],
)
def test_applique_les_seuils_hsk(score: str, niveau: str):
    assert niveau_de_reference(Decimal(score), CadreReference.HSK) == niveau


class TestTerminerTentative:
    def test_calcule_le_score_et_persiste_le_niveau_de_reference(self, client, db: Session):
        apprenant = creer_utilisateur(db)
        tentative = _creer_tentative(db, apprenant)
        questions = [_creer_question(db) for _ in range(3)]
        _repondre(client, apprenant, tentative, questions[0], "is")
        _repondre(client, apprenant, tentative, questions[1], "are")

        response = client.post(
            f"/api/v1/diagnostic/tentatives/{tentative.id_test}/terminer",
            headers=entete(apprenant),
        )

        assert response.status_code == 200
        assert response.json() == {
            "id_tentative": tentative.id_test,
            "score": 33.33,
            "max_score": 100,
            "percentage": 33.33,
            "level": "A2",
            "framework": "CECRL",
        }
        db.refresh(tentative)
        assert tentative.statut == StatutDiagnostic.TERMINE
        assert tentative.score == Decimal("33.33")
        assert tentative.niveau_final.code == "A2"
        assert tentative.date_fin is not None

    def test_compte_les_reponses_manquantes_comme_incorrectes(self, client, db: Session):
        apprenant = creer_utilisateur(db)
        tentative = _creer_tentative(db, apprenant)
        _creer_question(db)
        _creer_question(db)

        response = client.post(
            f"/api/v1/diagnostic/tentatives/{tentative.id_test}/terminer",
            headers=entete(apprenant),
        )

        assert response.status_code == 200
        assert response.json()["score"] == 0
        assert response.json()["level"] == "A1"

    def test_retourne_le_niveau_hsk_pour_le_mandarin(self, client, db: Session):
        apprenant = creer_utilisateur(db)
        tentative = _creer_tentative(db, apprenant, "zh")
        questions = [_creer_question(db, "zh") for _ in range(3)]
        for question in questions:
            _repondre(client, apprenant, tentative, question, "is")

        response = client.post(
            f"/api/v1/diagnostic/tentatives/{tentative.id_test}/terminer",
            headers=entete(apprenant),
        )

        assert response.status_code == 200
        assert response.json()["score"] == 100
        assert response.json()["level"] == "HSK 6"
        assert response.json()["framework"] == "HSK"

    @pytest.mark.parametrize("reponse_correcte", [None, "not an option"])
    def test_refuse_de_scorrer_si_une_cle_est_absente_ou_invalide(self, client, db: Session, reponse_correcte):
        apprenant = creer_utilisateur(db)
        tentative = _creer_tentative(db, apprenant)
        _creer_question(db, reponse_correcte=reponse_correcte)

        response = client.post(
            f"/api/v1/diagnostic/tentatives/{tentative.id_test}/terminer",
            headers=entete(apprenant),
        )

        assert response.status_code == 409
        db.refresh(tentative)
        assert tentative.statut == StatutDiagnostic.EN_COURS
        assert tentative.score is None

    def test_rend_la_finalisation_idempotente(self, client, db: Session):
        apprenant = creer_utilisateur(db)
        tentative = _creer_tentative(db, apprenant)
        _creer_question(db)
        headers = entete(apprenant)
        url = f"/api/v1/diagnostic/tentatives/{tentative.id_test}/terminer"

        premiere = client.post(url, headers=headers)
        seconde = client.post(url, headers=headers)

        assert premiere.status_code == seconde.status_code == 200
        assert seconde.json() == premiere.json()

    def test_ne_revele_pas_la_cle_de_correction_dans_les_questions(self, client, db: Session):
        apprenant = creer_utilisateur(db)
        question = _creer_question(db)

        response = client.get(
            "/api/v1/diagnostic/questions",
            headers=entete(apprenant),
            params={"code_langue": "en", "code_niveau": "A1"},
        )

        assert response.status_code == 200
        assert response.json()[0]["id_question"] == str(question.id_question)
        assert "reponse_correcte" not in response.text

    def test_refuse_une_tentative_appartenant_a_un_autre_apprenant(self, client, db: Session):
        apprenant = creer_utilisateur(db, email="apprenant@example.com")
        autre = creer_utilisateur(db, role=Role.APPRENANT, email="autre@example.com")
        tentative = _creer_tentative(db, apprenant)

        response = client.post(
            f"/api/v1/diagnostic/tentatives/{tentative.id_test}/terminer",
            headers=entete(autre),
        )

        assert response.status_code == 404
