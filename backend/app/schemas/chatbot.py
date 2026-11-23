"""Contrat public du chat apprenant (US67/US74, US-IA-CHAT-05).

Le frontend ne parle qu'à ce contrat : snake_case, aucun appel direct au service IA. L'historique transmis reste
borné à 20 tours et les corrections en marge à 3, comme dans le contrat interne du service IA. Depuis le contrat
1.2.0, chaque réponse du tuteur IA porte aussi `traduction` et `explication`, rédigées en français ; la PR 5 ajoute
les routes séparées `correction` et `traduction`, que le frontend consomme à la place de ces champs groupés.
Ceux-ci restent présents sur `/message` pour compatibilité, mais ne sont plus la source de l'affichage.
"""

from typing import Literal
from uuid import UUID

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
    traduction: str = Field(min_length=1, max_length=REPONSE_CHATBOT_MAX)
    explication: str = Field(min_length=1, max_length=REPONSE_CHATBOT_MAX)
    quota_restant: int = Field(ge=0)
    version_prompt: str = Field(min_length=1, max_length=128)


class ChatbotSessionSupprimeeOut(_ModeleChatbot):
    supprime: bool = True


# --- Exercice ciblé (US-IA-CHAT-04) : route publique distincte, sans modifier ``ChatbotMessageOut`` ---


class ExerciceCibleChatbotIn(_ModeleChatbot):
    identifiant_session: str = Field(min_length=1, max_length=64)
    type_erreur: Literal["grammaire", "orthographe", "syntaxe"]
    erreur: str = Field(min_length=1, max_length=120)


class ExerciceCibleChatbotOut(_ModeleChatbot):
    id_exercice: int = Field(ge=1)
    enonce: str = Field(min_length=1, max_length=REPONSE_CHATBOT_MAX)
    consigne: str = Field(min_length=1, max_length=REPONSE_CHATBOT_MAX)
    descripteur_id: str = Field(min_length=1, max_length=128)
    niveau: str = Field(min_length=1, max_length=20)


# --- Routes séparées (US-IA-CHAT-05) : le navigateur appelle ces relais, jamais le service IA ---


class CorrectionChatbotIn(_ModeleChatbot):
    message: str = Field(min_length=1, max_length=MESSAGE_CHATBOT_MAX)
    identifiant_session: str = Field(min_length=1, max_length=64)
    historique: list[MessageHistoriqueChatbotIn] = Field(default_factory=list, max_length=HISTORIQUE_CHATBOT_MAX)


class CorrectionDetailleeChatbotOut(_ModeleChatbot):
    """Type conservé pour l'exercice ciblé ; ``extrait`` reste le libellé historique du frontend."""

    type: Literal["grammaire", "orthographe", "syntaxe"]
    extrait: str = Field(min_length=1, max_length=120)
    correction: str = Field(min_length=1, max_length=120)
    explication: str = Field(min_length=1, max_length=300)


class CorrectionChatbotOut(_ModeleChatbot):
    corrections: list[CorrectionDetailleeChatbotOut] = Field(default_factory=list, max_length=CORRECTIONS_CHATBOT_MAX)
    version_prompt: str = Field(min_length=1, max_length=128)


class TraductionChatbotIn(_ModeleChatbot):
    identifiant_session: str = Field(min_length=1, max_length=64)
    id_message: UUID
    message: str = Field(min_length=1, max_length=REPONSE_CHATBOT_MAX)


class TraductionChatbotOut(_ModeleChatbot):
    id_message: UUID
    traduction: str = Field(min_length=1, max_length=REPONSE_CHATBOT_MAX)
    explication: str = Field(min_length=1, max_length=REPONSE_CHATBOT_MAX)
    version_prompt: str = Field(min_length=1, max_length=128)
