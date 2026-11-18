"""Tableau de bord de l'administrateur : Administrateur.consulterStatistiques()."""

from datetime import date, datetime, timedelta
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select

from app.api.deps import DbSession, permission_requise
from app.core.config import get_settings
from app.models import Apprenant, Atelier, Langue, Role, StatutAtelier, Utilisateur, apprenant_langue
from app.schemas.facturation import (
    AbonnementOut,
    ApprenantsParLangueOut,
    InscriptionApprenantOut,
    InscriptionsDuJourOut,
    StatistiquesOut,
    TotauxOut,
)
from app.schemas.pedagogie import LangueOut
from app.schemas.utilisateurs import ApprenantOut

router = APIRouter(prefix="/admin/statistiques", tags=["tableau de bord"])
LectureStatistiques = Annotated[Utilisateur, Depends(permission_requise("stats:read"))]

DERNIERES_INSCRIPTIONS = 5
PERIODES = (7, 30, 90)


@router.get("", response_model=StatistiquesOut)
def consulter_statistiques(db: DbSession, _admin: LectureStatistiques) -> StatistiquesOut:
    par_role = dict(db.execute(select(Utilisateur.role, func.count()).group_by(Utilisateur.role)).all())
    ateliers = db.scalar(
        select(func.count())
        .select_from(Atelier)
        .where(Atelier.date_heure > func.now(), Atelier.statut != StatutAtelier.ANNULE)
    )
    totaux = TotauxOut(
        utilisateurs=sum(par_role.values()),
        apprenants=par_role.get(Role.APPRENANT, 0),
        formateurs=par_role.get(Role.FORMATEUR, 0),
        ateliers_programmes=ateliers or 0,
    )

    # Apprenants distincts par langue suivie (un apprenant peut en suivre plusieurs)
    lignes = db.execute(
        select(Langue, func.count(func.distinct(apprenant_langue.c.id_apprenant)))
        .join(apprenant_langue, apprenant_langue.c.id_langue == Langue.id_langue)
        .group_by(Langue.id_langue)
        .order_by(func.count(func.distinct(apprenant_langue.c.id_apprenant)).desc(), Langue.libelle)
    ).all()
    par_langue = [ApprenantsParLangueOut(langue=LangueOut.model_validate(langue), apprenants=n) for langue, n in lignes]

    recents = db.scalars(
        select(Utilisateur)
        .join(Apprenant, Apprenant.id_user == Utilisateur.id_user)
        .where(Utilisateur.role == Role.APPRENANT)
        .order_by(Utilisateur.date_inscription.desc(), Utilisateur.id_user.desc())
        .limit(DERNIERES_INSCRIPTIONS)
    ).all()
    inscriptions = [
        InscriptionApprenantOut(
            apprenant=ApprenantOut.depuis(u),
            langues=[LangueOut.model_validate(langue) for langue in u.apprenant.langues],
            # Abonnement le plus récent (liste triée par date de début décroissante)
            abonnement=AbonnementOut.model_validate(u.apprenant.abonnements[0]) if u.apprenant.abonnements else None,
        )
        for u in recents
    ]
    return StatistiquesOut(totaux=totaux, apprenants_par_langue=par_langue, dernieres_inscriptions=inscriptions)


@router.get("/inscriptions", response_model=list[InscriptionsDuJourOut])
def inscriptions_par_jour(
    db: DbSession,
    _admin: LectureStatistiques,
    jours: Annotated[int, Query(description="Période en jours (7, 30 ou 90), aujourd'hui compris")] = 30,
) -> list[InscriptionsDuJourOut]:
    """Un élément par jour, du plus ancien au plus récent, jours sans inscription compris (fuseau TIMEZONE)."""
    # Pas de Literal[7, 30, 90] : un paramètre de requête arrive en texte (« 7 ») et serait refusé
    if jours not in PERIODES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "jours doit valoir 7, 30 ou 90.")
    fuseau = get_settings().timezone
    aujourd_hui = datetime.now(ZoneInfo(fuseau)).date()
    premier = aujourd_hui - timedelta(days=jours - 1)
    jour_local = func.date(func.timezone(fuseau, Utilisateur.date_inscription))
    comptes: dict[date, int] = dict(
        db.execute(
            select(jour_local, func.count())
            .where(jour_local >= premier, jour_local <= aujourd_hui)
            .group_by(jour_local)
        ).all()
    )
    return [
        InscriptionsDuJourOut(date=jour, nombre=comptes.get(jour, 0))
        for jour in (premier + timedelta(days=i) for i in range(jours))
    ]
