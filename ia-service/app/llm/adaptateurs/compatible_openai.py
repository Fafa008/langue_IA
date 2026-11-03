"""Adaptateur pour les fournisseurs exposant une API « compatible OpenAI ».

Concerne OpenAI, Mistral, Ollama, vLLM et la plupart des passerelles locales. Aucun SDK propriétaire n'est utilisé :
seul ``httpx`` est nécessaire, ce qui évite le verrouillage et garde l'image légère.

Le mode JSON s'appuie sur ``response_format={"type": "json_object"}`` ; la réponse est ensuite validée par le schéma
Pydantic fourni par l'appelant. Le streaming lit le protocole SSE (``data: {...}`` puis ``data: [DONE]``).
"""

import asyncio
import json
import time
from collections.abc import AsyncIterator, Awaitable, Callable, Sequence
from typing import TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from app.core.config import ConfigLLM
from app.core.erreurs import ErreurConfiguration, ErreurLlmIndisponible, ErreurLlmTimeout, ErreurReponseLlm
from app.llm.base import MessageLLM, MorceauFlux, ReponseLLM

T = TypeVar("T", bound=BaseModel)

# Seuls ces statuts justifient une reprise : une erreur 400/401/403/422 est définitive.
STATUTS_REJOUABLES = frozenset({429, 500, 502, 503, 504})
STATUTS_AUTHENTIFICATION = frozenset({401, 403})

MESSAGE_TIMEOUT = "Le fournisseur LLM n'a pas répondu dans le délai imparti."
MESSAGE_INDISPONIBLE = "Le fournisseur LLM est injoignable."
MESSAGE_REPONSE_INVALIDE = "Le fournisseur LLM a renvoyé une réponse inexploitable."


async def _attendre(delai_s: float) -> None:
    """Attente par défaut entre deux tentatives (surchargeable dans les tests)."""
    await asyncio.sleep(delai_s)


