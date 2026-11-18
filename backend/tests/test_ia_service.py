"""Tests du client backend vers le service IA, sans réseau (``httpx.MockTransport``)."""

from collections.abc import Iterator
from uuid import UUID

import httpx
import pytest

from app.core.config import get_settings
from app.schemas.ia import (
    ContexteApprenantIA,
    EntreeDiagnosticIA,
    PreuveDiagnosticIA,
    RequeteDiagnosticIA,
)
from app.services.ia import ErreurServiceIA, evaluer_diagnostic

REQUEST_ID = UUID("3f1c9b7e-6a2d-4f0e-9c1a-2b7d5e8f4a10")

ENVELOPPE = {
    "request_id": str(REQUEST_ID),
    "agent": "diagnostic",
    "version_agent": "1.0.0",
    "version_prompt": "diagnostic/evaluation@1.1.0",
    "statut": "succes",
    "resultat": {
        "code_langue": "en",
        "referentiel": "CECRL",
        "niveau_estime": "A2",
        "phase_assimil": "impregnation",
        "points_faibles": [
            {
                "domaine": "grammaire",
                "id_question": "1",
                "observation": "Le présent est utilisé là où le passé serait attendu.",
                "justification": "Emploi irrégulier des temps, à confirmer.",
            }
        ],
        "score_confiance": 0.6,
        "niveau_preliminaire": "A1",
        "ecart_avec_niveau_preliminaire": 1,
    },
    "meta": {
        "duree_ms": 1200,
        "fournisseur": "factice",
        "modele": "modele-test",
        "version_corpus": None,
        "empreinte_prompt": "sha256:" + "a" * 64,
    },
}


def requete() -> RequeteDiagnosticIA:
    return RequeteDiagnosticIA(
        request_id=REQUEST_ID,
        contexte=ContexteApprenantIA(code_langue="en", referentiel="CECRL", niveau_preliminaire="A1"),
        entree=EntreeDiagnosticIA(
            reponses=[
                PreuveDiagnosticIA(
                    id_question="1",
                    competence="grammaire",
                    type_reponse="choix",
                    contenu="is",
                )
            ],
            score_preliminaire=33.33,
        ),
    )


@pytest.fixture
def service_ia(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Configurer une URL joignable ; le transport simulé remplace le réseau."""
    monkeypatch.setenv("IA_SERVICE_URL", "http://ia.test")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _transport(handler) -> httpx.MockTransport:
    return httpx.MockTransport(handler)


def test_appelle_l_agent_et_valide_l_enveloppe(service_ia) -> None:
    appels: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        appels.append(request)
        return httpx.Response(200, json=ENVELOPPE)

    reponse = evaluer_diagnostic(requete(), transport=_transport(handler))

    assert reponse.resultat.niveau_estime == "A2"
    assert reponse.resultat.phase_assimil == "impregnation"
    assert len(appels) == 1
    assert appels[0].url == "http://ia.test/diagnostic/evaluer"
    corps = appels[0].read().decode()
    assert appels[0].headers["content-type"] == "application/json"
    assert "score_preliminaire" in corps
    assert "reponse_correcte" not in corps
    assert "apprenant" not in corps


@pytest.mark.parametrize("statut", [422, 429, 500, 502, 503, 504])
def test_erreur_http_devient_erreur_service(service_ia, statut: int) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(statut, json={"code": "X"})

    with pytest.raises(ErreurServiceIA) as erreur:
        evaluer_diagnostic(requete(), transport=_transport(handler))

    assert erreur.value.code == f"http_{statut}"


def test_delai_depasse(service_ia) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("trop lent")

    with pytest.raises(ErreurServiceIA) as erreur:
        evaluer_diagnostic(requete(), transport=_transport(handler))

    assert erreur.value.code == "timeout"


def test_service_injoignable(service_ia) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connexion refusée")

    with pytest.raises(ErreurServiceIA) as erreur:
        evaluer_diagnostic(requete(), transport=_transport(handler))

    assert erreur.value.code == "indisponible"


@pytest.mark.parametrize(
    "corps",
    [
        {"statut": "succes"},
        {**ENVELOPPE, "champ_inconnu": True},
        {**ENVELOPPE, "resultat": {"niveau_estime": "A2"}},
        "pas un objet",
    ],
    ids=["incomplet", "champ-en-trop", "resultat-incomplet", "pas-un-objet"],
)
def test_reponse_hors_contrat_refusee(service_ia, corps) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=corps)

    with pytest.raises(ErreurServiceIA) as erreur:
        evaluer_diagnostic(requete(), transport=_transport(handler))

    assert erreur.value.code == "reponse_invalide"


def test_url_absente_desactive_l_analyse(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("IA_SERVICE_URL", raising=False)
    get_settings.cache_clear()
    try:
        with pytest.raises(ErreurServiceIA) as erreur:
            evaluer_diagnostic(requete())
        assert erreur.value.code == "non_configure"
    finally:
        get_settings.cache_clear()
