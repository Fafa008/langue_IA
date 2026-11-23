"""Tests du tuteur v2 : niveau effectif, phase Assimil et mémoire courte Redis."""

import asyncio
import json
import time
from uuid import UUID

import pytest

from app.agent.conversation import VERSION_AGENT_CHATBOT_V2, definir_agent_conversation_chatbot, repondre
from app.core.erreurs import ErreurEntreeInvalide
from app.harness.agent import ContexteExecution, OutilsCommuns
from app.llm.adaptateurs.factice import FakeLLMClient, ScenarioLLM
from app.memory.court import MemoireCourteVide
from app.prompts import RegistrePrompts
from app.rag.vide import RecuperateurVide
from app.schemas.chatbot import EntreeConversation, ResultatChatbot, TourMemoire
from app.schemas.contexte import ContexteApprenant
from tests.donnees import CONTEXTE_MINIMAL, REQUEST_ID

REPONSE_MODELE = {
    "reponse": "Hello! How are you today?",
    "corrections": [],
    "traduction": "Bonjour ! Comment vas-tu aujourd'hui ?",
    "explication": "Salutation simple et question ouverte.",
}
SESSION = "session-7"


class MemoireConversationFausse(MemoireCourteVide):
    """Mémoire courte en mémoire : tours initiaux, puis écritures observées."""

    def __init__(self, tours: tuple[TourMemoire, ...] = ()) -> None:
        self.tours = list(tours)
        self.resume = None
        self.lectures_tours = 0
        self.ajouts = 0

    async def lire_tours(self, identifiant_session: str) -> tuple[TourMemoire, ...]:
        self.lectures_tours += 1
        return tuple(self.tours)

    async def ajouter_tour(self, identifiant_session: str, tour: TourMemoire) -> None:
        self.ajouts += 1
        self.tours.append(tour)

    async def ecrire_resume(self, identifiant_session: str, resume: object) -> None:
        self.resume = resume


def contexte(client: FakeLLMClient, memoire: object, **contexte_modifications: object) -> ContexteExecution:
    donnees = {**CONTEXTE_MINIMAL, **contexte_modifications}
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


def donnees_prompt(contenu: str) -> dict[str, object]:
    bloc = contenu.split("<donnees_conversation_non_fiables>\n", 1)[1].split(
        "\n</donnees_conversation_non_fiables>", 1
    )[0]
    return json.loads(bloc)


def test_definition_agent_conversation_v2() -> None:
    definition = definir_agent_conversation_chatbot(RegistrePrompts())

    assert definition.code == "chatbot"
    assert definition.version == VERSION_AGENT_CHATBOT_V2 == "2.0.0"
    assert definition.version_prompt == "chatbot/conversation@1.3.0"
    assert definition.executer is repondre


def test_conversation_v2_resout_niveau_et_phase_depuis_la_memoire() -> None:
    tours_initiaux = tuple(
        TourMemoire(role="apprenant" if rang % 2 == 0 else "assistant", contenu=f"Tour {rang}") for rang in range(4)
    )
    memoire = MemoireConversationFausse(tours_initiaux)
    client = FakeLLMClient([ScenarioLLM(reponse=REPONSE_MODELE)])
    entree = EntreeConversation(identifiant_session=SESSION, message="How are you?")

    resultat = asyncio.run(repondre(entree, contexte(client, memoire)))

    assert resultat == ResultatChatbot.model_validate(REPONSE_MODELE)
    assert len(client.appels) == 1
    donnees = donnees_prompt(client.appels[0][1].contenu)
    assert donnees["niveau_effectif"] == "A1"
    assert donnees["niveau_confirme"] is False
    assert donnees["phase_assimil"] == "activation"
    assert len(donnees["descripteurs_rag"]) == 1
    assert [tour["contenu"] for tour in donnees["historique"]] == [tour.contenu for tour in tours_initiaux]

    assert memoire.ajouts == 2
    assert [tour.role for tour in memoire.tours[-2:]] == ["apprenant", "assistant"]
    assert memoire.resume is not None
    assert memoire.resume.compteur_tours == 6
    assert memoire.resume.phase == "activation"
    assert memoire.resume.niveau_effectif == "A1"


def test_conversation_v2_sans_session_garde_le_niveau_confirme_et_la_phase_explicite() -> None:
    client = FakeLLMClient([ScenarioLLM(reponse=REPONSE_MODELE)])
    entree = EntreeConversation(message="How are you?", phase_assimil="activation")

    resultat = asyncio.run(
        repondre(
            entree,
            contexte(client, MemoireCourteVide(), niveau_confirme=True),
        )
    )

    assert resultat.reponse == REPONSE_MODELE["reponse"]
    donnees = donnees_prompt(client.appels[0][1].contenu)
    assert donnees["niveau_effectif"] == "B1"
    assert donnees["niveau_confirme"] is True
    assert donnees["phase_assimil"] == "activation"


def test_conversation_v2_refuse_un_identifiant_de_session_invalide() -> None:
    client = FakeLLMClient([ScenarioLLM(reponse=REPONSE_MODELE)])
    entree = EntreeConversation(identifiant_session="../session", message="Hello")

    with pytest.raises(ErreurEntreeInvalide):
        asyncio.run(repondre(entree, contexte(client, MemoireCourteVide())))

    assert client.appels == []
