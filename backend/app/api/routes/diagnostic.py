"""Consultation des questions du test de positionnement."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import DbSession, UtilisateurConnecte
from app.models import Langue, Niveau, Question, Reponse, Role, StatutDiagnostic, TestDiagnostic
from app.schemas.diagnostic import QuestionOut, ReponseCreate, ReponseOut, TentativeCreate, TentativeOut

router = APIRouter(tags=["diagnostic"])


def _question_out(question: Question, niveau: Niveau) -> QuestionOut:
    return QuestionOut(
        id_question=str(question.id_question),
        niveau=niveau.code,
        competence=question.competence,
        type_reponse=question.type_reponse,
        enonce=question.enonce,
        choix=question.choix,
        support=question.support,
        audio_url=question.audio_url,
        audio_texte=question.audio_texte,
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

    langue = db.scalar(select(Langue).where(Langue.code == code_langue))
    if langue is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Langue introuvable.")

    niveau = db.scalar(select(Niveau).where(Niveau.code == code_niveau))
    if niveau is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Niveau introuvable.")
    if niveau.id_niveau not in {niveau_ouvert.id_niveau for niveau_ouvert in langue.niveaux}:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Ce niveau n'est pas ouvert pour cette langue.")

    questions = db.scalars(
        select(Question)
        .where(Question.id_langue == langue.id_langue, Question.id_niveau == niveau.id_niveau)
        .order_by(Question.id_question)
    ).all()
    return [_question_out(question, niveau) for question in questions]


@router.post(
    "/diagnostic/tentatives",
    response_model=TentativeOut,
    response_model_exclude_none=True,
    status_code=status.HTTP_201_CREATED,
)
def creer_tentative(
    donnees: TentativeCreate,
    db: DbSession,
    utilisateur: UtilisateurConnecte,
) -> TentativeOut:
    """Crée une tentative minimale et retourne les questions sans correction pour son premier niveau disponible."""
    if utilisateur.role != Role.APPRENANT:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Droits insuffisants.")

    langue = db.scalar(select(Langue).where(Langue.code == donnees.code_langue))
    if langue is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Langue introuvable.")

    niveaux_disponibles: list[Niveau] = []
    for niveau in langue.niveaux:
        questions = db.scalars(
            select(Question)
            .where(
                Question.id_langue == langue.id_langue,
                Question.id_niveau == niveau.id_niveau,
                Question.type_reponse.in_(("choix", "texte")),
            )
            .order_by(Question.id_question)
        ).all()
        if questions:
            niveaux_disponibles.append(niveau)

    if not niveaux_disponibles:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Aucune question enregistrable n'est disponible pour cette langue.",
        )

    niveau = niveaux_disponibles[0]
    tentative = TestDiagnostic(
        id_apprenant=utilisateur.id_user,
        langue=langue,
        niveau=niveau,
    )
    db.add(tentative)
    db.commit()
    db.refresh(tentative)
    return TentativeOut(
        id_tentative=tentative.id_test,
        code_langue=langue.code,
        code_niveau=niveau.code,
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

    tentative = db.scalar(
        select(TestDiagnostic).where(
            TestDiagnostic.id_test == donnees.id_tentative,
            TestDiagnostic.id_apprenant == utilisateur.id_user,
        )
    )
    if tentative is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tentative introuvable.")
    if tentative.statut != StatutDiagnostic.EN_COURS:
        raise HTTPException(status.HTTP_409_CONFLICT, "Cette tentative n'est plus en cours.")

    question = db.get(Question, int(donnees.id_question))
    if question is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question introuvable.")
    if question.id_langue != tentative.id_langue or question.id_niveau != tentative.id_niveau:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "La question ne correspond pas à la tentative.")
    if question.type_reponse == "choix" and donnees.reponse_fournie not in (question.choix or []):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "La réponse ne correspond à aucun choix proposé.")
    if question.type_reponse == "audio":
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Le stockage des réponses audio n'est pas disponible.",
        )

    reponse_precedente = db.scalar(
        select(Reponse).where(
            Reponse.id_tentative == tentative.id_test,
            Reponse.id_question == question.id_question,
        )
    )
    if reponse_precedente is not None:
        if reponse_precedente.reponse_fournie == donnees.reponse_fournie:
            return ReponseOut(
                id_reponse=reponse_precedente.id_reponse,
                id_tentative=reponse_precedente.id_tentative,
                id_question=str(reponse_precedente.id_question),
                reponse_fournie=reponse_precedente.reponse_fournie,
            )
        raise HTTPException(status.HTTP_409_CONFLICT, "Une réponse différente existe déjà pour cette question.")

    reponse = Reponse(
        tentative=tentative,
        question=question,
        reponse_fournie=donnees.reponse_fournie,
    )
    db.add(reponse)
    try:
        db.commit()
    except IntegrityError as erreur:
        db.rollback()
        code_postgres = getattr(erreur.orig, "sqlstate", None) or getattr(erreur.orig, "pgcode", None)
        if code_postgres == "23505":
            reponse_precedente = db.scalar(
                select(Reponse).where(
                    Reponse.id_tentative == tentative.id_test,
                    Reponse.id_question == question.id_question,
                )
            )
            if reponse_precedente is not None and reponse_precedente.reponse_fournie == donnees.reponse_fournie:
                return ReponseOut(
                    id_reponse=reponse_precedente.id_reponse,
                    id_tentative=reponse_precedente.id_tentative,
                    id_question=str(reponse_precedente.id_question),
                    reponse_fournie=reponse_precedente.reponse_fournie,
                )
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Une réponse différente existe déjà pour cette question."
            ) from None
        raise
    db.refresh(reponse)
    return ReponseOut(
        id_reponse=reponse.id_reponse,
        id_tentative=reponse.id_tentative,
        id_question=str(reponse.id_question),
        reponse_fournie=reponse.reponse_fournie,
    )
