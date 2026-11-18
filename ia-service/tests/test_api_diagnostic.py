"""Tests de ``POST /diagnostic/evaluer`` (PRE-05), sans clé API ni réseau."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.agents.diagnostic import CODE_AGENT, VERSION_AGENT
from app.core.erreurs import ErreurLlmIndisponible, ErreurLlmLimiteRequetes, ErreurLlmTimeout
from app.harness.execution import Harness
from app.llm import fabrique
from app.llm.adaptateurs.factice import FakeLLMClient, ScenarioLLM
from app.main import app
from tests.donnees import CONTEXTE_MINIMAL, REQUEST_ID, RESULTAT_VALIDE

REPONSES = [
    {
        "id_question": "q-1",
        "competence": "ecrit",
        "type_reponse": "texte",
        "contenu": "I have been learning English for two years.",
    },
]


def requete(**entree: object) -> dict[str, object]:
    return {
        "request_id": REQUEST_ID,
        "contexte": CONTEXTE_MINIMAL,
        "entree": {"reponses": REPONSES, "score_preliminaire": 64, **entree},
    }


@pytest.fixture
def client_http(env_propre: pytest.MonkeyPatch) -> Iterator[TestClient]:
    fabrique.reinitialiser_client()
    with TestClient(app) as client:
        yield client
    fabrique.reinitialiser_client()


def brancher_llm(*scenarios: ScenarioLLM) -> FakeLLMClient:
    """Remplacer le client du Harness démarré par un faux client aux scénarios connus."""
    client_llm = FakeLLMClient(scenarios, modele="modele-test")
    app.state.harness = Harness(
        app.state.registre_agents,
        client_llm,
        registre_prompts=app.state.registre_prompts,
        recuperateur_rag=app.state.recuperateur_rag,
    )
    return client_llm


def test_agent_diagnostic_enregistre_au_demarrage(client_http: TestClient) -> None:
    assert CODE_AGENT in app.state.registre_agents


def test_post_evaluer_retourne_l_estimation_du_modele(client_http: TestClient) -> None:
    client_llm = brancher_llm(ScenarioLLM(reponse=RESULTAT_VALIDE))

    reponse = client_http.post("/diagnostic/evaluer", json=requete())

    assert reponse.status_code == 200
    corps = reponse.json()
    assert corps["statut"] == "succes"
    assert corps["request_id"] == REQUEST_ID
    assert corps["agent"] == "diagnostic"
    assert corps["version_agent"] == VERSION_AGENT
    assert corps["version_prompt"] == "diagnostic/evaluation@1.1.0"
    assert corps["resultat"] == RESULTAT_VALIDE
    assert corps["meta"]["fournisseur"] == "factice"
    assert corps["meta"]["modele"] == "modele-test"
    assert len(client_llm.appels) == 1


def test_post_evaluer_entree_invalide_sans_recopie(client_http: TestClient) -> None:
    brancher_llm()
    secret = "reponse-confidentielle-de-l-apprenant"

    reponse = client_http.post(
        "/diagnostic/evaluer",
        json={**requete(), "entree": {"reponses": [], "score_preliminaire": 64, "note": secret}},
    )

    assert reponse.status_code == 422
    assert reponse.json() == {
        "code": "ENTREE_INVALIDE",
        "message": "L'entrée ne respecte pas le contrat attendu par l'agent.",
        "retryable": False,
    }
    assert secret not in reponse.text


def test_post_evaluer_contexte_incoherent(client_http: TestClient) -> None:
    brancher_llm()
    contexte = {"code_langue": "zh", "referentiel": "CECRL", "niveau_preliminaire": "B1"}

    reponse = client_http.post("/diagnostic/evaluer", json={**requete(), "contexte": contexte})

    assert reponse.status_code == 422
    assert reponse.json()["code"] == "ENTREE_INVALIDE"


@pytest.mark.parametrize(
    ("erreur", "statut", "code", "retryable"),
    [
        (ErreurLlmTimeout("délai interne"), 504, "LLM_TIMEOUT", True),
        (ErreurLlmIndisponible("panne, clé sk-secret-test"), 503, "LLM_INDISPONIBLE", True),
        (ErreurLlmLimiteRequetes("quota fournisseur"), 429, "LLM_LIMITE_REQUETES", True),
    ],
)
def test_post_evaluer_erreur_du_fournisseur(
    client_http: TestClient, erreur: Exception, statut: int, code: str, retryable: bool
) -> None:
    brancher_llm(ScenarioLLM(erreur=erreur))

    reponse = client_http.post("/diagnostic/evaluer", json=requete())

    assert reponse.status_code == statut
    corps = reponse.json()
    assert corps["statut"] == "erreur"
    assert corps["request_id"] == REQUEST_ID
    assert corps["agent"] == "diagnostic"
    assert corps["erreur"]["code"] == code
    assert corps["erreur"]["retryable"] is retryable
    assert "sk-secret-test" not in reponse.text


def test_post_evaluer_reponse_du_modele_inexploitable(client_http: TestClient) -> None:
    brancher_llm(ScenarioLLM(reponse={"niveau_estime": "B2"}))

    reponse = client_http.post("/diagnostic/evaluer", json=requete())

    assert reponse.status_code == 502
    assert reponse.json()["erreur"]["code"] == "LLM_REPONSE_INVALIDE"


def test_route_documentee_dans_openapi(client_http: TestClient) -> None:
    schema = client_http.get("/openapi.json").json()

    operation = schema["paths"]["/diagnostic/evaluer"]["post"]
    assert operation["tags"] == ["diagnostic"]
    assert {"200", "422", "429", "500", "502", "503", "504"} <= set(operation["responses"])
    schema_422 = operation["responses"]["422"]["content"]["application/json"]["schema"]
    assert schema_422["$ref"].endswith("/ErreurAgent")
