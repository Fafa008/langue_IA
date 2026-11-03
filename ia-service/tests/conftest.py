"""Fixtures partagées des tests du service IA."""

import pytest

VARIABLES_LLM = (
    "ENVIRONNEMENT",
    "LLM_FOURNISSEUR",
    "LLM_MODELE",
    "LLM_BASE_URL",
    "LLM_API_KEY",
    "LLM_TEMPERATURE",
    "LLM_MAX_TOKENS",
    "LLM_TIMEOUT_S",
    "LLM_MAX_RETRIES",
    "LLM_REPRISE_DELAI_S",
    "LLM_REPRISE_DELAI_MAX_S",
    "LLM_BUDGET_TOTAL_S",
)


@pytest.fixture
def env_propre(monkeypatch: pytest.MonkeyPatch) -> pytest.MonkeyPatch:
    """Supprime les variables LLM de la machine pour rendre les tests déterministes."""
    for nom in VARIABLES_LLM:
        monkeypatch.delenv(nom, raising=False)
    return monkeypatch
