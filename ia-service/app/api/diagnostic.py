"""Route du diagnostic : ``POST /diagnostic/evaluer``.

La route ne contient aucune logique pédagogique : elle confie l'enveloppe validée au Harness et traduit une
``ReponseErreur`` en statut HTTP grâce au catalogue des codes (US-154). Le corps d'erreur reste l'enveloppe du
Harness, pour que le backend retrouve ``request_id`` et ``retryable``.
"""

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.agents.diagnostic import CODE_AGENT, EntreeDiagnostic
from app.core.codes_erreur import STATUTS_HTTP
from app.schemas.commun import ErreurAgent, ReponseAgent, ReponseErreur, RequeteAgent
from app.schemas.diagnostic import ResultatDiagnostic

router = APIRouter(prefix="/diagnostic", tags=["diagnostic"])


@router.post(
    "/evaluer",
    response_model=ReponseAgent[ResultatDiagnostic],
    responses={
        # Corps refusé avant d'atteindre le Harness : pas encore d'enveloppe, seulement {code, message, retryable}.
        422: {"model": ErreurAgent, "description": "Entrée hors contrat (ENTREE_INVALIDE)"},
        429: {"model": ReponseErreur, "description": "Limite de requêtes du fournisseur LLM atteinte"},
        500: {"model": ReponseErreur, "description": "Configuration LLM, prompt introuvable ou erreur interne"},
        502: {"model": ReponseErreur, "description": "Réponse du fournisseur LLM inexploitable ou refusée"},
        503: {"model": ReponseErreur, "description": "Fournisseur LLM ou corpus indisponible"},
        504: {"model": ReponseErreur, "description": "Délai dépassé"},
    },
)
async def evaluer(
    requete: RequeteAgent[EntreeDiagnostic], request: Request
) -> ReponseAgent[ResultatDiagnostic] | JSONResponse:
    """Transmettre les réponses du test au modèle et retourner l'estimation validée du diagnostic."""
    reponse = await request.app.state.harness.executer(CODE_AGENT, requete)
    if isinstance(reponse, ReponseErreur):
        return JSONResponse(
            status_code=STATUTS_HTTP[reponse.erreur.code],
            content=reponse.model_dump(mode="json"),
        )
    return reponse
