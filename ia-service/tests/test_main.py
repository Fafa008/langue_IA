"""Tests du câblage FastAPI (lifespan, santé)."""

import pytest
from fastapi.testclient import TestClient

from app.core.erreurs import ErreurConfiguration
from app.harness.execution import Harness
from app.harness.registre import RegistreAgents
from app.llm import fabrique
from app.llm.adaptateurs.factice import FakeLLMClient
from app.main import app


@pytest.fixture(autouse=True)
def client_reinitialise() -> None:
    fabrique.reinitialiser_client()
    yield
    fabrique.reinitialiser_client()


def test_health_et_lifespan(env_propre: pytest.MonkeyPatch) -> None:
    with TestClient(app) as client:
        reponse = client.get("/health")
        assert reponse.status_code == 200
        assert reponse.json() == {"status": "ok", "service": "ia-service"}

        client_llm = app.state.client_llm
        assert isinstance(client_llm, FakeLLMClient)
        assert isinstance(app.state.registre_agents, RegistreAgents)
        assert isinstance(app.state.harness, Harness)
        assert client_llm.ferme is False

    assert client_llm.ferme is True


def test_demarrage_refuse_une_configuration_invalide(
    env_propre: pytest.MonkeyPatch,
) -> None:
    env_propre.setenv("ENVIRONNEMENT", "prod")
    env_propre.setenv("LLM_FOURNISSEUR", "factice")

    with pytest.raises(ErreurConfiguration):
        with TestClient(app):
            pass
