"""Route de la correction d'une réponse libre (US157) : ``POST /correction/reponse-libre``.

La route ne contient aucune logique pédagogique : elle confie l'enveloppe validée au Harness et traduit une
``ReponseErreur`` en statut HTTP grâce au catalogue des codes (US-154). Le corps d'erreur reste l'enveloppe du
Harness, pour que le backend retrouve ``request_id`` et ``retryable``.
"""

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.agents.correction import CODE_AGENT_CORRECTION
from app.core.codes_erreur import STATUTS_HTTP
from app.schemas.commun import ErreurAgent, ReponseAgent, ReponseErreur, RequeteAgent
from app.schemas.correction import EntreeCorrection, ResultatCorrection

router = APIRouter(prefix="/correction", tags=["correction"])


@router.post(
    "/reponse-libre",
    response_model=ReponseAgent[ResultatCorrection],
    responses={
        # Corps refusé avant d'atteindre le Harness : pas encore d'enveloppe, seulement {code, message, retryable}.
        422: {"model": ErreurAgent, "description": "Entrée hors contrat ou leçon atteinte absente (ENTREE_INVALIDE)"},
        429: {"model": ReponseErreur, "description": "Limite de requêtes du fournisseur LLM atteinte"},
        500: {"model": ReponseErreur, "description": "Configuration LLM, prompt introuvable ou erreur interne"},
        502: {"model": ReponseErreur, "description": "Feedback du fournisseur LLM inexploitable ou incohérent"},
        503: {"model": ReponseErreur, "description": "Fournisseur LLM ou corpus indisponible"},
        504: {"model": ReponseErreur, "description": "Délai dépassé"},
    },
)
async def corriger_reponse_libre(
    requete: RequeteAgent[EntreeCorrection], request: Request
) -> ReponseAgent[ResultatCorrection] | JSONResponse:
    """Corriger la réponse libre de l'apprenant et retourner le feedback v2 validé."""
    reponse = await request.app.state.harness.executer(CODE_AGENT_CORRECTION, requete)
    if isinstance(reponse, ReponseErreur):
        return JSONResponse(
            status_code=STATUTS_HTTP[reponse.erreur.code],
            content=reponse.model_dump(mode="json"),
        )
    return reponse
