"""Fixtures partagées des tests du service IA."""

import os

import pytest

PREFIXES_CONFIG = ("GEMINI_", "LLM_", "RAG_", "OPENAI_", "REDIS_")
VARIABLES_CONFIG = {"ENVIRONNEMENT", "IA_SERVICE_TOKEN"}


@pytest.fixture(autouse=True)
def env_propre(monkeypatch: pytest.MonkeyPatch) -> pytest.MonkeyPatch:
    """Isole chaque test des variables Compose et de l'environnement de l'hôte."""
    for nom in tuple(os.environ):
        if nom in VARIABLES_CONFIG or nom.startswith(PREFIXES_CONFIG):
            monkeypatch.delenv(nom, raising=False)
    for nom in VARIABLES_CONFIG:
        monkeypatch.delenv(nom, raising=False)
    return monkeypatch
