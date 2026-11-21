"""Tests de ``POST /recommandation/actions``, sans clé API ni réseau."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.agents.recommandation import CODE_AGENT, VERSION_AGENT
from app.core.erreurs import ErreurLlmIndisponible, ErreurLlmLimiteRequetes, ErreurLlmTimeout
from app.harness.execution import Harness
from app.llm import fabrique
from app.llm.adaptateurs.factice import FakeLLMClient, ScenarioLLM
from app.main import app
from tests.donnees import CONTEXTE_MINIMAL, REQUEST_ID

POINTS_FAIBLES = [
    {
        "domaine": "grammaire",
        "id_question": "q-12",
        "observation": "Le prétérit manque dans « yesterday I go ».",
        "justification": "Le repère temporel situe l'action dans le passé.",
    }
]
RESULTAT = {
    "code_langue": "en",
    "referentiel": "CECRL",
    "niveau_cible": "B2",
    "recommandations": [
        {
            "domaine": "grammaire",
            "type_exercice": "GRAMMAIRE",
            "action": "Refaire un exercice de conjugaison au prétérit.",
            "justification": "Le point faible porte sur le prétérit.",
            "priorite": 1,
        }
    ],
    "resume": "Consolider le prétérit.",
    "confiance": 0.7,
}


def requete(**entree: object) -> dict[str, object]:
    return {
        "request_id": REQUEST_ID,
        "version_agent": VERSION_AGENT,
        "contexte": CONTEXTE_MINIMAL,
        "entree": {"points_faibles": POINTS_FAIBLES, "niveau_vise": "B2", **entree},
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


def test_agent_recommandation_enregistre_au_demarrage(client_http: TestClient) -> None:
    assert CODE_AGENT in app.state.registre_agents


def test_post_actions_retourne_la_proposition_validee(client_http: TestClient) -> None:
    client_llm = brancher_llm(ScenarioLLM(reponse=RESULTAT))

    reponse = client_http.post("/recommandation/actions", json=requete())

    assert reponse.status_code == 200
    corps = reponse.json()
    assert corps["statut"] == "succes"
    assert corps["agent"] == CODE_AGENT
    assert corps["version_agent"] == VERSION_AGENT
    assert corps["version_prompt"] == "recommandation/actions@1.0.0"
    assert corps["resultat"] == RESULTAT
    assert corps["meta"]["modele"] == "modele-test"
    assert len(client_llm.appels) == 1


def test_post_actions_entree_invalide_sans_recopie(client_http: TestClient) -> None:
    brancher_llm()
    secret = "observation-confidentielle-de-l-apprenant"

    reponse = client_http.post(
        "/recommandation/actions",
        json={**requete(), "entree": {"points_faibles": [], "niveau_vise": "B2", "note": secret}},
    )

    assert reponse.status_code == 422
    assert reponse.json()["code"] == "ENTREE_INVALIDE"
    assert secret not in reponse.text


def test_post_actions_contexte_incoherent(client_http: TestClient) -> None:
    brancher_llm()
    contexte = {"code_langue": "zh", "referentiel": "CECRL", "niveau_preliminaire": "B1"}

    reponse = client_http.post("/recommandation/actions", json={**requete(), "contexte": contexte})

    assert reponse.status_code == 422


@pytest.mark.parametrize(
    ("erreur", "statut", "code"),
    [
        (ErreurLlmTimeout("délai interne"), 504, "LLM_TIMEOUT"),
        (ErreurLlmIndisponible("panne, clé sk-secret-test"), 503, "LLM_INDISPONIBLE"),
        (ErreurLlmLimiteRequetes("quota fournisseur"), 429, "LLM_LIMITE_REQUETES"),
    ],
)
def test_post_actions_erreur_du_fournisseur(client_http: TestClient, erreur: Exception, statut: int, code: str) -> None:
    brancher_llm(ScenarioLLM(erreur=erreur))

    reponse = client_http.post("/recommandation/actions", json=requete())

    assert reponse.status_code == statut
    corps = reponse.json()
    assert corps["statut"] == "erreur"
    assert corps["request_id"] == REQUEST_ID
    assert corps["erreur"]["code"] == code
    assert "sk-secret-test" not in reponse.text


def test_post_actions_reponse_du_modele_inexploitable(client_http: TestClient) -> None:
    brancher_llm(ScenarioLLM(reponse={"niveau_cible": "B2"}))

    reponse = client_http.post("/recommandation/actions", json=requete())

    assert reponse.status_code == 502
    assert reponse.json()["erreur"]["code"] == "LLM_REPONSE_INVALIDE"


def test_route_documentee_dans_openapi(client_http: TestClient) -> None:
    schema = client_http.get("/openapi.json").json()

    operation = schema["paths"]["/recommandation/actions"]["post"]
    assert operation["tags"] == ["recommandation"]
    assert {"200", "422", "429", "500", "502", "503", "504"} <= set(operation["responses"])
