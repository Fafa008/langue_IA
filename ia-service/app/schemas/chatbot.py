"""Contrat de l'agent chatbot (US67) : entrée d'un message et réponse de l'assistant.

Le service IA reste sans état : le backend renvoie à chaque appel le court historique de la conversation qu'il
conserve. L'historique est borné pour garder un prompt de taille prévisible et ne jamais transmettre une
conversation entière au fournisseur. ``ModeleStrict`` retire les espaces superflus : un message fait d'espaces
devient vide et il est refusé par ``min_length``.
"""

from typing import Literal

from pydantic import Field

from app.schemas.base import ModeleStrict

MESSAGE_CHATBOT_MAX = 2000
REPONSE_CHATBOT_MAX = 4000
HISTORIQUE_CHATBOT_MAX = 20


class MessageHistorique(ModeleStrict):
    """Tour de parole déjà échangé, transmis par le backend dans l'ordre chronologique."""

    role: Literal["apprenant", "assistant"]
    contenu: str = Field(min_length=1, max_length=REPONSE_CHATBOT_MAX)


class EntreeChatbot(ModeleStrict):
    """Nouveau message de l'apprenant et historique récent de la conversation."""

    message: str = Field(min_length=1, max_length=MESSAGE_CHATBOT_MAX)
    historique: list[MessageHistorique] = Field(default_factory=list, max_length=HISTORIQUE_CHATBOT_MAX)


class ResultatChatbot(ModeleStrict):
    """Réponse de l'assistant, en texte brut."""

    reponse: str = Field(min_length=1, max_length=REPONSE_CHATBOT_MAX)
