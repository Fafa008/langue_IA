"""Politique de reprise commune aux appels LLM (US-154).

Une seule boucle de reprise pour tout le service : le client HTTP ne décide plus lui-même de réessayer, il lève une
exception typée et cette boucle applique la règle. Trois bornes empêchent tout blocage :

1. un nombre de tentatives limité (``max_reprises``) ;
2. un délai d'attente croissant, plafonné (``delai_initial_s``, ``delai_max_s``) ;
3. un budget total (``budget_total_s``) au-delà duquel on renonce au lieu d'attendre.

Seules les erreurs déclarées rejouables par leur code sont retentées. Une entrée invalide, une clé refusée, une
requête malformée ou une configuration incorrecte remontent immédiatement : les rejouer ne changerait rien.
"""

import asyncio
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from random import uniform
from typing import TypeVar

from app.core.erreurs import ErreurServiceIA

T = TypeVar("T")

DELAI_INITIAL_S = 0.5
DELAI_MAX_S = 4.0
BUDGET_TOTAL_S = 30.0
FRACTION_DESORDRE = 0.1


async def attendre(delai_s: float) -> None:
    """Attente par défaut entre deux tentatives (surchargée dans les tests pour rester instantanés)."""
    await asyncio.sleep(delai_s)


def desordre_par_defaut() -> float:
    """Petit décalage aléatoire : évite que plusieurs instances retentent exactement en même temps."""
    return uniform(0.0, FRACTION_DESORDRE)


def rejouable_par_defaut(exception: BaseException) -> bool:
    """Une erreur du service n'est retentée que si son code public est déclaré rejouable."""
    return isinstance(exception, ErreurServiceIA) and exception.rejouable


@dataclass(frozen=True, slots=True)
class PolitiqueReprise:
    """Bornes de reprise d'un appel LLM, construites depuis la configuration."""

    max_reprises: int = 1
    delai_initial_s: float = DELAI_INITIAL_S
    delai_max_s: float = DELAI_MAX_S
    budget_total_s: float = BUDGET_TOTAL_S

    @property
    def tentatives_max(self) -> int:
        """Nombre total d'appels autorisés, reprises comprises."""
        return self.max_reprises + 1

    def delai_s(
        self,
        tentative: int,
        *,
        retry_after_s: float | None = None,
        desordre: float = 0.0,
    ) -> float:
        """Délai à respecter avant la tentative suivante.

        ``tentative`` est l'index (à partir de 0) de la tentative qui vient d'échouer. Le délai double à chaque
        échec, ne descend jamais sous l'en-tête ``Retry-After`` fourni par le fournisseur et reste plafonné.
        """
        base = self.delai_initial_s * (2**tentative)
        if retry_after_s is not None and retry_after_s > base:
            base = retry_after_s
        return min(base * (1.0 + desordre), self.delai_max_s)


async def reessayer(
    operation: Callable[[], Awaitable[T]],
    *,
    politique: PolitiqueReprise,
    attente: Callable[[float], Awaitable[None]] = attendre,
    est_rejouable: Callable[[BaseException], bool] = rejouable_par_defaut,
    horloge: Callable[[], float] = time.monotonic,
    desordre: Callable[[], float] = desordre_par_defaut,
) -> T:
    """Exécuter ``operation`` en la retentant seulement sur une erreur rejouable.

    Lève l'erreur d'origine dès qu'elle est définitive, que les tentatives sont épuisées ou que le budget total ne
    permet plus d'attendre : l'appelant reçoit toujours l'erreur la plus précise, jamais une erreur de reprise.
    """
    debut = horloge()

    for tentative in range(politique.tentatives_max):
        try:
            return await operation()
        except Exception as exception:
            if tentative + 1 >= politique.tentatives_max or not est_rejouable(exception):
                raise

            reste_s = politique.budget_total_s - (horloge() - debut)
            delai_s = politique.delai_s(
                tentative,
                retry_after_s=getattr(exception, "retry_after_s", None),
                desordre=desordre(),
            )
            if reste_s <= 0 or delai_s >= reste_s:
                raise

            await attente(delai_s)

    raise AssertionError("politique.tentatives_max doit valoir au moins 1.")  # pragma: no cover
