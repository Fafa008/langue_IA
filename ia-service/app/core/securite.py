"""Vérification du jeton interne backend ↔ service IA (P1-1).

Le service reste joignable sans jeton en développement pour ne pas casser les outils locaux. Dès que
``IA_SERVICE_TOKEN`` est renseigné, toute route métier doit présenter ``X-IA-Token`` ; ``/health`` reste exempt
pour la supervision et le healthcheck Docker. En production, l'absence de secret empêche le démarrage.
"""

import hmac
import os
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse

from app.core.codes_erreur import STATUTS_HTTP, CodeErreur
from app.core.gestionnaire_erreurs import erreur_pour_code


def jeton_interne_attendu() -> str:
    """Lire le secret configuré, sans jamais le journaliser."""
    return os.getenv("IA_SERVICE_TOKEN", "").strip()


async def verifier_jeton_interne(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
    """Refuser une requête métier sans jeton valide quand un secret est configuré."""
    if request.url.path == "/health":
        return await call_next(request)

    attendu = jeton_interne_attendu()
    if not attendu:
        return await call_next(request)

    recu = request.headers.get("X-IA-Token", "")
    if not hmac.compare_digest(recu, attendu):
        erreur = erreur_pour_code(CodeErreur.ACCES_REFUSE)
        return JSONResponse(
            status_code=STATUTS_HTTP[erreur.code],
            content=erreur.model_dump(mode="json", exclude_none=True),
        )

    return await call_next(request)
