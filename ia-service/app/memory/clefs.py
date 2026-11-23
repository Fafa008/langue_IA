"""Noms de clés Redis de la mémoire courte.

Toutes les clés sont construites ici : elles portent toujours l'identifiant de session. Aucun autre module ne doit
composer une clé à la main, ce qui rend la règle vérifiable par un simple test.
"""

from __future__ import annotations

import re
from uuid import UUID

from app.core.erreurs import ErreurEntreeInvalide
from app.schemas.chatbot import IDENTIFIANT_SESSION_MAX

PREFIXE_SESSION = "session"
SUFFIXE_TOURS = "turns"
SUFFIXE_RESUME = "summary"
SUFFIXE_TRADUCTION = "traduction"

TTL_SESSION_S = 86_400
TOURS_MAX = 20

_IDENTIFIANT_SESSION = re.compile(r"^[A-Za-z0-9_-]+$")


def valider_identifiant_session(valeur: str) -> str:
    """Normaliser et valider l'identifiant de session utilisé comme préfixe de clé."""
    identifiant = valeur.strip()
    if (
        not identifiant
        or len(identifiant) > IDENTIFIANT_SESSION_MAX
        or _IDENTIFIANT_SESSION.fullmatch(identifiant) is None
    ):
        raise ErreurEntreeInvalide("Identifiant de session invalide.")
    return identifiant


def prefixe_session(identifiant_session: str) -> str:
    """Préfixe commun à toutes les clés d'une session."""
    return f"{PREFIXE_SESSION}:{valider_identifiant_session(identifiant_session)}"


def cle_tours(identifiant_session: str) -> str:
    """Clé de la liste des derniers tours (``RPUSH`` puis ``LTRIM``)."""
    return f"{prefixe_session(identifiant_session)}:{SUFFIXE_TOURS}"


def cle_summary(identifiant_session: str) -> str:
    """Clé du résumé glissant de la session."""
    return f"{prefixe_session(identifiant_session)}:{SUFFIXE_RESUME}"


def cle_traduction(identifiant_session: str, id_message: UUID | str) -> str:
    """Clé du cache de traduction, indexée par session puis par identifiant de message."""
    identifiant_message = str(id_message).strip()
    if not identifiant_message:
        raise ErreurEntreeInvalide("Identifiant de message invalide.")
    return f"{prefixe_session(identifiant_session)}:{SUFFIXE_TRADUCTION}:{identifiant_message}"


def est_cle_session(cle: str) -> bool:
    """Vrai si la clé appartient à une session et contient bien son identifiant."""
    parties = cle.split(":")
    return (
        len(parties) >= 3
        and parties[0] == PREFIXE_SESSION
        and bool(parties[1])
        and _IDENTIFIANT_SESSION.fullmatch(parties[1]) is not None
    )
