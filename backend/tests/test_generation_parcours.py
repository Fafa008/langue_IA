"""Génération du parcours personnalisé à partir du diagnostic (US36, US38)."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Exercice,
    Langue,
    Niveau,
    Parcours,
    ParcoursExercice,
    Question,
    Reponse,
    StatutDiagnostic,
    StatutParcours,
    TypeExercice,
)
from app.models import TestDiagnostic as TentativeDiagnostic
from app.services.parcours import (
    LECONS_PAR_PALIER,
    calculer_lecon_atteinte,
    calculer_niveau_vise,
    extraire_domaines_faibles,
    generer_parcours,
    selectionner_exercices,
)
from tests.conftest import creer_utilisateur, entete


def _question_scorable(db: Session, code_langue: str, code_niveau: str, enonce: str, correcte: int = 0) -> Question:
    choix = ["is", "are", "am", "be"]
    question = Question(
        enonce=enonce,
        competence="grammaire",
        type_reponse="choix",
        choix=choix,
        reponse_correcte=choix[correcte],
        langue=db.scalar(select(Langue).where(Langue.code == code_langue)),
        niveau=db.scalar(select(Niveau).where(Niveau.code == code_niveau)),
    )
    db.add(question)
    db.commit()
    return question


def _creer_tentative_avec_question(
    db: Session, apprenant, code_langue: str = "en"
) -> tuple[TentativeDiagnostic, Question]:
    question = _question_scorable(db, code_langue, "A1", "She ___ a student.")
    langue = db.scalar(select(Langue).where(Langue.code == code_langue))
    niveau = db.scalar(select(Niveau).where(Niveau.code == "A1"))
    tentative = TentativeDiagnostic(apprenant=apprenant.apprenant, langue=langue, niveau=niveau)
    db.add(tentative)
    db.commit()
    return tentative, question


def _creer_exercice(
    db: Session,
    code_langue: str,
    code_niveau: str,
    type_exercice: TypeExercice,
    difficulte: int = 1,
    contenu: str | None = None,
) -> Exercice:
    exercice = Exercice(
        type=type_exercice,
        contenu=contenu or f"{code_langue}-{code_niveau}-{type_exercice.value}-{difficulte}",
        difficulte=difficulte,
        langue=db.scalar(select(Langue).where(Langue.code == code_langue)),
        niveau=db.scalar(select(Niveau).where(Niveau.code == code_niveau)),
    )
    db.add(exercice)
    db.commit()
    return exercice


class TestReglesGeneration:
    def test_extraire_domaines_faibles_depuis_analyse(self):
        analyse = {
            "resultat": {
                "points_faibles": [
                    {"domaine": "grammaire"},
                    {"domaine": "vocabulaire"},
                    {"domaine": "grammaire"},
                    "invalide",
                ]
            }
        }
        assert extraire_domaines_faibles(analyse) == ["grammaire", "vocabulaire"]

    def test_extraire_domaines_faibles_absents_ou_invalides(self):
        assert extraire_domaines_faibles(None) == []
        assert extraire_domaines_faibles({}) == []
        assert extraire_domaines_faibles({"resultat": None}) == []
        assert extraire_domaines_faibles({"resultat": {"points_faibles": "x"}}) == []

    def test_niveau_vise_est_le_niveau_suivant(self, db: Session):
        langue = db.scalar(select(Langue).where(Langue.code == "en"))
        niveau = db.scalar(select(Niveau).where(Niveau.code == "A2"))
        assert langue is not None and niveau is not None
        vise = calculer_niveau_vise(niveau, list(langue.niveaux))
        assert vise.code == "B1"

    def test_niveau_vise_reste_le_maximum(self, db: Session):
        langue = db.scalar(select(Langue).where(Langue.code == "en"))
        niveau = db.scalar(select(Niveau).where(Niveau.code == "C2"))
        assert langue is not None and niveau is not None
        vise = calculer_niveau_vise(niveau, list(langue.niveaux))
        assert vise.code == "C2"

    def test_lecon_atteinte_selon_le_rang_du_niveau(self, db: Session):
        langue = db.scalar(select(Langue).where(Langue.code == "en"))
        assert langue is not None
        a1 = db.scalar(select(Niveau).where(Niveau.code == "A1"))
        b1 = db.scalar(select(Niveau).where(Niveau.code == "B1"))
        assert a1 is not None and b1 is not None
        assert calculer_lecon_atteinte(a1, list(langue.niveaux)) == 1
        assert calculer_lecon_atteinte(b1, list(langue.niveaux)) == 2 * LECONS_PAR_PALIER + 1


class TestGenerationService:
    def test_cree_un_parcours_pour_une_tentative_terminee(self, db: Session):
        apprenant = creer_utilisateur(db)
        tentative, question = _creer_tentative_avec_question(db, apprenant)
        # Réponse correcte -> 100% => C2
        db.add(Reponse(tentative=tentative, question=question, reponse_fournie=question.reponse_correcte))
        tentative.statut = StatutDiagnostic.TERMINE
        tentative.score = 100
        tentative.niveau_final = db.scalar(select(Niveau).where(Niveau.code == "C2"))
        db.commit()
        db.refresh(tentative)

        parcours = generer_parcours(db, tentative)
        db.commit()

        assert parcours is not None
        assert parcours.id_test == tentative.id_test
        assert parcours.id_langue == tentative.id_langue
        assert parcours.niveau_vise.code == "C2"
        assert parcours.lecon_atteinte == 5 * LECONS_PAR_PALIER + 1
        assert parcours.statut == StatutParcours.EN_COURS

    def test_est_idempotent_pour_une_meme_tentative(self, db: Session):
        apprenant = creer_utilisateur(db)
        tentative, question = _creer_tentative_avec_question(db, apprenant)
        db.add(Reponse(tentative=tentative, question=question, reponse_fournie=question.reponse_correcte))
        tentative.statut = StatutDiagnostic.TERMINE
        tentative.score = 100
        tentative.niveau_final = db.scalar(select(Niveau).where(Niveau.code == "A1"))
        db.commit()
        db.refresh(tentative)

        premier = generer_parcours(db, tentative)
        db.commit()
        second = generer_parcours(db, tentative)
        db.commit()

        assert premier is not None and second is not None
        assert premier.id_parcours == second.id_parcours
        assert db.scalar(select(func.count()).select_from(Parcours)) == 1

    def test_ne_genere_pas_si_la_tentative_n_est_pas_terminee(self, db: Session):
        apprenant = creer_utilisateur(db)
        tentative, _ = _creer_tentative_avec_question(db, apprenant)
        tentative.niveau_final = db.scalar(select(Niveau).where(Niveau.code == "A1"))
        db.commit()
        db.refresh(tentative)

        assert generer_parcours(db, tentative) is None
        assert db.scalar(select(func.count()).select_from(Parcours)) == 0

    def test_genere_meme_sans_analyse_ia(self, db: Session):
        apprenant = creer_utilisateur(db)
        tentative, question = _creer_tentative_avec_question(db, apprenant)
        db.add(Reponse(tentative=tentative, question=question, reponse_fournie=question.reponse_correcte))
        tentative.statut = StatutDiagnostic.TERMINE
        tentative.score = 0
        tentative.niveau_final = db.scalar(select(Niveau).where(Niveau.code == "A1"))
        tentative.analyse_ia = None
        db.commit()
        db.refresh(tentative)

        parcours = generer_parcours(db, tentative)
        db.commit()

        assert parcours is not None
        assert parcours.niveau_vise.code == "A2"
        assert parcours.lecon_atteinte == 1


class TestAssociationExercices:
    def test_associe_des_exercices_de_la_langue_et_du_niveau_vise(self, db: Session):
        apprenant = creer_utilisateur(db)
        tentative, question = _creer_tentative_avec_question(db, apprenant)
        ex_a1 = _creer_exercice(db, "en", "A1", TypeExercice.GRAMMAIRE, 1)
        ex_a2 = _creer_exercice(db, "en", "A2", TypeExercice.VOCABULAIRE, 1)
        _creer_exercice(db, "en", "B1", TypeExercice.COMPREHENSION, 1)
        _creer_exercice(db, "fr", "A1", TypeExercice.GRAMMAIRE, 1)
        db.add(Reponse(tentative=tentative, question=question, reponse_fournie=question.reponse_correcte))
        tentative.statut = StatutDiagnostic.TERMINE
        tentative.score = 0
        tentative.niveau_final = db.scalar(select(Niveau).where(Niveau.code == "A1"))  # vise A2
        db.commit()
        db.refresh(tentative)

        parcours = generer_parcours(db, tentative)
        db.commit()

        assert parcours is not None
        liens = db.scalars(select(ParcoursExercice).where(ParcoursExercice.id_parcours == parcours.id_parcours)).all()
        ids_exercices = {lien.id_exercice for lien in liens}
        assert ids_exercices == {ex_a1.id_exercice, ex_a2.id_exercice}
        assert all(lien.numero_lecon == parcours.lecon_atteinte for lien in liens)
        assert all(lien.score_obtenu is None for lien in liens)

    def test_priorise_les_exercices_lies_aux_points_faibles(self, db: Session):
        apprenant = creer_utilisateur(db)
        tentative, question = _creer_tentative_avec_question(db, apprenant)
        ex_vocab = _creer_exercice(db, "en", "A1", TypeExercice.VOCABULAIRE, 1, "vocab")
        ex_gram = _creer_exercice(db, "en", "A1", TypeExercice.GRAMMAIRE, 1, "gram")
        ex_comp = _creer_exercice(db, "en", "A1", TypeExercice.COMPREHENSION, 1, "comp")
        db.add(Reponse(tentative=tentative, question=question, reponse_fournie=question.reponse_correcte))
        tentative.statut = StatutDiagnostic.TERMINE
        tentative.score = 0
        tentative.niveau_final = db.scalar(select(Niveau).where(Niveau.code == "A1"))
        tentative.analyse_ia = {"resultat": {"points_faibles": [{"domaine": "vocabulaire"}, {"domaine": "grammaire"}]}}
        db.commit()
        db.refresh(tentative)

        langue = db.scalar(select(Langue).where(Langue.code == "en"))
        niveau_final = db.scalar(select(Niveau).where(Niveau.code == "A1"))
        niveau_vise = db.scalar(select(Niveau).where(Niveau.code == "A2"))
        assert langue and niveau_final and niveau_vise
        selection = selectionner_exercices(
            db,
            tentative.id_langue,
            niveau_final,
            niveau_vise,
            list(langue.niveaux),
            ["vocabulaire", "grammaire"],
        )
        assert [ex.id_exercice for ex in selection[:3]] == [
            ex_vocab.id_exercice,
            ex_gram.id_exercice,
            ex_comp.id_exercice,
        ]

    def test_ne_duplique_pas_les_associations_si_generation_rejouee(self, db: Session):
        apprenant = creer_utilisateur(db)
        tentative, question = _creer_tentative_avec_question(db, apprenant)
        _creer_exercice(db, "en", "A1", TypeExercice.GRAMMAIRE, 1)
        _creer_exercice(db, "en", "A2", TypeExercice.VOCABULAIRE, 1)
        db.add(Reponse(tentative=tentative, question=question, reponse_fournie=question.reponse_correcte))
        tentative.statut = StatutDiagnostic.TERMINE
        tentative.score = 0
        tentative.niveau_final = db.scalar(select(Niveau).where(Niveau.code == "A1"))
        db.commit()
        db.refresh(tentative)

        parcours = generer_parcours(db, tentative)
        db.commit()
        assert parcours is not None
        # rejoue l'association sur le parcours existant
        exercices = selectionner_exercices(
            db,
            tentative.id_langue,
            tentative.niveau_final,
            parcours.niveau_vise,
            list(tentative.langue.niveaux),
            [],
        )
        from app.services.parcours import associer_exercices

        associer_exercices(db, parcours, exercices, parcours.lecon_atteinte)
        db.commit()

        assert (
            db.scalar(
                select(func.count())
                .select_from(ParcoursExercice)
                .where(ParcoursExercice.id_parcours == parcours.id_parcours)
            )
            == 2
        )

    def test_parcours_cree_sans_exercices_si_catalogue_vide(self, db: Session):
        apprenant = creer_utilisateur(db)
        tentative, question = _creer_tentative_avec_question(db, apprenant)
        db.add(Reponse(tentative=tentative, question=question, reponse_fournie=question.reponse_correcte))
        tentative.statut = StatutDiagnostic.TERMINE
        tentative.score = 0
        tentative.niveau_final = db.scalar(select(Niveau).where(Niveau.code == "A1"))
        db.commit()
        db.refresh(tentative)

        parcours = generer_parcours(db, tentative)
        db.commit()

        assert parcours is not None
        assert (
            db.scalar(
                select(func.count())
                .select_from(ParcoursExercice)
                .where(ParcoursExercice.id_parcours == parcours.id_parcours)
            )
            == 0
        )


class TestGenerationApresDiagnostic:
    def test_le_parcours_est_cree_et_exercices_associes_a_la_cloture(self, client, db: Session):
        apprenant = creer_utilisateur(db)
        question = _question_scorable(db, "en", "A1", "She ___ a student.", correcte=0)
        # Réponse incorrecte -> niveau final A1 (visé A2) : l'exercice A1 est éligible.
        ex = _creer_exercice(db, "en", "A1", TypeExercice.GRAMMAIRE, 1)
        mauvaise_reponse = next(c for c in question.choix if c != question.reponse_correcte)

        creation = client.post(
            "/api/v1/diagnostic/tentatives",
            headers=entete(apprenant),
            json={"code_langue": "en"},
        )
        assert creation.status_code == 201
        id_tentative = creation.json()["id_tentative"]

        enregistrement = client.post(
            "/api/v1/diagnostic/reponse",
            headers=entete(apprenant),
            json={
                "id_tentative": id_tentative,
                "id_question": str(question.id_question),
                "reponse_fournie": mauvaise_reponse,
            },
        )
        assert enregistrement.status_code == 201

        fin = client.post(
            f"/api/v1/diagnostic/tentatives/{id_tentative}/terminer",
            headers=entete(apprenant),
        )
        assert fin.status_code == 200

        db.expire_all()
        parcours = db.scalar(select(Parcours).where(Parcours.id_test == id_tentative))
        assert parcours is not None
        assert parcours.niveau_vise is not None
        assert parcours.lecon_atteinte >= 1
        liens = db.scalars(select(ParcoursExercice).where(ParcoursExercice.id_parcours == parcours.id_parcours)).all()
        assert len(liens) >= 1
        assert any(lien.id_exercice == ex.id_exercice for lien in liens)
