"""US-N01 : la banque unique sert le diagnostic et le parcours sans mélanger leurs usages.

Les exercices migrés et les questions créées par les tests partagent désormais la table `exercice` ;
`usage` et `statut` doivent donc être filtrés des deux côtés (D1, D3), et le seed de démonstration
reste identifiable comme donnée de test sans audio (D7, D8).
"""

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import seed
from app.models import Exercice, Langue, Niveau, Question, TypeExercice
from app.seed_diagnostic import QUESTIONS_DEMO
from app.services.diagnostic import lister_questions
from app.services.parcours import selectionner_exercices


def _langue_et_niveau(db: Session, code_langue: str = "fr", code_niveau: str = "A1") -> tuple[Langue, Niveau]:
    langue = db.scalar(select(Langue).where(Langue.code == code_langue))
    niveau = db.scalar(select(Niveau).where(Niveau.code == code_niveau))
    assert langue is not None and niveau is not None
    return langue, niveau


def _exercice_parcours(db: Session, enonce: str, usage: str = "parcours", statut: str = "publié") -> Exercice:
    langue, niveau = _langue_et_niveau(db, "en")
    exercice = Exercice(
        type=TypeExercice.GRAMMAIRE,
        contenu=json.dumps({"enonce": enonce}),
        difficulte=1,
        langue=langue,
        niveau=niveau,
        usage=usage,
        statut=statut,
    )
    db.add(exercice)
    db.commit()
    return exercice


def _question_diagnostic(db: Session, enonce: str, usage: str = "diagnostic", statut: str = "publié") -> Question:
    langue, niveau = _langue_et_niveau(db)
    question = Question(
        enonce=enonce,
        competence="grammaire",
        type_reponse="choix",
        choix=["a", "b"],
        reponse_correcte="a",
        langue=langue,
        niveau=niveau,
    )
    question.usage = usage
    question.statut = statut
    db.add(question)
    db.commit()
    return question


class TestSelectionDepuisLaBanque:
    def test_diagnostic_selectionne_uniquement_les_exercices_publies_du_diagnostic(self, db: Session):
        publiee = _question_diagnostic(db, "Publiée diagnostic")
        partagee = _question_diagnostic(db, "Publiée les deux", usage="les deux")
        brouillon = _question_diagnostic(db, "Brouillon diagnostic", statut="brouillon")
        parcours = _exercice_parcours(db, "Réservé parcours")

        _, questions = lister_questions(db, "fr", "A1")

        ids = {question.id_exercice for question in questions}
        assert ids == {publiee.id_exercice, partagee.id_exercice}
        assert brouillon.id_exercice not in ids
        assert parcours.id_exercice not in ids

    def test_brouillon_hors_parcours(self, db: Session):
        publie = _exercice_parcours(db, "Publié parcours")
        brouillon = _exercice_parcours(db, "Brouillon parcours", statut="brouillon")
        diagnostic = _question_diagnostic(db, "Réservé diagnostic")
        _, niveau = _langue_et_niveau(db, "en")

        selection = selectionner_exercices(db, publie.id_langue, niveau, niveau, [niveau], [])

        assert [exercice.id_exercice for exercice in selection] == [publie.id_exercice]
        assert brouillon.id_exercice not in {exercice.id_exercice for exercice in selection}
        assert diagnostic.id_exercice not in {exercice.id_exercice for exercice in selection}


class TestSeedSansAudio:
    def test_les_questions_du_seed_sont_des_donnees_de_test_sans_audio(self, db, monkeypatch):
        monkeypatch.setenv("SEED_DEMO", "true")
        seed.main()

        questions = db.scalars(select(Question).where(Question.usage.in_(("diagnostic", "les deux")))).all()
        assert len(questions) == sum(len(groupe) for groupe in QUESTIONS_DEMO.values())
        assert all(question.donnees_test for question in questions)
        assert all(question.audio_ref is None for question in questions)
        assert all("audio_url" not in json.loads(question.contenu) for question in questions)
        assert all(question.framework == "CECRL" for question in questions)
