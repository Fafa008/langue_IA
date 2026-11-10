"""Test d'intégration Groq réel, désactivé sauf activation explicite."""

import asyncio
import os

import pytest

from app.core.config import charger_config
from app.core.erreurs import ErreurConfiguration
from app.llm.base import MessageLLM
from app.llm.fabrique import creer_client

pytestmark = pytest.mark.skipif(
    os.getenv("TEST_GROQ_INTEGRATION") != "1",
    reason="Définir TEST_GROQ_INTEGRATION=1 pour appeler l'API Groq réelle.",
)


def test_generation_reelle_avec_groq() -> None:
    """Vérifier une génération courte via le modèle et la clé explicitement configurés."""
    configuration = charger_config()
    if configuration.fournisseur != "compatible-openai":
        raise ErreurConfiguration("Le test d'intégration nécessite LLM_FOURNISSEUR=compatible-openai.")
    if configuration.base_url is None or configuration.base_url.host != "api.groq.com":
        raise ErreurConfiguration("Le test d'intégration nécessite LLM_BASE_URL=https://api.groq.com/openai/v1.")

    client = creer_client(configuration)

    async def scenario() -> None:
        try:
            contenu, reponse = await client.generer_texte(
                [MessageLLM(role="user", contenu="Réponds uniquement par : OK Groq.")],
            )
            assert contenu.strip()
            assert reponse.fournisseur == "compatible-openai"
            assert reponse.modele == configuration.modele
        finally:
            await client.fermer()

    asyncio.run(scenario())
