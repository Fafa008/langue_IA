"""Routes HTTP du test de positionnement."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import DbSession, UtilisateurConnecte
from app.models import Question, Reponse, Role
from app.schemas.diagnostic import QuestionOut, ReponseCreate, ReponseOut, TentativeCreate, TentativeOut
from app.services.diagnostic import (
    CodeErreurDiagnostic,
    ErreurDiagnostic,
)
from app.services.diagnostic import (
    creer_tentative as creer_tentative_service,
)
from app.services.diagnostic import (
    enregistrer_reponse as enregistrer_reponse_service,
)
from app.services.diagnostic import (
    lister_questions as lister_questions_service,
)

router = APIRouter(tags=["diagnostic"])

_ERREURS_HTTP = {
    CodeErreurDiagnostic.LANGUE_INCONNUE: (status.HTTP_404_NOT_FOUND, "Langue introuvable."),
    CodeErreurDiagnostic.NIVEAU_INCONNU: (status.HTTP_404_NOT_FOUND, "Niveau introuvable."),
    CodeErreurDiagnostic.NIVEAU_NON_OUVERT: (
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "Ce niveau n'est pas ouvert pour cette langue.",
    ),
    CodeErreurDiagnostic.AUCUNE_QUESTION: (
        status.HTTP_404_NOT_FOUND,
        "Aucune question enregistrable n'est disponible pour cette langue.",
    ),
    CodeErreurDiagnostic.TENTATIVE_INCONNUE: (status.HTTP_404_NOT_FOUND, "Tentative introuvable."),
    CodeErreurDiagnostic.TENTATIVE_TERMINEE: (status.HTTP_409_CONFLICT, "Cette tentative n'est plus en cours."),
    CodeErreurDiagnostic.QUESTION_INCONNUE: (status.HTTP_404_NOT_FOUND, "Question introuvable."),
    CodeErreurDiagnostic.QUESTION_HORS_TENTATIVE: (
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "La question ne correspond pas à la tentative.",
    ),
    CodeErreurDiagnostic.CHOIX_INVALIDE: (
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "La réponse ne correspond à aucun choix proposé.",
    ),
    CodeErreurDiagnostic.AUDIO_NON_DISPONIBLE: (
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "Le stockage des réponses audio n'est pas disponible.",
    ),
    CodeErreurDiagnostic.REPONSE_DIFFERENTE: (
        status.HTTP_409_CONFLICT,
        "Une réponse différente existe déjà pour cette question.",
    ),
}


def _convertir_erreur(erreur: ErreurDiagnostic) -> HTTPException:
    code, detail = _ERREURS_HTTP[erreur.code]
    return HTTPException(code, detail)


def _question_out(question: Question, niveau: str) -> QuestionOut:
    return QuestionOut(
        id_question=str(question.id_question),
        niveau=niveau,
        competence=question.competence,
        type_reponse=question.type_reponse,
        enonce=question.enonce,
        choix=question.choix,
        support=question.support,
        audio_url=question.audio_url,
        audio_texte=question.audio_texte,
    )


def _reponse_out(reponse: Reponse) -> ReponseOut:
    return ReponseOut(
        id_reponse=reponse.id_reponse,
        id_tentative=reponse.id_tentative,
        id_question=str(reponse.id_question),
        reponse_fournie=reponse.reponse_fournie,
    )


@router.get("/diagnostic/questions", response_model=list[QuestionOut], response_model_exclude_none=True)
def lister_questions(
    db: DbSession,
    utilisateur: UtilisateurConnecte,
    code_langue: Annotated[str, Query(min_length=2, max_length=3, description="Code de la langue, ex. en")],
    code_niveau: Annotated[str, Query(min_length=1, max_length=20, description="Code du niveau, ex. A1")],
) -> list[QuestionOut]:
    """Retourne les questions d'une langue et d'un niveau ouverts à l'apprenant connecté."""
    if utilisateur.role != Role.APPRENANT:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Droits insuffisants.")

    try:
        niveau, questions = lister_questions_service(db, code_langue, code_niveau)
    except ErreurDiagnostic as erreur:
        raise _convertir_erreur(erreur) from None
    return [_question_out(question, niveau.code) for question in questions]


@router.post(
    "/diagnostic/tentatives",
    response_model=TentativeOut,
    status_code=status.HTTP_201_CREATED,
)
def creer_tentative(
    donnees: TentativeCreate,
    db: DbSession,
    utilisateur: UtilisateurConnecte,
) -> TentativeOut:
    """Crée une tentative de diagnostic pour le premier niveau ayant des questions disponibles."""
    if utilisateur.role != Role.APPRENANT:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Droits insuffisants.")

    try:
        tentative = creer_tentative_service(db, utilisateur.id_user, donnees.code_langue)
    except ErreurDiagnostic as erreur:
        raise _convertir_erreur(erreur) from None
    return TentativeOut(
        id_tentative=tentative.id_test,
        code_langue=tentative.langue.code,
        code_niveau=tentative.niveau.code,
    )


@router.post("/diagnostic/reponse", response_model=ReponseOut, status_code=status.HTTP_201_CREATED)
def enregistrer_reponse(
    donnees: ReponseCreate,
    db: DbSession,
    utilisateur: UtilisateurConnecte,
) -> ReponseOut:
    """Enregistre la réponse de l'apprenant dans sa tentative active, sans l'évaluer."""
    if utilisateur.role != Role.APPRENANT:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Droits insuffisants.")

    try:
        reponse = enregistrer_reponse_service(
            db,
            utilisateur.id_user,
            donnees.id_tentative,
            int(donnees.id_question),
            donnees.reponse_fournie,
        )
    except ErreurDiagnostic as erreur:
        raise _convertir_erreur(erreur) from None
    return _reponse_out(reponse)
