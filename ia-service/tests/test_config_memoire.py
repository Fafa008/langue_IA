"""Tests de la configuration Redis, lue depuis les variables d'environnement."""

import pytest

from app.core.config import charger_config_memoire
from app.core.erreurs import ErreurConfiguration


def test_config_memoire_defaut(monkeypatch: pytest.MonkeyPatch) -> None:
    for nom in ("REDIS_URL", "REDIS_TTL_S", "REDIS_TOURS_MAX"):
        monkeypatch.delenv(nom, raising=False)

    configuration = charger_config_memoire()

    assert configuration.url == "redis://redis:6379/0"
    assert configuration.ttl_s == 86_400
    assert configuration.tours_max == 20


def test_config_memoire_depuis_environnement(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("REDIS_URL", "redis://redis:6379/2")
    monkeypatch.setenv("REDIS_TTL_S", "120")
    monkeypatch.setenv("REDIS_TOURS_MAX", "12")

    configuration = charger_config_memoire()

    assert configuration.url == "redis://redis:6379/2"
    assert configuration.ttl_s == 120
    assert configuration.tours_max == 12


def test_config_memoire_invalide(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("REDIS_TTL_S", "0")

    with pytest.raises(ErreurConfiguration) as erreur:
        charger_config_memoire()

    assert "ttl_s" in str(erreur.value)
