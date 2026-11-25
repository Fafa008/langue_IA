"""Opérations métier et persistance du test de diagnostic."""

from dataclasses import dataclass
from enum import Enum

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Langue, Niveau, Question, Reponse, StatutDiagnostic, TestDiagnostic
from app.models.parcours import PACK_DIAGNOSTIC_COMPLET


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
"""Types de réponses enregistrables : l'audio est refusé, faute de stockage de médias pour les réponses."""

NOMBRE_QUESTIONS_DIAGNOSTIC = 20

USAGES_DIAGNOSTIC = ("diagnostic", "les deux")
"""D3 : un exercice peut servir au diagnostic seul ou aux deux usages."""


def _exercices_de_diagnostic(exercices: list[Question]) -> list[Question]:
    """D1/D3 : seuls les exercices publiés proposables au diagnostic sont retenus."""
    return [exercice for exercice in exercices if exercice.statut == "publié" and exercice.usage in USAGES_DIAGNOSTIC]


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

    exercices = db.scalars(
        select(Question)
        .where(Question.id_langue == langue.id_langue, Question.id_niveau == niveau.id_niveau)
        .order_by(Question.id_question)
    ).all()
    return niveau, _exercices_de_diagnostic(list(exercices))


def _questions_du_test(db: Session, langue: Langue) -> list[Question]:
    """Questions enregistrables de tous les niveaux ouverts, dans l'ordre pédagogique."""
    niveaux = langue.niveaux
    rangs = {niveau.id_niveau: rang for rang, niveau in enumerate(niveaux)}
    if not rangs:
        return []

    exercices = _exercices_de_diagnostic(
        list(
            db.scalars(
                select(Question).where(
                    Question.id_langue == langue.id_langue,
                    Question.id_niveau.in_(rangs),
                )
            ).all()
        )
    )
    questions = [exercice for exercice in exercices if exercice.type_reponse in TYPES_ENREGISTRABLES]
    pack = [question for question in questions if question.diagnostic_pack == PACK_DIAGNOSTIC_COMPLET]
    if pack:
        questions = pack
    return sorted(questions, key=lambda question: (rangs[question.id_niveau], question.id_question))


def _niveau_de_depart(questions: list[Question]) -> Niveau | None:
    """Niveau le plus bas présent dans le test, conservé comme niveau initial de la tentative."""
    return questions[0].niveau if questions else None


def lister_langues(db: Session) -> list[LangueDiagnostic]:
    """Toutes les langues, avec leur niveau initial et le nombre de questions multi-niveaux disponibles."""
    langues = db.scalars(select(Langue).order_by(Langue.libelle)).all()
    resultats = []
    for langue in langues:
        questions = _questions_du_test(db, langue)
        nombre = min(len(questions), NOMBRE_QUESTIONS_DIAGNOSTIC)
        resultats.append(LangueDiagnostic(langue, _niveau_de_depart(questions), nombre))
    return resultats


def creer_tentative(db: Session, id_apprenant: int, code_langue: str) -> TestDiagnostic:
    """Crée une tentative au premier niveau ouvert qui possède des questions enregistrables."""
    langue = db.scalar(select(Langue).where(Langue.code == code_langue))
    if langue is None:
        raise ErreurDiagnostic(CodeErreurDiagnostic.LANGUE_INCONNUE)

    questions = _questions_du_test(db, langue)[:NOMBRE_QUESTIONS_DIAGNOSTIC]
    niveau = _niveau_de_depart(questions)
    if niveau is None:
        raise ErreurDiagnostic(CodeErreurDiagnostic.AUCUNE_QUESTION)

    tentative = TestDiagnostic(
        id_apprenant=id_apprenant,
        langue=langue,
        niveau=niveau,
        questions_ids=[question.id_question for question in questions],
    )
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
    if question.id_langue != tentative.id_langue or (
        question.id_question not in tentative.questions_ids
        if tentative.questions_ids
        else question.id_niveau != tentative.id_niveau
    ):
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
        if code_postgres != "23505" or nom_contrainte not in (
            "reponse_id_tentative_id_question_key",
            "uq_reponse_tentative_exercice",
        ):
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
