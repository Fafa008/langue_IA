"""Client HTTP du backend vers le service IA (PRE-05).

Le backend reste l'autorité : il construit la requête, borne l'attente, valide l'enveloppe de réponse et ne
journalise que des identifiants techniques. Aucun contenu d'apprenant, aucun prompt, aucune clé n'est écrit dans les
journaux. Une panne du service IA n'est jamais une erreur pour l'apprenant : l'appelant dégrade en résultat partiel.
"""

import logging
from typing import TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from app.core.config import get_settings
from app.schemas.ia import (
    ReponseChatbotIA,
    ReponseClotureIA,
    ReponseCorrectionIA,
    ReponseDiagnosticIA,
    ReponseExerciceIA,
    ReponseRecommandationIA,
    RequeteChatbotIA,
    RequeteClotureIA,
    RequeteCorrectionIA,
    RequeteDiagnosticIA,
    RequeteExerciceIA,
    RequeteRecommandationIA,
)

logger = logging.getLogger(__name__)

CHEMIN_EVALUATION = "/diagnostic/evaluer"
CHEMIN_CORRECTION = "/correction/reponse-libre"
CHEMIN_CHATBOT = "/chatbot/message"
CHEMIN_CLOTURE_CHATBOT = "/chatbot/session/close"
CHEMIN_EXERCICE_CHATBOT = "/chatbot/exercice"
CHEMIN_RECOMMANDATION = "/recommandation/actions"

T = TypeVar("T", bound=BaseModel)


class ErreurServiceIA(Exception):
    """Échec de l'appel au service IA, traduit en dégradation par l'orchestration.

    ``code`` reste technique et court : ``non_configure``, ``timeout``, ``indisponible``, ``reponse_invalide`` ou
    ``http_<statut>``. Il ne contient jamais la réponse du fournisseur.
    """

    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


def _poster(chemin: str, requete: BaseModel, modele: type[T], transport: httpx.BaseTransport | None) -> T:
    """Appeler une route du service IA et valider son enveloppe de succès ; toute autre issue lève une erreur."""
    settings = get_settings()
    base = settings.ia_service_url.strip()
    if not base:
        raise ErreurServiceIA("non_configure")

    entetes: dict[str, str] = {}
    jeton = settings.ia_service_token.strip()
    if jeton:
        entetes["X-IA-Token"] = jeton

    try:
        with httpx.Client(timeout=settings.ia_service_timeout_s, transport=transport) as client:
            reponse = client.post(
                f"{base.rstrip('/')}{chemin}",
                json=requete.model_dump(mode="json", exclude_none=True),
                headers=entetes or None,
            )
    except httpx.TimeoutException:
        raise ErreurServiceIA("timeout") from None
    except httpx.HTTPError:
        raise ErreurServiceIA("indisponible") from None

    if reponse.status_code != 200:
        raise ErreurServiceIA(f"http_{reponse.status_code}")

    try:
        return modele.model_validate(reponse.json())
    except (ValueError, ValidationError):
        raise ErreurServiceIA("reponse_invalide") from None


def evaluer_diagnostic(
    requete: RequeteDiagnosticIA,
    *,
    transport: httpx.BaseTransport | None = None,
) -> ReponseDiagnosticIA:
    """Appeler l'agent Diagnostic et retourner son enveloppe validée.

    ``transport`` sert uniquement aux tests (``httpx.MockTransport``) ; il reste ``None`` en production.
    """
    return _poster(CHEMIN_EVALUATION, requete, ReponseDiagnosticIA, transport)


def corriger_reponse_libre(
    requete: RequeteCorrectionIA,
    *,
    transport: httpx.BaseTransport | None = None,
) -> ReponseCorrectionIA:
    """Appeler l'agent de correction (US157) et retourner son feedback v2 validé."""
    return _poster(CHEMIN_CORRECTION, requete, ReponseCorrectionIA, transport)


def envoyer_message_chatbot(
    requete: RequeteChatbotIA,
    *,
    transport: httpx.BaseTransport | None = None,
) -> ReponseChatbotIA:
    """Appeler l'agent Chatbot et retourner son enveloppe validée, corrections en marge comprises."""
    return _poster(CHEMIN_CHATBOT, requete, ReponseChatbotIA, transport)


def clore_session_chatbot(
    requete: RequeteClotureIA,
    *,
    transport: httpx.BaseTransport | None = None,
) -> ReponseClotureIA:
    """Demander à l'agent de clôture la charge utile de mémoire long terme, sans rien persister ici."""
    return _poster(CHEMIN_CLOTURE_CHATBOT, requete, ReponseClotureIA, transport)


def generer_exercice_chatbot(
    requete: RequeteExerciceIA,
    *,
    transport: httpx.BaseTransport | None = None,
) -> ReponseExerciceIA:
    """Demander un exercice ciblé à l'agent dédié et valider son enveloppe."""
    return _poster(CHEMIN_EXERCICE_CHATBOT, requete, ReponseExerciceIA, transport)


def recommander_actions(
    requete: RequeteRecommandationIA,
    *,
    transport: httpx.BaseTransport | None = None,
) -> ReponseRecommandationIA:
    """Appeler l'agent Recommandation (REC-02) et retourner sa proposition validée."""
    return _poster(CHEMIN_RECOMMANDATION, requete, ReponseRecommandationIA, transport)
