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


def _compter_questions_diagnostic(db) -> int:
    """Depuis US-N01, `Question` est un alias de la banque `exercice` : on ne compte que son usage diagnostic."""
    db.expire_all()
    return db.scalar(select(func.count()).select_from(Question).where(Question.usage.in_(("diagnostic", "les deux"))))


class TestSeed:
    def test_sans_seed_demo_seul_le_referentiel_est_charge(self, db, monkeypatch):
        monkeypatch.setenv("SEED_DEMO", "false")

        seed.main()

        assert _compter(db, Langue) == len(seed.LANGUES)
        assert _compter(db, Formule) == len(seed.FORMULES)
        assert _compter(db, Utilisateur) == 0
        assert _compter_questions_diagnostic(db) == 0

    def test_seed_demo_charge_comptes_et_questions_sans_doublon(self, db, monkeypatch):
        monkeypatch.setenv("SEED_DEMO", "true")

        seed.main()
        premier = (_compter(db, Utilisateur), _compter_questions_diagnostic(db), _compter(db, Niveau))
        seed.main()  # second démarrage du conteneur

        assert premier == (_compter(db, Utilisateur), _compter_questions_diagnostic(db), _compter(db, Niveau))
        assert premier[0] == len(seed.COMPTES_DEMO)
        assert premier[1] == sum(len(questions) for questions in QUESTIONS_DEMO.values()) == 100

    def test_une_question_deja_presente_n_est_pas_recreee(self, db):
        assert charger_questions_demo(db) > 0
        assert charger_questions_demo(db) == 0

    def test_complete_les_niveaux_manquants_d_une_langue_existante_sans_doublon(self, db):
        mandarin = db.scalar(select(Langue).where(Langue.code == "zh"))
        mandarin.niveaux = [niveau for niveau in mandarin.niveaux if niveau.code not in ("HSK 5", "HSK 6")]
        db.commit()

        seed.charger_referentiel(db)
        seed.charger_referentiel(db)
        db.refresh(mandarin)

        assert [niveau.code for niveau in mandarin.niveaux] == [f"HSK {numero}" for numero in range(1, 7)]


class TestBanqueDeQuestions:
    @pytest.mark.parametrize("code_langue", sorted(QUESTIONS_DEMO))
    def test_banque_de_chaque_langue_couvre_les_niveaux_et_les_quatre_competences(self, code_langue):
        niveaux = [question.niveau for question in QUESTIONS_DEMO[code_langue]]
        questions = QUESTIONS_DEMO[code_langue]

        referentiel = seed.HSK if code_langue == "zh" else seed.CECRL
        for code_niveau, _ in referentiel:
            assert niveaux.count(code_niveau) >= 2, f"{code_langue} {code_niveau}"
        assert len(questions) == 20
        assert {
            format_: sum(q.format_exercice == format_ for q in questions)
            for format_ in ("qcm", "vrai_faux", "dictee", "texte_a_trous", "parler")
        } == {
            "qcm": 7,
            "vrai_faux": 1,
            "dictee": 2,
            "texte_a_trous": 5,
            "parler": 5,
        }
        assert sum(question.competence == "ecoute" for question in questions) == 5

    @pytest.mark.parametrize("code_langue", sorted(QUESTIONS_DEMO))
    def test_les_questions_sont_corrigeables_par_le_scoring(self, code_langue):
        for question in QUESTIONS_DEMO[code_langue]:
            assert question.bonne_reponse
            if question.choix:
                assert question.bonne_reponse in question.choix, question.enonce
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
        questions = tentative["questions"]
        assert len(questions) == 20
        assert len({question["niveau"] for question in questions}) > 1
        assert all("bonne_reponse" not in question for question in questions)

        bonnes = {(demo.enonce, demo.niveau): demo.bonne_reponse for demo in QUESTIONS_DEMO["en"]}
        for question in questions:
            reponse = client.post(
                "/api/v1/diagnostic/reponse",
                headers=entete,
                json={
                    "id_tentative": tentative["id_tentative"],
                    "id_question": question["id_question"],
                    "reponse_fournie": bonnes[(question["enonce"], question["niveau"])],
                },
            )
            assert reponse.status_code == 201, reponse.text

        resultat = client.post(f"/api/v1/diagnostic/tentatives/{tentative['id_tentative']}/terminer", headers=entete)
        assert resultat.status_code == 200, resultat.text
        assert resultat.json()["percentage"] == 100
