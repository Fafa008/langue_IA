"""Route de l'agent Recommandation : ``POST /recommandation/actions``.

La route ne contient aucune logique pédagogique : elle confie l'enveloppe validée au Harness et traduit une
``ReponseErreur`` en statut HTTP grâce au catalogue des codes (US-154). Le backend reste seul décisionnaire de
l'intégration des propositions dans le parcours.
"""

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.core.codes_erreur import STATUTS_HTTP
from app.schemas.commun import ErreurAgent, ReponseAgent, ReponseErreur, RequeteAgent
from app.schemas.recommandation import CODE_AGENT, EntreeRecommandation, ResultatRecommandation

router = APIRouter(prefix="/recommandation", tags=["recommandation"])


@router.post(
    "/actions",
    response_model=ReponseAgent[ResultatRecommandation],
    responses={
        422: {"model": ErreurAgent, "description": "Entrée hors contrat (ENTREE_INVALIDE)"},
        429: {"model": ReponseErreur, "description": "Limite de requêtes du fournisseur LLM atteinte"},
        500: {"model": ReponseErreur, "description": "Configuration LLM, prompt introuvable ou erreur interne"},
        502: {"model": ReponseErreur, "description": "Réponse du fournisseur LLM inexploitable ou incohérente"},
        503: {"model": ReponseErreur, "description": "Fournisseur LLM indisponible"},
        504: {"model": ReponseErreur, "description": "Délai dépassé"},
    },
)
async def recommander_actions(
    requete: RequeteAgent[EntreeRecommandation], request: Request
) -> ReponseAgent[ResultatRecommandation] | JSONResponse:
    """Proposer des actions de remédiation validées pour le parcours de l'apprenant."""
    reponse = await request.app.state.harness.executer(CODE_AGENT, requete)
    if isinstance(reponse, ReponseErreur):
        return JSONResponse(
            status_code=STATUTS_HTTP[reponse.erreur.code],
            content=reponse.model_dump(mode="json"),
        )
    return reponse
