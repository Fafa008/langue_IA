"""Client LLM simulé (FakeLLMClient).

Il permet de tester le Harness et les agents sans clé API, sans réseau et sans dépendre d'un fournisseur. Les
scénarios sont consommés dans l'ordre : chaque appel (JSON ou flux) prend le scénario suivant, ce qui rend les
erreurs et les timeouts reproductibles.
"""

import asyncio
import json
import time
from collections import deque
from collections.abc import AsyncIterator, Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import TypeVar

from pydantic import BaseModel, ValidationError

from app.core.erreurs import ErreurConfiguration, ErreurReponseLlm
from app.llm.base import MessageLLM, MorceauFlux, ReponseLLM

T = TypeVar("T", bound=BaseModel)


@dataclass(frozen=True, slots=True)
class ScenarioLLM:
    """Réponse préparée pour un appel du faux client.

    ``reponse`` est validée contre le schéma demandé par l'appelant. ``morceaux`` alimente le flux ; à défaut, le
    flux est déduit de ``reponse``. ``erreur`` est levée telle quelle, ce qui permet de simuler un timeout ou une
    indisponibilité. ``delai_s`` ne sert qu'aux tests de budget.
    """

    reponse: BaseModel | Mapping[str, object] | str | None = None
    morceaux: tuple[str, ...] = ()
    erreur: Exception | None = None
    delai_s: float = 0.0


class FakeLLMClient:
    """Fournisseur factice conforme au contrat ``FournisseurLLM``."""

    nom = "factice"

    def __init__(
        self,
        scenarios: Sequence[ScenarioLLM] = (),
        *,
        modele: str = "factice-1",
        horloge: Callable[[], float] = time.monotonic,
    ) -> None:
        self.modele = modele
        self._scenarios = deque(scenarios)
        self._horloge = horloge
        self._ferme = False
        # Journaux d'observation : les tests vérifient que le Harness transmet bien les messages et l'ordre des appels.
        self.appels: list[list[MessageLLM]] = []
        self.flux_demandes: list[list[MessageLLM]] = []

    @property
    def ferme(self) -> bool:
        """Vrai après ``fermer()`` : permet de vérifier l'arrêt propre du client partagé."""
        return self._ferme

    def _prochain_scenario(self) -> ScenarioLLM:
        if not self._scenarios:
            raise ErreurConfiguration("Aucun scénario factice n'est disponible pour cet appel.")
        return self._scenarios.popleft()

    async def generer_json(
        self,
        messages: Sequence[MessageLLM],
        *,
        schema: type[T],
        temperature: float | None = None,
        max_tokens: int | None = None,
        delai_s: float | None = None,
    ) -> tuple[T, ReponseLLM]:
        """Valider le scénario courant avec ``schema`` et retourner la réponse normalisée."""
        self.appels.append(list(messages))
        scenario = self._prochain_scenario()

        debut = self._horloge()
        if scenario.delai_s > 0:
            await asyncio.sleep(scenario.delai_s)
        if scenario.erreur is not None:
            raise scenario.erreur
        if scenario.reponse is None:
            raise ErreurReponseLlm("Le scénario factice ne contient aucune réponse JSON.")

        try:
            if isinstance(scenario.reponse, str):
                objet = schema.model_validate_json(scenario.reponse)
            else:
                objet = schema.model_validate(scenario.reponse)
        except ValidationError as exc:
            raise ErreurReponseLlm("La réponse factice n'est pas conforme au schéma demandé.") from exc

        contenu = objet.model_dump_json()
        reponse = ReponseLLM(
            contenu=contenu,
            fournisseur=self.nom,
            modele=self.modele,
            duree_ms=self._duree_ms(debut),
            tokens_entree=self._tokens_entree(messages),
            tokens_sortie=len(contenu.split()),
        )
        return objet, reponse

    async def _iterer_flux(self, messages: Sequence[MessageLLM]) -> AsyncIterator[MorceauFlux]:
        self.flux_demandes.append(list(messages))
        scenario = self._prochain_scenario()

        debut = self._horloge()
        if scenario.delai_s > 0:
            await asyncio.sleep(scenario.delai_s)
        if scenario.erreur is not None:
            raise scenario.erreur

        morceaux = scenario.morceaux or self._morceaux_depuis_reponse(scenario.reponse)
        texte_complet = "".join(morceaux)
        for morceau in morceaux:
            yield MorceauFlux(texte=morceau)

        yield MorceauFlux(
            texte="",
            fin=ReponseLLM(
                contenu=texte_complet,
                fournisseur=self.nom,
                modele=self.modele,
                duree_ms=self._duree_ms(debut),
                tokens_entree=self._tokens_entree(messages),
                tokens_sortie=len(texte_complet.split()),
            ),
        )

    def generer_flux(
        self,
        messages: Sequence[MessageLLM],
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        delai_s: float | None = None,
    ) -> AsyncIterator[MorceauFlux]:
        """Retourner le flux asynchrone du scénario courant (sans rejeu en cas d'erreur)."""
        return self._iterer_flux(messages)

    async def fermer(self) -> None:
        """Aucun réseau à libérer, mais l'arrêt reste idempotent et observable."""
        self._ferme = True

    @staticmethod
    def _morceaux_depuis_reponse(reponse: BaseModel | Mapping[str, object] | str | None) -> tuple[str, ...]:
        if reponse is None:
            return ()
        if isinstance(reponse, BaseModel):
            return (reponse.model_dump_json(),)
        if isinstance(reponse, str):
            return (reponse,)
        try:
            return (json.dumps(reponse, ensure_ascii=False),)
        except (TypeError, ValueError) as exc:
            raise ErreurReponseLlm("La réponse factice n'est pas sérialisable en JSON.") from exc

    def _duree_ms(self, debut: float) -> int:
        return max(0, int(round((self._horloge() - debut) * 1000)))

    @staticmethod
    def _tokens_entree(messages: Sequence[MessageLLM]) -> int:
        return sum(len(message.contenu.split()) for message in messages)
