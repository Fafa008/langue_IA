"""Tests du parsing JSON strict de la correction en marge du chat, avec LLM simulé."""

import asyncio
import json
import time
from uuid import UUID

import pytest

from app.agent.correction import (
    CODE_AGENT_CORRECTION_CHATBOT,
    ParseCorrectionError,
    analyser,
    definir_agent_correction_chatbot,
    parser_correction,
)
from app.harness.agent import ContexteExecution, OutilsCommuns
from app.llm.adaptateurs.factice import FakeLLMClient, ScenarioLLM
from app.prompts import RegistrePrompts
from app.rag.vide import RecuperateurVide
from app.schemas.chatbot import EntreeChatbot
from app.schemas.contexte import ContexteApprenant
from tests.donnees import CONTEXTE_MINIMAL, REQUEST_ID

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


def contexte(client: FakeLLMClient) -> ContexteExecution:
    return ContexteExecution(
        request_id=UUID(REQUEST_ID),
        contexte=ContexteApprenant.model_validate(CONTEXTE_MINIMAL),
        outils=OutilsCommuns(
            client_llm=client,
            registre_prompts=RegistrePrompts(),
            recuperateur_rag=RecuperateurVide(),
            horloge=time.monotonic,
        ),
    )


def test_parser_correction_valide() -> None:
    resultat = parser_correction(CORRECTION_JSON, PHRASE)

    assert resultat.phrase_originale == PHRASE
    assert [correction.type for correction in resultat.corrections] == ["grammaire"]
    assert resultat.corrections[0].correction == "I have"


def test_parser_correction_liste_vide() -> None:
    resultat = parser_correction(json.dumps({"phrase_originale": PHRASE, "corrections": []}), PHRASE)

    assert resultat.corrections == []


@pytest.mark.parametrize(
    "brut",
    [
        "pas du JSON",
        "{}",
        '{"phrase_originale": "I has a dog", "corrections": [{"type": "prononciation"}]}',
        '{"phrase_originale": "I has a dog", "corrections": [], "score": 3}',
    ],
)
def test_parser_correction_invalide(brut: str) -> None:
    with pytest.raises(ParseCorrectionError):
        parser_correction(brut, PHRASE)


def test_parser_refuse_phrase_originale_modifiee() -> None:
    with pytest.raises(ParseCorrectionError) as erreur:
        parser_correction(json.dumps({"phrase_originale": "autre phrase", "corrections": []}), PHRASE)
    assert erreur.value.raison == "phrase_originale_incoherente"


def test_analyser_rejoue_une_fois_puis_reussit() -> None:
    client = FakeLLMClient([ScenarioLLM(reponse="pas du JSON"), ScenarioLLM(reponse=CORRECTION_JSON)])

    resultat = asyncio.run(analyser(EntreeChatbot(message=PHRASE), contexte(client)))

    assert resultat.corrections[0].type == "grammaire"
    assert len(client.appels) == 2
    assert "Réponds uniquement" in client.appels[1][-1].contenu


def test_analyser_valeur_par_defaut_apres_deux_echecs() -> None:
    client = FakeLLMClient([ScenarioLLM(reponse="pas du JSON"), ScenarioLLM(reponse="{}")])

    resultat = asyncio.run(analyser(EntreeChatbot(message=PHRASE), contexte(client)))

    assert resultat.phrase_originale == PHRASE
    assert resultat.corrections == []
    assert len(client.appels) == 2


def test_definition_agent_correction() -> None:
    definition = definir_agent_correction_chatbot(RegistrePrompts())

    assert definition.code == CODE_AGENT_CORRECTION_CHATBOT
    assert definition.version == "1.0.0"
    assert definition.version_prompt == "chatbot/correction@1.0.0"
    assert definition.executer is analyser