class CompatibleOpenAI:
    """Client HTTP minimal pour une API de type ``/chat/completions``."""

    nom = "compatible-openai"

    def __init__(
        self,
        config: ConfigLLM,
        *,
        client: httpx.AsyncClient | None = None,
        attente: Callable[[float], Awaitable[None]] | None = None,
    ) -> None:
        if config.modele is None or config.base_url is None or config.api_key is None:
            raise ErreurConfiguration("Le fournisseur compatible-openai exige LLM_MODELE, LLM_BASE_URL et LLM_API_KEY.")
        self._config = config
        self.modele = config.modele
        self._url = f"{str(config.base_url).rstrip('/')}/chat/completions"
        self._api_key = config.api_key
        self._client = client if client is not None else httpx.AsyncClient(timeout=config.timeout_s)
        self._client_externe = client is not None
        self._attente = attente if attente is not None else _attendre

    @property
    def url(self) -> str:
        """URL complète de l'endpoint, utile à la supervision et aux tests."""
        return self._url

    async def generer_json(
        self,
        messages: Sequence[MessageLLM],
        *,
        schema: type[T],
        temperature: float | None = None,
        max_tokens: int | None = None,
        delai_s: float | None = None,
    ) -> tuple[T, ReponseLLM]:
        """Appeler le fournisseur en mode JSON et valider la réponse avec ``schema``."""
        debut = time.monotonic()
        corps = self._corps(messages, temperature, max_tokens, mode_json=True, flux=False)
        reponse_http = await self._poster(corps, self._delai(delai_s))

        donnees = self._charger_json(reponse_http)
        contenu = self._extraire_contenu(donnees)
        if not contenu.strip():
            raise ErreurReponseLlm(MESSAGE_REPONSE_INVALIDE)

        try:
            objet = schema.model_validate_json(contenu)
        except ValidationError as exc:
            raise ErreurReponseLlm(MESSAGE_REPONSE_INVALIDE) from exc

        usage = donnees.get("usage") if isinstance(donnees, dict) else None
        return objet, ReponseLLM(
            contenu=contenu,
            fournisseur=self.nom,
            modele=self.modele,
            duree_ms=self._duree_ms(debut),
            tokens_entree=self._entier_ou_none(usage, "prompt_tokens"),
            tokens_sortie=self._entier_ou_none(usage, "completion_tokens"),
        )

    async def _iterer_flux(
        self,
        messages: Sequence[MessageLLM],
        *,
        temperature: float | None,
        max_tokens: int | None,
        delai_s: float | None,
    ) -> AsyncIterator[MorceauFlux]:
        debut = time.monotonic()
        corps = self._corps(messages, temperature, max_tokens, mode_json=False, flux=True)
        morceaux: list[str] = []
        tokens_entree: int | None = None
        tokens_sortie: int | None = None

        try:
            async with self._client.stream(
                "POST",
                self._url,
                json=corps,
                headers=self._entetes(),
                timeout=self._delai(delai_s),
            ) as reponse_http:
                if reponse_http.status_code >= 300:
                    await reponse_http.aread()
                    self._verifier_statut(reponse_http.status_code)

                async for ligne in reponse_http.aiter_lines():
                    if not ligne.startswith("data:"):
                        continue
                    donnee = ligne.removeprefix("data:").strip()
                    if not donnee:
                        continue
                    if donnee == "[DONE]":
                        break

                    evenement = self._charger_evenement(donnee)
                    usage = evenement.get("usage")
                    if isinstance(usage, dict):
                        tokens_entree = self._entier_ou_none(usage, "prompt_tokens") or tokens_entree
                        tokens_sortie = self._entier_ou_none(usage, "completion_tokens") or tokens_sortie

                    choix = evenement.get("choices")
                    if not isinstance(choix, list) or not choix:
                        continue
                    premier = choix[0]
                    delta = premier.get("delta") if isinstance(premier, dict) else None
                    texte = delta.get("content") if isinstance(delta, dict) else None
                    if isinstance(texte, str) and texte:
                        morceaux.append(texte)
                        yield MorceauFlux(texte=texte)
        except httpx.TimeoutException as exc:
            raise ErreurLlmTimeout(MESSAGE_TIMEOUT) from exc
        except httpx.HTTPError as exc:
            raise ErreurLlmIndisponible(MESSAGE_INDISPONIBLE) from exc

        texte_complet = "".join(morceaux)
        yield MorceauFlux(
            texte="",
            fin=ReponseLLM(
                contenu=texte_complet,
                fournisseur=self.nom,
                modele=self.modele,
                duree_ms=self._duree_ms(debut),
                tokens_entree=tokens_entree,
                tokens_sortie=tokens_sortie,
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
        """Retourner le flux SSE du fournisseur.

        Un flux commencé n'est jamais rejoué : le consommateur a déjà pu afficher des morceaux. Une erreur de statut
        avant tout contenu est signalée par ``ErreurLlmIndisponible``.
        """
        return self._iterer_flux(
            messages,
            temperature=temperature,
            max_tokens=max_tokens,
            delai_s=delai_s,
        )

    async def fermer(self) -> None:
        """Fermer le client HTTP interne ; un client injecté reste sous la responsabilité de l'appelant."""
        if not self._client_externe:
            await self._client.aclose()

    def _entetes(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key.get_secret_value()}",
            "Content-Type": "application/json",
        }

    def _corps(
        self,
        messages: Sequence[MessageLLM],
        temperature: float | None,
        max_tokens: int | None,
        *,
        mode_json: bool,
        flux: bool,
    ) -> dict[str, object]:
        corps: dict[str, object] = {
            "model": self.modele,
            "messages": [{"role": message.role, "content": message.contenu} for message in messages],
            "temperature": self._config.temperature if temperature is None else temperature,
            "max_tokens": self._config.max_tokens if max_tokens is None else max_tokens,
        }
        if mode_json:
            corps["response_format"] = {"type": "json_object"}
        if flux:
            corps["stream"] = True
        return corps

    async def _poster(self, corps: dict[str, object], delai_s: float) -> httpx.Response:
        """Envoyer la requête, avec reprise uniquement sur les statuts transitoires."""
        for tentative in range(self._config.max_retries + 1):
            try:
                reponse = await self._client.post(
                    self._url,
                    json=corps,
                    headers=self._entetes(),
                    timeout=delai_s,
                )
            except httpx.TimeoutException as exc:
                raise ErreurLlmTimeout(MESSAGE_TIMEOUT) from exc
            except httpx.HTTPError as exc:
                raise ErreurLlmIndisponible(MESSAGE_INDISPONIBLE) from exc

            if reponse.status_code in STATUTS_REJOUABLES and tentative < self._config.max_retries:
                await self._attente(min(0.5 * (2**tentative), 4.0))
                continue

            self._verifier_statut(reponse.status_code)
            return reponse

        raise ErreurLlmIndisponible(MESSAGE_INDISPONIBLE)  # pragma: no cover - boucle toujours bornée

    @staticmethod
    def _verifier_statut(statut: int) -> None:
        """Traduire un statut HTTP en erreur interne, sans recopier le corps de la réponse."""
        if statut in STATUTS_AUTHENTIFICATION:
            raise ErreurLlmIndisponible("Le fournisseur LLM a refusé l'authentification.")
        if statut == 429:
            raise ErreurLlmIndisponible("Le fournisseur LLM a atteint sa limite de requêtes.")
        if statut >= 400:
            raise ErreurLlmIndisponible(f"Le fournisseur LLM a renvoyé une erreur HTTP {statut}.")

    @staticmethod
    def _charger_json(reponse_http: httpx.Response) -> dict:
        try:
            donnees = reponse_http.json()
        except ValueError as exc:
            raise ErreurReponseLlm(MESSAGE_REPONSE_INVALIDE) from exc
        if not isinstance(donnees, dict):
            raise ErreurReponseLlm(MESSAGE_REPONSE_INVALIDE)
        return donnees

    @staticmethod
    def _extraire_contenu(donnees: dict) -> str:
        try:
            contenu = donnees["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise ErreurReponseLlm(MESSAGE_REPONSE_INVALIDE) from exc
        if not isinstance(contenu, str):
            raise ErreurReponseLlm(MESSAGE_REPONSE_INVALIDE)
        return contenu

    @staticmethod
    def _charger_evenement(donnee: str) -> dict:
        try:
            evenement = json.loads(donnee)
        except json.JSONDecodeError as exc:
            raise ErreurReponseLlm(MESSAGE_REPONSE_INVALIDE) from exc
        if not isinstance(evenement, dict):
            raise ErreurReponseLlm(MESSAGE_REPONSE_INVALIDE)
        return evenement

    @staticmethod
    def _entier_ou_none(usage: object, cle: str) -> int | None:
        if not isinstance(usage, dict):
            return None
        valeur = usage.get(cle)
        if isinstance(valeur, bool) or not isinstance(valeur, int) or valeur < 0:
            return None
        return valeur

    def _delai(self, delai_s: float | None) -> float:
        return self._config.timeout_s if delai_s is None else delai_s

    @staticmethod
    def _duree_ms(debut: float) -> int:
        return max(0, int(round((time.monotonic() - debut) * 1000)))
