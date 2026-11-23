"""Port de mémoire courte et implémentation sans état de repli.

Le port est volontairement petit : lire/écrire les tours, le résumé et le cache de traduction. Un Redis
indisponible est remplacé par ``MemoireCourteVide`` : la conversation continue avec l'historique transmis par le
backend, sans mémoire courte propre au service IA.
"""

from __future__ import annotations

from typing import Protocol
from uuid import UUID

from app.schemas.chatbot import ResultatTraduction, ResumeSession, TourMemoire


class MemoireCourte(Protocol):
    """Contrat structurel de la mémoire de session."""

    async def lire_tours(self, identifiant_session: str) -> tuple[TourMemoire, ...]: ...

    async def ajouter_tour(self, identifiant_session: str, tour: TourMemoire) -> None: ...

    async def lire_resume(self, identifiant_session: str) -> ResumeSession | None: ...

    async def ecrire_resume(self, identifiant_session: str, resume: ResumeSession) -> None: ...

    async def lire_traduction(self, identifiant_session: str, id_message: UUID) -> ResultatTraduction | None: ...

    async def ecrire_traduction(self, identifiant_session: str, resultat: ResultatTraduction) -> None: ...

    async def fermer(self) -> None: ...


class MemoireCourteVide:
    """Repli sans état : aucune lecture, aucune écriture, aucune erreur."""

    async def lire_tours(self, identifiant_session: str) -> tuple[TourMemoire, ...]:
        return ()

    async def ajouter_tour(self, identifiant_session: str, tour: TourMemoire) -> None:
        return None

    async def lire_resume(self, identifiant_session: str) -> ResumeSession | None:
        return None

    async def ecrire_resume(self, identifiant_session: str, resume: ResumeSession) -> None:
        return None

    async def lire_traduction(self, identifiant_session: str, id_message: UUID) -> ResultatTraduction | None:
        return None

    async def ecrire_traduction(self, identifiant_session: str, resultat: ResultatTraduction) -> None:
        return None

    async def fermer(self) -> None:
        return None
