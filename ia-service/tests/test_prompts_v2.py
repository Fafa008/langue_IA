"""Tests des prompts versionnés ajoutés pour le tuteur CECRL/Assimil (US-IA-CHAT-01)."""

import json

import pytest

from app.prompts import RegistrePrompts
from app.prompts.variables import (
    VariablesConversationChatbotV2,
    VariablesCorrectionChatbot,
)
from app.schemas.chatbot import PhaseAssimil
from app.schemas.contexte import ContexteApprenant
from tests.donnees import CONTEXTE_MINIMAL


def corps_donnees(contenu: str, balise: str) -> dict[str, object]:
    bloc = contenu.split(f"<{balise}>\n", 1)[1].split(f"\n</{balise}>", 1)[0]
    return json.loads(bloc)


def test_prompt_conversation_v2_publie() -> None:
    registre = RegistrePrompts()
    variables = VariablesConversationChatbotV2(
        contexte_apprenant=ContexteApprenant.model_validate(CONTEXTE_MINIMAL),
        historique=[],
        message="Hello!",
        niveau_effectif="B1",
        niveau_confirme=True,
        phase_assimil="activation",
    )

    rendu = registre.rendre_conversation_chatbot_v2(variables)

    assert rendu.version_prompt == "chatbot/conversation@1.3.0"
    assert registre.definition("chatbot", "conversation", "1.3.0") == (
        "chatbot/conversation@1.3.0",
        rendu.empreinte_prompt,
    )
    assert "descripteurs_rag" in rendu.messages[0].contenu
    corps = corps_donnees(rendu.messages[1].contenu, "donnees_conversation_non_fiables")
    assert corps["phase_assimil"] == "activation"
    assert corps["niveau_effectif"] == "B1"
    assert corps["niveau_confirme"] is True
    assert corps["descripteurs_rag"] == []


@pytest.mark.parametrize("phase", ["impregnation", "activation"])
def test_prompt_correction_du_chat(phase: PhaseAssimil) -> None:
    variables = VariablesCorrectionChatbot(message="I has a dog", niveau_effectif="B1", phase_assimil=phase)
    rendu = RegistrePrompts().rendre_correction_chatbot(variables)

    assert rendu.version_prompt == "chatbot/correction@1.0.0"
    assert "phrase_originale" in rendu.messages[0].contenu
    corps = corps_donnees(rendu.messages[1].contenu, "donnees_correction_non_fiables")
    assert corps["message"] == "I has a dog"
    assert corps["phase_assimil"] == phase
    assert corps["resume_session"] == ""
