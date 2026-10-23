"""Schémas publics du diagnostic."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class QuestionOut(BaseModel):
    """Question affichable par l'apprenant ; aucune donnée de correction n'est exposée."""

    id_question: str
    niveau: str
    competence: str
    type_reponse: Literal["choix", "texte", "audio"]
    enonce: str
    choix: list[str] | None = None
    support: str | None = None
    audio_url: str | None = None
    audio_texte: str | None = None


class ReponseCreate(BaseModel):
    """Réponse fournie par l'apprenant pour une question d'une tentative en cours."""

    id_tentative: int = Field(gt=0)
    id_question: str = Field(pattern=r"^[1-9]\d*$")
    reponse_fournie: str = Field(min_length=1)

    @field_validator("reponse_fournie")
    @classmethod
    def refuser_reponse_vide(cls, valeur: str) -> str:
        if not valeur.strip():
            raise ValueError("La réponse ne peut pas être vide.")
        return valeur


class ReponseOut(BaseModel):
    """Réponse enregistrée ; aucune évaluation n'est exposée par cette route."""

    id_reponse: int
    id_tentative: int
    id_question: str
    reponse_fournie: str


class TentativeCreate(BaseModel):
    """Création minimale d'une tentative avant l'évaluation par le service IA."""

    code_langue: str = Field(min_length=2, max_length=3)


class TentativeOut(BaseModel):
    """Tentative persistée et niveau initial choisi."""

    id_tentative: int
    code_langue: str
    code_niveau: str
