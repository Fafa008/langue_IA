"""Tests du gestionnaire d'erreurs central (US-154)."""

import asyncio
import json
import logging
from uuid import UUID

import pytest

from app.core.codes_erreur import CODES_RETRYABLES, MESSAGES_PUBLICS, STATUTS_HTTP, CodeErreur
from app.core.erreurs import (
    ErreurAgentInconnu,
    ErreurConfiguration,
    ErreurLlmAuthentification,
    ErreurLlmIndisponible,
    ErreurLlmLimiteRequetes,
    ErreurLlmRequete,
    ErreurLlmTimeout,
    ErreurRegistre,
    ErreurReponseLlm,
    ErreurServiceIA,
)
from app.core.gestionnaire_erreurs import (
    code_pour,
    erreur_pour_code,
    erreur_publique,
    gerer_erreur_inattendue,
    gerer_erreur_service,
    journaliser,
    reponse_erreur,
    reponse_erreur_pour_code,
)
from app.schemas.commun import ReponseErreur

REQUEST_ID = UUID("3f1c9b7e-6a2d-4f0e-9c1a-2b7d5e8f4a10")


@pytest.mark.parametrize(
    ("exception", "attendu"),
    [
        (ErreurConfiguration("x"), CodeErreur.LLM_CONFIGURATION),
        (ErreurLlmTimeout("x"), CodeErreur.LLM_TIMEOUT),
        (ErreurLlmIndisponible("x"), CodeErreur.LLM_INDISPONIBLE),
        (ErreurLlmLimiteRequetes("x"), CodeErreur.LLM_LIMITE_REQUETES),
        (ErreurLlmAuthentification("x"), CodeErreur.LLM_AUTHENTIFICATION),
        (ErreurLlmRequete("x"), CodeErreur.LLM_REQUETE_INVALIDE),
        (ErreurReponseLlm("x"), CodeErreur.LLM_REPONSE_INVALIDE),
        (ErreurRegistre("x"), CodeErreur.ERREUR_INTERNE),
        (ErreurAgentInconnu("x"), CodeErreur.AGENT_INCONNU),
        (ErreurServiceIA("x"), CodeErreur.ERREUR_INTERNE),
        (RuntimeError("x"), CodeErreur.ERREUR_INTERNE),
        (ValueError("x"), CodeErreur.ERREUR_INTERNE),
    ],
)
def test_code_pour(exception: BaseException, attendu: CodeErreur) -> None:
    assert code_pour(exception) == attendu


def test_erreur_pour_code_respecte_le_catalogue() -> None:
    for code in CodeErreur:
        erreur = erreur_pour_code(code)
        assert erreur.code is code
        assert erreur.message == MESSAGES_PUBLICS[code]
        assert erreur.retryable is (code in CODES_RETRYABLES)


def test_aucun_secret_dans_l_erreur_publique() -> None:
    exception = ErreurLlmAuthentification("clé sk-secret-test refusée")
    erreur = erreur_publique(exception)
    assert "sk-secret-test" not in erreur.message
    assert erreur.message == MESSAGES_PUBLICS[CodeErreur.LLM_AUTHENTIFICATION]


def test_enveloppe_erreur_complete() -> None:
    enveloppe = reponse_erreur(REQUEST_ID, "diagnostic", ErreurLlmTimeout("lent"))

    assert isinstance(enveloppe, ReponseErreur)
    assert enveloppe.request_id == REQUEST_ID
    assert enveloppe.agent == "diagnostic"
    assert enveloppe.statut == "erreur"
    assert enveloppe.erreur.code is CodeErreur.LLM_TIMEOUT
    assert enveloppe.erreur.retryable is True


def test_enveloppe_erreur_pour_code() -> None:
    enveloppe = reponse_erreur_pour_code(REQUEST_ID, "inconnu", CodeErreur.AGENT_INCONNU)

    assert enveloppe.erreur.code is CodeErreur.AGENT_INCONNU
    assert enveloppe.erreur.retryable is False


def test_journaliser_une_erreur_metier(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.WARNING, logger="app.core.gestionnaire_erreurs"):
        journaliser(ErreurLlmIndisponible("panne transitoire"))

    assert "LLM_INDISPONIBLE" in caplog.text
    assert caplog.records[0].exc_info is None


def test_journaliser_une_erreur_inattendue(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.ERROR, logger="app.core.gestionnaire_erreurs"):
        journaliser(RuntimeError("SECRET-dans-trace"))

    trace = caplog.records[0]
    assert trace.exc_info is not None
    assert "SECRET-dans-trace" not in trace.getMessage()


def _json(reponse) -> dict:
    return json.loads(reponse.body)


def test_handler_metier_renvoie_le_format_attendu() -> None:
    reponse = asyncio.run(gerer_erreur_service(None, ErreurLlmIndisponible("panne")))  # type: ignore[arg-type]

    assert reponse.status_code == STATUTS_HTTP[CodeErreur.LLM_INDISPONIBLE]
    corps = _json(reponse)
    assert corps == {
        "code": "LLM_INDISPONIBLE",
        "message": MESSAGES_PUBLICS[CodeErreur.LLM_INDISPONIBLE],
        "retryable": True,
    }


def test_handler_metier_sans_secret_ni_trace() -> None:
    exception = ErreurLlmAuthentification("clé sk-secret-test refusée (trace interne)")
    reponse = asyncio.run(gerer_erreur_service(None, exception))  # type: ignore[arg-type]

    corps = _json(reponse)
    assert reponse.status_code == 502
    assert corps["code"] == "LLM_AUTHENTIFICATION"
    assert corps["retryable"] is False
    assert "sk-secret-test" not in reponse.body.decode("utf-8")
    assert "Traceback" not in reponse.body.decode("utf-8")


def test_handler_inattendu_masque_la_cause() -> None:
    reponse = asyncio.run(
        gerer_erreur_inattendue(None, RuntimeError("SECRET-dans-trace"))  # type: ignore[arg-type]
    )

    corps = _json(reponse)
    assert reponse.status_code == 500
    assert corps == {
        "code": "ERREUR_INTERNE",
        "message": MESSAGES_PUBLICS[CodeErreur.ERREUR_INTERNE],
        "retryable": False,
    }
    assert "SECRET" not in reponse.body.decode("utf-8")
    assert "RuntimeError" not in reponse.body.decode("utf-8")
