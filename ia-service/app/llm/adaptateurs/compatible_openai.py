"""Adaptateur pour les fournisseurs exposant une API « compatible OpenAI ».

Concerne OpenAI, Mistral, Ollama, vLLM et la plupart des passerelles locales. Aucun SDK propriétaire n'est utilisé :
seul ``httpx`` est nécessaire, ce qui évite le verrouillage et garde l'image légère.

Le mode JSON s'appuie sur ``response_format={"type": "json_object"}`` ; la réponse est ensuite validée par le schéma
Pydantic fourni par l'appelant. Le streaming lit le protocole SSE (``data: {...}`` puis ``data: [DONE]``).

Depuis l'US-154, cet adaptateur ne décide plus lui-même de réessayer : il effectue **une** tentative et lève une
exception typée. La boucle commune (``app.core.reprise``) applique le nombre de tentatives, les délais et le budget
total. Un flux commencé n'est jamais rejoué, car des morceaux ont déjà pu être affichés.
"""

import asyncio
import json
import time
from collections.abc import AsyncIterator, Awaitable, Callable, Sequence
from typing import TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from app.core.config import ConfigLLM
from app.core.erreurs import (
    ErreurConfiguration,
    ErreurLlmAuthentification,
    ErreurLlmIndisponible,
    ErreurLlmLimiteRequetes,
    ErreurLlmRequete,
    ErreurLlmTimeout,
    ErreurReponseLlm,
)
from app.core.reprise import PolitiqueReprise, attendre, reessayer
from app.llm.base import MessageLLM, MorceauFlux, ReponseLLM

T = TypeVar("T", bound=BaseModel)

STATUTS_AUTHENTIFICATION = frozenset({401, 403})

MESSAGE_TIMEOUT = "Le fournisseur LLM n'a pas répondu dans le délai imparti."
MESSAGE_INDISPONIBLE = "Le fournisseur LLM est injoignable."
MESSAGE_REPONSE_INVALIDE = "Le fournisseur LLM a renvoyé une réponse inexploitable."


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
        self._attente = attente if attente is not None else attendre
        self._politique: PolitiqueReprise = config.politique_reprise

    @property
    def url(self) -> str:
        """URL complète de l'endpoint, utile à la supervision et aux tests."""
        return self._url

    @property
    def politique_reprise(self) -> PolitiqueReprise:
        """Bornes de reprise appliquées aux appels JSON."""
        return self._politique

    async def generer_json(
        self,
        messages: Sequence[MessageLLM],
        *,
        schema: type[T],
        temperature: float | None = None,
        max_tokens: int | None = None,
        delai_s: float | None = None,
    ) -> tuple[T, ReponseLLM]:
        """Appeler le fournisseur en mode JSON, avec reprise bornée, et valider la réponse avec ``schema``.

        Le budget total de ``ConfigLLM`` encadre l'ensemble des tentatives : quel que soit le comportement du
        fournisseur, l'appel rend la main avec ``ErreurLlmTimeout`` au plus tard à l'échéance.
        """
        debut = time.monotonic()
        corps = self._corps(messages, temperature, max_tokens, mode_json=True, flux=False)

        async def tentative() -> tuple[T, str, dict | None]:
            reponse_http = await self._poster(corps, self._delai(delai_s))
            donnees = self._charger_json(reponse_http)
            contenu = self._extraire_contenu(donnees)
            if not contenu.strip():
                raise ErreurReponseLlm(MESSAGE_REPONSE_INVALIDE)

            try:
                objet = schema.model_validate_json(contenu)
            except ValidationError as exc:
                raise ErreurReponseLlm(MESSAGE_REPONSE_INVALIDE) from exc

            usage = donnees.get("usage")
            return objet, contenu, usage if isinstance(usage, dict) else None

        try:
            async with asyncio.timeout(self._config.budget_total_s):
                objet, contenu, usage = await reessayer(
                    tentative,
                    politique=self._politique,
                    attente=self._attente,
                )
        except TimeoutError as exc:
            raise ErreurLlmTimeout(MESSAGE_TIMEOUT) from exc

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
                self._verifier_statut(reponse_http)

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
        except httpx.TransportError as exc:
            raise ErreurLlmIndisponible(MESSAGE_INDISPONIBLE) from exc
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

        Aucune reprise : un flux commencé a déjà pu être affiché. Le délai ``httpx`` borne chaque lecture, donc une
        connexion qui se bloque est interrompue même si le fournisseur n'envoie plus rien.
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
        """Envoyer une tentative unique ; la reprise éventuelle appartient à la politique commune."""
        try:
            reponse = await self._client.post(
                self._url,
                json=corps,
                headers=self._entetes(),
                timeout=delai_s,
            )
        except httpx.TimeoutException as exc:
            raise ErreurLlmTimeout(MESSAGE_TIMEOUT) from exc
        except httpx.TransportError as exc:
            raise ErreurLlmIndisponible(MESSAGE_INDISPONIBLE) from exc
        except httpx.HTTPError as exc:
            raise ErreurLlmIndisponible(MESSAGE_INDISPONIBLE) from exc

        self._verifier_statut(reponse)
        return reponse

    @staticmethod
    def _verifier_statut(reponse: httpx.Response) -> None:
        """Traduire un statut HTTP en erreur typée, sans jamais recopier le corps de la réponse."""
        statut = reponse.status_code
        if 200 <= statut < 300:
            return
        if statut in STATUTS_AUTHENTIFICATION:
            raise ErreurLlmAuthentification(f"Le fournisseur LLM a refusé l'authentification (HTTP {statut}).")
        if statut == 429:
            raise ErreurLlmLimiteRequetes(
                "Le fournisseur LLM a atteint sa limite de requêtes (HTTP 429).",
                retry_after_s=_delai_retry_after(reponse.headers),
            )
        if 300 <= statut < 400:
            raise ErreurLlmRequete(f"Le fournisseur LLM a répondu par une redirection inattendue (HTTP {statut}).")
        if statut < 500:
            raise ErreurLlmRequete(f"Le fournisseur LLM a refusé la requête (HTTP {statut}).")
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


def _delai_retry_after(entetes: httpx.Headers) -> float | None:
    """Lire ``Retry-After`` en secondes ; une date HTTP n'est pas interprétée et vaut « inconnu ».

    Le fournisseur ne doit pas pouvoir imposer une attente arbitraire : le plafond de la politique s'applique
    ensuite.
    """
    valeur = entetes.get("retry-after")
    if valeur is None:
        return None
    try:
        delai = float(valeur.strip())
    except ValueError:
        return None
    if delai < 0:
        return None
    return delai
