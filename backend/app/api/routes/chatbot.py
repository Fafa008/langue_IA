"""Routes du chat apprenant (US67/US74, US-IA-CHAT-04/05) : relais IA, quota, mémoire, exercices et fin de session."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, status

from app.api.deps import UtilisateurConnecte
from app.models import Role
from app.schemas.chatbot import (
    ChatbotMessageIn,
    ChatbotMessageOut,
    ChatbotSessionSupprimeeOut,
    CorrectionChatbotIn,
    CorrectionChatbotOut,
    ExerciceCibleChatbotIn,
    ExerciceCibleChatbotOut,
    TraductionChatbotIn,
    TraductionChatbotOut,
)
from app.services.chatbot import (
    CodeErreurChatbot,
    ErreurChatbot,
    corriger_message,
    envoyer_message,
    generer_exercice_cible,
    terminer_session_chat,
    traduire_message,
)

router = APIRouter(prefix="/chatbot", tags=["chatbot"])

_ERREURS_HTTP = {
    CodeErreurChatbot.PARCOURS_INCONNU: (
        status.HTTP_404_NOT_FOUND,
        "Aucun parcours en cours. Passez le test de positionnement.",
    ),
    CodeErreurChatbot.LANGUE_NON_PRISE_EN_CHARGE: (
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "Cette langue ou ce niveau n'est pas encore pris en charge par le chat.",
    ),
    CodeErreurChatbot.QUOTA_DEPASSE: (
        status.HTTP_429_TOO_MANY_REQUESTS,
        "Limite d'échanges atteinte pour cette session. Commencez une nouvelle session.",
    ),
    CodeErreurChatbot.IA_TIMEOUT: (
        status.HTTP_504_GATEWAY_TIMEOUT,
        "La réponse du chat prend plus de temps que prévu. Réessayez dans un instant.",
    ),
    CodeErreurChatbot.IA_INDISPONIBLE: (
        status.HTTP_503_SERVICE_UNAVAILABLE,
        "Le chat est momentanément indisponible. Réessayez dans un instant.",
    ),
    CodeErreurChatbot.IA_REPONSE_INVALIDE: (
        status.HTTP_502_BAD_GATEWAY,
        "La réponse du chat n'a pas pu être validée. Réessayez dans un instant.",
    ),
}


def _exiger_apprenant(utilisateur: UtilisateurConnecte) -> None:
    if utilisateur.role != Role.APPRENANT:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Seul un apprenant peut utiliser le chat.")


@router.post("/message", response_model=ChatbotMessageOut)
def poster_message(corps: ChatbotMessageIn, utilisateur: UtilisateurConnecte) -> ChatbotMessageOut:
    """Envoyer un message au chat ; le service ouvre ses propres sessions pour ne pas bloquer l'appel IA."""
    _exiger_apprenant(utilisateur)
    try:
        return envoyer_message(utilisateur.id_user, corps)
    except ErreurChatbot as erreur:
        code, detail = _ERREURS_HTTP[erreur.code]
        raise HTTPException(code, detail) from None


@router.delete("/session/{identifiant_session}", response_model=ChatbotSessionSupprimeeOut)
def fermer_session(
    identifiant_session: Annotated[str, Path(min_length=1, max_length=64)],
    utilisateur: UtilisateurConnecte,
) -> ChatbotSessionSupprimeeOut:
    """Persister la mémoire long terme puis supprimer l'historique et le quota de la session."""
    _exiger_apprenant(utilisateur)
    return terminer_session_chat(utilisateur.id_user, identifiant_session)


@router.post("/exercice", response_model=ExerciceCibleChatbotOut)
def poster_exercice_cible(corps: ExerciceCibleChatbotIn, utilisateur: UtilisateurConnecte) -> ExerciceCibleChatbotOut:
    """Générer un exercice ciblé depuis une erreur et l'enregistrer comme brouillon."""
    _exiger_apprenant(utilisateur)
    try:
        return generer_exercice_cible(utilisateur.id_user, corps)
    except ErreurChatbot as erreur:
        code, detail = _ERREURS_HTTP[erreur.code]
        raise HTTPException(code, detail) from None


@router.post("/correction", response_model=CorrectionChatbotOut)
def poster_correction(corps: CorrectionChatbotIn, utilisateur: UtilisateurConnecte) -> CorrectionChatbotOut:
    """Corriger séparément le dernier message : l'appel LLM est distinct de la réponse du tuteur."""
    _exiger_apprenant(utilisateur)
    try:
        return corriger_message(utilisateur.id_user, corps)
    except ErreurChatbot as erreur:
        code, detail = _ERREURS_HTTP[erreur.code]
        raise HTTPException(code, detail) from None


@router.post("/traduction", response_model=TraductionChatbotOut)
def poster_traduction(corps: TraductionChatbotIn, utilisateur: UtilisateurConnecte) -> TraductionChatbotOut:
    """Traduire séparément une réponse du tuteur, avec cache IA indexé par ``id_message``."""
    _exiger_apprenant(utilisateur)
    try:
        return traduire_message(utilisateur.id_user, corps)
    except ErreurChatbot as erreur:
        code, detail = _ERREURS_HTTP[erreur.code]
        raise HTTPException(code, detail) from None
