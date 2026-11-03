"""Tests de l'adaptateur HTTP compatible OpenAI (sans réseau réel)."""

import asyncio
import json
from collections.abc import AsyncIterator, Callable

import httpx
import pytest
from pydantic import Field

from app.core.config import ConfigLLM
from app.core.erreurs import ErreurConfiguration, ErreurLlmIndisponible, ErreurLlmTimeout, ErreurReponseLlm
from app.llm.adaptateurs.compatible_openai import CompatibleOpenAI, _attendre
from app.llm.base import MessageLLM, MorceauFlux
from app.schemas.base import ModeleStrict


class Sortie(ModeleStrict):
    valeur: str = Field(min_length=1)


MESSAGES = [MessageLLM(role="system", contenu="Tu réponds en JSON."), MessageLLM(role="user", contenu="Bonjour")]


def config(**surcharges: object) -> ConfigLLM:
    base: dict[str, object] = {
        "environnement": "dev",
        "fournisseur": "compatible-openai",
        "modele": "modele-test",
        "base_url": "https://llm.test/v1",
        "api_key": "sk-secret-test",
        "temperature": 0.2,
        "max_tokens": 600,
        "timeout_s": 5.0,
        "max_retries": 1,
    }
    base.update(surcharges)
    return ConfigLLM(**base)


def client_simule(handler: Callable[[httpx.Request], httpx.Response]) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


async def collecter(flux: AsyncIterator[MorceauFlux]) -> list[MorceauFlux]:
    return [morceau async for morceau in flux]


def test_generer_json_envoie_la_requete_attendue(env_propre: pytest.MonkeyPatch) -> None:
    captures: list[httpx.Request] = []

    def handler(requete: httpx.Request) -> httpx.Response:
        captures.append(requete)
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": '{"valeur": "bonjour"}'}}],
                "usage": {"prompt_tokens": 12, "completion_tokens": 4},
            },
        )

    async def scenario() -> None:
        adaptateur = CompatibleOpenAI(config(), client=client_simule(handler))
        objet, reponse = await adaptateur.generer_json(MESSAGES, schema=Sortie, temperature=0.9, max_tokens=42)
        await adaptateur.fermer()

        assert objet == Sortie(valeur="bonjour")
        assert reponse.fournisseur == "compatible-openai"
        assert reponse.modele == "modele-test"
        assert reponse.tokens_entree == 12
        assert reponse.tokens_sortie == 4
        assert reponse.duree_ms >= 0

        requete = captures[0]
        assert str(requete.url) == "https://llm.test/v1/chat/completions"
        assert requete.method == "POST"
        assert requete.headers["authorization"] == "Bearer sk-secret-test"
        corps = json.loads(requete.content)
        assert corps["model"] == "modele-test"
        assert corps["temperature"] == 0.9
        assert corps["max_tokens"] == 42
        assert corps["response_format"] == {"type": "json_object"}
        assert corps["messages"][0] == {"role": "system", "content": "Tu réponds en JSON."}

    asyncio.run(scenario())


def test_generer_json_utilise_les_defauts_de_configuration(env_propre: pytest.MonkeyPatch) -> None:
    corps_vus: list[dict] = []

    def handler(requete: httpx.Request) -> httpx.Response:
        corps_vus.append(json.loads(requete.content))
        return httpx.Response(200, json={"choices": [{"message": {"content": '{"valeur": "ok"}'}}]})

    async def scenario() -> None:
        adaptateur = CompatibleOpenAI(config(temperature=0.1, max_tokens=77), client=client_simule(handler))
        _, reponse = await adaptateur.generer_json(MESSAGES, schema=Sortie)
        await adaptateur.fermer()
        assert reponse.tokens_entree is None
        assert reponse.tokens_sortie is None

    asyncio.run(scenario())
    assert corps_vus[0]["temperature"] == 0.1
    assert corps_vus[0]["max_tokens"] == 77


