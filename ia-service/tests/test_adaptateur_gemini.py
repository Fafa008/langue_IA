"""Tests de l'adaptateur Gemini, sans appel réseau ni quota."""

import asyncio
import logging
from collections.abc import AsyncIterator
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import httpx
import pytest
from google.genai import errors, types
from pydantic import Field

from app.core.config import ConfigLLM
from app.core.erreurs import (
    ErreurLlmAuthentification,
    ErreurLlmIndisponible,
    ErreurLlmLimiteRequetes,
    ErreurLlmRequete,
    ErreurLlmTimeout,
    ErreurReponseLlm,
)
from app.core.gestionnaire_erreurs import journaliser
from app.llm.adaptateurs.gemini import GeminiClient
from app.llm.base import MessageLLM, MorceauFlux
from app.schemas.base import ModeleStrict


class Sortie(ModeleStrict):
    valeur: str = Field(min_length=1)


MESSAGES = [
    MessageLLM(role="system", contenu="Tu réponds clairement."),
    MessageLLM(role="user", contenu="Bonjour"),
]


def configuration(**surcharges: object) -> ConfigLLM:
    base: dict[str, object] = {
        "fournisseur": "gemini",
        "gemini_modele": "modele-test",
        "gemini_cle_api": "cle-test-gemini",
    }
    base.update(surcharges)
    return ConfigLLM(**base)


def client_simule(reponse: object | None = None) -> Mock:
    client = Mock()
    client.aio = Mock()
    client.aio.models = Mock()
    client.aio.models.generate_content = AsyncMock(return_value=reponse)
    client.aio.models.generate_content_stream = AsyncMock()
    client.aio.aclose = AsyncMock()
    client.close = Mock()
    return client


def reponse_simulee(
    texte: str,
    usage: object | None = None,
    raison: types.FinishReason | None = types.FinishReason.STOP,
) -> SimpleNamespace:
    return SimpleNamespace(
        text=texte,
        usage_metadata=usage,
        candidates=[SimpleNamespace(finish_reason=raison)],
    )


async def collecter(flux: AsyncIterator[MorceauFlux]) -> list[MorceauFlux]:
    return [morceau async for morceau in flux]


class AttenteFactice:
    def __init__(self) -> None:
        self.delais: list[float] = []

    async def __call__(self, delai_s: float) -> None:
        self.delais.append(delai_s)


def test_initialise_le_sdk_avec_configuration_secrete_et_delai() -> None:
    sdk = client_simule()

    with patch("app.llm.adaptateurs.gemini.genai.Client", return_value=sdk) as constructeur:
        adaptateur = GeminiClient(configuration(timeout_s=3.5))
        arguments = constructeur.call_args.kwargs

    assert arguments["api_key"] == "cle-test-gemini"
    assert arguments["http_options"].timeout == 3500
    assert arguments["http_options"].retry_options.attempts == 1
    assert "cle-test-gemini" not in repr(adaptateur)

    asyncio.run(adaptateur.fermer())
    sdk.aio.aclose.assert_awaited_once()
    sdk.close.assert_called_once()


def test_generer_texte_transmet_instruction_et_normalise_la_reponse() -> None:
    usage = SimpleNamespace(prompt_token_count=12, candidates_token_count=4)
    sdk = client_simule(reponse_simulee("Bonjour.", usage))
    adaptateur = GeminiClient(configuration(), client=sdk)

    async def scenario() -> None:
        texte, reponse = await adaptateur.generer_texte(MESSAGES, temperature=0.6, max_tokens=50)

        assert texte == "Bonjour."
        assert reponse.contenu == texte
        assert reponse.fournisseur == "gemini"
        assert reponse.modele == "modele-test"
        assert reponse.tokens_entree == 12
        assert reponse.tokens_sortie == 4
        assert reponse.duree_ms >= 0

        appel = sdk.aio.models.generate_content.await_args.kwargs
        assert appel["model"] == "modele-test"
        assert appel["config"].system_instruction == "Tu réponds clairement."
        assert appel["config"].temperature == 0.6
        assert appel["config"].max_output_tokens == 50
        assert appel["contents"][0].role == "user"
        assert appel["contents"][0].parts[0].text == "Bonjour"

    asyncio.run(scenario())


def test_generer_json_demande_et_valide_le_schema_pydantic() -> None:
    sdk = client_simule(reponse_simulee('{"valeur":"ok"}'))
    adaptateur = GeminiClient(configuration(), client=sdk)

    async def scenario() -> None:
        resultat, _ = await adaptateur.generer_json(MESSAGES, schema=Sortie)

        assert resultat == Sortie(valeur="ok")
        config = sdk.aio.models.generate_content.await_args.kwargs["config"]
        assert config.response_mime_type == "application/json"
        assert config.response_schema is Sortie

    asyncio.run(scenario())


