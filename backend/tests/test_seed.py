"""Script de seed (PRE-07) : une base neuve doit permettre de dérouler la chaîne complète en local.

Le seed est relancé à chaque démarrage du conteneur : il doit être idempotent et ne charger les données de
démonstration (comptes, banque de questions) que si SEED_DEMO=true.
"""

import pytest
from sqlalchemy import func, select

from app import seed
from app.models import Formule, Langue, Niveau, Question, Utilisateur
from app.seed_diagnostic import QUESTIONS_DEMO, charger_questions_demo


def _compter(db, modele) -> int:
    db.expire_all()
    return db.scalar(select(func.count()).select_from(modele))


class TestSeed:
    def test_sans_seed_demo_seul_le_referentiel_est_charge(self, db, monkeypatch):
        monkeypatch.setenv("SEED_DEMO", "false")

        seed.main()

        assert _compter(db, Langue) == len(seed.LANGUES)
        assert _compter(db, Formule) == len(seed.FORMULES)
        assert _compter(db, Utilisateur) == 0
        assert _compter(db, Question) == 0

    def test_seed_demo_charge_comptes_et_questions_sans_doublon(self, db, monkeypatch):
        monkeypatch.setenv("SEED_DEMO", "true")

        seed.main()
        premier = (_compter(db, Utilisateur), _compter(db, Question), _compter(db, Niveau))
        seed.main()  # second démarrage du conteneur

        assert premier == (_compter(db, Utilisateur), _compter(db, Question), _compter(db, Niveau))
        assert premier[0] == len(seed.COMPTES_DEMO)
        assert premier[1] == sum(len(questions) for questions in QUESTIONS_DEMO.values())

    def test_une_question_deja_presente_n_est_pas_recreee(self, db):
        assert charger_questions_demo(db) > 0
        assert charger_questions_demo(db) == 0


class TestBanqueDeQuestions:
    @pytest.mark.parametrize("code_langue", sorted(QUESTIONS_DEMO))
    def test_chaque_niveau_cecrl_a_au_moins_deux_questions(self, code_langue):
        niveaux = [question.niveau for question in QUESTIONS_DEMO[code_langue]]

        for code_niveau, _ in seed.CECRL:
            assert niveaux.count(code_niveau) >= 2, f"{code_langue} {code_niveau}"

    @pytest.mark.parametrize("code_langue", sorted(QUESTIONS_DEMO))
    def test_les_questions_sont_corrigeables_par_le_scoring(self, code_langue):
        for question in QUESTIONS_DEMO[code_langue]:
            assert 0 <= question.bonne_reponse < len(question.choix), question.enonce
            assert len(set(question.choix)) == len(question.choix), question.enonce


class TestParcoursDeDemonstration:
    """Ce que fait un membre de l'équipe après `make up` : connexion du compte apprenant puis test complet."""

    def test_l_apprenant_demo_passe_le_diagnostic_d_anglais(self, client, monkeypatch):
        monkeypatch.setenv("SEED_DEMO", "true")
        seed.main()

        connexion = client.post(
            "/api/v1/auth/login",
            json={"email": "apprenant@digitheque.mg", "mot_de_passe": seed.MOT_DE_PASSE_DEMO},
        )
        assert connexion.status_code == 200, connexion.text
        entete = {"Authorization": f"Bearer {connexion.json()['access_token']}"}

        tentative = client.post("/api/v1/diagnostic/tentatives", headers=entete, json={"code_langue": "en"})
        assert tentative.status_code == 201, tentative.text
        tentative = tentative.json()
        questions = client.get(
            "/api/v1/diagnostic/questions",
            headers=entete,
            params={"code_langue": "en", "code_niveau": tentative["code_niveau"]},
        ).json()
        assert questions

        bonnes = {
            demo.enonce: demo.choix[demo.bonne_reponse]
            for demo in QUESTIONS_DEMO["en"]
            if demo.niveau == tentative["code_niveau"]
        }
        for question in questions:
            reponse = client.post(
                "/api/v1/diagnostic/reponse",
                headers=entete,
                json={
                    "id_tentative": tentative["id_tentative"],
                    "id_question": question["id_question"],
                    "reponse_fournie": bonnes[question["enonce"]],
                },
            )
            assert reponse.status_code == 201, reponse.text

        resultat = client.post(f"/api/v1/diagnostic/tentatives/{tentative['id_tentative']}/terminer", headers=entete)
        assert resultat.status_code == 200, resultat.text
        assert resultat.json()["percentage"] == 100
