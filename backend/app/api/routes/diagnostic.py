"""Consultation des questions du test de positionnement."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.api.deps import DbSession, UtilisateurConnecte
from app.models import Langue, Niveau, Question, Role
from app.schemas.diagnostic import QuestionOut

router = APIRouter(tags=["diagnostic"])


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
    return [
        QuestionOut(
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
        for question in questions
    ]
