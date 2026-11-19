"""Contrat HTTP de la correction d'un exercice du parcours (docs/api/contrat-frontend.md, « Contrat v2 (US157) »)."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

FormatReponse = Literal["choix", "texte", "redaction", "ecoute", "prononciation"]


class ReponseExerciceIn(BaseModel):
    """Corps de ``POST /parcours/{id_parcours}/exercices/{id_parcours_exercice}/reponse``.

    La conversation (liste de messages) relève d'un autre contrat : elle n'est pas acceptée ici.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    format: FormatReponse
    reponse: str = Field(min_length=1, max_length=5000)


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
