"""Catalogue des formules d'abonnement (public : affiché à l'inscription)."""

from collections.abc import Sequence

from fastapi import APIRouter
from sqlalchemy import select

from app.api.deps import DbSession
from app.models import Formule
from app.schemas.facturation import FormuleOut

router = APIRouter(prefix="/formules", tags=["formules"])


@router.get("", response_model=list[FormuleOut])
def lister_formules(db: DbSession) -> Sequence[Formule]:
    return db.scalars(select(Formule).order_by(Formule.prix_mensuel)).all()
