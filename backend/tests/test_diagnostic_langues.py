"""Langues proposées sur l'écran d'accueil du test de positionnement."""

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Langue, Niveau, Question, Role
from app.seed_diagnostic import QUESTIONS_DEMO, charger_questions_demo
from tests.conftest import creer_utilisateur, entete

URL = "/api/v1/diagnostic/langues"


def _ajouter_question(db: Session, code_langue: str, code_niveau: str, type_reponse: str = "choix") -> None:
    db.add(
        Question(
            enonce=f"Question {code_langue} {code_niveau} {type_reponse}",
            competence="grammaire",
            type_reponse=type_reponse,
            choix=["a", "b"] if type_reponse == "choix" else None,
            langue=db.scalar(select(Langue).where(Langue.code == code_langue)),
            niveau=db.scalar(select(Niveau).where(Niveau.code == code_niveau)),
        )
    )
    db.commit()


def _par_code(reponse) -> dict[str, dict]:
    return {langue["code"]: langue for langue in reponse.json()}


def _inscrire_langues(db: Session, apprenant, *codes: str) -> None:
    apprenant.apprenant.langues = db.scalars(select(Langue).where(Langue.code.in_(codes))).all()
    db.commit()


class TestLanguesDiagnostic:
    def test_reserve_aux_apprenants(self, client, db: Session):
        assert client.get(URL).status_code == 401

        formateur = creer_utilisateur(db, Role.FORMATEUR, email="formateur@exemple.com")
        assert client.get(URL, headers=entete(formateur)).status_code == 403

    def test_liste_uniquement_les_langues_inscrites_triees_avec_leur_echelle(self, client, db: Session):
        apprenant = creer_utilisateur(db)
        _inscrire_langues(db, apprenant, "en", "zh")

        reponse = client.get(URL, headers=entete(apprenant))

        assert reponse.status_code == 200
        langues = reponse.json()
        assert [langue["libelle"] for langue in langues] == sorted(langue["libelle"] for langue in langues)
        assert {langue["code"] for langue in langues} == {"en", "zh"}
        par_code = _par_code(reponse)
        assert par_code["en"]["cadre"] == "CECRL"
        assert par_code["en"]["niveaux"] == ["A1", "A2", "B1", "B2", "C1", "C2"]
        assert par_code["zh"]["cadre"] == "HSK"
        assert all(niveau.startswith("HSK") for niveau in par_code["zh"]["niveaux"])

    def test_une_langue_sans_question_est_bientot_disponible(self, client, db: Session):
        apprenant = creer_utilisateur(db)
        _inscrire_langues(db, apprenant, "en")

        langue = _par_code(client.get(URL, headers=entete(apprenant)))["en"]

        assert langue["disponible"] is False
        assert langue["nombre_questions"] == 0

    def test_compte_les_questions_enregistrables_sur_les_niveaux_du_test(self, client, db: Session):
        apprenant = creer_utilisateur(db)
        _inscrire_langues(db, apprenant, "en")
        # A1 n'a qu'une question audio : les questions enregistrables viennent d'A2 et B1.
        _ajouter_question(db, "en", "A1", "audio")
        _ajouter_question(db, "en", "A2", "choix")
        _ajouter_question(db, "en", "A2", "texte")
        _ajouter_question(db, "en", "A2", "audio")
        _ajouter_question(db, "en", "B1", "choix")

        langue = _par_code(client.get(URL, headers=entete(apprenant)))["en"]

        assert langue["disponible"] is True
        assert langue["nombre_questions"] == 3
        tentative = client.post("/api/v1/diagnostic/tentatives", headers=entete(apprenant), json={"code_langue": "en"})
        assert tentative.status_code == 201
        assert tentative.json()["code_niveau"] == "A2"
        assert {question["niveau"] for question in tentative.json()["questions"]} == {"A2", "B1"}
        assert len(tentative.json()["questions"]) == 3

    @pytest.mark.parametrize("code_langue", sorted(QUESTIONS_DEMO))
    def test_toutes_les_langues_recoivent_20_questions_des_quatre_competences(
        self, client, db: Session, code_langue: str
    ):
        apprenant = creer_utilisateur(db)
        _inscrire_langues(db, apprenant, code_langue)
        charger_questions_demo(db)

        tentative = client.post(
            "/api/v1/diagnostic/tentatives",
            headers=entete(apprenant),
            json={"code_langue": code_langue},
        )

        assert tentative.status_code == 201
        questions = tentative.json()["questions"]
        assert len(questions) == 20
        assert {question["competence"] for question in questions} == {
            "grammaire",
            "lecture",
            "ecoute",
            "ecrit",
            "oral",
        }
        assert {
            competence: sum(question["competence"] == competence for question in questions)
            for competence in ("grammaire", "lecture", "ecoute", "ecrit", "oral")
        } == {"grammaire": 4, "lecture": 1, "ecoute": 5, "ecrit": 5, "oral": 5}
        assert (
            sum(question["format"] == "parler" and question["type_reponse"] == "texte" for question in questions) == 5
        )

    def test_pack_complet_remplace_les_anciennes_questions_qcm_dans_la_tentative(self, client, db: Session):
        apprenant = creer_utilisateur(db)
        _inscrire_langues(db, apprenant, "en")
        db.add(
            Question(
                enonce="Ancienne question uniquement QCM",
                competence="grammaire",
                type_reponse="choix",
                choix=["a", "b"],
                reponse_correcte="a",
                langue=db.scalar(select(Langue).where(Langue.code == "en")),
                niveau=db.scalar(select(Niveau).where(Niveau.code == "A1")),
            )
        )
        db.commit()
        assert charger_questions_demo(db) == 100

        langues = _par_code(client.get(URL, headers=entete(apprenant)))
        tentative = client.post(
            "/api/v1/diagnostic/tentatives",
            headers=entete(apprenant),
            json={"code_langue": "en"},
        )

        assert langues["en"]["nombre_questions"] == 20
        assert tentative.status_code == 201
        questions = tentative.json()["questions"]
        assert len(questions) == 20
        assert all(question["enonce"] != "Ancienne question uniquement QCM" for question in questions)
        assert {question["competence"] for question in questions} == {"grammaire", "lecture", "ecoute", "ecrit", "oral"}
        assert (
            sum(question["format"] == "parler" and question["type_reponse"] == "texte" for question in questions) == 5
        )
