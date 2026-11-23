"""Tests de la mémoire long terme et des exercices ciblés du chat (US-IA-CHAT-04)."""

import asyncio
import json
import time
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.agent.exercice import CODE_AGENT_EXERCICE_CHATBOT, definir_agent_exercice_chatbot, generer
from app.agent.memoire import CODE_AGENT_MEMOIRE_CHATBOT, clore, definir_agent_memoire_chatbot
from app.core.erreurs import ErreurEntreeInvalide
from app.harness.agent import ContexteExecution, OutilsCommuns
from app.harness.execution import Harness
from app.llm import fabrique
from app.llm.adaptateurs.factice import FakeLLMClient, ScenarioLLM
from app.main import app
from app.memory.court import MemoireCourteVide
from app.prompts import RegistrePrompts
from app.rag.vide import RecuperateurVide
from app.schemas.chatbot import (
    ChargeMemoireLongTerme,
    EntreeClotureSession,
    EntreeExercice,
    ProfilMemoire,
    ResumeSession,
    TourMemoire,
)
from app.schemas.contexte import ContexteApprenant
from tests.donnees import CONTEXTE_MINIMAL, REQUEST_ID

SESSION = "session-7"
PROFIL = ProfilMemoire(profil_id="profil-pseudonyme", code_langue="en", niveau_effectif="A1")
MEMOIRE_JSON = json.dumps(
    {
        "resume": "L'apprenant a travaillé le passé ; les accords restent à consolider.",
        "erreurs": [{"type": "grammaire", "erreur": "I go yesterday", "frequence": 2}],
    }
)
EXERCICE_JSON = json.dumps(
    {
        "enonce": "Yesterday, I ___ to the market with my sister.",
        "consigne": "Choisis la forme au passé qui convient.",
    }
)


class MemoireClotureFausse(MemoireCourteVide):
    def __init__(self, tours: tuple[TourMemoire, ...] = (), resume: ResumeSession | None = None) -> None:
        self.tours = tours
        self.resume = resume

    async def lire_tours(self, identifiant_session: str) -> tuple[TourMemoire, ...]:
        return self.tours

    async def lire_resume(self, identifiant_session: str) -> ResumeSession | None:
        return self.resume


def contexte_agent(
    client: FakeLLMClient,
    memoire: object,
    **modifications: object,
) -> ContexteExecution:
    donnees = {**CONTEXTE_MINIMAL, **modifications}
    return ContexteExecution(
        request_id=UUID(REQUEST_ID),
        contexte=ContexteApprenant.model_validate(donnees),
        outils=OutilsCommuns(
            client_llm=client,
            registre_prompts=RegistrePrompts(),
            recuperateur_rag=RecuperateurVide(),
            horloge=time.monotonic,
            memoire=memoire,  # type: ignore[arg-type]
        ),
    )


def donnees_prompt(contenu: str, balise: str) -> dict[str, object]:
    bloc = contenu.split(f"<{balise}>\n", 1)[1].split(f"\n</{balise}>", 1)[0]
    return json.loads(bloc)


def test_definitions_des_agents_memoire_et_exercice() -> None:
    registre = RegistrePrompts()
    memoire = definir_agent_memoire_chatbot(registre)
    exercice = definir_agent_exercice_chatbot(registre)

    assert (memoire.code, memoire.version, memoire.version_prompt) == (
        CODE_AGENT_MEMOIRE_CHATBOT,
        "1.0.0",
        "chatbot/memoire@1.0.0",
    )
    assert (exercice.code, exercice.version, exercice.version_prompt) == (
        CODE_AGENT_EXERCICE_CHATBOT,
        "1.0.0",
        "chatbot/exercice@1.0.0",
    )
    assert memoire.executer is clore
    assert exercice.executer is generer


def test_cloture_genere_une_charge_sans_identite_dans_le_prompt() -> None:
    tours = (
        TourMemoire(role="apprenant", contenu="I go yesterday"),
        TourMemoire(role="assistant", contenu="You went yesterday."),
    )
    resume = ResumeSession(phase="activation", niveau_effectif="A1", compteur_tours=2)
    client = FakeLLMClient([ScenarioLLM(reponse=MEMOIRE_JSON)])

    charge = asyncio.run(
        clore(
            EntreeClotureSession(identifiant_session=SESSION, profil=PROFIL),
            contexte_agent(client, MemoireClotureFausse(tours, resume)),
        )
    )

    assert isinstance(charge, ChargeMemoireLongTerme)
    assert charge.profil == PROFIL
    assert charge.erreurs[0].type == "grammaire"
    assert charge.erreurs[0].frequence == 2
    assert charge.erreurs[0].derniere_occurrence.startswith("20")
    assert charge.session.nombre_tours == 2
    assert charge.session.phase_atteinte == "activation"
    donnees = donnees_prompt(client.appels[0][1].contenu, "donnees_session_non_fiables")
    assert "profil_id" not in donnees
    assert [tour["contenu"] for tour in donnees["tours"]] == [tour.contenu for tour in tours]


