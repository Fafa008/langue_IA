"""Fabrique du client LLM unique du processus.

Le Harness ne construit jamais de client : il reçoit celui de ``obtenir_client()`` (ou un faux client dans les
tests). La sélection de l'adaptateur se fait au démarrage, pas au premier appel, afin qu'une configuration invalide
empêche le service de démarrer plutôt que d'échouer en production à la première requête.
"""

import threading

from app.core.config import ConfigLLM, charger_config
from app.core.erreurs import ErreurConfiguration
from app.llm.adaptateurs.compatible_openai import CompatibleOpenAI
from app.llm.adaptateurs.factice import FakeLLMClient
from app.llm.base import FournisseurLLM

_verrou = threading.Lock()
_client: FournisseurLLM | None = None


def creer_client(config: ConfigLLM) -> FournisseurLLM:
    """Instancier l'adaptateur correspondant à la configuration.

    Aucun appel réseau n'est effectué ici. Un fournisseur inconnu lève ``ErreurConfiguration`` immédiatement.
    """
    if config.fournisseur == "factice":
        return FakeLLMClient(modele=config.modele or "factice-1")
    if config.fournisseur == "compatible-openai":
        return CompatibleOpenAI(config)
    if config.fournisseur == "gemini":
        # Import paresseux : le SDK google-genai pèse plusieurs secondes au démarrage. Le charger uniquement
        # lorsqu'il est réellement choisi évite de dépasser le ping de surveillance d'Uvicorn (5 s) avec
        # ``--workers`` et garde courts les démarrages des fournisseurs compatibles OpenAI.
        from app.llm.adaptateurs.gemini import GeminiClient

        return GeminiClient(config)
    raise ErreurConfiguration("Fournisseur LLM inconnu : la configuration a été refusée.")


def obtenir_client() -> FournisseurLLM:
    """Retourner le client partagé, en le construisant une seule fois par processus."""
    global _client
    if _client is None:
        with _verrou:
            if _client is None:
                _client = creer_client(charger_config())
    return _client


def reinitialiser_client() -> None:
    """Oublier le client partagé (arrêt du service ou test).

    Le client doit avoir été fermé par l'appelant ; cette fonction ne fait aucune entrée/sortie.
    """
    global _client
    with _verrou:
        _client = None