def test_generer_json_refuse_une_sortie_non_conforme() -> None:
    sdk = client_simule(reponse_simulee('{"valeur":""}'))
    adaptateur = GeminiClient(configuration(max_retries=0), client=sdk)

    async def scenario() -> None:
        with pytest.raises(ErreurReponseLlm):
            await adaptateur.generer_json(MESSAGES, schema=Sortie)

    asyncio.run(scenario())


@pytest.mark.parametrize(
    "texte",
    [
        "pas du JSON",
        '{"autre":"ok"}',
        '{"valeur":42}',
        '{"valeur":"ok","extra":true}',
    ],
)
def test_generer_json_refuse_les_champs_manquants_types_invalides_et_extras(texte: str) -> None:
    sdk = client_simule(reponse_simulee(texte))
    adaptateur = GeminiClient(configuration(max_retries=0), client=sdk)

    async def scenario() -> None:
        with pytest.raises(ErreurReponseLlm):
            await adaptateur.generer_json(MESSAGES, schema=Sortie)

    asyncio.run(scenario())


def test_generer_refuse_une_reponse_vide() -> None:
    sdk = client_simule(reponse_simulee("  "))
    adaptateur = GeminiClient(configuration(max_retries=0), client=sdk)

    async def scenario() -> None:
        with pytest.raises(ErreurReponseLlm):
            await adaptateur.generer_texte(MESSAGES)

    asyncio.run(scenario())


@pytest.mark.parametrize(
    ("statut", "type_erreur"),
    [
        (401, ErreurLlmAuthentification),
        (403, ErreurLlmAuthentification),
        (429, ErreurLlmLimiteRequetes),
        (500, ErreurLlmIndisponible),
        (400, ErreurLlmRequete),
    ],
)
def test_traduit_les_erreurs_http_sans_exposer_le_detail(
    statut: int,
    type_erreur: type[Exception],
) -> None:
    sdk = client_simule()
    sdk.aio.models.generate_content.side_effect = errors.ClientError(statut, {"message": "secret fournisseur"})
    adaptateur = GeminiClient(configuration(max_retries=0), client=sdk)

    async def scenario() -> None:
        with pytest.raises(type_erreur) as exc:
            await adaptateur.generer_texte(MESSAGES)
        assert "secret fournisseur" not in str(exc.value)
        assert "cle-test-gemini" not in str(exc.value)

    asyncio.run(scenario())


@pytest.mark.parametrize(
    ("raison", "type_erreur"),
    [
        (types.FinishReason.MAX_TOKENS, ErreurReponseLlm),
        (types.FinishReason.SAFETY, ErreurLlmRequete),
    ],
)
def test_refuse_une_generation_incomplete_ou_bloquee(
    raison: types.FinishReason,
    type_erreur: type[Exception],
) -> None:
    sdk = client_simule(reponse_simulee('{"valeur":"ok"}', raison=raison))
    adaptateur = GeminiClient(configuration(max_retries=0), client=sdk)

    async def scenario() -> None:
        with pytest.raises(type_erreur):
            await adaptateur.generer_json(MESSAGES, schema=Sortie)

    asyncio.run(scenario())


def test_refuse_une_reponse_sans_candidat() -> None:
    sdk = client_simule(SimpleNamespace(text="{}", usage_metadata=None, candidates=[]))
    adaptateur = GeminiClient(configuration(max_retries=0), client=sdk)

    async def scenario() -> None:
        with pytest.raises(ErreurLlmRequete):
            await adaptateur.generer_json(MESSAGES, schema=Sortie)

    asyncio.run(scenario())


def test_generer_texte_respecte_le_delai() -> None:
    async def reponse_lente(**_: object) -> object:
        await asyncio.sleep(0.02)
        return reponse_simulee("tard")

    sdk = client_simule()
    sdk.aio.models.generate_content.side_effect = reponse_lente
    adaptateur = GeminiClient(configuration(max_retries=0), client=sdk)

    async def scenario() -> None:
        with pytest.raises(ErreurLlmTimeout):
            await adaptateur.generer_texte(MESSAGES, delai_s=0.001)

    asyncio.run(scenario())


