"""Compatibilité des imports historiques de la route chatbot.

La définition est désormais dans :mod:`app.routes.chatbot`. ``app.main`` continue d'inclure ``chatbot.router``.
"""

from app.routes.chatbot import router

__all__ = ["router"]
