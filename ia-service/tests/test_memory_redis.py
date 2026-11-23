"""Tests de la mémoire courte Redis, sans serveur : client factice et pannes simulées."""

import asyncio
from uuid import UUID

import pytest
from redis.exceptions import RedisError

from app.memory.court import MemoireCourteVide
from app.memory.redis import MemoireRedis
from app.schemas.chatbot import ResultatTraduction, ResumeSession, TourMemoire

SESSION = "session-7"
MESSAGE_ID = UUID("11111111-2222-3333-4444-555555555555")


class RedisFactice:
    """Minimal client asynchrone : assez pour vérifier clés, TTL et dégradation."""

    def __init__(self, erreur: Exception | None = None) -> None:
        self.erreur = erreur
        self.listes: dict[str, list[str]] = {}
        self.valeurs: dict[str, str] = {}
        self.expirations: dict[str, int | None] = {}
        self.appels: list[str] = []
        self.ferme = False

    def _verifier(self) -> None:
        if self.erreur is not None:
            raise self.erreur

    async def rpush(self, cle: str, valeur: str) -> int:
        self._verifier()
        self.appels.append("rpush")
        self.listes.setdefault(cle, []).append(valeur)
        return len(self.listes[cle])

    async def ltrim(self, cle: str, debut: int, fin: int) -> bool:
        self._verifier()
        self.appels.append("ltrim")
        valeurs = self.listes.get(cle, [])
        debut_absolu = max(0, len(valeurs) + debut) if debut < 0 else debut
        fin_absolu = len(valeurs) + fin if fin < 0 else fin
        self.listes[cle] = valeurs[debut_absolu : fin_absolu + 1]
        return True

    async def expire(self, cle: str, ttl: int) -> bool:
        self._verifier()
        self.appels.append("expire")
        self.expirations[cle] = ttl
        return True

    async def lrange(self, cle: str, debut: int, fin: int) -> list[str]:
        self._verifier()
        self.appels.append("lrange")
        valeurs = self.listes.get(cle, [])
        return valeurs[debut:] if fin == -1 else valeurs[debut : fin + 1]

    async def get(self, cle: str) -> str | None:
        self._verifier()
        self.appels.append("get")
        return self.valeurs.get(cle)

    async def set(self, cle: str, valeur: str, ex: int | None = None) -> bool:
        self._verifier()
        self.appels.append("set")
        self.valeurs[cle] = valeur
        self.expirations[cle] = ex
        return True

    async def aclose(self) -> None:
        self._verifier()
        self.ferme = True


def test_ajouter_tour_borne_et_renouvelle_ttl() -> None:
    client = RedisFactice()
    memoire = MemoireRedis(client, ttl_s=120, tours_max=3)

    for rang in range(5):
        asyncio.run(memoire.ajouter_tour(SESSION, TourMemoire(role="apprenant", contenu=f"Message {rang}")))

    tours = asyncio.run(memoire.lire_tours(SESSION))
    assert [tour.contenu for tour in tours] == ["Message 2", "Message 3", "Message 4"]
    assert client.expirations["session:session-7:turns"] == 120
    assert "rpush" in client.appels and "ltrim" in client.appels


def test_tour_corrompu_ignore() -> None:
    client = RedisFactice()
    client.listes["session:session-7:turns"] = ["pas du JSON"]
    memoire = MemoireRedis(client)

    assert asyncio.run(memoire.lire_tours(SESSION)) == ()


def test_resume_et_traduction_en_cache() -> None:
    client = RedisFactice()
    memoire = MemoireRedis(client, ttl_s=60)
    resume = ResumeSession(phase="activation", niveau_effectif="B1", compteur_tours=4)
    traduction = ResultatTraduction(
        id_message=MESSAGE_ID,
        traduction="Bonjour !",
        explication="Salutation simple.",
    )

    asyncio.run(memoire.ecrire_resume(SESSION, resume))
    asyncio.run(memoire.ecrire_traduction(SESSION, traduction))

    assert asyncio.run(memoire.lire_resume(SESSION)) == resume
    assert asyncio.run(memoire.lire_traduction(SESSION, MESSAGE_ID)) == traduction
    assert client.expirations["session:session-7:summary"] == 60
    assert client.expirations[f"session:session-7:traduction:{MESSAGE_ID}"] == 60


def test_valeur_corrompue_ignorée_pour_resume_et_traduction() -> None:
    client = RedisFactice()
    client.valeurs["session:session-7:summary"] = "{}"
    client.valeurs[f"session:session-7:traduction:{MESSAGE_ID}"] = "{}"
    memoire = MemoireRedis(client)

    assert asyncio.run(memoire.lire_resume(SESSION)) is None
    assert asyncio.run(memoire.lire_traduction(SESSION, MESSAGE_ID)) is None


def test_redis_indisponible_degrade_sans_lever_erreur() -> None:
    client = RedisFactice(RedisError("panne"))
    memoire = MemoireRedis(client)
    resume = ResumeSession(phase="impregnation", niveau_effectif="A1", compteur_tours=0)

    asyncio.run(memoire.ajouter_tour(SESSION, TourMemoire(role="assistant", contenu="Hello")))

    assert asyncio.run(memoire.lire_tours(SESSION)) == ()
    asyncio.run(memoire.ecrire_resume(SESSION, resume))
    assert asyncio.run(memoire.lire_resume(SESSION)) is None
    asyncio.run(
        memoire.ecrire_traduction(
            SESSION,
            ResultatTraduction(id_message=MESSAGE_ID, traduction="Salut", explication="Salut."),
        )
    )
    assert asyncio.run(memoire.lire_traduction(SESSION, MESSAGE_ID)) is None
    asyncio.run(memoire.fermer())
    assert client.ferme is False


@pytest.mark.parametrize("fonction", ["lire_tours", "lire_resume"])
def test_fonctions_sans_client_repondent_vide(fonction: str) -> None:
    assert asyncio.run(getattr(MemoireRedis(RedisFactice()), fonction)(SESSION)) in ((), None)


def test_memoire_vide_ne_stocke_rien() -> None:
    memoire = MemoireCourteVide()
    resume = ResumeSession(phase="impregnation", niveau_effectif="A1", compteur_tours=0)
    tour = TourMemoire(role="apprenant", contenu="Bonjour")
    traduction = ResultatTraduction(id_message=MESSAGE_ID, traduction="Bonjour", explication="Salut.")

    assert asyncio.run(memoire.lire_tours(SESSION)) == ()
    assert asyncio.run(memoire.lire_resume(SESSION)) is None
    assert asyncio.run(memoire.lire_traduction(SESSION, MESSAGE_ID)) is None
    asyncio.run(memoire.ajouter_tour(SESSION, tour))
    asyncio.run(memoire.ecrire_resume(SESSION, resume))
    asyncio.run(memoire.ecrire_traduction(SESSION, traduction))
    asyncio.run(memoire.fermer())
