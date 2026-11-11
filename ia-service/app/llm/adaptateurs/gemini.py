"""Adaptateur asynchrone pour le SDK officiel Google Gen AI."""

import asyncio
import math
import time
from collections.abc import AsyncIterator, Awaitable, Callable, Mapping, Sequence
from typing import NoReturn, TypeVar

import httpx
from google import genai
from google.genai import errors, types
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
R = TypeVar("R")

MESSAGE_TIMEOUT = "Le fournisseur LLM n'a pas répondu dans le délai imparti."
MESSAGE_INDISPONIBLE = "Le fournisseur LLM est injoignable."
MESSAGE_REQUETE_INVALIDE = "Le fournisseur LLM a refusé la requête."
MESSAGE_REPONSE_INVALIDE = "Le fournisseur LLM a renvoyé une réponse inexploitable."

# Mots-clés JSON Schema que l'API Gemini refuse dans ``response_schema``.
# Pydantic émet ``additionalProperties: false`` dès que ``extra="forbid"`` est posé ; ``default`` n'est pas
# accepté non plus. La validation finale restant celle de Pydantic, les retirer ne change pas le contrat.
_CLES_SCHEMA_REFUSEES = frozenset({"additionalProperties", "default"})


def _schema_compatible_gemini(valeur: object) -> object:
    """Copier un schéma JSON en retirant récursivement les mots-clés refusés par l'API Gemini."""
    if isinstance(valeur, dict):
        return {
            cle: _schema_compatible_gemini(sous_valeur)
            for cle, sous_valeur in valeur.items()
            if cle not in _CLES_SCHEMA_REFUSEES
        }
    if isinstance(valeur, list):
        return [_schema_compatible_gemini(element) for element in valeur]
    return valeur


