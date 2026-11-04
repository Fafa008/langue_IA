"""Gestionnaire d'erreurs central du service IA (US-154).

Point de passage unique entre le monde Python et le monde HTTP :

- une exception typée est traduite en ``ErreurAgent`` (code, message public, indicateur ``retryable``) ;
- une exception inconnue devient ``ERREUR_INTERNE`` : sa trace part dans les journaux, jamais dans la réponse ;
- les messages publics viennent du catalogue ``app.core.codes_erreur`` et ne recopient aucune donnée d'entrée.

Ce module ne journalise jamais le contenu d'une requête, le prompt, la réponse du fournisseur ni la clé d'API.
"""

import logging
from uuid import UUID

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.codes_erreur import CODES_RETRYABLES, MESSAGES_PUBLICS, STATUTS_HTTP, CodeErreur
from app.core.erreurs import ErreurServiceIA
from app.schemas.commun import ErreurAgent, ReponseErreur

logger = logging.getLogger(__name__)


def code_pour(exception: BaseException) -> CodeErreur:
    """Code public d'une exception : celui qu'elle déclare, sinon ``ERREUR_INTERNE``."""
    if isinstance(exception, ErreurServiceIA):
        return exception.code
    return CodeErreur.ERREUR_INTERNE


def erreur_pour_code(code: CodeErreur) -> ErreurAgent:
    """Construire l'erreur publique d'un code, sans jamais consulter le message interne de l'exception."""
    return ErreurAgent(
        code=code,
        message=MESSAGES_PUBLICS[code],
        retryable=code in CODES_RETRYABLES,
    )


def erreur_publique(exception: BaseException) -> ErreurAgent:
    """Traduire une exception quelconque en erreur publique sûre."""
    return erreur_pour_code(code_pour(exception))


def reponse_erreur(request_id: UUID, agent: str, exception: BaseException) -> ReponseErreur:
    """Construire l'enveloppe d'erreur du Harness à partir d'une exception."""
    return ReponseErreur(request_id=request_id, agent=agent, erreur=erreur_publique(exception))


def reponse_erreur_pour_code(request_id: UUID, agent: str, code: CodeErreur) -> ReponseErreur:
    """Variante pour une erreur détectée avant tout appel au fournisseur (entrée invalide, agent inconnu)."""
    return ReponseErreur(request_id=request_id, agent=agent, erreur=erreur_pour_code(code))


def journaliser(exception: BaseException) -> None:
    """Journaliser une erreur sans contenu sensible.

    Une erreur métier est journalisée avec son code et son message interne (déjà expurgé). Une erreur inattendue est
    journalisée avec sa trace pour le diagnostic, mais le client ne reçoit qu'un message générique.
    """
    if isinstance(exception, ErreurServiceIA):
        logger.warning("Erreur %s : %s", exception.code.value, exception)
    else:
        logger.exception("Erreur inattendue du service IA (%s)", type(exception).__name__)


async def gerer_erreur_service(_: Request, exception: ErreurServiceIA) -> JSONResponse:
    """Handler FastAPI des erreurs métier : erreur structurée, jamais de trace."""
    journaliser(exception)
    return _reponse_http(exception)


async def gerer_erreur_inattendue(_: Request, exception: Exception) -> JSONResponse:
    """Handler FastAPI de dernier recours : trace en journal, ``ERREUR_INTERNE`` en réponse."""
    journaliser(exception)
    return _reponse_http(exception)


async def gerer_erreur_validation(_: Request, exception: RequestValidationError) -> JSONResponse:
    """Handler FastAPI des corps de requête hors contrat.

    La réponse 422 par défaut de FastAPI recopie la valeur refusée (``input``), donc le message de l'apprenant : elle
    est remplacée par ``ENTREE_INVALIDE``. Seuls les emplacements des champs fautifs sont journalisés.
    """
    emplacements = sorted({".".join(str(partie) for partie in erreur.get("loc", ())) for erreur in exception.errors()})
    logger.warning("Erreur %s : %s", CodeErreur.ENTREE_INVALIDE.value, ", ".join(emplacements[:10]))
    return _reponse_http_pour_code(CodeErreur.ENTREE_INVALIDE)


def _reponse_http(exception: BaseException) -> JSONResponse:
    """Réponse JSON ``{code, message, retryable}``, au format attendu par le backend."""
    return _reponse_http_pour_code(code_pour(exception))


def _reponse_http_pour_code(code: CodeErreur) -> JSONResponse:
    erreur = erreur_pour_code(code)
    return JSONResponse(
        status_code=STATUTS_HTTP[erreur.code],
        content=erreur.model_dump(mode="json", exclude_none=True),
    )
