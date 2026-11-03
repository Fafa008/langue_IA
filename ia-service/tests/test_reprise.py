"""Tests de la politique de reprise commune (US-154)."""

import asyncio

import pytest

from app.core.erreurs import (
    ErreurConfiguration,
    ErreurLlmIndisponible,
    ErreurLlmLimiteRequetes,
    ErreurReponseLlm,
    ErreurServiceIA,
)
from app.core.reprise import (
    PolitiqueReprise,
    desordre_par_defaut,
    reessayer,
    rejouable_par_defaut,
)

POLITIQUE = PolitiqueReprise(max_reprises=2, delai_initial_s=0.5, delai_max_s=4.0, budget_total_s=30.0)


class AttenteFactice:
    def __init__(self) -> None:
        self.delais: list[float] = []

    async def __call__(self, delai_s: float) -> None:
        self.delais.append(delai_s)


class HorlogeFactice:
    """Horloge avancée manuellement : rend les tests de budget déterministes."""

    def __init__(self, valeurs: list[float]) -> None:
        self._valeurs = list(valeurs)

    def __call__(self) -> float:
        return self._valeurs.pop(0)


def test_tentatives_max_inclut_l_appel_initial() -> None:
    assert PolitiqueReprise(max_reprises=0).tentatives_max == 1
    assert PolitiqueReprise(max_reprises=3).tentatives_max == 4


def test_delai_croissant_et_plafonne() -> None:
    politique = PolitiqueReprise(delai_initial_s=0.5, delai_max_s=1.5)
    assert politique.delai_s(0) == 0.5
    assert politique.delai_s(1) == 1.0
    assert politique.delai_s(2) == 1.5
    assert politique.delai_s(9) == 1.5


def test_retry_after_prime_sur_le_delai_calcule() -> None:
    assert POLITIQUE.delai_s(0, retry_after_s=2.0) == 2.0
    assert POLITIQUE.delai_s(0, retry_after_s=0.1) == 0.5


def test_retry_after_reste_plafonne() -> None:
    assert POLITIQUE.delai_s(0, retry_after_s=9999.0) == 4.0


def test_desordre_majore_legerement_le_delai() -> None:
    assert POLITIQUE.delai_s(0, desordre=0.1) == pytest.approx(0.55)
    assert POLITIQUE.delai_s(0, desordre=0.0) == 0.5


def test_desordre_par_defaut_borne() -> None:
    for _ in range(20):
        assert 0.0 <= desordre_par_defaut() <= 0.1


def test_rejouable_par_defaut() -> None:
    assert rejouable_par_defaut(ErreurLlmIndisponible("panne")) is True
    assert rejouable_par_defaut(ErreurConfiguration("invalide")) is False
    assert rejouable_par_defaut(ValueError("inconnu")) is False


def test_succes_immediat_sans_attente() -> None:
    appels: list[int] = []
    attente = AttenteFactice()

    async def operation() -> str:
        appels.append(1)
        return "ok"

    resultat = asyncio.run(reessayer(operation, politique=POLITIQUE, attente=attente, desordre=lambda: 0.0))

    assert resultat == "ok"
    assert len(appels) == 1
    assert attente.delais == []


def test_reprise_puis_succes() -> None:
    appels: list[int] = []
    attente = AttenteFactice()

    async def operation() -> str:
        appels.append(1)
        if len(appels) == 1:
            raise ErreurLlmIndisponible("panne")
        return "ok"

    resultat = asyncio.run(reessayer(operation, politique=POLITIQUE, attente=attente, desordre=lambda: 0.0))

    assert resultat == "ok"
    assert len(appels) == 2
    assert attente.delais == [0.5]


def test_erreur_definitive_jamais_rejouee() -> None:
    appels: list[int] = []
    attente = AttenteFactice()

    async def operation() -> str:
        appels.append(1)
        raise ErreurConfiguration("clé absente")

    with pytest.raises(ErreurConfiguration):
        asyncio.run(reessayer(operation, politique=POLITIQUE, attente=attente, desordre=lambda: 0.0))

    assert len(appels) == 1
    assert attente.delais == []


