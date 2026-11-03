"""Registre des agents disponibles.

Le registre ne connaît ni les neuf agents à l'avance, ni leur logique : il stocke des ``DefinitionAgent`` indexées
par code et version. Il est rempli à l'initialisation puis lu uniquement, ce qui évite les courses en production.
"""

import threading

from packaging.version import Version

from app.core.erreurs import ErreurAgentInconnu, ErreurRegistre
from app.harness.agent import DefinitionAgent


class RegistreAgents:
    """Index ``code → version → définition`` avec résolution de la dernière version SemVer."""

    def __init__(self) -> None:
        self._agents: dict[str, dict[str, DefinitionAgent]] = {}
        self._verrou = threading.Lock()

    def enregistrer(self, definition: DefinitionAgent) -> None:
        """Enregistrer un agent ; un doublon ``(code, version)`` est refusé, jamais écrasé."""
        with self._verrou:
            versions = self._agents.setdefault(definition.code, {})
            if definition.version in versions:
                raise ErreurRegistre(f"L'agent {definition.code} version {definition.version} est déjà enregistré.")
            versions[definition.version] = definition

    def resoudre(self, code: str, version: str | None = None) -> DefinitionAgent:
        """Retourner la définition demandée, ou la dernière version si ``version`` est absente."""
        versions = self._agents.get(code)
        if not versions:
            raise ErreurAgentInconnu("Aucun agent ne correspond à l'identifiant demandé.")

        if version is None:
            return max(versions.values(), key=lambda definition: Version(definition.version))

        definition = versions.get(version)
        if definition is None:
            raise ErreurAgentInconnu("Aucune version de cet agent ne correspond à la version demandée.")
        return definition

    def lister(self) -> tuple[DefinitionAgent, ...]:
        """Lister les définitions, triées par code puis par version croissante."""
        definitions = [definition for versions in self._agents.values() for definition in versions.values()]
        return tuple(sorted(definitions, key=lambda definition: (definition.code, Version(definition.version))))

    def __len__(self) -> int:
        return sum(len(versions) for versions in self._agents.values())

    def __contains__(self, code: object) -> bool:
        return isinstance(code, str) and code in self._agents
