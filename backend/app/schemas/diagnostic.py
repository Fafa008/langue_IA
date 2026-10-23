"""Schémas publics du diagnostic."""

from typing import Literal

from pydantic import BaseModel


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
