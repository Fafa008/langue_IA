"""Contrat HTTP de la correction d'un exercice du parcours (docs/api/contrat-frontend.md, « Contrat v2 (US157) »)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import StatutParcours, TypeExercice
from app.schemas.ia import DomaineFaiblesseIA, TypeExerciceRecommandationIA
from app.services.phase_parcours import PhaseParcours

FormatReponse = Literal["choix", "texte", "redaction", "ecoute", "prononciation"]
StatutRecommandation = Literal["COMPLET", "PARTIEL"]


class ReponseExerciceIn(BaseModel):
    """Corps de ``POST /parcours/{id_parcours}/exercices/{id_parcours_exercice}/reponse``.

    La conversation (liste de messages) relève d'un autre contrat : elle n'est pas acceptée ici.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    format: FormatReponse
    reponse: str = Field(min_length=1, max_length=5000)


class ModuleParcoursOut(BaseModel):
    """Regroupement de leçons consécutives sous un thème (modèle de données encore à décider)."""

    numero: int
    titre: str
    description: str
    premiere_lecon: int
    derniere_lecon: int


class ProgressionLeconOut(BaseModel):
    """Progression d'une leçon notée (US48) : seules les leçons ayant un score de leçon sont renvoyées."""

    numero_lecon: int
    last_score: int
    best_score: int
    is_validated: bool


class RecommandationActionOut(BaseModel):
    """Une action de remédiation proposée par l'IA et revalidée par le backend (REC-03)."""

    domaine: DomaineFaiblesseIA
    type_exercice: TypeExerciceRecommandationIA
    action: str
    justification: str
    priorite: int


class RecommandationParcoursOut(BaseModel):
    """Réponse publique de ``POST /parcours/{id}/recommandations`` et champ de ``GET /parcours/en-cours``.

    ``PARTIEL`` signifie que le service IA n'a pas fourni de proposition exploitable : la liste est alors vide et
    aucun code technique n'est exposé à l'apprenant.
    """

    statut: StatutRecommandation
    code_langue: str
    referentiel: Literal["CECRL", "HSK"]
    niveau_cible: str
    recommandations: list[RecommandationActionOut] = Field(default_factory=list)
    resume: str
    confiance: float


class ParcoursEnCoursOut(BaseModel):
    """``GET /parcours/en-cours`` (docs/api/contrat-frontend.md, « Parcours personnalisé »)."""

    id_parcours: int
    statut: StatutParcours
    date_creation: datetime
    code_langue: str
    libelle_langue: str
    cadre: Literal["CECRL", "HSK"]
    niveaux_cadre: list[str]
    niveau_depart: str
    niveau_vise: str
    lecon_atteinte: int
    phase: PhaseParcours
    est_lecon_de_revision: bool
    modules: list[ModuleParcoursOut]
    progressions: list[ProgressionLeconOut] = Field(default_factory=list)
    recommandation: RecommandationParcoursOut | None = None


class ExerciceParcoursOut(BaseModel):
    """Une ligne de ``GET /parcours/{id}/exercices`` : exercice du parcours et statut de l'apprenant."""

    id_parcours_exercice: int
    id_exercice: int
    numero_lecon: int
    type: TypeExercice
    difficulte: int
    intitule: str | None
    statut: Literal["A_FAIRE", "REUSSI", "A_REVOIR"]
    score_obtenu: int | None


class ExerciceLeconOut(ExerciceParcoursOut):
    """Exercice d'une leçon : ``contenu`` est le JSON des seuls champs visibles par l'apprenant."""

    contenu: str


class LeconParcoursOut(BaseModel):
    """``GET /parcours/{id}/lecons/{numero_lecon}``."""

    numero_lecon: int
    est_lecon_de_revision: bool
    code_langue: str
    exercices: list[ExerciceLeconOut]


class ErreurReleveeOut(BaseModel):
    extrait: str
    correction: str
    explication: str


class CorrectionExerciceOut(BaseModel):
    """Correction renvoyée au frontend ; ``phase``, ``lecon_atteinte`` et ``reformulation`` : contrat v2 (US157)."""

    statut: Literal["REUSSI", "A_REVOIR"]
    score_obtenu: int = Field(ge=0, le=100)
    mode_correction: Literal["AUTOMATIQUE", "IA"]
    commentaire: str
    reponse_attendue: str | None = None
    explication: str | None = None
    points_forts: list[str] = Field(default_factory=list)
    erreurs: list[ErreurReleveeOut] = Field(default_factory=list)
    conseil: str | None = None
    phase: Literal["PASSIVE", "ACTIVE"] | None = None
    lecon_atteinte: int | None = None
    reformulation: str | None = None