def test_cloture_sans_contenu_ne_rappelle_pas_le_llm() -> None:
    client = FakeLLMClient([ScenarioLLM(reponse=MEMOIRE_JSON)])

    charge = asyncio.run(
        clore(
            EntreeClotureSession(identifiant_session=SESSION, profil=PROFIL),
            contexte_agent(client, MemoireCourteVide()),
        )
    )

    assert charge.erreurs == []
    assert charge.session.resume == "Session sans échange enregistré."
    assert charge.session.nombre_tours == 0
    assert client.appels == []


def test_cloture_refuse_un_identifiant_de_session_invalide() -> None:
    client = FakeLLMClient([ScenarioLLM(reponse=MEMOIRE_JSON)])

    with pytest.raises(ErreurEntreeInvalide):
        asyncio.run(
            clore(
                EntreeClotureSession(identifiant_session="../session", profil=PROFIL),
                contexte_agent(client, MemoireCourteVide()),
            )
        )

    assert client.appels == []


def test_exercice_cible_ajoute_le_descripteur_sans_laisser_le_modele_l_inventer() -> None:
    client = FakeLLMClient([ScenarioLLM(reponse=EXERCICE_JSON)])
    entree = EntreeExercice(
        identifiant_session=SESSION,
        type_erreur="grammaire",
        erreur="I go yesterday",
        niveau="B1",
    )

    resultat = asyncio.run(generer(entree, contexte_agent(client, MemoireCourteVide())))

    assert resultat.enonce.startswith("Yesterday")
    assert resultat.niveau == "B1"
    assert resultat.descripteur_id
    donnees = donnees_prompt(client.appels[0][1].contenu, "donnees_exercice_non_fiables")
    assert donnees["type_erreur"] == "grammaire"
    assert donnees["niveau_effectif"] == "B1"
    assert donnees["descripteurs_rag"]


def test_exercice_refuse_un_identifiant_de_session_invalide() -> None:
    client = FakeLLMClient([ScenarioLLM(reponse=EXERCICE_JSON)])
    entree = EntreeExercice(
        identifiant_session="session invalide",
        type_erreur="syntaxe",
        erreur="He don't like it",
        niveau="A1",
    )

    with pytest.raises(ErreurEntreeInvalide):
        asyncio.run(generer(entree, contexte_agent(client, MemoireCourteVide())))

    assert client.appels == []


@pytest.fixture
def client_http(env_propre: pytest.MonkeyPatch) -> object:
    fabrique.reinitialiser_client()
    with TestClient(app) as client:
        yield client
    fabrique.reinitialiser_client()


def _brancher(client_llm: FakeLLMClient) -> None:
    app.state.harness = Harness(
        app.state.registre_agents,
        client_llm,
        registre_prompts=app.state.registre_prompts,
        recuperateur_rag=app.state.recuperateur_rag,
        memoire=MemoireCourteVide(),
    )


def _requete(entree: dict[str, object]) -> dict[str, object]:
    return {"request_id": REQUEST_ID, "contexte": CONTEXTE_MINIMAL, "entree": entree}


def test_routes_session_close_et_exercice(client_http: TestClient) -> None:
    def repondeur(messages: object, schema: type[object]) -> dict[str, object]:
        """Deux tâches distinctes : le schéma demandé détermine la réponse factice."""
        if schema.__name__ == "MemoireGeneree":
            return json.loads(MEMOIRE_JSON)
        return json.loads(EXERCICE_JSON)

    _brancher(FakeLLMClient(repondeur=repondeur))
    assert CODE_AGENT_MEMOIRE_CHATBOT in app.state.registre_agents
    assert CODE_AGENT_EXERCICE_CHATBOT in app.state.registre_agents

    cloture = client_http.post(
        "/chatbot/session/close",
        json=_requete({"identifiant_session": SESSION, "profil": PROFIL.model_dump(mode="json")}),
    )
    exercice = client_http.post(
        "/chatbot/exercice",
        json=_requete(
            {
                "identifiant_session": SESSION,
                "type_erreur": "grammaire",
                "erreur": "I go yesterday",
                "niveau": "A1",
            }
        ),
    )

    assert cloture.status_code == 200
    assert cloture.json()["agent"] == CODE_AGENT_MEMOIRE_CHATBOT
    assert cloture.json()["version_prompt"] == "chatbot/memoire@1.0.0"
    assert exercice.status_code == 200
    assert exercice.json()["agent"] == CODE_AGENT_EXERCICE_CHATBOT
    assert exercice.json()["resultat"]["descripteur_id"]


def test_routes_refusent_un_identifiant_de_session_invalide(client_http: TestClient) -> None:
    _brancher(FakeLLMClient([]))

    for chemin, entree in (
        (
            "/chatbot/session/close",
            {"identifiant_session": "../session", "profil": PROFIL.model_dump(mode="json")},
        ),
        (
            "/chatbot/exercice",
            {
                "identifiant_session": "../session",
                "type_erreur": "grammaire",
                "erreur": "I go yesterday",
                "niveau": "A1",
            },
        ),
    ):
        reponse = client_http.post(chemin, json=_requete(entree))
        assert reponse.status_code == 422
        assert reponse.json()["code"] == "ENTREE_INVALIDE"
