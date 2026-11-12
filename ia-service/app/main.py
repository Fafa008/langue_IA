"""Point d'entrée du service IA.

Le service expose ``GET /health`` et ``POST /chatbot/message`` (US67). Le client LLM unique, le Harness et ses agents
Diagnostic et chatbot sont enregistrés au démarrage : une configuration LLM invalide empêche le service de démarrer,
et les ressources partagées sont fermées proprement à l'arrêt. L'agent Diagnostic n'a pas encore de route
d'inférence.
"""

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.agents.chatbot import definir_agent_chatbot
from app.agents.diagnostic import construire_definition
from app.api import chatbot
from app.core.erreurs import ErreurServiceIA
from app.core.gestionnaire_erreurs import gerer_erreur_inattendue, gerer_erreur_service, gerer_erreur_validation
from app.harness.execution import Harness
from app.harness.registre import RegistreAgents
from app.llm.fabrique import obtenir_client, reinitialiser_client
from app.prompts import RegistrePrompts
from app.rag import construire_recuperateur


@asynccontextmanager
async def duree_vie(app: FastAPI) -> AsyncIterator[None]:
    """Construire les ressources partagées une seule fois, puis les libérer."""
    registre_prompts = RegistrePrompts()
    client_llm = obtenir_client()
    registre_agents = RegistreAgents()
    recuperateur_rag = construire_recuperateur()

    registre_agents.enregistrer(construire_definition(registre_prompts))
    registre_agents.enregistrer(definir_agent_chatbot(registre_prompts))

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
# Corps hors contrat : ENTREE_INVALIDE, sans recopier la valeur refusée (US67).
app.add_exception_handler(RequestValidationError, gerer_erreur_validation)

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


app.include_router(chatbot.router)
