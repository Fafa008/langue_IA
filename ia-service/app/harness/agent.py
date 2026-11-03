"""Contrat d'un agent et contexte d'exécution pour le Harness.

Un agent est une fonction injectée : il n'importe pas ``httpx``, pas ``sqlalchemy`` et pas le registre. Il reçoit
uniquement son entrée typée et un ``ContexteExecution`` contenant le client LLM partagé et les outils communs.
"""

import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Generic, TypeVar
from uuid import UUID

from packaging.version import InvalidVersion, Version
from pydantic import BaseModel

from app.core.erreurs import ErreurRegistre
from app.llm.base import FournisseurLLM
from app.prompts import RegistrePrompts
from app.schemas.commun import CODE_AGENT_PATTERN, EMPREINTE_PATTERN, VERSION_PATTERN, VERSION_PROMPT_PATTERN
from app.schemas.contexte import ContexteApprenant

TEntree = TypeVar("TEntree")
TSortie = TypeVar("TSortie")


@dataclass(frozen=True, slots=True)
class OutilsCommuns:
    """Outils partagés par tous les agents, injectés par le Harness."""

    client_llm: FournisseurLLM
    registre_prompts: RegistrePrompts
    horloge: Callable[[], float]


@dataclass(frozen=True, slots=True)
class ContexteExecution:
    """Contexte immuable d'une exécution d'agent."""

    request_id: UUID
    contexte: ContexteApprenant
    outils: OutilsCommuns


@dataclass(frozen=True, slots=True)
class DefinitionAgent(Generic[TEntree, TSortie]):
    """Description déclarative d'un agent enregistré dans le registre.

    Les schémas servent à la validation défense-en-profondeur (entrée) et à la validation de la sortie de l'agent
    (étape 7 du pipeline). ``budget_ms`` borne l'exécution ; ``version_prompt`` et ``empreinte_prompt`` alimentent
    ``MetaExecution`` sans que le registre connaisse le contenu des prompts.
    """

    code: str
    version: str
    schema_entree: type[TEntree]
    schema_sortie: type[TSortie]
    budget_ms: int
    version_prompt: str
    empreinte_prompt: str
    executer: Callable[[TEntree, ContexteExecution], Awaitable[TSortie]]

    def __post_init__(self) -> None:
        """Refuser une définition incomplète au démarrage, jamais à la première requête."""
        if not isinstance(self.code, str) or len(self.code) > 32 or re.fullmatch(CODE_AGENT_PATTERN, self.code) is None:
            raise ErreurRegistre("Le code d'agent doit être en minuscules, chiffres et tirets (32 caractères maximum).")

        if not isinstance(self.version, str) or re.fullmatch(VERSION_PATTERN, self.version) is None:
            raise ErreurRegistre("La version d'agent doit respecter le format SemVer (par exemple 1.0.0).")
        try:
            Version(self.version)
        except InvalidVersion as exc:
            raise ErreurRegistre("La version d'agent doit être une version SemVer valide.") from exc

        if (
            not isinstance(self.version_prompt, str)
            or re.fullmatch(VERSION_PROMPT_PATTERN, self.version_prompt) is None
        ):
            raise ErreurRegistre("La version de prompt doit respecter le format agent/tache@x.y.z.")
        if not isinstance(self.empreinte_prompt, str) or re.fullmatch(EMPREINTE_PATTERN, self.empreinte_prompt) is None:
            raise ErreurRegistre("L'empreinte de prompt doit être au format sha256:<64 hexadécimaux>.")

        if (
            isinstance(self.budget_ms, bool)
            or not isinstance(self.budget_ms, int)
            or self.budget_ms <= 0
            or self.budget_ms > 600_000
        ):
            raise ErreurRegistre("Le budget d'exécution doit être un entier de 1 à 600000 millisecondes.")
        if not (isinstance(self.schema_entree, type) and issubclass(self.schema_entree, BaseModel)):
            raise ErreurRegistre("Le schéma d'entrée doit être un modèle Pydantic.")
        if not (isinstance(self.schema_sortie, type) and issubclass(self.schema_sortie, BaseModel)):
            raise ErreurRegistre("Le schéma de sortie doit être un modèle Pydantic.")
        if not callable(self.executer):
            raise ErreurRegistre("L'exécuteur d'agent doit être appelable.")
