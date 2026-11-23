"""Mémoire courte Redis de la session.

Trois clés, toutes préfixées par l'identifiant de session : les tours (20 au maximum), le résumé glissant et le
cache de traduction. Chaque accès renouvelle le TTL de 24 h. Une panne Redis dégrade vers une session sans
mémoire courte : l'erreur est journalisée sans identifiant ni contenu d'apprenant, et jamais propagée au chat.
"""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from pydantic import ValidationError
from redis import asyncio as aioredis
from redis.exceptions import RedisError

from app.memory import clefs
from app.schemas.chatbot import ResultatTraduction, ResumeSession, TourMemoire

logger = logging.getLogger(__name__)


class MemoireRedis:
    """Implémentation Redis du port :mod:`app.memory.court`."""

    def __init__(
        self,
        client: Any,
        *,
        ttl_s: int = clefs.TTL_SESSION_S,
        tours_max: int = clefs.TOURS_MAX,
    ) -> None:
        self._client = client
        self._ttl_s = ttl_s
        self._tours_max = tours_max

    @classmethod
    def depuis_url(
        cls, url: str, *, ttl_s: int = clefs.TTL_SESSION_S, tours_max: int = clefs.TOURS_MAX
    ) -> MemoireRedis:
        """Construire le client Redis partagé à partir d'une URL d'environnement."""
        return cls(aioredis.Redis.from_url(url, decode_responses=True), ttl_s=ttl_s, tours_max=tours_max)

    @staticmethod
    def _journaliser_indisponible(operation: str, erreur: RedisError) -> None:
        """Journaliser une panne Redis sans contenu d'apprenant ni détail d'erreur."""
        logger.warning(
            "redis_indisponible operation=%s type=%s",
            operation,
            type(erreur).__name__,
            extra={"operation": operation, "raison": type(erreur).__name__},
        )

    async def lire_tours(self, identifiant_session: str) -> tuple[TourMemoire, ...]:
        """Lire les tours stockés, en ignorant les entrées corrompues."""
        try:
            valeurs = await self._client.lrange(clefs.cle_tours(identifiant_session), 0, -1)
            await self._client.expire(clefs.cle_tours(identifiant_session), self._ttl_s)
        except RedisError as erreur:
            self._journaliser_indisponible("lire_tours", erreur)
            return ()

        tours: list[TourMemoire] = []
        for valeur in valeurs:
            try:
                tours.append(TourMemoire.model_validate_json(valeur))
            except (ValidationError, TypeError):
                logger.warning("tour_memoire_invalide ignores")
        return tuple(tours)

    async def ajouter_tour(self, identifiant_session: str, tour: TourMemoire) -> None:
        """Ajouter un tour, le borner à 20 et renouveler le TTL."""
        cle = clefs.cle_tours(identifiant_session)
        try:
            await self._client.rpush(cle, tour.model_dump_json())
            # LTRIM négatif : conserver les N tours les plus récents, pas les N premiers.
            await self._client.ltrim(cle, -self._tours_max, -1)
            await self._client.expire(cle, self._ttl_s)
        except RedisError as erreur:
            self._journaliser_indisponible("ajouter_tour", erreur)

    async def lire_resume(self, identifiant_session: str) -> ResumeSession | None:
        """Lire le résumé glissant s'il est encore présent."""
        try:
            valeur = await self._client.get(clefs.cle_summary(identifiant_session))
            if valeur is None:
                return None
            await self._client.expire(clefs.cle_summary(identifiant_session), self._ttl_s)
        except RedisError as erreur:
            self._journaliser_indisponible("lire_resume", erreur)
            return None
        try:
            return ResumeSession.model_validate_json(valeur)
        except (ValidationError, TypeError):
            logger.warning("resume_memoire_invalide ignore")
            return None

    async def ecrire_resume(self, identifiant_session: str, resume: ResumeSession) -> None:
        """Écrire le résumé glissant et renouveler le TTL."""
        try:
            await self._client.set(
                clefs.cle_summary(identifiant_session),
                resume.model_dump_json(),
                ex=self._ttl_s,
            )
        except RedisError as erreur:
            self._journaliser_indisponible("ecrire_resume", erreur)

    async def lire_traduction(self, identifiant_session: str, id_message: UUID) -> ResultatTraduction | None:
        """Lire une traduction déjà calculée pour ce message."""
        cle = clefs.cle_traduction(identifiant_session, id_message)
        try:
            valeur = await self._client.get(cle)
            if valeur is None:
                return None
            await self._client.expire(cle, self._ttl_s)
        except RedisError as erreur:
            self._journaliser_indisponible("lire_traduction", erreur)
            return None
        try:
            return ResultatTraduction.model_validate_json(valeur)
        except (ValidationError, TypeError):
            logger.warning("traduction_memoire_invalide ignoree")
            return None

    async def ecrire_traduction(self, identifiant_session: str, resultat: ResultatTraduction) -> None:
        """Mettre une traduction en cache pour éviter un appel LLM répété."""
        try:
            await self._client.set(
                clefs.cle_traduction(identifiant_session, resultat.id_message),
                resultat.model_dump_json(),
                ex=self._ttl_s,
            )
        except RedisError as erreur:
            self._journaliser_indisponible("ecrire_traduction", erreur)

    async def fermer(self) -> None:
        """Fermer le client partagé ; une panne à l'arrêt ne doit pas bloquer le processus."""
        try:
            await self._client.aclose()
        except RedisError as erreur:
            self._journaliser_indisponible("fermer", erreur)
