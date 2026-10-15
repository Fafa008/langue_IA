"""Point d'entrée du service IA.

Squelette minimal pour que la stack Docker démarre : une seule route /health.
À compléter par l'équipe (routes, base de données, configuration).
"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Centre de langues IA — Service IA", version="0.1.0")

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
