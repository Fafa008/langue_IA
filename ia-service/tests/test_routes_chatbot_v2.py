"""Tests HTTP des routes internes de correction et de traduction du chatbot."""

import json
from collections.abc import Iterator
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.agent.correction import CODE_AGENT_CORRECTION_CHATBOT
from app.agent.traduction import CODE_AGENT_TRADUCTION_CHATBOT
from app.harness.execution import Harness
from app.llm import fabrique
from app.llm.adaptateurs.factice import FakeLLMClient, ScenarioLLM
from app.main import app
from app.memory.court import MemoireCourteVide
from app.memory.redis import MemoireRedis
from app.schemas.chatbot import ResultatTraduction, TourMemoire
from tests.donnees import CONTEXTE_MINIMAL, REQUEST_ID

SESSION = "session-7"
MESSAGE_ID = "11111111-2222-3333-4444-555555555555"
PHRASE = "I has a dog"
CORRECTION_JSON = json.dumps(
    {
        "phrase_originale": PHRASE,
        "corrections": [
            {
                "type": "grammaire",
                "erreur": "I has",
                "correction": "I have",
                "explication": "Accord avec le sujet « I ».",
            }
        ],
    }
)
TRADUCTION_JSON = json.dumps(
    {
        "traduction": "Bonjour ! Comment puis-je aider ?",
        "explication": "Salutation suivie d'une proposition d'aide.",
    }
)
REPONSE_CHATBOT = {
    "reponse": "Hello! How are you today?",
    "corrections": [],
    "traduction": "Bonjour ! Comment vas-tu aujourd'hui ?",
    "explication": "Salutation simple et question ouverte.",
}


class MemoireFactice:
    """Mémoire courte en mémoire, isolée par test."""

    def __init__(self, tours: tuple[TourMemoire, ...] = ()) -> None:
        self.traductions: dict[tuple[str, UUID], ResultatTraduction] = {}
        self.tours = list(tours)
        self.resume: object | None = None
        self.ajouts = 0

    async def lire_traduction(self, identifiant_session: str, id_message: UUID) -> ResultatTraduction | None:
        return self.traductions.get((identifiant_session, id_message))

    async def ecrire_traduction(self, identifiant_session: str, resultat: ResultatTraduction) -> None:
        self.traductions[(identifiant_session, resultat.id_message)] = resultat.model_copy(update={"cache_hit": False})

    async def lire_tours(self, identifiant_session: str) -> tuple[TourMemoire, ...]:
        return tuple(self.tours)

    async def ajouter_tour(self, identifiant_session: str, tour: TourMemoire) -> None:
        self.ajouts += 1
        self.tours.append(tour)

    async def lire_resume(self, identifiant_session: str) -> object | None:
        return self.resume

    async def ecrire_resume(self, identifiant_session: str, resume: object) -> None:
        self.resume = resume

    async def fermer(self) -> None:
        return None


@pytest.fixture
def client_http(env_propre: pytest.MonkeyPatch) -> Iterator[TestClient]:
    fabrique.reinitialiser_client()
    with TestClient(app) as client:
        yield client
    fabrique.reinitialiser_client()


def brancher_harness(client_llm: FakeLLMClient, memoire: object) -> None:
    app.state.harness = Harness(
        app.state.registre_agents,
        client_llm,
        registre_prompts=app.state.registre_prompts,
        recuperateur_rag=app.state.recuperateur_rag,
        memoire=memoire,  # type: ignore[arg-type]
    )


def requete(entree: dict[str, object]) -> dict[str, object]:
    return {"request_id": REQUEST_ID, "contexte": CONTEXTE_MINIMAL, "entree": entree}


def test_agents_et_memoire_enregistres_au_demarrage(client_http: TestClient) -> None:
    assert CODE_AGENT_CORRECTION_CHATBOT in app.state.registre_agents
    assert CODE_AGENT_TRADUCTION_CHATBOT in app.state.registre_agents
    assert isinstance(app.state.memoire, MemoireRedis)


def test_post_correction_retourne_le_resultat_separe(client_http: TestClient) -> None:
    client_llm = FakeLLMClient([ScenarioLLM(reponse=CORRECTION_JSON)])
    brancher_harness(client_llm, MemoireCourteVide())

    reponse = client_http.post("/chatbot/correction", json=requete({"message": PHRASE, "identifiant_session": SESSION}))

    assert reponse.status_code == 200
    corps = reponse.json()
    assert corps["statut"] == "succes"
    assert corps["agent"] == CODE_AGENT_CORRECTION_CHATBOT
    assert corps["version_prompt"] == "chatbot/correction@1.0.0"
    assert corps["resultat"]["phrase_originale"] == PHRASE
    assert corps["resultat"]["corrections"][0]["correction"] == "I have"
    assert len(client_llm.appels) == 1


