"""Contrat de l'agent chatbot (US67/US74) : réponse et corrections en marge.

Le service IA reste sans état : le backend renvoie à chaque appel le court historique de la conversation qu'il
conservait. L'historique est borné pour garder un prompt de taille prévisible et ne jamais transmettre une
conversation entière au fournisseur. ``ModeleStrict`` retire les espaces superflus : un message fait d'espaces
devient vide et il est refusé par ``min_length``.

Depuis la consigne 1.1.0, l'agent peut renvoyer jusqu'à trois corrections en marge. Elles ne coupent jamais la
conversation : la ``reponse`` reste obligatoire et les ``corrections`` sont optionnelles.
"""

from typing import Literal

from pydantic import Field

from app.schemas.base import ModeleStrict

MESSAGE_CHATBOT_MAX = 2000
REPONSE_CHATBOT_MAX = 4000
HISTORIQUE_CHATBOT_MAX = 20
CORRECTIONS_CHATBOT_MAX = 3
EXTRAIT_CORRECTION_MAX = 120
EXPLICATION_CORRECTION_MAX = 300


class MessageHistorique(ModeleStrict):
    """Tour de parole déjà échangé, transmis par le backend dans l'ordre chronologique."""

    role: Literal["apprenant", "assistant"]
    contenu: str = Field(min_length=1, max_length=REPONSE_CHATBOT_MAX)


class CorrectionChatbot(ModeleStrict):
    """Correction brève affichée en marge, sans interrompre l'échange (D1)."""

    extrait: str = Field(min_length=1, max_length=EXTRAIT_CORRECTION_MAX)
    correction: str = Field(min_length=1, max_length=EXTRAIT_CORRECTION_MAX)
    explication: str = Field(min_length=1, max_length=EXPLICATION_CORRECTION_MAX)


class EntreeChatbot(ModeleStrict):
    """Nouveau message de l'apprenant et historique récent de la conversation."""

    message: str = Field(min_length=1, max_length=MESSAGE_CHATBOT_MAX)
    historique: list[MessageHistorique] = Field(default_factory=list, max_length=HISTORIQUE_CHATBOT_MAX)


class ResultatChatbot(ModeleStrict):
    """Réponse de l'assistant et corrections éventuelles, en texte brut."""

    reponse: str = Field(min_length=1, max_length=REPONSE_CHATBOT_MAX)
    corrections: list[CorrectionChatbot] = Field(default_factory=list, max_length=CORRECTIONS_CHATBOT_MAX)
