"""Toutes les routes de l'API, sous le préfixe /api/v1 (docs/api/contrat-frontend.md)."""

from fastapi import APIRouter

from app.api.routes import auth, diagnostic, formateurs, formules, pedagogie, profil, roles, statistiques, utilisateurs

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(formules.router)
# /users/me avant /users/{id_user}
api_router.include_router(profil.router)
api_router.include_router(roles.router)
api_router.include_router(utilisateurs.router)
api_router.include_router(statistiques.router)
api_router.include_router(pedagogie.router)
api_router.include_router(diagnostic.router)
api_router.include_router(formateurs.router)
