"""Tests du catalogue des codes d'erreur publics (US-154)."""

import pytest

from app.core.codes_erreur import (
    CODES_RETRYABLES,
    MESSAGES_PUBLICS,
    STATUTS_HTTP,
    CodeErreur,
    est_rejouable,
)
from app.schemas.regles import MESSAGE_ERREUR_MAX


def test_chaque_code_a_un_message_public() -> None:
    assert set(MESSAGES_PUBLICS) == set(CodeErreur)


def test_chaque_code_a_un_statut_http() -> None:
    assert set(STATUTS_HTTP) == set(CodeErreur)
    assert all(400 <= statut <= 599 for statut in STATUTS_HTTP.values())


def test_messages_publics_surs_et_stables() -> None:
    for code, message in MESSAGES_PUBLICS.items():
        assert message.strip() == message
        assert 1 <= len(message) <= MESSAGE_ERREUR_MAX
        assert "\n" not in message and "\r" not in message
        assert not message.startswith(code.value)


def test_seuls_les_codes_declares_sont_rejouables() -> None:
    assert CODES_RETRYABLES <= set(CodeErreur)
    for code in CodeErreur:
        assert est_rejouable(code) is (code in CODES_RETRYABLES)


@pytest.mark.parametrize(
    "code",
    [
        CodeErreur.LLM_INDISPONIBLE,
        CodeErreur.LLM_TIMEOUT,
        CodeErreur.LLM_LIMITE_REQUETES,
        CodeErreur.LLM_REPONSE_INVALIDE,
    ],
)
def test_les_pannes_llm_temporaires_sont_rejouables(code: CodeErreur) -> None:
    assert est_rejouable(code) is True


@pytest.mark.parametrize(
    "code",
    [
        CodeErreur.ENTREE_INVALIDE,
        CodeErreur.AGENT_INCONNU,
        CodeErreur.LLM_AUTHENTIFICATION,
        CodeErreur.LLM_REQUETE_INVALIDE,
        CodeErreur.LLM_CONFIGURATION,
        CodeErreur.ERREUR_INTERNE,
    ],
)
def test_les_erreurs_definitives_ne_sont_jamais_rejouees(code: CodeErreur) -> None:
    assert est_rejouable(code) is False


def test_codes_llm_attendus_par_le_contrat() -> None:
    valeurs = {code.value for code in CodeErreur}
    assert {
        "LLM_INDISPONIBLE",
        "LLM_TIMEOUT",
        "LLM_LIMITE_REQUETES",
        "LLM_AUTHENTIFICATION",
        "LLM_REQUETE_INVALIDE",
        "LLM_CONFIGURATION",
        "LLM_REPONSE_INVALIDE",
        "ERREUR_INTERNE",
    } <= valeurs
