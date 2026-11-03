"""Point d'entrée du service IA.

Le service expose pour l'instant ``GET /health``. Le client LLM unique et le Harness sont construits au démarrage :
une configuration LLM invalide empêche le service de démarrer, et le client est fermé proprement à l'arrêt.
"""

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.harness.execution import Harness
from app.harness.registre import RegistreAgents
from app.llm.fabrique import obtenir_client, reinitialiser_client


@asynccontextmanager
async def duree_vie(app: FastAPI) -> AsyncIterator[None]:
    """Construire les ressources partagées une seule fois, puis les libérer."""
    client_llm = obtenir_client()
    registre_agents = RegistreAgents()

    app.state.client_llm = client_llm
    app.state.registre_agents = registre_agents
    app.state.harness = Harness(registre_agents, client_llm)

    try:
        yield
    finally:
        await client_llm.fermer()
        reinitialiser_client()


app = FastAPI(title="Centre de langues IA — Service IA", version="0.1.0", lifespan=duree_vie)

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
