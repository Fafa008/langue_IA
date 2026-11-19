"""Test de fumée (US46-QA réduit) : génération et cohérence du parcours après diagnostic."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Exercice,
    Langue,
    Niveau,
    Parcours,
    ParcoursExercice,
    Question,
    StatutParcours,
    TypeExercice,
)
from tests.conftest import creer_utilisateur, entete


def _question_a1(db: Session, code_langue: str = "en", enonce: str = "Smoke ___ test.") -> Question:
    choix = ["is", "are", "am", "be"]
    question = Question(
        enonce=enonce,
        competence="grammaire",
        type_reponse="choix",
        choix=choix,
        reponse_correcte=choix[0],
        langue=db.scalar(select(Langue).where(Langue.code == code_langue)),
        niveau=db.scalar(select(Niveau).where(Niveau.code == "A1")),
    )
    db.add(question)
    db.commit()
    return question


class TestSmokeGenerationParcours:
    def test_termine_le_diagnostic_et_genere_un_parcours_coherent(self, client, db: Session):
        apprenant = creer_utilisateur(db, email="smoke.parcours@exemple.com")
        question = _question_a1(db)

        creation = client.post(
            "/api/v1/diagnostic/tentatives",
            headers=entete(apprenant),
            json={"code_langue": "en"},
        )
        assert creation.status_code == 201
        id_tentative = creation.json()["id_tentative"]

        reponse = client.post(
            "/api/v1/diagnostic/reponse",
            headers=entete(apprenant),
            json={
                "id_tentative": id_tentative,
                "id_question": str(question.id_question),
                "reponse_fournie": question.reponse_correcte,
            },
        )
        assert reponse.status_code == 201

        fin = client.post(
            f"/api/v1/diagnostic/tentatives/{id_tentative}/terminer",
            headers=entete(apprenant),
        )
        assert fin.status_code == 200
        resultat = fin.json()
        assert resultat["id_tentative"] == id_tentative
        assert resultat["framework"] == "CECRL"
        assert resultat["level"] == "C2"
        assert resultat["percentage"] == 100.0

        db.expire_all()
        parcours = db.scalar(select(Parcours).where(Parcours.id_test == id_tentative))
        assert parcours is not None
        assert parcours.id_langue == question.id_langue
        assert parcours.statut == StatutParcours.EN_COURS
        assert parcours.niveau_vise.code == "C2"
        # Niveau C2 = rang 5 sur l'échelle CECRL ouverte (A1..C2) => 5 * 7 + 1.
        assert parcours.lecon_atteinte == 36
        assert db.scalar(select(func.count()).select_from(Parcours).where(Parcours.id_test == id_tentative)) == 1

    def test_generation_associe_les_exercices_disponibles_du_catalogue(self, client, db: Session):
        apprenant = creer_utilisateur(db, email="smoke.exercices@exemple.com")
        question = _question_a1(db, enonce="Smoke ___ catalogue.")
        langue = db.scalar(select(Langue).where(Langue.code == "en"))
        niveau_c2 = db.scalar(select(Niveau).where(Niveau.code == "C2"))
        exercice = Exercice(
            type=TypeExercice.GRAMMAIRE,
            contenu="Exercice de fumée C2",
            difficulte=3,
            langue=langue,
            niveau=niveau_c2,
        )
        db.add(exercice)
        db.commit()

        creation = client.post(
            "/api/v1/diagnostic/tentatives",
            headers=entete(apprenant),
            json={"code_langue": "en"},
        )
        assert creation.status_code == 201
        id_tentative = creation.json()["id_tentative"]

        client.post(
            "/api/v1/diagnostic/reponse",
            headers=entete(apprenant),
            json={
                "id_tentative": id_tentative,
                "id_question": str(question.id_question),
                "reponse_fournie": question.reponse_correcte,
            },
        )
        fin = client.post(
            f"/api/v1/diagnostic/tentatives/{id_tentative}/terminer",
            headers=entete(apprenant),
        )
        assert fin.status_code == 200

        db.expire_all()
        parcours = db.scalar(select(Parcours).where(Parcours.id_test == id_tentative))
        assert parcours is not None
        liens = db.scalars(select(ParcoursExercice).where(ParcoursExercice.id_parcours == parcours.id_parcours)).all()
        assert len(liens) == 1
        assert liens[0].id_exercice == exercice.id_exercice
        assert liens[0].numero_lecon == parcours.lecon_atteinte
        assert liens[0].score_obtenu is None
