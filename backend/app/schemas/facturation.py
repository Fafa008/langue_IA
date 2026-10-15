"""Schémas Formule, Abonnement et statistiques du tableau de bord administrateur."""

from datetime import date

from pydantic import BaseModel, ConfigDict

from app.models import StatutAbonnement
from app.schemas.pedagogie import LangueOut
from app.schemas.utilisateurs import ApprenantOut


class LangueFormuleOut(BaseModel):
    """Langue couverte par une formule : { code, libelle } (format de GET /formules)."""

    model_config = ConfigDict(from_attributes=True)

    code: str
    libelle: str


class FormuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_formule: int
    libelle: str
    prix_mensuel: float
    duree_mois: int
    quota_heures: int
    quota_ateliers: int
    # Liste vide : la formule couvre toutes les langues
    langues: list[LangueFormuleOut]


class AbonnementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_abonnement: int
    date_debut: date
    date_fin: date
    statut: StatutAbonnement
    quota_heures: int
    quota_ateliers: int
    formule: FormuleOut


# ----- Tableau de bord : GET /admin/statistiques -----


class TotauxOut(BaseModel):
    utilisateurs: int
    apprenants: int
    formateurs: int
    ateliers_programmes: int


class ApprenantsParLangueOut(BaseModel):
    langue: LangueOut
    apprenants: int


class InscriptionApprenantOut(BaseModel):
    apprenant: ApprenantOut
    langues: list[LangueOut]
    abonnement: AbonnementOut | None


class StatistiquesOut(BaseModel):
    totaux: TotauxOut
    apprenants_par_langue: list[ApprenantsParLangueOut]
    dernieres_inscriptions: list[InscriptionApprenantOut]


class InscriptionsDuJourOut(BaseModel):
    date: date
    nombre: int
