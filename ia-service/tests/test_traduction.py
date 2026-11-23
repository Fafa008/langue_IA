"""Tests de la traduction séparée : prompt versionné, sortie JSON et cache par message."""

import asyncio
import json
import time
from uuid import UUID

from app.agent.traduction import (
    CODE_AGENT_TRADUCTION_CHATBOT,
    definir_agent_traduction_chatbot,
    traduire,
)
from app.harness.agent import ContexteExecution, OutilsCommuns
from app.llm.adaptateurs.factice import FakeLLMClient, ScenarioLLM
from app.memory.court import MemoireCourteVide
from app.prompts import RegistrePrompts
from app.prompts.variables import VariablesTraductionChatbot
from app.rag.vide import RecuperateurVide
from app.schemas.chatbot import EntreeTraduction, ResultatTraduction
from app.schemas.contexte import ContexteApprenant
from tests.donnees import CONTEXTE_MINIMAL, REQUEST_ID

SESSION = "session-7"
MESSAGE_ID = UUID("11111111-2222-3333-4444-555555555555")
MESSAGE = "Hello! How can I help?"
TRADUCTION_JSON = json.dumps(
    {
        "traduction": "Bonjour ! Comment puis-je aider ?",
        "explication": "Salutation suivie d'une proposition d'aide.",
    }
)


class MemoireFactice:
    """Mémoire courte minimale : assez pour vérifier le hit et l'écriture du cache."""

    def __init__(self) -> None:
        self.traductions: dict[tuple[str, UUID], ResultatTraduction] = {}
        self.lectures = 0
        self.ecritures = 0

    async def lire_traduction(self, identifiant_session: str, id_message: UUID) -> ResultatTraduction | None:
        self.lectures += 1
        return self.traductions.get((identifiant_session, id_message))

    async def ecrire_traduction(self, identifiant_session: str, resultat: ResultatTraduction) -> None:
        self.ecritures += 1
        self.traductions[(identifiant_session, resultat.id_message)] = resultat.model_copy(update={"cache_hit": False})

    async def fermer(self) -> None:
        return None


def contexte(client: FakeLLMClient, memoire: object) -> ContexteExecution:
    return ContexteExecution(
        request_id=UUID(REQUEST_ID),
        contexte=ContexteApprenant.model_validate(CONTEXTE_MINIMAL),
        outils=OutilsCommuns(
            client_llm=client,
            registre_prompts=RegistrePrompts(),
            recuperateur_rag=RecuperateurVide(),
            horloge=time.monotonic,
            memoire=memoire,  # type: ignore[arg-type]
        ),
    )


def entree() -> EntreeTraduction:
    return EntreeTraduction(identifiant_session=SESSION, id_message=MESSAGE_ID, message=MESSAGE)


def test_definition_agent_traduction() -> None:
    definition = definir_agent_traduction_chatbot(RegistrePrompts())

    assert definition.code == CODE_AGENT_TRADUCTION_CHATBOT
    assert definition.code == "chatbot-traduction"
    assert definition.version == "1.0.0"
    assert definition.version_prompt == "chatbot/traduction@1.0.0"
    assert definition.executer is traduire


def test_rendu_prompt_traduction_injecte_les_variables_validees() -> None:
    rendu = RegistrePrompts().rendre_traduction_chatbot(
        VariablesTraductionChatbot(message=MESSAGE, code_langue="en", niveau_effectif="B1")
    )

    assert rendu.version_prompt == "chatbot/traduction@1.0.0"
    assert rendu.empreinte_prompt.startswith("sha256:")
    assert '"message": "Hello! How can I help?"' in rendu.messages[1].contenu
    assert '"code_langue": "en"' in rendu.messages[1].contenu
    assert '"niveau_effectif": "B1"' in rendu.messages[1].contenu


def test_traduction_appelle_le_llm_puis_reutilise_le_cache() -> None:
    memoire = MemoireFactice()
    premier_client = FakeLLMClient([ScenarioLLM(reponse=TRADUCTION_JSON)])
    premier = asyncio.run(traduire(entree(), contexte(premier_client, memoire)))

    assert premier.cache_hit is False
    assert premier.traduction == "Bonjour ! Comment puis-je aider ?"
    assert premier.explication == "Salutation suivie d'une proposition d'aide."
    assert len(premier_client.appels) == 1
    assert memoire.ecritures == 1

    second_client = FakeLLMClient()
    second = asyncio.run(traduire(entree(), contexte(second_client, memoire)))

    assert second.cache_hit is True
    assert second.traduction == premier.traduction
    assert second_client.appels == []
    assert memoire.lectures == 2
    assert memoire.ecritures == 1


def test_traduction_sans_memoire_reste_fonctionnelle() -> None:
    client = FakeLLMClient([ScenarioLLM(reponse=TRADUCTION_JSON)])

    resultat = asyncio.run(traduire(entree(), contexte(client, MemoireCourteVide())))

    assert resultat.cache_hit is False
    assert resultat.id_message == MESSAGE_ID
    assert len(client.appels) == 1