@pytest.mark.parametrize(
    "reponse",
    [
        httpx.Response(200, text="pas du json"),
        httpx.Response(200, json=["liste"]),
        httpx.Response(200, json={"choices": []}),
        httpx.Response(200, json={"choices": [{"message": {"content": None}}]}),
        httpx.Response(200, json={"choices": [{"message": {"content": ""}}]}),
        httpx.Response(200, json={"choices": [{"message": {"content": '{"valeur": ""}'}}]}),
        httpx.Response(200, json={"choices": [{"message": {"content": '{"valeur": "ok", "extra": 1}'}}]}),
    ],
)
def test_generer_json_refuse_une_reponse_inexploitable(
    env_propre: pytest.MonkeyPatch,
    reponse: httpx.Response,
) -> None:
    async def scenario() -> None:
        adaptateur = CompatibleOpenAI(config(), client=client_simule(lambda _: reponse))
        with pytest.raises(ErreurReponseLlm) as exc:
            await adaptateur.generer_json(MESSAGES, schema=Sortie)
        assert "sk-secret-test" not in str(exc.value)
        await adaptateur.fermer()

    asyncio.run(scenario())


def test_generer_json_lit_les_tokens_invalides_comme_absents(env_propre: pytest.MonkeyPatch) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": '{"valeur": "ok"}'}}],
                "usage": {"prompt_tokens": True, "completion_tokens": -3},
            },
        )

    async def scenario() -> None:
        adaptateur = CompatibleOpenAI(config(), client=client_simule(handler))
        _, reponse = await adaptateur.generer_json(MESSAGES, schema=Sortie)
        assert reponse.tokens_entree is None
        assert reponse.tokens_sortie is None
        await adaptateur.fermer()

    asyncio.run(scenario())


def test_generer_json_authentification_refusee(env_propre: pytest.MonkeyPatch) -> None:
    async def scenario() -> None:
        adaptateur = CompatibleOpenAI(config(), client=client_simule(lambda _: httpx.Response(401)))
        with pytest.raises(ErreurLlmIndisponible) as exc:
            await adaptateur.generer_json(MESSAGES, schema=Sortie)
        assert "authentification" in str(exc.value)
        assert "sk-secret-test" not in str(exc.value)
        await adaptateur.fermer()

    asyncio.run(scenario())


def test_generer_json_erreur_definitive_sans_reprise(env_propre: pytest.MonkeyPatch) -> None:
    appels: list[int] = []

    def handler(_: httpx.Request) -> httpx.Response:
        appels.append(1)
        return httpx.Response(400, text="requête invalide")

    async def scenario() -> None:
        adaptateur = CompatibleOpenAI(config(), client=client_simule(handler))
        with pytest.raises(ErreurLlmIndisponible) as exc:
            await adaptateur.generer_json(MESSAGES, schema=Sortie)
        assert "HTTP 400" in str(exc.value)
        await adaptateur.fermer()

    asyncio.run(scenario())
    assert len(appels) == 1


def test_generer_json_reessaye_sur_503_puis_reussit(env_propre: pytest.MonkeyPatch) -> None:
    appels: list[int] = []
    attentes: list[float] = []

    def handler(_: httpx.Request) -> httpx.Response:
        appels.append(1)
        if len(appels) == 1:
            return httpx.Response(503)
        return httpx.Response(200, json={"choices": [{"message": {"content": '{"valeur": "ok"}'}}]})

    async def pas_d_attente(delai: float) -> None:
        attentes.append(delai)

    async def scenario() -> None:
        adaptateur = CompatibleOpenAI(config(max_retries=1), client=client_simule(handler), attente=pas_d_attente)
        objet, _ = await adaptateur.generer_json(MESSAGES, schema=Sortie)
        assert objet.valeur == "ok"
        await adaptateur.fermer()

    asyncio.run(scenario())
    assert len(appels) == 2
    assert attentes == [0.5]


