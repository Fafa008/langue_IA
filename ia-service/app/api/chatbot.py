"""Route du chatbot (US67) : ``POST /chatbot/message``.

La route ne contient aucune logique : elle confie l'enveloppe validée au Harness et traduit une ``ReponseErreur``
en statut HTTP grâce au catalogue des codes (US-154). Le corps d'erreur reste l'enveloppe du Harness, pour que le
backend retrouve ``request_id`` et ``retryable``.
"""

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.agents.chatbot import CODE_AGENT_CHATBOT
from app.core.codes_erreur import STATUTS_HTTP
from app.schemas.chatbot import EntreeChatbot, ResultatChatbot
from app.schemas.commun import ErreurAgent, ReponseAgent, ReponseErreur, RequeteAgent

router = APIRouter(prefix="/chatbot", tags=["chatbot"])


@router.post(
    "/message",
    response_model=ReponseAgent[ResultatChatbot],
    responses={
        # Corps refusé avant d'atteindre le Harness : pas encore d'enveloppe, seulement {code, message, retryable}.
        422: {"model": ErreurAgent, "description": "Entrée hors contrat (ENTREE_INVALIDE)"},
        429: {"model": ReponseErreur, "description": "Limite de requêtes du fournisseur LLM atteinte"},
        500: {"model": ReponseErreur, "description": "Configuration LLM, prompt introuvable ou erreur interne"},
        502: {"model": ReponseErreur, "description": "Réponse du fournisseur LLM inexploitable ou refusée"},
        503: {"model": ReponseErreur, "description": "Fournisseur LLM indisponible"},
        504: {"model": ReponseErreur, "description": "Délai dépassé"},
    },
)
async def envoyer_message(
    requete: RequeteAgent[EntreeChatbot], request: Request
) -> ReponseAgent[ResultatChatbot] | JSONResponse:
    """Transmettre le message de l'apprenant au modèle et retourner la réponse de l'assistant."""
    reponse = await request.app.state.harness.executer(CODE_AGENT_CHATBOT, requete)
    if isinstance(reponse, ReponseErreur):
        return JSONResponse(
            status_code=STATUTS_HTTP[reponse.erreur.code],
            content=reponse.model_dump(mode="json"),
        )
    return reponse
