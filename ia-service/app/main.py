"""Point d'entrée du service IA.

Le service expose ``GET /health``, ``POST /chatbot/message`` (US67, tuteur v2 CECRL/Assimil), les routes internes
de correction et de traduction du chatbot, ``POST /diagnostic/evaluer`` (PRE-05),
``POST /correction/reponse-libre`` (US157) et ``POST /recommandation/actions``. Le client LLM unique, le Harness et
ses agents Diagnostic, chatbot, correction, traduction, mémoire, exercice et recommandation sont enregistrés au
démarrage : une configuration LLM invalide empêche le service de démarrer, et les ressources partagées sont fermées à
l'arrêt. Le service ne persiste rien : c'est le
backend qui valide et enregistre l'analyse du diagnostic, le feedback des réponses libres et les propositions de
recommandation.
"""

import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.agent.conversation import definir_agent_conversation_chatbot
from app.agent.correction import definir_agent_correction_chatbot
from app.agent.exercice import definir_agent_exercice_chatbot
from app.agent.memoire import definir_agent_memoire_chatbot
from app.agent.traduction import definir_agent_traduction_chatbot
from app.agents.chatbot import definir_agent_chatbot
from app.agents.correction import definir_agent_correction
from app.agents.diagnostic import construire_definition
from app.agents.recommandation import definir_agent_recommandation
from app.api import chatbot, correction, diagnostic, recommandation
from app.core.config import charger_config_memoire
from app.core.erreurs import ErreurConfiguration, ErreurServiceIA
from app.core.gestionnaire_erreurs import gerer_erreur_inattendue, gerer_erreur_service, gerer_erreur_validation
from app.core.securite import jeton_interne_attendu, verifier_jeton_interne
from app.harness.execution import Harness
from app.harness.registre import RegistreAgents
from app.llm.fabrique import obtenir_client, reinitialiser_client
from app.memory.court import MemoireCourte, MemoireCourteVide
from app.memory.redis import MemoireRedis
from app.prompts import RegistrePrompts
from app.rag import construire_recuperateur

logger = logging.getLogger(__name__)


@asynccontextmanager
async def duree_vie(app: FastAPI) -> AsyncIterator[None]:
    """Construire les ressources partagées une seule fois, puis les libérer."""
    if os.getenv("ENVIRONNEMENT", "dev") == "prod" and not jeton_interne_attendu():
        raise ErreurConfiguration("IA_SERVICE_TOKEN requis en production.")

    registre_prompts = RegistrePrompts()
    client_llm = obtenir_client()
    registre_agents = RegistreAgents()
    recuperateur_rag = construire_recuperateur()
    # Une configuration Redis invalide n'empêche pas le service de démarrer : le chat continue sans cache.
    try:
        configuration_memoire = charger_config_memoire()
        memoire: MemoireCourte = MemoireRedis.depuis_url(
            configuration_memoire.url,
            ttl_s=configuration_memoire.ttl_s,
            tours_max=configuration_memoire.tours_max,
        )
    except ErreurConfiguration as erreur:
        logger.warning("memoire_courte_desactivee raison=%s", erreur)
        memoire = MemoireCourteVide()

    registre_agents.enregistrer(construire_definition(registre_prompts))
    registre_agents.enregistrer(definir_agent_chatbot(registre_prompts))
    registre_agents.enregistrer(definir_agent_conversation_chatbot(registre_prompts))
    registre_agents.enregistrer(definir_agent_correction_chatbot(registre_prompts))
    registre_agents.enregistrer(definir_agent_traduction_chatbot(registre_prompts))
    registre_agents.enregistrer(definir_agent_memoire_chatbot(registre_prompts))
    registre_agents.enregistrer(definir_agent_exercice_chatbot(registre_prompts))
    registre_agents.enregistrer(definir_agent_correction(registre_prompts))
    registre_agents.enregistrer(definir_agent_recommandation(registre_prompts))

    app.state.client_llm = client_llm
    app.state.registre_agents = registre_agents
    app.state.registre_prompts = registre_prompts
    app.state.recuperateur_rag = recuperateur_rag
    app.state.memoire = memoire
    app.state.harness = Harness(
        registre_agents,
        client_llm,
        registre_prompts=registre_prompts,
        recuperateur_rag=recuperateur_rag,
        memoire=memoire,
    )

    try:
        yield
    finally:
        await client_llm.fermer()
        await recuperateur_rag.fermer()
        await memoire.fermer()
        reinitialiser_client()


app = FastAPI(title="Centre de langues IA — Service IA", version="0.1.0", lifespan=duree_vie)

# Gestionnaire d'erreurs central (US-154) : réponse JSON {code, message, retryable}, jamais de trace ni de secret.
app.add_exception_handler(ErreurServiceIA, gerer_erreur_service)
app.add_exception_handler(Exception, gerer_erreur_inattendue)
# Corps hors contrat : ENTREE_INVALIDE, sans recopier la valeur refusée (US67).
app.add_exception_handler(RequestValidationError, gerer_erreur_validation)
app.middleware("http")(verifier_jeton_interne)

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
app.include_router(correction.router)
app.include_router(diagnostic.router)
app.include_router(recommandation.router)
