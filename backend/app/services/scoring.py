"""Calcul déterministe du score et du niveau de référence d'un diagnostic."""

from decimal import ROUND_HALF_UP, Decimal
from enum import Enum

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Langue, Niveau, Question, Reponse, StatutDiagnostic, TestDiagnostic

SCORE_MAX = 100
SEUILS_NIVEAUX = (
    (Decimal("20"), "A1", "HSK 1"),
    (Decimal("40"), "A2", "HSK 2"),
    (Decimal("60"), "B1", "HSK 3"),
    (Decimal("75"), "B2", "HSK 4"),
    (Decimal("90"), "C1", "HSK 5"),
    (Decimal("101"), "C2", "HSK 6"),
)


class CadreReference(str, Enum):
    CECRL = "CECRL"
    HSK = "HSK"


class CodeErreurScoring(str, Enum):
    TENTATIVE_INCONNUE = "tentative_inconnue"
    TENTATIVE_TERMINEE = "tentative_terminee"
    QUESTIONS_NON_CONFIGUREES = "questions_non_configurees"
    NIVEAU_NON_CONFIGURE = "niveau_non_configure"


class ErreurScoring(Exception):
    """Erreur métier de scoring, traduite en HTTP par le routeur."""

    def __init__(self, code: CodeErreurScoring) -> None:
        self.code = code
        super().__init__(code.value)


def cadre_de_langue(code_langue: str) -> CadreReference:
    """Le chinois est évalué sur l'échelle HSK, les autres langues sur le CECRL."""
    return CadreReference.HSK if code_langue == "zh" else CadreReference.CECRL


def niveau_de_reference(pourcentage: Decimal, cadre: CadreReference) -> str:
    """Convertit un pourcentage en niveau selon la grille CECRL ou HSK."""
    for seuil, niveau_cecrl, niveau_hsk in SEUILS_NIVEAUX:
        if pourcentage < seuil:
            return niveau_hsk if cadre == CadreReference.HSK else niveau_cecrl
    return "C2" if cadre == CadreReference.CECRL else "HSK 6"


def _calculer_pourcentage(nb_correctes: int, nb_questions: int) -> Decimal:
    return (Decimal(nb_correctes * SCORE_MAX) / Decimal(nb_questions)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def terminer_tentative(
    db: Session, id_apprenant: int, id_tentative: int
) -> tuple[TestDiagnostic, Decimal, str, CadreReference]:
    """Corrige les questions à choix, clôt la tentative et persiste son résultat."""
    tentative = db.scalar(
        select(TestDiagnostic)
        .where(
            TestDiagnostic.id_test == id_tentative,
            TestDiagnostic.id_apprenant == id_apprenant,
        )
        .with_for_update()
    )
    if tentative is None:
        raise ErreurScoring(CodeErreurScoring.TENTATIVE_INCONNUE)

    langue = db.get(Langue, tentative.id_langue)
    if langue is None:
        raise ErreurScoring(CodeErreurScoring.TENTATIVE_INCONNUE)

    cadre = cadre_de_langue(langue.code)
    if tentative.statut == StatutDiagnostic.TERMINE:
        if tentative.score is None or tentative.niveau_final is None:
            raise ErreurScoring(CodeErreurScoring.TENTATIVE_TERMINEE)
        return tentative, tentative.score, tentative.niveau_final.code, cadre
    if tentative.statut != StatutDiagnostic.EN_COURS:
        raise ErreurScoring(CodeErreurScoring.TENTATIVE_TERMINEE)

    questions = list(
        db.scalars(
            select(Question)
            .where(
                Question.id_langue == tentative.id_langue,
                Question.id_niveau == tentative.id_niveau,
                Question.type_reponse == "choix",
            )
            .order_by(Question.id_question)
        ).all()
    )
    if not questions or any(
        not question.choix or question.reponse_correcte is None or question.reponse_correcte not in question.choix
        for question in questions
    ):
        raise ErreurScoring(CodeErreurScoring.QUESTIONS_NON_CONFIGUREES)

    reponses = db.scalars(
        select(Reponse).where(
            Reponse.id_tentative == id_tentative,
            Reponse.id_question.in_([question.id_question for question in questions]),
        )
    ).all()
    reponses_par_question = {reponse.id_question: reponse.reponse_fournie for reponse in reponses}
    nb_correctes = sum(
        reponses_par_question.get(question.id_question) == question.reponse_correcte for question in questions
    )
    pourcentage = _calculer_pourcentage(nb_correctes, len(questions))
    code_niveau = niveau_de_reference(pourcentage, cadre)
    niveau_final = db.scalar(select(Niveau).where(Niveau.code == code_niveau))
    if niveau_final is None:
        raise ErreurScoring(CodeErreurScoring.NIVEAU_NON_CONFIGURE)

    tentative.score = pourcentage
    tentative.id_niveau_final = niveau_final.id_niveau
    tentative.statut = StatutDiagnostic.TERMINE
    tentative.date_fin = db.scalar(select(func.now()))
    db.commit()
    db.refresh(tentative)
    return tentative, pourcentage, code_niveau, cadre
