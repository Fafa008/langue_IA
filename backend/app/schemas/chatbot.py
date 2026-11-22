"""Contrat public du chat apprenant (US67/US74).

Le frontend ne parle qu'à ce contrat : snake_case, aucun appel direct au service IA. L'historique transmis reste
borné à 20 tours et les corrections en marge à 3, comme dans le contrat interne du service IA.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

MESSAGE_CHATBOT_MAX = 2000
REPONSE_CHATBOT_MAX = 4000
HISTORIQUE_CHATBOT_MAX = 20
CORRECTIONS_CHATBOT_MAX = 3


class _ModeleChatbot(BaseModel):
    model_config = ConfigDict(extra="forbid")


class MessageHistoriqueChatbotIn(_ModeleChatbot):
    role: Literal["apprenant", "assistant"]
    contenu: str = Field(min_length=1, max_length=REPONSE_CHATBOT_MAX)


class ChatbotMessageIn(_ModeleChatbot):
    message: str = Field(min_length=1, max_length=MESSAGE_CHATBOT_MAX)
    identifiant_session: str = Field(min_length=1, max_length=64)
    historique: list[MessageHistoriqueChatbotIn] = Field(default_factory=list, max_length=HISTORIQUE_CHATBOT_MAX)


class CorrectionChatbotOut(_ModeleChatbot):
    extrait: str = Field(min_length=1, max_length=120)
    correction: str = Field(min_length=1, max_length=120)
    explication: str = Field(min_length=1, max_length=300)


class ChatbotMessageOut(_ModeleChatbot):
    reponse: str = Field(min_length=1, max_length=REPONSE_CHATBOT_MAX)
    corrections: list[CorrectionChatbotOut] = Field(default_factory=list, max_length=CORRECTIONS_CHATBOT_MAX)
    quota_restant: int = Field(ge=0)
    version_prompt: str = Field(min_length=1, max_length=128)


class ChatbotSessionSupprimeeOut(_ModeleChatbot):
    supprime: bool = True