def test_reessaie_un_quota_en_respectant_retry_after() -> None:
    attente = AttenteFactice()
    sdk = client_simule()
    sdk.aio.models.generate_content.side_effect = [
        errors.ClientError(
            429,
            {"message": "quota"},
            response=httpx.Response(429, headers={"retry-after": "2"}),
        ),
        reponse_simulee("réussi"),
    ]
    adaptateur = GeminiClient(configuration(max_retries=1), client=sdk, attente=attente)

    async def scenario() -> None:
        texte, _ = await adaptateur.generer_texte(MESSAGES)
        assert texte == "réussi"

    asyncio.run(scenario())
    assert sdk.aio.models.generate_content.await_count == 2
    assert len(attente.delais) == 1
    assert 2.0 <= attente.delais[0] <= 2.2


@pytest.mark.parametrize(
    "statut",
    [400, 401, 403],
)
def test_ne_rejoue_pas_les_erreurs_permanentes(statut: int) -> None:
    attente = AttenteFactice()
    sdk = client_simule()
    sdk.aio.models.generate_content.side_effect = errors.ClientError(statut, {"message": "secret fournisseur"})
    adaptateur = GeminiClient(configuration(max_retries=3), client=sdk, attente=attente)

    async def scenario() -> None:
        with pytest.raises((ErreurLlmAuthentification, ErreurLlmRequete)) as exc:
            await adaptateur.generer_texte(MESSAGES)
        journaliser(exc.value)

    asyncio.run(scenario())

    assert sdk.aio.models.generate_content.await_count == 1
    assert attente.delais == []


def test_journal_ne_contient_ni_secret_ni_donnee_du_prompt(caplog: pytest.LogCaptureFixture) -> None:
    sdk = client_simule()
    sdk.aio.models.generate_content.side_effect = errors.ClientError(401, {"message": "cle-test-gemini"})
    adaptateur = GeminiClient(configuration(max_retries=0), client=sdk)
    messages = [MessageLLM(role="user", contenu="donnee-personnelle@example.test")]

    async def scenario() -> None:
        with pytest.raises(ErreurLlmAuthentification) as exc:
            await adaptateur.generer_texte(messages)
        journaliser(exc.value)

    with caplog.at_level(logging.WARNING):
        asyncio.run(scenario())

    assert "cle-test-gemini" not in caplog.text
    assert "donnee-personnelle@example.test" not in caplog.text
    assert "authentification" in caplog.text


def test_appels_concurrents_ne_sont_pas_serialises() -> None:
    actifs = 0
    maximum_actifs = 0

    async def generer(**_: object) -> object:
        nonlocal actifs, maximum_actifs
        actifs += 1
        maximum_actifs = max(maximum_actifs, actifs)
        await asyncio.sleep(0)
        actifs -= 1
        return reponse_simulee("réponse")

    sdk = client_simule()
    sdk.aio.models.generate_content.side_effect = generer
    adaptateur = GeminiClient(configuration(max_retries=0), client=sdk)

    async def scenario() -> None:
        await asyncio.gather(
            adaptateur.generer_texte(MESSAGES),
            adaptateur.generer_texte(MESSAGES),
        )

    asyncio.run(scenario())
    assert maximum_actifs == 2


def test_generer_flux_normalise_les_morceaux() -> None:
    async def flux() -> AsyncIterator[SimpleNamespace]:
        yield SimpleNamespace(
            text="Bon",
            usage_metadata=None,
            candidates=[SimpleNamespace(finish_reason=None)],
        )
        yield SimpleNamespace(
            text="jour",
            usage_metadata=SimpleNamespace(prompt_token_count=3, candidates_token_count=2),
            candidates=[SimpleNamespace(finish_reason=types.FinishReason.STOP)],
        )

    sdk = client_simule()
    sdk.aio.models.generate_content_stream.return_value = flux()
    adaptateur = GeminiClient(configuration(), client=sdk)

    async def scenario() -> None:
        morceaux = await collecter(adaptateur.generer_flux(MESSAGES))
        assert [morceau.texte for morceau in morceaux] == ["Bon", "jour", ""]
        assert morceaux[-1].fin is not None
        assert morceaux[-1].fin.contenu == "Bonjour"
        assert morceaux[-1].fin.tokens_entree == 3
        assert morceaux[-1].fin.tokens_sortie == 2

    asyncio.run(scenario())


def test_generer_flux_signale_une_fin_incomplete() -> None:
    async def flux() -> AsyncIterator[SimpleNamespace]:
        yield SimpleNamespace(
            text="partiel",
            usage_metadata=None,
            candidates=[SimpleNamespace(finish_reason=types.FinishReason.MAX_TOKENS)],
        )

    sdk = client_simule()
    sdk.aio.models.generate_content_stream.return_value = flux()
    adaptateur = GeminiClient(configuration(max_retries=0), client=sdk)

    async def scenario() -> None:
        with pytest.raises(ErreurReponseLlm):
            await collecter(adaptateur.generer_flux(MESSAGES))

    asyncio.run(scenario())