def test_generer_json_epuise_les_reprises(env_propre: pytest.MonkeyPatch) -> None:
    appels: list[int] = []

    def handler(_: httpx.Request) -> httpx.Response:
        appels.append(1)
        return httpx.Response(502)

    async def scenario() -> None:
        adaptateur = CompatibleOpenAI(
            config(max_retries=2),
            client=client_simule(handler),
            attente=lambda _: asyncio.sleep(0),
        )
        with pytest.raises(ErreurLlmIndisponible) as exc:
            await adaptateur.generer_json(MESSAGES, schema=Sortie)
        assert "HTTP 502" in str(exc.value)
        await adaptateur.fermer()

    asyncio.run(scenario())
    assert len(appels) == 3


def test_generer_json_limite_de_requetes(env_propre: pytest.MonkeyPatch) -> None:
    async def scenario() -> None:
        adaptateur = CompatibleOpenAI(
            config(max_retries=0),
            client=client_simule(lambda _: httpx.Response(429)),
        )
        with pytest.raises(ErreurLlmIndisponible) as exc:
            await adaptateur.generer_json(MESSAGES, schema=Sortie)
        assert "limite de requêtes" in str(exc.value)
        await adaptateur.fermer()

    asyncio.run(scenario())


def test_generer_json_timeout(env_propre: pytest.MonkeyPatch) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("trop long")

    async def scenario() -> None:
        adaptateur = CompatibleOpenAI(config(), client=client_simule(handler))
        with pytest.raises(ErreurLlmTimeout):
            await adaptateur.generer_json(MESSAGES, schema=Sortie)
        await adaptateur.fermer()

    asyncio.run(scenario())


def test_generer_json_reseau_injoignable(env_propre: pytest.MonkeyPatch) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("dns")

    async def scenario() -> None:
        adaptateur = CompatibleOpenAI(config(), client=client_simule(handler))
        with pytest.raises(ErreurLlmIndisponible):
            await adaptateur.generer_json(MESSAGES, schema=Sortie)
        await adaptateur.fermer()

    asyncio.run(scenario())


def _reponse_sse() -> httpx.Response:
    corps = (
        'data: {"choices": [{"delta": {"content": "Bon"}}]}\n\n'
        'data: {"choices": [{"delta": {"content": "jour"}}]}\n\n'
        'data: {"choices": [], "usage": {"prompt_tokens": 7, "completion_tokens": 2}}\n\n'
        "data: [DONE]\n\n"
    )
    return httpx.Response(200, content=corps.encode("utf-8"), headers={"content-type": "text/event-stream"})


def test_generer_flux_lit_le_sse(env_propre: pytest.MonkeyPatch) -> None:
    captures: list[dict] = []

    def handler(requete: httpx.Request) -> httpx.Response:
        captures.append(json.loads(requete.content))
        return _reponse_sse()

    async def scenario() -> None:
        adaptateur = CompatibleOpenAI(config(), client=client_simule(handler))
        morceaux = await collecter(adaptateur.generer_flux(MESSAGES))
        await adaptateur.fermer()

        assert [m.texte for m in morceaux] == ["Bon", "jour", ""]
        fin = morceaux[-1].fin
        assert fin is not None
        assert fin.contenu == "Bonjour"
        assert fin.tokens_entree == 7
        assert fin.tokens_sortie == 2

    asyncio.run(scenario())
    assert captures[0]["stream"] is True
    assert "response_format" not in captures[0]


def test_generer_flux_ignore_les_lignes_non_sse(env_propre: pytest.MonkeyPatch) -> None:
    corps = (
        "ping\n\n"
        "data:\n\n"
        'data: {"choices": [{"delta": {"content": "ok"}}]}\n\n'
        "data: [DONE]\n\n"
        'data: {"choices": [{"delta": {"content": "ignoré"}}]}\n\n'
    )

    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=corps.encode("utf-8"))

    async def scenario() -> None:
        adaptateur = CompatibleOpenAI(config(), client=client_simule(handler))
        morceaux = await collecter(adaptateur.generer_flux(MESSAGES))
        assert [m.texte for m in morceaux] == ["ok", ""]
        await adaptateur.fermer()

    asyncio.run(scenario())


