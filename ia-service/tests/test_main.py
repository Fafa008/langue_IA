"""Tests du câblage FastAPI (lifespan, santé)."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.erreurs import ErreurConfiguration, ErreurLlmIndisponible, ErreurServiceIA
from app.core.gestionnaire_erreurs import gerer_erreur_inattendue, gerer_erreur_service
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


def test_gestionnaire_erreurs_est_enregistre() -> None:
    assert app.exception_handlers[ErreurServiceIA] is gerer_erreur_service
    assert app.exception_handlers[Exception] is gerer_erreur_inattendue


def test_erreur_metier_renvoyee_sans_trace() -> None:
    locale = FastAPI()
    locale.add_exception_handler(ErreurServiceIA, gerer_erreur_service)

    @locale.get("/indisponible")
    def indisponible() -> None:
        raise ErreurLlmIndisponible("panne interne, clé sk-secret-test")

    reponse = TestClient(locale).get("/indisponible")

    assert reponse.status_code == 503
    assert reponse.json() == {
        "code": "LLM_INDISPONIBLE",
        "message": "Le fournisseur LLM est momentanément indisponible.",
        "retryable": True,
    }
    assert "sk-secret-test" not in reponse.text
    assert "Traceback" not in reponse.text


def test_erreur_inattendue_masquee() -> None:
    locale = FastAPI()
    locale.add_exception_handler(Exception, gerer_erreur_inattendue)

    @locale.get("/boum")
    def boum() -> None:
        raise RuntimeError("SECRET-dans-trace")

    reponse = TestClient(locale, raise_server_exceptions=False).get("/boum")

    assert reponse.status_code == 500
    assert reponse.json()["code"] == "ERREUR_INTERNE"
    assert reponse.json()["retryable"] is False
    assert "SECRET" not in reponse.text
    assert "RuntimeError" not in reponse.text
