"""Lecture des questions filtrées par langue et niveau."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Langue, Niveau, Question, Role
from tests.conftest import creer_utilisateur, entete


def _ajouter_question(
    db: Session,
    code_langue: str,
    code_niveau: str,
    *,
    enonce: str,
    competence: str = "grammaire",
    type_reponse: str = "choix",
    choix: list[str] | None = None,
    support: str | None = None,
    audio_url: str | None = None,
    audio_texte: str | None = None,
) -> Question:
    question = Question(
        enonce=enonce,
        competence=competence,
        type_reponse=type_reponse,
        choix=choix,
        support=support,
        audio_url=audio_url,
        audio_texte=audio_texte,
        langue=db.scalar(select(Langue).where(Langue.code == code_langue)),
        niveau=db.scalar(select(Niveau).where(Niveau.code == code_niveau)),
    )
    db.add(question)
    db.commit()
    return question


class TestListerQuestions:
    def test_filtre_exactement_par_langue_et_niveau_et_ne_renvoie_pas_la_correction(self, client, db: Session):
        apprenant = creer_utilisateur(db)
        question = _ajouter_question(
            db,
            "en",
            "A1",
            enonce="She ___ a student.",
            choix=["is", "are", "am", "be"],
        )
        _ajouter_question(db, "en", "A2", enonce="Question anglaise A2")
        _ajouter_question(db, "fr", "A1", enonce="Question française A1")

        reponse = client.get(
            "/api/v1/diagnostic/questions",
            headers=entete(apprenant),
            params={"code_langue": "en", "code_niveau": "A1"},
        )

        assert reponse.status_code == 200
        assert reponse.json() == [
            {
                "id_question": str(question.id_question),
                "niveau": "A1",
                "competence": "grammaire",
                "type_reponse": "choix",
                "enonce": "She ___ a student.",
                "choix": ["is", "are", "am", "be"],
            }
        ]
        assert "bonne_reponse" not in reponse.text

    def test_renvoie_les_contenus_optionnels_du_frontend_et_omet_les_valeurs_absentes(self, client, db: Session):
        apprenant = creer_utilisateur(db)
        _ajouter_question(
            db,
            "fr",
            "B2",
            enonce="Que conseille la personne ?",
            competence="ecoute",
            choix=["Réserver à l'avance", "Prendre le bus"],
            audio_texte="Je vous conseille de réserver à l'avance.",
            support="Texte de compréhension",
            audio_url="/media/questions/fr-b2.webm",
        )
        _ajouter_question(db, "fr", "B2", enonce="Rédigez une réponse.", type_reponse="texte")

        reponse = client.get(
            "/api/v1/diagnostic/questions",
            headers=entete(apprenant),
            params={"code_langue": "fr", "code_niveau": "B2"},
        )

        assert reponse.status_code == 200
        questions = reponse.json()
        assert questions[0]["audio_texte"] == "Je vous conseille de réserver à l'avance."
        assert questions[0]["audio_url"] == "/media/questions/fr-b2.webm"
        assert questions[0]["support"] == "Texte de compréhension"
        assert questions[1]["type_reponse"] == "texte"
        assert "choix" not in questions[1]

    def test_renvoie_une_liste_vide_si_aucune_question_ne_correspond(self, client, db: Session):
        apprenant = creer_utilisateur(db)

        reponse = client.get(
            "/api/v1/diagnostic/questions",
            headers=entete(apprenant),
            params={"code_langue": "en", "code_niveau": "C2"},
        )

        assert reponse.status_code == 200
        assert reponse.json() == []

    def test_exige_une_session_et_le_role_apprenant(self, client, db: Session):
        assert (
            client.get(
                "/api/v1/diagnostic/questions",
                params={"code_langue": "en", "code_niveau": "A1"},
            ).status_code
            == 401
        )

        formateur = creer_utilisateur(db, Role.FORMATEUR, email="formateur@exemple.com")
        reponse = client.get(
            "/api/v1/diagnostic/questions",
            headers=entete(formateur),
            params={"code_langue": "en", "code_niveau": "A1"},
        )
        assert reponse.status_code == 403

    def test_refuse_les_codes_inconnus_et_un_niveau_non_ouvert_pour_la_langue(self, client, db: Session):
        apprenant = creer_utilisateur(db)
        headers = entete(apprenant)

        langue_inconnue = client.get(
            "/api/v1/diagnostic/questions",
            headers=headers,
            params={"code_langue": "xx", "code_niveau": "A1"},
        )
        assert langue_inconnue.status_code == 404

        niveau_inconnu = client.get(
            "/api/v1/diagnostic/questions",
            headers=headers,
            params={"code_langue": "en", "code_niveau": "X9"},
        )
        assert niveau_inconnu.status_code == 404

        niveau_non_ouvert = client.get(
            "/api/v1/diagnostic/questions",
            headers=headers,
            params={"code_langue": "zh", "code_niveau": "A1"},
        )
        assert niveau_non_ouvert.status_code == 422
