"""Test d'intégration Gemini réel, désactivé sauf activation explicite."""

import asyncio
import os

import pytest

from app.core.config import charger_config
from app.core.erreurs import ErreurConfiguration
from app.llm.base import MessageLLM
from app.llm.fabrique import creer_client

pytestmark = pytest.mark.skipif(
    os.getenv("TEST_GEMINI_INTEGRATION") != "1",
    reason="Définir TEST_GEMINI_INTEGRATION=1 pour appeler l'API Gemini réelle.",
)


def test_generation_reelle_avec_gemini() -> None:
    """Vérifier une génération courte via le modèle et la clé explicitement configurés."""
    configuration = charger_config()
    if configuration.fournisseur != "gemini":
        raise ErreurConfiguration("Le test d'intégration nécessite LLM_FOURNISSEUR=gemini.")

    client = creer_client(configuration)

    async def scenario() -> None:
        try:
            contenu, reponse = await client.generer_texte(
                [MessageLLM(role="user", contenu="Réponds uniquement par : OK Gemini.")],
            )
            assert contenu.strip()
            assert reponse.fournisseur == "gemini"
            assert reponse.modele == configuration.gemini_modele
        finally:
            await client.fermer()

    asyncio.run(scenario())
