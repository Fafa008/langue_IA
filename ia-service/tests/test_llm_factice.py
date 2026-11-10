"""Tests du client LLM factice (FakeLLMClient)."""

import asyncio
from collections.abc import AsyncIterator

import pytest
from pydantic import Field

from app.core.erreurs import ErreurConfiguration, ErreurReponseLlm
from app.llm.adaptateurs.factice import FakeLLMClient, ScenarioLLM
from app.llm.base import MessageLLM, MorceauFlux
from app.schemas.base import ModeleStrict


class Sortie(ModeleStrict):
    valeur: str = Field(min_length=1)


MESSAGES = [MessageLLM(role="user", contenu="Réponds en JSON.")]


async def collecter(flux: AsyncIterator[MorceauFlux]) -> list[MorceauFlux]:
    return [morceau async for morceau in flux]


def horloge_fixe(valeurs: list[float]):
    def suivant() -> float:
        return valeurs.pop(0)

    return suivant


def test_generer_json_valide_et_journalise() -> None:
    client = FakeLLMClient(
        [ScenarioLLM(reponse={"valeur": "bonjour"})],
        modele="factice-test",
        horloge=horloge_fixe([10.0, 10.25]),
    )

    async def scenario() -> None:
        objet, reponse = await client.generer_json(MESSAGES, schema=Sortie)

        assert objet == Sortie(valeur="bonjour")
        assert reponse.fournisseur == "factice"
        assert reponse.modele == "factice-test"
        assert reponse.duree_ms == 250
        assert reponse.tokens_entree is not None
        assert reponse.tokens_sortie is not None
        assert client.appels == [MESSAGES]

    asyncio.run(scenario())


def test_generer_texte_valide_et_journalise() -> None:
    client = FakeLLMClient([ScenarioLLM(reponse="bonjour")], modele="factice-test")

    async def scenario() -> None:
        texte, reponse = await client.generer_texte(MESSAGES)
        assert texte == "bonjour"
        assert reponse.contenu == texte
        assert reponse.fournisseur == "factice"
        assert reponse.modele == "factice-test"
        assert client.appels == [MESSAGES]

    asyncio.run(scenario())


def test_generer_json_accepte_un_modele_et_une_chaine() -> None:
    client = FakeLLMClient(
        [
            ScenarioLLM(reponse=Sortie(valeur="modele")),
            ScenarioLLM(reponse='{"valeur": "chaine"}'),
        ]
    )

    async def scenario() -> None:
        premier, _ = await client.generer_json(MESSAGES, schema=Sortie)
        second, _ = await client.generer_json(MESSAGES, schema=Sortie)
        assert premier.valeur == "modele"
        assert second.valeur == "chaine"

    asyncio.run(scenario())


def test_generer_json_refuse_une_reponse_non_conforme() -> None:
    client = FakeLLMClient([ScenarioLLM(reponse={"valeur": ""})])

    async def scenario() -> None:
        with pytest.raises(ErreurReponseLlm):
            await client.generer_json(MESSAGES, schema=Sortie)

    asyncio.run(scenario())


def test_generer_json_refuse_un_champ_supplementaire() -> None:
    client = FakeLLMClient([ScenarioLLM(reponse={"valeur": "ok", "inconnu": 1})])

    async def scenario() -> None:
        with pytest.raises(ErreurReponseLlm):
            await client.generer_json(MESSAGES, schema=Sortie)

    asyncio.run(scenario())


def test_generer_json_sans_reponse() -> None:
    client = FakeLLMClient([ScenarioLLM()])

    async def scenario() -> None:
        with pytest.raises(ErreurReponseLlm):
            await client.generer_json(MESSAGES, schema=Sortie)

    asyncio.run(scenario())


def test_generer_json_propage_l_erreur_du_scenario() -> None:
    erreur = TimeoutError("budget dépassé")
    client = FakeLLMClient([ScenarioLLM(erreur=erreur)])

    async def scenario() -> None:
        with pytest.raises(TimeoutError):
            await client.generer_json(MESSAGES, schema=Sortie)

    asyncio.run(scenario())


def test_generer_json_respecte_le_delai() -> None:
    client = FakeLLMClient([ScenarioLLM(reponse={"valeur": "ok"}, delai_s=0.01)])

    async def scenario() -> None:
        objet, _ = await client.generer_json(MESSAGES, schema=Sortie)
        assert objet.valeur == "ok"

    asyncio.run(scenario())


def test_generer_json_sans_scenario() -> None:
    client = FakeLLMClient()

    async def scenario() -> None:
        with pytest.raises(ErreurConfiguration):
            await client.generer_json(MESSAGES, schema=Sortie)

    asyncio.run(scenario())


def test_flux_avec_morceaux() -> None:
    client = FakeLLMClient(
        [ScenarioLLM(morceaux=("Bon", "jour"), delai_s=0.005)],
        horloge=horloge_fixe([5.0, 5.1]),
    )

    async def scenario() -> None:
        morceaux = await collecter(client.generer_flux(MESSAGES))
        assert [m.texte for m in morceaux] == ["Bon", "jour", ""]
        assert morceaux[-1].fin is not None
        assert morceaux[-1].fin.contenu == "Bonjour"
        assert morceaux[-1].fin.duree_ms == 100
        assert client.flux_demandes == [MESSAGES]

    asyncio.run(scenario())


def test_flux_deduit_du_modele_ou_du_dictionnaire() -> None:
    client = FakeLLMClient(
        [
            ScenarioLLM(reponse=Sortie(valeur="modele")),
            ScenarioLLM(reponse={"valeur": "dictionnaire"}),
            ScenarioLLM(reponse='{"valeur": "chaine"}'),
        ]
    )

    async def scenario() -> None:
        premier = await collecter(client.generer_flux(MESSAGES))
        second = await collecter(client.generer_flux(MESSAGES))
        troisieme = await collecter(client.generer_flux(MESSAGES))
        assert "modele" in premier[-1].fin.contenu
        assert "dictionnaire" in second[-1].fin.contenu
        assert "chaine" in troisieme[-1].fin.contenu

    asyncio.run(scenario())


def test_flux_vide_emet_quand_meme_les_metadonnees() -> None:
    client = FakeLLMClient([ScenarioLLM()])

    async def scenario() -> None:
        morceaux = await collecter(client.generer_flux(MESSAGES))
        assert len(morceaux) == 1
        assert morceaux[0].texte == ""
        assert morceaux[0].fin is not None
        assert morceaux[0].fin.contenu == ""

    asyncio.run(scenario())


def test_flux_propage_l_erreur() -> None:
    client = FakeLLMClient([ScenarioLLM(erreur=ErreurReponseLlm("flux invalide"))])

    async def scenario() -> None:
        with pytest.raises(ErreurReponseLlm):
            await collecter(client.generer_flux(MESSAGES))

    asyncio.run(scenario())


def test_flux_refuse_une_reponse_non_serialisable() -> None:
    client = FakeLLMClient([ScenarioLLM(reponse={"valeur": object()})])

    async def scenario() -> None:
        with pytest.raises(ErreurReponseLlm):
            await collecter(client.generer_flux(MESSAGES))

    asyncio.run(scenario())


def test_fermer_est_idempotent() -> None:
    client = FakeLLMClient()
    assert client.ferme is False

    async def scenario() -> None:
        await client.fermer()
        await client.fermer()

    asyncio.run(scenario())
    assert client.ferme is True
