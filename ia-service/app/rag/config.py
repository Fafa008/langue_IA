"""Configuration du récupérateur documentaire CECRL.

Le corpus est désactivé par défaut : sans fichier privé ni variable d'environnement, le service reste exactement
dans son comportement antérieur (``RecuperateurVide``). Une variable mal renseignée ne doit jamais empêcher le
service de démarrer : la fabrique se rabat sur le récupérateur vide et journalise la cause.
"""

from __future__ import annotations

from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# ``app/rag/config.py`` → ``ia-service/``
RACINE_SERVICE = Path(__file__).resolve().parents[2]
CHEMIN_CORPUS_PAR_DEFAUT = RACINE_SERVICE / "corpus" / "cecrl"


class ConfigRAG(BaseSettings):
    """Paramètres du corpus, lus dans l'environnement avec le préfixe ``RAG_``.

    ``RAG_CORPUS_ACTIF`` vaut ``false`` par défaut. ``RAG_CORPUS_CHEMIN`` permet de pointer un corpus monté hors
    de l'image ; ``RAG_CORPUS_VERIFIER_EMPREINTE`` désactive uniquement le contrôle d'intégrité, jamais les
    validations de structure.
    """

    model_config = SettingsConfigDict(env_prefix="RAG_", extra="ignore", frozen=True, populate_by_name=True)

    corpus_actif: bool = False
    corpus_chemin: Path | None = None
    verifier_empreinte: bool = Field(default=True, validation_alias="RAG_CORPUS_VERIFIER_EMPREINTE")

    @field_validator("corpus_chemin", mode="before")
    @classmethod
    def vide_en_absent(cls, valeur: object) -> object:
        """Une variable présente mais vide vaut « non renseignée »."""
        if isinstance(valeur, str) and not valeur.strip():
            return None
        return valeur

    @property
    def dossier(self) -> Path:
        """Dossier du corpus effectivement lu."""
        return self.corpus_chemin or CHEMIN_CORPUS_PAR_DEFAUT
