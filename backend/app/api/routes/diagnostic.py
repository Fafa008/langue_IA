"""Routes HTTP du test de positionnement."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query, status

from app.api.deps import DbSession, UtilisateurConnecte
from app.models import Question, Reponse, Role
from app.schemas.diagnostic import (
    LangueDiagnosticOut,
    QuestionOut,
    ReponseCreate,
    ReponseOut,
    ScoreDiagnosticOut,
    TentativeCreate,
    TentativeOut,
)
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
    lister_langues as lister_langues_service,
)
from app.services.diagnostic import (
    lister_questions as lister_questions_service,
)
from app.services.scoring import CodeErreurScoring, ErreurScoring, cadre_de_langue
from app.services.scoring import terminer_tentative as terminer_tentative_service

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

_ERREURS_SCORING_HTTP = {
    CodeErreurScoring.TENTATIVE_INCONNUE: (status.HTTP_404_NOT_FOUND, "Tentative introuvable."),
    CodeErreurScoring.TENTATIVE_TERMINEE: (status.HTTP_409_CONFLICT, "Cette tentative ne peut plus être terminée."),
    CodeErreurScoring.QUESTIONS_NON_CONFIGUREES: (
        status.HTTP_409_CONFLICT,
        "Les questions à choix n'ont pas toutes une clé de correction valide.",
    ),
    CodeErreurScoring.NIVEAU_NON_CONFIGURE: (
        status.HTTP_409_CONFLICT,
        "Le référentiel ne contient pas le niveau calculé.",
    ),
}


def _convertir_erreur(erreur: ErreurDiagnostic) -> HTTPException:
    code, detail = _ERREURS_HTTP[erreur.code]
    return HTTPException(code, detail)


def _convertir_erreur_scoring(erreur: ErreurScoring) -> HTTPException:
    code, detail = _ERREURS_SCORING_HTTP[erreur.code]
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


@router.get("/diagnostic/langues", response_model=list[LangueDiagnosticOut])
def lister_langues(db: DbSession, utilisateur: UtilisateurConnecte) -> list[LangueDiagnosticOut]:
    """Langues proposées sur l'écran d'accueil du test, avec leur échelle et leur disponibilité."""
    if utilisateur.role != Role.APPRENANT:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Droits insuffisants.")

    return [
        LangueDiagnosticOut(
            code=item.langue.code,
            libelle=item.langue.libelle,
            cadre=cadre_de_langue(item.langue.code).value,
            niveaux=[niveau.code for niveau in item.langue.niveaux],
            nombre_questions=item.nombre_questions,
            disponible=item.niveau_depart is not None,
        )
        for item in lister_langues_service(db)
    ]


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


@router.post(
    "/diagnostic/tentatives/{id_tentative}/terminer",
    response_model=ScoreDiagnosticOut,
)
def terminer_tentative(
    id_tentative: Annotated[int, Path(gt=0)],
    db: DbSession,
    utilisateur: UtilisateurConnecte,
) -> ScoreDiagnosticOut:
    """Calcule le score déterministe et fixe le niveau de référence de la tentative."""
    if utilisateur.role != Role.APPRENANT:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Droits insuffisants.")

    try:
        tentative, score, code_niveau, cadre = terminer_tentative_service(db, utilisateur.id_user, id_tentative)
    except ErreurScoring as erreur:
        raise _convertir_erreur_scoring(erreur) from None

    return ScoreDiagnosticOut(
        id_tentative=tentative.id_test,
        score=float(score),
        percentage=float(score),
        level=code_niveau,
        framework=cadre.value,
    )