def test_generer_flux_refuse_un_evenement_mal_forme(env_propre: pytest.MonkeyPatch) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"data: pas-du-json\n\n")

    async def scenario() -> None:
        adaptateur = CompatibleOpenAI(config(), client=client_simule(handler))
        with pytest.raises(ErreurReponseLlm):
            await collecter(adaptateur.generer_flux(MESSAGES))
        await adaptateur.fermer()

    asyncio.run(scenario())


def test_generer_flux_refuse_un_evenement_non_objet(env_propre: pytest.MonkeyPatch) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"data: [1, 2]\n\n")

    async def scenario() -> None:
        adaptateur = CompatibleOpenAI(config(), client=client_simule(handler))
        with pytest.raises(ErreurReponseLlm):
            await collecter(adaptateur.generer_flux(MESSAGES))
        await adaptateur.fermer()

    asyncio.run(scenario())


def test_generer_flux_erreur_http(env_propre: pytest.MonkeyPatch) -> None:
    appels: list[int] = []

    def handler(_: httpx.Request) -> httpx.Response:
        appels.append(1)
        return httpx.Response(500, content=b"erreur")

    async def scenario() -> None:
        adaptateur = CompatibleOpenAI(config(max_retries=3), client=client_simule(handler))
        with pytest.raises(ErreurLlmIndisponible) as exc:
            await collecter(adaptateur.generer_flux(MESSAGES))
        assert "HTTP 500" in str(exc.value)
        await adaptateur.fermer()

    asyncio.run(scenario())
    assert len(appels) == 1


def test_generer_flux_timeout(env_propre: pytest.MonkeyPatch) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("trop long")

    async def scenario() -> None:
        adaptateur = CompatibleOpenAI(config(), client=client_simule(handler))
        with pytest.raises(ErreurLlmTimeout):
            await collecter(adaptateur.generer_flux(MESSAGES))
        await adaptateur.fermer()

    asyncio.run(scenario())


def test_constructeur_exige_une_configuration_complete(env_propre: pytest.MonkeyPatch) -> None:
    incomplete = ConfigLLM.model_construct(modele=None, base_url=None, api_key=None)
    with pytest.raises(ErreurConfiguration):
        CompatibleOpenAI(incomplete)


def test_url_supprime_la_barre_finale(env_propre: pytest.MonkeyPatch) -> None:
    adaptateur = CompatibleOpenAI(config(base_url="https://llm.test/v1/"), client=client_simule(lambda _: None))
    assert adaptateur.url == "https://llm.test/v1/chat/completions"


def test_fermer_ne_ferme_pas_un_client_injecte(env_propre: pytest.MonkeyPatch) -> None:
    externe = client_simule(lambda _: httpx.Response(200))

    async def scenario() -> None:
        adaptateur = CompatibleOpenAI(config(), client=externe)
        await adaptateur.fermer()
        assert externe.is_closed is False
        await externe.aclose()

    asyncio.run(scenario())


def test_fermer_un_client_interne_est_sans_erreur(env_propre: pytest.MonkeyPatch) -> None:
    async def scenario() -> None:
        adaptateur = CompatibleOpenAI(config())
        await adaptateur.fermer()
        await adaptateur.fermer()

    asyncio.run(scenario())


def test_attente_par_defaut() -> None:
    asyncio.run(_attendre(0))


def test_generer_flux_reseau_injoignable(env_propre: pytest.MonkeyPatch) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("dns")

    async def scenario() -> None:
        adaptateur = CompatibleOpenAI(config(), client=client_simule(handler))
        with pytest.raises(ErreurLlmIndisponible):
            await collecter(adaptateur.generer_flux(MESSAGES))
        await adaptateur.fermer()

    asyncio.run(scenario())
