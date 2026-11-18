"""Client LLM indépendant du fournisseur.

Le reste du service ne connaît que ce contrat : un adaptateur (factice, compatible OpenAI, autre) peut être
remplacé sans toucher aux agents. Les types de réponse sont normalisés pour que les métadonnées d'exécution
(fournisseur, modèle, durée, tokens) soient disponibles quel que soit le fournisseur.
"""

from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass
from typing import Literal, Protocol, TypeVar

from pydantic import BaseModel, Field

from app.schemas.base import ModeleStrict

T = TypeVar("T", bound=BaseModel)

# Un message ne doit pas être vide : un contenu vide n'apporte rien au modèle et masque souvent un bug d'appel.
CONTENU_MESSAGE_MAX = 100_000


class MessageLLM(ModeleStrict):
    """Message du dialogue envoyé au fournisseur (format neutre, proche du chat completion)."""

    role: Literal["system", "user", "assistant"]
    contenu: str = Field(min_length=1, max_length=CONTENU_MESSAGE_MAX)


@dataclass(frozen=True, slots=True)
class ReponseLLM:
    """Réponse normalisée d'un fournisseur, y compris pour le dernier morceau d'un flux.

    ``contenu`` porte le texte complet en mode JSON et le texte accumulé en mode flux. ``tokens_*`` restent
    facultatifs : tous les fournisseurs ne les renvoient pas, notamment en streaming.
    """

    contenu: str
    fournisseur: str
    modele: str
    duree_ms: int
    tokens_entree: int | None = None
    tokens_sortie: int | None = None


@dataclass(frozen=True, slots=True)
class MorceauFlux:
    """Morceau de texte d'un flux.

    Le dernier morceau porte ``fin`` avec les métadonnées complètes (durée, tokens, modèle). Le consommateur peut
    ainsi afficher le texte au fil de l'eau puis journaliser une seule fois les métadonnées.
    """

    texte: str
    fin: ReponseLLM | None = None


class FournisseurLLM(Protocol):
    """Contrat structurel d'un adaptateur LLM.

    Aucun héritage n'est imposé : un objet qui expose ces quatre méthodes et les deux attributs est un fournisseur
    valide. ``generer_texte`` retourne du texte et ses métadonnées ; ``generer_json`` valide la réponse avec le
    schéma fourni ; ``generer_flux`` ne rejoue jamais un flux commencé.
    """

    nom: str
    modele: str

    async def generer_texte(
        self,
        messages: Sequence[MessageLLM],
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        delai_s: float | None = None,
    ) -> tuple[str, ReponseLLM]:
        """Générer du texte de façon asynchrone et retourner une réponse normalisée."""
        ...

    async def generer_json(
        self,
        messages: Sequence[MessageLLM],
        *,
        schema: type[T],
        temperature: float | None = None,
        max_tokens: int | None = None,
        delai_s: float | None = None,
    ) -> tuple[T, ReponseLLM]:
        """Générer une réponse JSON et la valider avec ``schema``.

        Lève ``ErreurReponseLlm`` si la réponse n'est pas un JSON conforme, ``ErreurLlmTimeout`` en cas de délai
        dépassé et ``ErreurLlmIndisponible`` si le fournisseur ne répond pas correctement.
        """
        ...

    def generer_flux(
        self,
        messages: Sequence[MessageLLM],
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        delai_s: float | None = None,
    ) -> AsyncIterator[MorceauFlux]:
        """Produire un flux asynchrone de morceaux de texte."""
        ...

    async def fermer(self) -> None:
        """Libérer les ressources réseau. Idempotent."""
        ...
