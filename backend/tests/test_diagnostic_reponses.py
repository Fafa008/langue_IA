"""Enregistrement temporaire des réponses dans une tentative de diagnostic."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Langue, Niveau, Question, Reponse, Role, StatutDiagnostic
from app.models import TestDiagnostic as TentativeDiagnostic
from tests.conftest import creer_utilisateur, entete


def _creer_tentative(db: Session, apprenant, code_langue: str = "en") -> TentativeDiagnostic:
    langue = db.scalar(select(Langue).where(Langue.code == code_langue))
    niveau = db.scalar(select(Niveau).where(Niveau.code == "A1"))
    tentative = TentativeDiagnostic(apprenant=apprenant.apprenant, langue=langue, niveau=niveau)
    db.add(tentative)
    db.commit()
    return tentative


def _creer_question(db: Session, code_langue: str = "en") -> Question:
    question = Question(
        enonce="She ___ a student.",
        competence="grammaire",
        choix=["is", "are"],
        langue=db.scalar(select(Langue).where(Langue.code == code_langue)),
        niveau=db.scalar(select(Niveau).where(Niveau.code == "A1")),
    )
    db.add(question)
    db.commit()
    return question


class TestEnregistrerReponse:
    def test_exige_une_session_apprenant_pour_creer_une_tentative(self, client, db: Session):
        assert client.post("/api/v1/diagnostic/tentatives", json={"code_langue": "en"}).status_code == 401

        formateur = creer_utilisateur(db, Role.FORMATEUR, email="formateur@exemple.com")
        reponse = client.post(
            "/api/v1/diagnostic/tentatives",
            headers=entete(formateur),
            json={"code_langue": "en"},
        )

        assert reponse.status_code == 403

    def test_cree_une_tentative_persistante_et_retourne_les_questions_du_premier_niveau(self, client, db: Session):
        apprenant = creer_utilisateur(db)
        premiere_question = _creer_question(db, code_langue="en")
        autre_question = Question(
            enonce="Question A2",
            competence="lecture",
            langue=premiere_question.langue,
            niveau=db.scalar(select(Niveau).where(Niveau.code == "A2")),
        )
        db.add(autre_question)
        db.commit()

        reponse = client.post(
            "/api/v1/diagnostic/tentatives",
            headers=entete(apprenant),
            json={"code_langue": "en"},
        )

        assert reponse.status_code == 201
        donnees = reponse.json()
        assert donnees["id_tentative"] > 0
        assert donnees["code_langue"] == "en"
        assert donnees["code_niveau"] == "A1"
        questions = client.get(
            "/api/v1/diagnostic/questions",
            headers=entete(apprenant),
            params={"code_langue": "en", "code_niveau": donnees["code_niveau"]},
        )
        assert questions.status_code == 200
        assert [question["id_question"] for question in questions.json()] == [str(premiere_question.id_question)]
        assert "bonne_reponse" not in questions.text
        tentative = db.get(TentativeDiagnostic, donnees["id_tentative"])
        assert tentative is not None
        assert tentative.id_apprenant == apprenant.id_user

    def test_ne_cree_pas_de_tentative_si_aucune_question_n_est_disponible(self, client, db: Session):
        apprenant = creer_utilisateur(db)

        reponse = client.post(
            "/api/v1/diagnostic/tentatives",
            headers=entete(apprenant),
            json={"code_langue": "en"},
        )

        assert reponse.status_code == 404
        assert db.scalar(select(func.count()).select_from(TentativeDiagnostic)) == 0

    def test_enregistre_la_reponse_de_lapprenant_sans_l_evaluer(self, client, db: Session):
        apprenant = creer_utilisateur(db)
        tentative = _creer_tentative(db, apprenant)
        question = _creer_question(db)

        reponse_http = client.post(
            "/api/v1/diagnostic/reponse",
            headers=entete(apprenant),
            json={
                "id_tentative": tentative.id_test,
                "id_question": str(question.id_question),
                "reponse_fournie": "is",
            },
        )

        assert reponse_http.status_code == 201
        donnees = reponse_http.json()
        assert isinstance(donnees["id_reponse"], int)
        assert donnees["id_reponse"] > 0
        assert donnees == {
            "id_reponse": donnees["id_reponse"],
            "id_tentative": tentative.id_test,
            "id_question": str(question.id_question),
            "reponse_fournie": "is",
        }
        reponse = db.scalar(select(Reponse).where(Reponse.id_tentative == tentative.id_test))
        assert reponse is not None
        assert reponse.evaluation is None

    def test_refuse_une_tentative_d_un_autre_apprenant(self, client, db: Session):
        proprietaire = creer_utilisateur(db)
        autre_apprenant = creer_utilisateur(db, email="autre@exemple.com")
        tentative = _creer_tentative(db, proprietaire)
        question = _creer_question(db)

        reponse = client.post(
            "/api/v1/diagnostic/reponse",
            headers=entete(autre_apprenant),
            json={
                "id_tentative": tentative.id_test,
                "id_question": str(question.id_question),
                "reponse_fournie": "is",
            },
        )

        assert reponse.status_code == 404

    def test_refuse_une_tentative_terminee(self, client, db: Session):
        apprenant = creer_utilisateur(db)
        tentative = _creer_tentative(db, apprenant)
        tentative.statut = StatutDiagnostic.TERMINE
        db.commit()
        question = _creer_question(db)

        reponse = client.post(
            "/api/v1/diagnostic/reponse",
            headers=entete(apprenant),
            json={
                "id_tentative": tentative.id_test,
                "id_question": str(question.id_question),
                "reponse_fournie": "is",
            },
        )

        assert reponse.status_code == 409

    def test_refuse_une_question_d_une_autre_langue(self, client, db: Session):
        apprenant = creer_utilisateur(db)
        tentative = _creer_tentative(db, apprenant, code_langue="en")
        question = _creer_question(db, code_langue="fr")

        reponse = client.post(
            "/api/v1/diagnostic/reponse",
            headers=entete(apprenant),
            json={
                "id_tentative": tentative.id_test,
                "id_question": str(question.id_question),
                "reponse_fournie": "est",
            },
        )

        assert reponse.status_code == 422

    def test_refuse_un_choix_qui_ne_fait_pas_partie_des_options(self, client, db: Session):
        apprenant = creer_utilisateur(db)
        tentative = _creer_tentative(db, apprenant)
        question = _creer_question(db)

        reponse = client.post(
            "/api/v1/diagnostic/reponse",
            headers=entete(apprenant),
            json={
                "id_tentative": tentative.id_test,
                "id_question": str(question.id_question),
                "reponse_fournie": "am",
            },
        )

        assert reponse.status_code == 422

    def test_refuse_une_deuxieme_reponse_a_la_meme_question(self, client, db: Session):
        apprenant = creer_utilisateur(db)
        tentative = _creer_tentative(db, apprenant)
        question = _creer_question(db)
        requete = {
            "id_tentative": tentative.id_test,
            "id_question": str(question.id_question),
            "reponse_fournie": "is",
        }
        headers = entete(apprenant)

        premiere = client.post("/api/v1/diagnostic/reponse", headers=headers, json=requete)
        deuxieme = client.post("/api/v1/diagnostic/reponse", headers=headers, json=requete)
        autre_reponse = client.post(
            "/api/v1/diagnostic/reponse",
            headers=headers,
            json={**requete, "reponse_fournie": "are"},
        )

        assert premiere.status_code == 201
        assert deuxieme.status_code == 201
        assert deuxieme.json()["id_reponse"] == premiere.json()["id_reponse"]
        assert autre_reponse.status_code == 409
        assert db.scalar(select(func.count()).select_from(Reponse)) == 1

    def test_exige_une_session_et_le_role_apprenant(self, client, db: Session):
        assert client.post("/api/v1/diagnostic/reponse", json={}).status_code == 401

        formateur = creer_utilisateur(db, Role.FORMATEUR, email="formateur@exemple.com")
        reponse = client.post(
            "/api/v1/diagnostic/reponse",
            headers=entete(formateur),
            json={"id_tentative": 1, "id_question": "1", "reponse_fournie": "is"},
        )

        assert reponse.status_code == 403

    def test_refuse_une_reponse_vide(self, client, db: Session):
        apprenant = creer_utilisateur(db)
        tentative = _creer_tentative(db, apprenant)
        question = _creer_question(db)

        reponse = client.post(
            "/api/v1/diagnostic/reponse",
            headers=entete(apprenant),
            json={
                "id_tentative": tentative.id_test,
                "id_question": str(question.id_question),
                "reponse_fournie": "   ",
            },
        )

        assert reponse.status_code == 422