class GeminiClient:
    """Client Gemini partageant le contrat ``FournisseurLLM``."""

    nom = "gemini"

    def __init__(
        self,
        config: ConfigLLM,
        *,
        client: genai.Client | None = None,
        attente: Callable[[float], Awaitable[None]] | None = None,
    ) -> None:
        if config.gemini_modele is None or config.gemini_cle_api is None:
            raise ErreurConfiguration("Gemini exige GEMINI_MODEL et GEMINI_API_KEY.")

        self._config = config
        self.modele = config.gemini_modele
        self._client = (
            client
            if client is not None
            else genai.Client(
                api_key=config.gemini_cle_api.get_secret_value(),
                http_options=types.HttpOptions(
                    timeout=max(1, math.ceil(config.timeout_s * 1000)),
                    retry_options=types.HttpRetryOptions(attempts=1),
                ),
            )
        )
        self._client_externe = client is not None
        self._attente = attente if attente is not None else attendre
        self._politique: PolitiqueReprise = config.politique_reprise
        self._ferme = False

    async def generer_texte(
        self,
        messages: Sequence[MessageLLM],
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        delai_s: float | None = None,
    ) -> tuple[str, ReponseLLM]:
        """Générer du texte avec l'API asynchrone du SDK."""
        return await self._avec_reprises(
            lambda: self._generer(
                messages,
                temperature=temperature,
                max_tokens=max_tokens,
                delai_s=delai_s,
            )
        )

    async def generer_json(
        self,
        messages: Sequence[MessageLLM],
        *,
        schema: type[T],
        temperature: float | None = None,
        max_tokens: int | None = None,
        delai_s: float | None = None,
    ) -> tuple[T, ReponseLLM]:
        """Générer une réponse JSON et la valider localement contre le schéma Pydantic."""

        async def tentative() -> tuple[T, ReponseLLM]:
            contenu, reponse = await self._generer(
                messages,
                schema=schema,
                temperature=temperature,
                max_tokens=max_tokens,
                delai_s=delai_s,
            )
            try:
                resultat = schema.model_validate_json(contenu)
            except ValidationError as exc:
                raise ErreurReponseLlm(MESSAGE_REPONSE_INVALIDE) from exc
            return resultat, reponse

        return await self._avec_reprises(tentative)

    async def _avec_reprises(self, operation: Callable[[], Awaitable[R]]) -> R:
        """Appliquer la politique partagée au budget total, sans retry caché dans le SDK."""
        try:
            async with asyncio.timeout(self._politique.budget_total_s):
                return await reessayer(
                    operation,
                    politique=self._politique,
                    attente=self._attente,
                )
        except TimeoutError as exc:
            raise ErreurLlmTimeout(MESSAGE_TIMEOUT) from exc

    async def _generer(
        self,
        messages: Sequence[MessageLLM],
        *,
        schema: type[BaseModel] | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        delai_s: float | None = None,
    ) -> tuple[str, ReponseLLM]:
        if self._ferme:
            raise ErreurConfiguration("Le client Gemini est fermé.")
        contenu_messages, instruction_systeme = self._preparer_messages(messages)
        options: dict[str, object] = {
            "system_instruction": instruction_systeme,
            "temperature": self._config.temperature if temperature is None else temperature,
            "max_output_tokens": self._config.max_tokens if max_tokens is None else max_tokens,
        }
        if schema is not None:
            options["response_mime_type"] = "application/json"
            options["response_schema"] = _schema_compatible_gemini(schema.model_json_schema())
        configuration = types.GenerateContentConfig(**options)
        debut = time.monotonic()

        try:
            async with asyncio.timeout(self._delai(delai_s)):
                reponse = await self._client.aio.models.generate_content(
                    model=self.modele,
                    contents=contenu_messages,
                    config=configuration,
                )
        except (TimeoutError, httpx.TimeoutException) as exc:
            raise ErreurLlmTimeout(MESSAGE_TIMEOUT) from exc
        except httpx.TransportError as exc:
            raise ErreurLlmIndisponible(MESSAGE_INDISPONIBLE) from exc
        except errors.APIError as exc:
            self._lever_erreur_fournisseur(exc)

        self._verifier_reponse_complete(reponse)
        try:
            contenu = reponse.text
        except ValueError as exc:
            raise ErreurReponseLlm(MESSAGE_REPONSE_INVALIDE) from exc
        if not isinstance(contenu, str) or not contenu.strip():
            raise ErreurReponseLlm(MESSAGE_REPONSE_INVALIDE)

        return contenu, self._reponse_normalisee(contenu, reponse.usage_metadata, debut)

    def generer_flux(
        self,
        messages: Sequence[MessageLLM],
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        delai_s: float | None = None,
    ) -> AsyncIterator[MorceauFlux]:
        """Retourner le flux asynchrone du SDK ; un flux commencé n'est jamais rejoué."""
        return self._iterer_flux(
            messages,
            temperature=temperature,
            max_tokens=max_tokens,
            delai_s=delai_s,
        )

    async def _iterer_flux(
        self,
        messages: Sequence[MessageLLM],
        *,
        temperature: float | None,
        max_tokens: int | None,
        delai_s: float | None,
    ) -> AsyncIterator[MorceauFlux]:
        if self._ferme:
            raise ErreurConfiguration("Le client Gemini est fermé.")
        contenu_messages, instruction_systeme = self._preparer_messages(messages)
        configuration = types.GenerateContentConfig(
            system_instruction=instruction_systeme,
            temperature=self._config.temperature if temperature is None else temperature,
            max_output_tokens=self._config.max_tokens if max_tokens is None else max_tokens,
        )
        debut = time.monotonic()
        morceaux: list[str] = []
        usage = None
        raison_fin = None

        try:
            async with asyncio.timeout(self._delai(delai_s)):
                flux = await self._client.aio.models.generate_content_stream(
                    model=self.modele,
                    contents=contenu_messages,
                    config=configuration,
                )
                async for morceau in flux:
                    if morceau.candidates:
                        raison_fin = morceau.candidates[0].finish_reason
                    if morceau.usage_metadata is not None:
                        usage = morceau.usage_metadata
                    texte = self._texte_ou_vide(morceau)
                    if texte:
                        morceaux.append(texte)
                        yield MorceauFlux(texte=texte)
        except (TimeoutError, httpx.TimeoutException) as exc:
            raise ErreurLlmTimeout(MESSAGE_TIMEOUT) from exc
        except httpx.TransportError as exc:
            raise ErreurLlmIndisponible(MESSAGE_INDISPONIBLE) from exc
        except errors.APIError as exc:
            self._lever_erreur_fournisseur(exc)

        self._verifier_raison_fin(raison_fin)
        contenu = "".join(morceaux)
        if not contenu.strip():
            raise ErreurReponseLlm(MESSAGE_REPONSE_INVALIDE)
        yield MorceauFlux(
            texte="",
            fin=self._reponse_normalisee(contenu, usage, debut),
        )

    async def fermer(self) -> None:
        """Libérer les clients SDK asynchrone et synchrone, sans fermer un client injecté."""
        if self._ferme or self._client_externe:
            return
        self._ferme = True
        try:
            await self._client.aio.aclose()
        finally:
            self._client.close()

    @staticmethod
    def _preparer_messages(
        messages: Sequence[MessageLLM],
    ) -> tuple[list[types.Content], str | None]:
        instruction = "\n\n".join(message.contenu for message in messages if message.role == "system") or None
        contenu = [
            types.Content(
                role="model" if message.role == "assistant" else "user",
                parts=[types.Part.from_text(text=message.contenu)],
            )
            for message in messages
            if message.role != "system"
        ]
        if not contenu:
            raise ErreurLlmRequete(MESSAGE_REQUETE_INVALIDE)
        return contenu, instruction

    def _reponse_normalisee(self, contenu: str, usage: object, debut: float) -> ReponseLLM:
        return ReponseLLM(
            contenu=contenu,
            fournisseur=self.nom,
            modele=self.modele,
            duree_ms=max(0, int(round((time.monotonic() - debut) * 1000))),
            tokens_entree=self._entier_ou_none(usage, "prompt_token_count"),
            tokens_sortie=self._entier_ou_none(usage, "candidates_token_count"),
        )

    @staticmethod
    def _texte_ou_vide(reponse: types.GenerateContentResponse) -> str:
        try:
            texte = reponse.text
        except ValueError:
            return ""
        return texte if isinstance(texte, str) else ""

    @staticmethod
    def _verifier_reponse_complete(reponse: types.GenerateContentResponse) -> None:
        if not reponse.candidates:
            raise ErreurLlmRequete(MESSAGE_REQUETE_INVALIDE)
        GeminiClient._verifier_raison_fin(reponse.candidates[0].finish_reason)

    @staticmethod
    def _verifier_raison_fin(raison: types.FinishReason | None) -> None:
        if raison is types.FinishReason.STOP:
            return
        if raison in {
            None,
            types.FinishReason.FINISH_REASON_UNSPECIFIED,
            types.FinishReason.MAX_TOKENS,
        }:
            raise ErreurReponseLlm(MESSAGE_REPONSE_INVALIDE)
        raise ErreurLlmRequete(MESSAGE_REQUETE_INVALIDE)

    @staticmethod
    def _entier_ou_none(usage: object, nom: str) -> int | None:
        valeur = getattr(usage, nom, None)
        if isinstance(valeur, bool) or not isinstance(valeur, int) or valeur < 0:
            return None
        return valeur

    def _delai(self, delai_s: float | None) -> float:
        return self._config.timeout_s if delai_s is None else delai_s

    @staticmethod
    def _lever_erreur_fournisseur(exception: errors.APIError) -> NoReturn:
        if exception.code in {401, 403}:
            raise ErreurLlmAuthentification("Le fournisseur LLM a refusé l'authentification.") from exception
        if exception.code == 429:
            raise ErreurLlmLimiteRequetes(
                "Le fournisseur LLM a atteint sa limite de requêtes.",
                retry_after_s=GeminiClient._delai_retry_after(exception),
            ) from exception
        if exception.code == 408:
            raise ErreurLlmTimeout(MESSAGE_TIMEOUT) from exception
        if exception.code >= 500:
            raise ErreurLlmIndisponible(MESSAGE_INDISPONIBLE) from exception
        raise ErreurLlmRequete(MESSAGE_REQUETE_INVALIDE) from exception

    @staticmethod
    def _delai_retry_after(exception: errors.APIError) -> float | None:
        reponse = getattr(exception, "response", None)
        entetes = getattr(reponse, "headers", None)
        if not isinstance(entetes, Mapping):
            return None
        valeur = entetes.get("retry-after")
        if not isinstance(valeur, str):
            return None
        try:
            delai = float(valeur.strip())
        except ValueError:
            return None
        return delai if math.isfinite(delai) and delai >= 0 else None