def test_post_traduction_met_en_cache_puis_ne_rappelle_pas_le_llm(client_http: TestClient) -> None:
    memoire = MemoireFactice()
    client_llm = FakeLLMClient([ScenarioLLM(reponse=TRADUCTION_JSON)])
    brancher_harness(client_llm, memoire)
    corps_requete = requete(
        {"identifiant_session": SESSION, "id_message": MESSAGE_ID, "message": "Hello! How can I help?"}
    )

    premiere = client_http.post("/chatbot/traduction", json=corps_requete)
    seconde = client_http.post("/chatbot/traduction", json=corps_requete)

    assert premiere.status_code == 200
    assert seconde.status_code == 200
    assert premiere.json()["resultat"]["cache_hit"] is False
    assert seconde.json()["resultat"]["cache_hit"] is True
    assert seconde.json()["resultat"]["traduction"] == premiere.json()["resultat"]["traduction"]
    assert seconde.json()["agent"] == CODE_AGENT_TRADUCTION_CHATBOT
    assert seconde.json()["version_prompt"] == "chatbot/traduction@1.0.0"
    assert len(client_llm.appels) == 1


def test_post_traduction_refuse_un_identifiant_de_session_invalide(client_http: TestClient) -> None:
    client_llm = FakeLLMClient([ScenarioLLM(reponse=TRADUCTION_JSON)])
    brancher_harness(client_llm, MemoireFactice())

    reponse = client_http.post(
        "/chatbot/traduction",
        json=requete(
            {
                "identifiant_session": "../session-7",
                "id_message": MESSAGE_ID,
                "message": "Hello! How can I help?",
            }
        ),
    )

    assert reponse.status_code == 422
    assert reponse.json()["code"] == "ENTREE_INVALIDE"
    assert client_llm.appels == []


def test_post_message_utilise_la_memoire_et_le_prompt_v2(client_http: TestClient) -> None:
    tours_initiaux = tuple(
        TourMemoire(role="apprenant" if rang % 2 == 0 else "assistant", contenu=f"Tour {rang}") for rang in range(4)
    )
    memoire = MemoireFactice(tours_initiaux)
    client_llm = FakeLLMClient([ScenarioLLM(reponse=REPONSE_CHATBOT)])
    brancher_harness(client_llm, memoire)

    reponse = client_http.post(
        "/chatbot/message",
        json={
            **requete({"identifiant_session": SESSION, "message": "How are you?"}),
            "contexte": {**CONTEXTE_MINIMAL, "niveau_confirme": False},
        },
    )

    assert reponse.status_code == 200
    corps = reponse.json()
    assert corps["resultat"] == REPONSE_CHATBOT
    assert corps["version_agent"] == "2.0.0"
    assert corps["version_prompt"] == "chatbot/conversation@1.3.0"
    assert len(client_llm.appels) == 1
    assert memoire.ajouts == 2
    assert memoire.resume is not None
    donnees = json.loads(
        client_llm.appels[0][1]
        .contenu.split("<donnees_conversation_non_fiables>\n", 1)[1]
        .split("\n</donnees_conversation_non_fiables>", 1)[0]
    )
    assert donnees["phase_assimil"] == "activation"
    assert donnees["niveau_effectif"] == "A1"


def test_post_message_refuse_un_identifiant_de_session_invalide(client_http: TestClient) -> None:
    client_llm = FakeLLMClient([ScenarioLLM(reponse=REPONSE_CHATBOT)])
    brancher_harness(client_llm, MemoireFactice())

    reponse = client_http.post(
        "/chatbot/message",
        json=requete({"identifiant_session": "../session-7", "message": "How are you?"}),
    )

    assert reponse.status_code == 422
    assert reponse.json()["code"] == "ENTREE_INVALIDE"
    assert client_llm.appels == []


def test_post_message_peut_demander_la_version_historique(client_http: TestClient) -> None:
    client_llm = FakeLLMClient([ScenarioLLM(reponse=REPONSE_CHATBOT)])
    brancher_harness(client_llm, MemoireFactice())

    reponse = client_http.post(
        "/chatbot/message",
        json={**requete({"message": "How are you?"}), "version_agent": "1.2.0"},
    )

    assert reponse.status_code == 200
    assert reponse.json()["version_agent"] == "1.2.0"
    assert reponse.json()["version_prompt"] == "chatbot/conversation@1.2.0"
    assert len(client_llm.appels) == 1
