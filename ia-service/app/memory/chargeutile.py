"""Charge utile de la mémoire long terme.

Le service IA ne possède pas de SQLAlchemy : il produit une charge utile typée que le backend valide et persiste
dans ses propres tables. Ce module réexporte les schémas concernés pour que le point d'entrée de la mémoire long
terme soit unique.
"""

from app.schemas.chatbot import (
    ChargeMemoireLongTerme,
    ErreurRecurrente,
    ProfilMemoire,
    SessionMemoire,
)

__all__ = ["ChargeMemoireLongTerme", "ErreurRecurrente", "ProfilMemoire", "SessionMemoire"]
