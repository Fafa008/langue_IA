"""Routes du chatbot (US67, US-IA-CHAT-02/03) : dialogue, correction et traduction.

``POST /chatbot/message`` sert le tuteur v2 (CECRL/Assimil, mémoire courte) mais garde la forme de résultat
consommée par le frontend (``reponse``, ``corrections``, ``traduction``, ``explication``).
Les routes internes ajoutées ici séparent l'analyse grammaticale et la traduction, sans modifier le contrat public
avant la bascule prévue en fin de programme. Elles ne contiennent aucune logique pédagogique : l'enveloppe validée
est confiée au Harness, et une ``ReponseErreur`` est traduite en statut HTTP grâce au catalogue des codes (US-154).
"""

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.agent.chatbot import CODE_AGENT_CHATBOT
from app.agent.correction import CODE_AGENT_CORRECTION_CHATBOT
from app.agent.traduction import CODE_AGENT_TRADUCTION_CHATBOT
from app.core.codes_erreur import STATUTS_HTTP
from app.memory import clefs
from app.schemas.chatbot import (
    EntreeChatbot,
    EntreeConversation,
    EntreeTraduction,
    ResultatChatbot,
    ResultatCorrection,
    ResultatTraduction,
)
from app.schemas.commun import ErreurAgent, ReponseAgent, ReponseErreur, RequeteAgent

router = APIRouter(prefix="/chatbot", tags=["chatbot"])

_REPONSES_ERREUR: dict[int, dict[str, object]] = {
    # Corps refusé avant d'atteindre le Harness : pas encore d'enveloppe, seulement {code, message, retryable}.
    422: {"model": ErreurAgent, "description": "Entrée hors contrat (ENTREE_INVALIDE)"},
    429: {"model": ReponseErreur, "description": "Limite de requêtes du fournisseur LLM atteinte"},
    500: {"model": ReponseErreur, "description": "Configuration LLM, prompt introuvable ou erreur interne"},
    502: {"model": ReponseErreur, "description": "Réponse du fournisseur LLM inexploitable ou refusée"},
    503: {"model": ReponseErreur, "description": "Fournisseur LLM indisponible"},
    504: {"model": ReponseErreur, "description": "Délai dépassé"},
}


def _reponse_erreur(reponse: ReponseErreur) -> JSONResponse:
    """Convertir une enveloppe d'erreur du Harness en réponse HTTP, sans révéler son contenu."""
    return JSONResponse(
        status_code=STATUTS_HTTP[reponse.erreur.code],
        content=reponse.model_dump(mode="json"),
    )


@router.post(
    "/message",
    response_model=ReponseAgent[ResultatChatbot],
    responses=_REPONSES_ERREUR,
)
async def envoyer_message(
    requete: RequeteAgent[EntreeConversation], request: Request
) -> ReponseAgent[ResultatChatbot] | JSONResponse:
    """Transmettre le message de l'apprenant au modèle et retourner la réponse de l'assistant."""
    if requete.entree.identifiant_session:
        clefs.valider_identifiant_session(requete.entree.identifiant_session)
    reponse = await request.app.state.harness.executer(CODE_AGENT_CHATBOT, requete)
    if isinstance(reponse, ReponseErreur):
        return _reponse_erreur(reponse)
    return reponse


@router.post(
    "/correction",
    response_model=ReponseAgent[ResultatCorrection],
    responses=_REPONSES_ERREUR,
)
async def corriger_message(
    requete: RequeteAgent[EntreeChatbot], request: Request
) -> ReponseAgent[ResultatCorrection] | JSONResponse:
    """Analyser séparément le dernier message de l'apprenant, sans couper la conversation."""
    reponse = await request.app.state.harness.executer(CODE_AGENT_CORRECTION_CHATBOT, requete)
    if isinstance(reponse, ReponseErreur):
        return _reponse_erreur(reponse)
    return reponse


@router.post(
    "/traduction",
    response_model=ReponseAgent[ResultatTraduction],
    responses=_REPONSES_ERREUR,
)
async def traduire_message(
    requete: RequeteAgent[EntreeTraduction], request: Request
) -> ReponseAgent[ResultatTraduction] | JSONResponse:
    """Traduire une réponse de l'assistant, en réutilisant le cache de la session quand il est disponible."""
    # Le préfixe de clé Redis est dérivé de cet identifiant : il doit être validé avant tout accès au cache.
    clefs.valider_identifiant_session(requete.entree.identifiant_session)
    reponse = await request.app.state.harness.executer(CODE_AGENT_TRADUCTION_CHATBOT, requete)
    if isinstance(reponse, ReponseErreur):
        return _reponse_erreur(reponse)
    return reponse
