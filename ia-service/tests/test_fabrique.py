"""Tests de la fabrique du client LLM unique."""

import asyncio

import pytest

from app.core.config import ConfigLLM
from app.core.erreurs import ErreurConfiguration
from app.llm import fabrique
from app.llm.adaptateurs.compatible_openai import CompatibleOpenAI
from app.llm.adaptateurs.factice import FakeLLMClient


@pytest.fixture(autouse=True)
def client_reinitialise() -> None:
    """Isole chaque test du cache global de la fabrique."""
    fabrique.reinitialiser_client()
    yield
    fabrique.reinitialiser_client()


def test_creer_client_factice_par_defaut(env_propre: pytest.MonkeyPatch) -> None:
    client = fabrique.creer_client(ConfigLLM())
    assert isinstance(client, FakeLLMClient)
    assert client.nom == "factice"


def test_creer_client_compatible_openai() -> None:
    config = ConfigLLM(
        environnement="dev",
        fournisseur="compatible-openai",
        modele="mistral-small",
        base_url="http://localhost:11434/v1",
        api_key="cle-test",
    )
    client = fabrique.creer_client(config)
    assert isinstance(client, CompatibleOpenAI)
    assert client.nom == "compatible-openai"
    assert client.url == "http://localhost:11434/v1/chat/completions"
    asyncio.run(client.fermer())


def test_creer_client_refuse_un_fournisseur_inconnu() -> None:
    """Défense en profondeur : même une configuration fabriquée à la main est refusée au démarrage."""
    config = ConfigLLM.model_construct(fournisseur="anthropic")
    with pytest.raises(ErreurConfiguration):
        fabrique.creer_client(config)


def test_obtenir_client_instance_unique(env_propre: pytest.MonkeyPatch) -> None:
    client1 = fabrique.obtenir_client()
    client2 = fabrique.obtenir_client()
    assert client1 is client2
    assert isinstance(client1, FakeLLMClient)


def test_reinitialiser_client(env_propre: pytest.MonkeyPatch) -> None:
    premier = fabrique.obtenir_client()
    fabrique.reinitialiser_client()
    second = fabrique.obtenir_client()
    assert premier is not second
