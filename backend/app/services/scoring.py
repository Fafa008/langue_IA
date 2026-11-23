"""Calcul déterministe du score et du niveau de référence d'un diagnostic."""

from decimal import ROUND_HALF_UP, Decimal
from enum import Enum
from typing import get_args

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Langue, Niveau, Question, Reponse, StatutDiagnostic, TestDiagnostic
from app.schemas.ia import CompetenceIA

COMPETENCES_CONNUES = set(get_args(CompetenceIA))
FORMATS_CONNUS = {"qcm", "vrai_faux", "texte_a_trous", "dictee", "parler"}
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


def _questions_a_corriger(exercices: list[Question]) -> list[Question]:
    """Retient les exercices notables d'une tentative.

    Les exercices enrichis du test 4 compétences ajoutent aux QCM les réponses textuelles corrigées
    exactement et comptent la production orale comme fausse tant que la STT n'existe pas (phase 4).
    Sans exercice enrichi, le comportement historique (QCM seuls) est conservé.
    """
    candidats = [
        exercice
        for exercice in exercices
        if exercice.statut == "publié" and exercice.usage in ("diagnostic", "les deux")
    ]
    enrichis = [exercice for exercice in candidats if exercice.format_exercice]
    if not enrichis:
        questions = [exercice for exercice in candidats if exercice.type_reponse == "choix"]
        if any(
            not question.choix or question.reponse_correcte is None or question.reponse_correcte not in question.choix
            for question in questions
        ):
            raise ErreurScoring(CodeErreurScoring.QUESTIONS_NON_CONFIGUREES)
        return questions

    questions: list[Question] = []
    for exercice in candidats:
        if exercice.type_reponse == "choix" and (
            not exercice.choix
            or (exercice.reponse_correcte is not None and exercice.reponse_correcte not in exercice.choix)
        ):
            raise ErreurScoring(CodeErreurScoring.QUESTIONS_NON_CONFIGUREES)
        if exercice.type_reponse in ("choix", "texte") and exercice.reponse_correcte is None:
            raise ErreurScoring(CodeErreurScoring.QUESTIONS_NON_CONFIGUREES)
        questions.append(exercice)
    return questions


def _est_correct(question: Question, reponse_fournie: str | None) -> bool:
    """Une question orale sans transcription reste fausse : aucun score n'est inventé."""
    if question.type_reponse == "audio":
        return False
    return reponse_fournie is not None and reponse_fournie == question.reponse_correcte


def resultat_detaille(db: Session, id_tentative: int) -> tuple[list[dict], list[dict]]:
    """Détail par compétence et dossier factuel de la tentative déjà clôturée.

    Le temps de réponse n'est pas encore transmis par le client : il vaut 0 tant que la phase 4
    n'a pas branché la mesure côté frontend. Aucune transcription ni confiance STT n'est inventée.
    """
    exercices = db.scalars(
        select(Question)
        .where(
            TestDiagnostic.id_test == id_tentative,
            Question.id_langue == TestDiagnostic.id_langue,
            Question.id_niveau == TestDiagnostic.id_niveau,
        )
        .order_by(Question.id_question)
    ).all()
    questions = _questions_a_corriger(list(exercices))
    if not any(question.format_exercice in FORMATS_CONNUS for question in questions):
        # Banque historique : l'analyse IA reste la seule source du détail par compétence.
        return [], []
    reponses = db.scalars(select(Reponse).where(Reponse.id_tentative == id_tentative)).all()
    reponses_par_question = {reponse.id_question: reponse.reponse_fournie for reponse in reponses}

    scores: dict[str, list[int]] = {}
    donnees: list[dict] = []
    for question in questions:
        competence = question.competence or "grammaire"
        justesse = _est_correct(question, reponses_par_question.get(question.id_question))
        total, obtenu = scores.get(competence, (0, 0))
        scores[competence] = (total + 1, obtenu + int(justesse))
        if question.format_exercice in FORMATS_CONNUS and competence in COMPETENCES_CONNUES:
            donnees.append(
                {
                    "id_question": str(question.id_question),
                    "competence": competence,
                    "format": question.format_exercice,
                    "difficulte": question.difficulte,
                    "justesse": justesse,
                    "temps_reponse_secondes": 0.0,
                }
            )
    competences = [
        {"competence": competence, "score": obtenu, "total": total}
        for competence, (total, obtenu) in sorted(scores.items())
        if competence in COMPETENCES_CONNUES
    ]
    return competences, donnees


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

    exercices = db.scalars(
        select(Question)
        .where(
            Question.id_langue == tentative.id_langue,
            Question.id_niveau == tentative.id_niveau,
        )
        .order_by(Question.id_question)
    ).all()
    # D1/D3 : le scoring ne retient que les exercices publiés et proposables au diagnostic.
    questions = _questions_a_corriger(list(exercices))
    if not questions:
        raise ErreurScoring(CodeErreurScoring.QUESTIONS_NON_CONFIGUREES)

    reponses = db.scalars(
        select(Reponse).where(
            Reponse.id_tentative == id_tentative,
            Reponse.id_question.in_([question.id_question for question in questions]),
        )
    ).all()
    reponses_par_question = {reponse.id_question: reponse.reponse_fournie for reponse in reponses}
    nb_correctes = sum(
        _est_correct(question, reponses_par_question.get(question.id_question)) for question in questions
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
