"""Client HTTP du backend vers le service IA (PRE-05).

Le backend reste l'autorité : il construit la requête, borne l'attente, valide l'enveloppe de réponse et ne
journalise que des identifiants techniques. Aucun contenu d'apprenant, aucun prompt, aucune clé n'est écrit dans les
journaux. Une panne du service IA n'est jamais une erreur pour l'apprenant : l'appelant dégrade en résultat partiel.
"""

import logging

import httpx
from pydantic import ValidationError

from app.core.config import get_settings
from app.schemas.ia import ReponseDiagnosticIA, RequeteDiagnosticIA

logger = logging.getLogger(__name__)

CHEMIN_EVALUATION = "/diagnostic/evaluer"


class ErreurServiceIA(Exception):
    """Échec de l'appel au service IA, traduit en dégradation par l'orchestration.

    ``code`` reste technique et court : ``non_configure``, ``timeout``, ``indisponible``, ``reponse_invalide`` ou
    ``http_<statut>``. Il ne contient jamais la réponse du fournisseur.
    """

    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


def evaluer_diagnostic(
    requete: RequeteDiagnosticIA,
    *,
    transport: httpx.BaseTransport | None = None,
) -> ReponseDiagnosticIA:
    """Appeler l'agent Diagnostic et retourner son enveloppe validée.

    ``transport`` sert uniquement aux tests (``httpx.MockTransport``) ; il reste ``None`` en production.
    """
    settings = get_settings()
    base = settings.ia_service_url.strip()
    if not base:
        raise ErreurServiceIA("non_configure")

    try:
        with httpx.Client(timeout=settings.ia_service_timeout_s, transport=transport) as client:
            reponse = client.post(
                f"{base.rstrip('/')}{CHEMIN_EVALUATION}",
                json=requete.model_dump(mode="json", exclude_none=True),
            )
    except httpx.TimeoutException:
        raise ErreurServiceIA("timeout") from None
    except httpx.HTTPError:
        raise ErreurServiceIA("indisponible") from None

    if reponse.status_code != 200:
        raise ErreurServiceIA(f"http_{reponse.status_code}")

    try:
        return ReponseDiagnosticIA.model_validate(reponse.json())
    except (ValueError, ValidationError):
        raise ErreurServiceIA("reponse_invalide") from None
