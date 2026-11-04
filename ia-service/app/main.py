"""Point d'entrée du service IA.

Le service expose ``GET /health``. Le client LLM unique, le registre de prompts, le port RAG et le Harness sont
construits au démarrage : une configuration LLM invalide empêche le service de démarrer, et le client est fermé
proprement à l'arrêt. L'agent Diagnostic est enregistré dans le registre partagé ; aucune route d'inférence n'est
encore exposée.
"""

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agents.diagnostic import construire_definition
from app.core.erreurs import ErreurServiceIA
from app.core.gestionnaire_erreurs import gerer_erreur_inattendue, gerer_erreur_service
from app.harness.execution import Harness
from app.harness.registre import RegistreAgents
from app.llm.fabrique import obtenir_client, reinitialiser_client
from app.prompts import RegistrePrompts
from app.rag import RecuperateurVide


@asynccontextmanager
async def duree_vie(app: FastAPI) -> AsyncIterator[None]:
    """Construire les ressources partagées une seule fois, puis les libérer."""
    registre_prompts = RegistrePrompts()
    client_llm = obtenir_client()
    registre_agents = RegistreAgents()
    recuperateur_rag = RecuperateurVide()

    registre_agents.enregistrer(construire_definition(registre_prompts))

    app.state.client_llm = client_llm
    app.state.registre_agents = registre_agents
    app.state.registre_prompts = registre_prompts
    app.state.recuperateur_rag = recuperateur_rag
    app.state.harness = Harness(
        registre_agents,
        client_llm,
        registre_prompts=registre_prompts,
        recuperateur_rag=recuperateur_rag,
    )

    try:
        yield
    finally:
        await client_llm.fermer()
        await recuperateur_rag.fermer()
        reinitialiser_client()


app = FastAPI(title="Centre de langues IA — Service IA", version="0.1.0", lifespan=duree_vie)

# Gestionnaire d'erreurs central (US-154) : réponse JSON {code, message, retryable}, jamais de trace ni de secret.
app.add_exception_handler(ErreurServiceIA, gerer_erreur_service)
app.add_exception_handler(Exception, gerer_erreur_inattendue)

# Origines autorisées (frontend) : BACKEND_CORS_ORIGINS du .env, séparées par des virgules
origines = [o.strip() for o in os.getenv("BACKEND_CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origines,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["supervision"])
def health() -> dict[str, str]:
    """Utilisée par le healthcheck Docker et la supervision."""
    return {"status": "ok", "service": "ia-service"}
