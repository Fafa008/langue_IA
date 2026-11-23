"""Compatibilité des imports historiques de l'agent chatbot.

La définition est désormais dans :mod:`app.agent.chatbot`. Ce module conserve les symboles publics utilisés par les
tests et par ``app.main`` afin que le déplacement du code reste sans effet observable.
"""

from app.agent.chatbot import (
    BUDGET_CHATBOT_MS,
    CODE_AGENT_CHATBOT,
    VERSION_AGENT_CHATBOT,
    definir_agent_chatbot,
    repondre,
)

__all__ = [
    "BUDGET_CHATBOT_MS",
    "CODE_AGENT_CHATBOT",
    "VERSION_AGENT_CHATBOT",
    "definir_agent_chatbot",
    "repondre",
]