def test_exception_inconnue_jamais_rejouee() -> None:
    appels: list[int] = []

    async def operation() -> str:
        appels.append(1)
        raise ValueError("inattendue")

    with pytest.raises(ValueError):
        asyncio.run(reessayer(operation, politique=POLITIQUE, attente=AttenteFactice()))

    assert len(appels) == 1


def test_epuisement_des_tentatives() -> None:
    appels: list[int] = []
    attente = AttenteFactice()

    async def operation() -> str:
        appels.append(1)
        raise ErreurReponseLlm("json invalide")

    with pytest.raises(ErreurReponseLlm):
        asyncio.run(reessayer(operation, politique=POLITIQUE, attente=attente, desordre=lambda: 0.0))

    assert len(appels) == 3
    assert attente.delais == [0.5, 1.0]


def test_retry_after_repris_de_l_exception() -> None:
    appels: list[int] = []
    attente = AttenteFactice()

    async def operation() -> str:
        appels.append(1)
        if len(appels) == 1:
            raise ErreurLlmLimiteRequetes("429", retry_after_s=3.0)
        return "ok"

    asyncio.run(reessayer(operation, politique=POLITIQUE, attente=attente, desordre=lambda: 0.0))

    assert attente.delais == [3.0]


def test_budget_epuise_avant_l_attente() -> None:
    appels: list[int] = []
    attente = AttenteFactice()
    horloge = HorlogeFactice([0.0, 30.0])

    async def operation() -> str:
        appels.append(1)
        raise ErreurLlmIndisponible("panne")

    with pytest.raises(ErreurLlmIndisponible):
        asyncio.run(
            reessayer(
                operation,
                politique=POLITIQUE,
                attente=attente,
                horloge=horloge,
                desordre=lambda: 0.0,
            )
        )

    assert len(appels) == 1
    assert attente.delais == []


def test_budget_insuffisant_pour_le_delai() -> None:
    appels: list[int] = []
    attente = AttenteFactice()
    horloge = HorlogeFactice([0.0, 29.9])

    async def operation() -> str:
        appels.append(1)
        raise ErreurLlmIndisponible("panne")

    with pytest.raises(ErreurLlmIndisponible):
        asyncio.run(
            reessayer(
                operation,
                politique=POLITIQUE,
                attente=attente,
                horloge=horloge,
                desordre=lambda: 0.0,
            )
        )

    assert len(appels) == 1
    assert attente.delais == []


def test_reprise_desactivee() -> None:
    appels: list[int] = []

    async def operation() -> str:
        appels.append(1)
        raise ErreurLlmIndisponible("panne")

    with pytest.raises(ErreurLlmIndisponible):
        asyncio.run(reessayer(operation, politique=PolitiqueReprise(max_reprises=0), attente=AttenteFactice()))

    assert len(appels) == 1


def test_est_rejouable_personnalise() -> None:
    appels: list[int] = []

    async def operation() -> str:
        appels.append(1)
        if len(appels) == 1:
            raise ValueError("temporaire")
        return "ok"

    resultat = asyncio.run(
        reessayer(
            operation,
            politique=POLITIQUE,
            attente=AttenteFactice(),
            est_rejouable=lambda exception: isinstance(exception, ValueError),
        )
    )

    assert resultat == "ok"
    assert len(appels) == 2


def test_toute_erreur_du_service_porte_un_code() -> None:
    for exception in (
        ErreurLlmIndisponible("a"),
        ErreurConfiguration("b"),
        ErreurReponseLlm("c"),
        ErreurLlmLimiteRequetes("d"),
        ErreurServiceIA("e"),
    ):
        assert isinstance(exception.code.value, str)
        assert exception.message_public
