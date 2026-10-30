"""Opérations métier et persistance du test de diagnostic."""

from dataclasses import dataclass
from enum import Enum

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Langue, Niveau, Question, Reponse, StatutDiagnostic, TestDiagnostic


class CodeErreurDiagnostic(str, Enum):
    LANGUE_INCONNUE = "langue_inconnue"
    NIVEAU_INCONNU = "niveau_inconnu"
    NIVEAU_NON_OUVERT = "niveau_non_ouvert"
    AUCUNE_QUESTION = "aucune_question"
    TENTATIVE_INCONNUE = "tentative_inconnue"
    TENTATIVE_TERMINEE = "tentative_terminee"
    QUESTION_INCONNUE = "question_inconnue"
    QUESTION_HORS_TENTATIVE = "question_hors_tentative"
    CHOIX_INVALIDE = "choix_invalide"
    AUDIO_NON_DISPONIBLE = "audio_non_disponible"
    REPONSE_DIFFERENTE = "reponse_differente"


TYPES_ENREGISTRABLES = ("choix", "texte")
"""Types de questions posées pendant le test (l'audio attend un stockage des médias)."""


@dataclass(frozen=True)
class LangueDiagnostic:
    """Langue proposée sur l'écran d'accueil du test, avec ce qu'un apprenant peut en attendre."""

    langue: Langue
    niveau_depart: Niveau | None
    nombre_questions: int


class ErreurDiagnostic(Exception):
    """Erreur métier du diagnostic, traduite en HTTP par la couche API."""

    def __init__(self, code: CodeErreurDiagnostic) -> None:
        self.code = code
        super().__init__(code.value)


def lister_questions(db: Session, code_langue: str, code_niveau: str) -> tuple[Niveau, list[Question]]:
    """Retourne les questions d'une langue et d'un niveau ouverts."""
    langue = db.scalar(select(Langue).where(Langue.code == code_langue))
    if langue is None:
        raise ErreurDiagnostic(CodeErreurDiagnostic.LANGUE_INCONNUE)

    niveau = db.scalar(select(Niveau).where(Niveau.code == code_niveau))
    if niveau is None:
        raise ErreurDiagnostic(CodeErreurDiagnostic.NIVEAU_INCONNU)
    if niveau.id_niveau not in {niveau_ouvert.id_niveau for niveau_ouvert in langue.niveaux}:
        raise ErreurDiagnostic(CodeErreurDiagnostic.NIVEAU_NON_OUVERT)

    questions = db.scalars(
        select(Question)
        .where(Question.id_langue == langue.id_langue, Question.id_niveau == niveau.id_niveau)
        .order_by(Question.id_question)
    ).all()
    return niveau, list(questions)


def _questions_par_niveau(db: Session, langue: Langue) -> dict[int, int]:
    """Nombre de questions enregistrables de la langue, pour chacun de ses niveaux ouverts."""
    lignes = db.execute(
        select(Question.id_niveau, func.count())
        .where(
            Question.id_langue == langue.id_langue,
            Question.id_niveau.in_([niveau.id_niveau for niveau in langue.niveaux]),
            Question.type_reponse.in_(TYPES_ENREGISTRABLES),
        )
        .group_by(Question.id_niveau)
    ).all()
    return {id_niveau: nombre for id_niveau, nombre in lignes}


def _niveau_de_depart(db: Session, langue: Langue) -> tuple[Niveau | None, int]:
    """Premier niveau ouvert qui possède des questions enregistrables, et son nombre de questions."""
    questions = _questions_par_niveau(db, langue)
    niveau = next((niveau for niveau in langue.niveaux if questions.get(niveau.id_niveau)), None)
    return niveau, questions.get(niveau.id_niveau, 0) if niveau else 0


def lister_langues(db: Session) -> list[LangueDiagnostic]:
    """Toutes les langues, triées par libellé, avec leur niveau de départ et le nombre de questions du test."""
    langues = db.scalars(select(Langue).order_by(Langue.libelle)).all()
    return [LangueDiagnostic(langue, *_niveau_de_depart(db, langue)) for langue in langues]


def creer_tentative(db: Session, id_apprenant: int, code_langue: str) -> TestDiagnostic:
    """Crée une tentative au premier niveau ouvert qui possède des questions enregistrables."""
    langue = db.scalar(select(Langue).where(Langue.code == code_langue))
    if langue is None:
        raise ErreurDiagnostic(CodeErreurDiagnostic.LANGUE_INCONNUE)

    niveau, _ = _niveau_de_depart(db, langue)
    if niveau is None:
        raise ErreurDiagnostic(CodeErreurDiagnostic.AUCUNE_QUESTION)

    tentative = TestDiagnostic(id_apprenant=id_apprenant, langue=langue, niveau=niveau)
    db.add(tentative)
    db.commit()
    db.refresh(tentative)
    return tentative


def enregistrer_reponse(
    db: Session,
    id_apprenant: int,
    id_tentative: int,
    id_question: int,
    reponse_fournie: str,
) -> Reponse:
    """Persiste une réponse non évaluée et rend les répétitions identiques idempotentes."""
    tentative = db.scalar(
        select(TestDiagnostic).where(
            TestDiagnostic.id_test == id_tentative,
            TestDiagnostic.id_apprenant == id_apprenant,
        )
    )
    if tentative is None:
        raise ErreurDiagnostic(CodeErreurDiagnostic.TENTATIVE_INCONNUE)
    if tentative.statut != StatutDiagnostic.EN_COURS:
        raise ErreurDiagnostic(CodeErreurDiagnostic.TENTATIVE_TERMINEE)

    question = db.get(Question, id_question)
    if question is None:
        raise ErreurDiagnostic(CodeErreurDiagnostic.QUESTION_INCONNUE)
    if question.id_langue != tentative.id_langue or question.id_niveau != tentative.id_niveau:
        raise ErreurDiagnostic(CodeErreurDiagnostic.QUESTION_HORS_TENTATIVE)
    if question.type_reponse == "choix" and reponse_fournie not in (question.choix or []):
        raise ErreurDiagnostic(CodeErreurDiagnostic.CHOIX_INVALIDE)
    if question.type_reponse == "audio":
        raise ErreurDiagnostic(CodeErreurDiagnostic.AUDIO_NON_DISPONIBLE)

    precedente = db.scalar(
        select(Reponse).where(
            Reponse.id_tentative == tentative.id_test,
            Reponse.id_question == question.id_question,
        )
    )
    if precedente is not None:
        if precedente.reponse_fournie == reponse_fournie:
            return precedente
        raise ErreurDiagnostic(CodeErreurDiagnostic.REPONSE_DIFFERENTE)

    reponse = Reponse(
        tentative=tentative,
        question=question,
        reponse_fournie=reponse_fournie,
    )
    db.add(reponse)
    try:
        db.commit()
    except IntegrityError as erreur:
        db.rollback()
        code_postgres = getattr(erreur.orig, "sqlstate", None) or getattr(erreur.orig, "pgcode", None)
        nom_contrainte = getattr(getattr(erreur.orig, "diag", None), "constraint_name", None)
        if code_postgres != "23505" or nom_contrainte != "reponse_id_tentative_id_question_key":
            raise

        precedente = db.scalar(
            select(Reponse).where(
                Reponse.id_tentative == id_tentative,
                Reponse.id_question == id_question,
            )
        )
        if precedente is not None and precedente.reponse_fournie == reponse_fournie:
            return precedente
        raise ErreurDiagnostic(CodeErreurDiagnostic.REPONSE_DIFFERENTE) from None

    db.refresh(reponse)
    return reponse
