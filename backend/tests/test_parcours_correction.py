"""Tests de la correction d'une réponse libre par l'IA (US157-BE), sur PostgreSQL de test et sans réseau.

Le service IA est remplacé par un faux qui rejoue des enveloppes ; le client HTTP réel est testé à part avec
``httpx.MockTransport``.
"""

import json
from collections.abc import Iterator
from uuid import UUID

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Niveau, ParcoursExercice, Role, Utilisateur
from app.models import TestDiagnostic as Diagnostic
from app.schemas.ia import (
    ContexteApprenantIA,
    EntreeCorrectionIA,
    ReponseCorrectionIA,
    RequeteCorrectionIA,
)
from app.services import correction_exercice
from app.services.ia import ErreurServiceIA, corriger_reponse_libre
from tests.conftest import creer_utilisateur, entete
from tests.fabriques_parcours import CONTENU_REDACTION, creer_parcours

REPONSE = "yesterday I go to the market with my sister and we buy apples"
ERREUR_GO = {"extrait": "I go", "correction": "I went", "explication": "« Yesterday » appelle le prétérit."}
ERREUR_BUY = {"extrait": "we buy", "correction": "we bought", "explication": "Même temps du passé."}


def resultat(phase: str = "PASSIVE", lecon: int = 23, **champs: object) -> dict[str, object]:
    return {
        "phase": phase,
        "lecon_atteinte": lecon,
        "score": 55,
        "commentaire": "Message compréhensible ; revoyez le passé.",
        "points_forts": ["Vous reliez vos idées avec « and »."],
        "erreurs": [ERREUR_GO],
        "reformulation": None,
        "conseil": "Relisez la leçon du jour à voix haute.",
        **champs,
    }


def enveloppe(request_id: UUID, **resultat_champs: object) -> dict[str, object]:
    return {
        "request_id": str(request_id),
        "agent": "correction",
        "version_agent": "1.0.0",
        "version_prompt": "correction/reponse-libre@1.0.0",
        "statut": "succes",
        "resultat": resultat(**resultat_champs),
        "meta": {
            "duree_ms": 900,
            "fournisseur": "factice",
            "modele": "modele-test",
            "version_corpus": "synthetique_fallback",
            "empreinte_prompt": "sha256:" + "b" * 64,
        },
    }


class FauxServiceIA:
    """Remplace l'appel HTTP : garde les requêtes et rejoue une enveloppe ou une erreur."""

    def __init__(self) -> None:
        self.requetes: list[RequeteCorrectionIA] = []
        self.erreur: Exception | None = None
        self.champs: dict[str, object] = {}

    def __call__(self, requete: RequeteCorrectionIA) -> ReponseCorrectionIA:
        self.requetes.append(requete)
        if self.erreur is not None:
            raise self.erreur
        lecon = requete.contexte.lecon_atteinte
        defauts = {"lecon": lecon, "phase": "PASSIVE" if lecon < 50 else "ACTIVE"}
        return ReponseCorrectionIA.model_validate(enveloppe(requete.request_id, **{**defauts, **self.champs}))


@pytest.fixture
def faux_ia(monkeypatch: pytest.MonkeyPatch) -> FauxServiceIA:
    faux = FauxServiceIA()
    monkeypatch.setattr(correction_exercice, "corriger_reponse_libre", faux)
    return faux


@pytest.fixture
def apprenant(db: Session) -> Utilisateur:
    return creer_utilisateur(db)


def url(id_parcours: int, id_ligne: int) -> str:
    return f"/api/v1/parcours/{id_parcours}/exercices/{id_ligne}/reponse"


def envoyer(client: TestClient, apprenant: Utilisateur, ids: tuple[int, int], **corps: object) -> httpx.Response:
    return client.post(url(*ids), json={"format": "redaction", "reponse": REPONSE, **corps}, headers=entete(apprenant))


# Correction et enregistrement


def test_corrige_en_phase_passive_et_enregistre(client, db, apprenant, faux_ia) -> None:
    ids = creer_parcours(db, apprenant)

    reponse = envoyer(client, apprenant, ids)

    assert reponse.status_code == 200
    assert reponse.json() == {
        "statut": "REUSSI",
        "score_obtenu": 55,
        "mode_correction": "IA",
        "commentaire": "Message compréhensible ; revoyez le passé.",
        "reponse_attendue": None,
        "explication": None,
        "points_forts": ["Vous reliez vos idées avec « and »."],
        "erreurs": [ERREUR_GO],
        "conseil": "Relisez la leçon du jour à voix haute.",
        "phase": "PASSIVE",
        "lecon_atteinte": 23,
        "reformulation": None,
    }
    # Contexte transmis : langue, référentiel, niveau du test et leçon atteinte, sans identité
    requete = faux_ia.requetes[0]
    assert requete.contexte.model_dump() == {
        "code_langue": "en",
        "referentiel": "CECRL",
        "niveau_preliminaire": "B1",
        "lecon_atteinte": 23,
    }
    assert requete.entree.consigne == CONTENU_REDACTION["consigne"]
    assert requete.entree.mots_minimum == 10

    db.expire_all()
    ligne = db.get(ParcoursExercice, ids[1])
    assert ligne.score_obtenu == 55
    assert ligne.reponse_apprenant == REPONSE
    assert ligne.feedback_ia["resultat"]["phase"] == "PASSIVE"
    assert ligne.feedback_ia["meta"]["version_corpus"] == "synthetique_fallback"
    assert ligne.date_reponse is not None


def test_phase_active_avec_version_corrigee_et_niveau_final(client, db, apprenant, faux_ia) -> None:
    ids = creer_parcours(db, apprenant, lecon_atteinte=56, numero_lecon=50)
    test = db.scalar(select(Diagnostic))
    test.niveau_final = db.scalar(select(Niveau).where(Niveau.code == "A2"))
    db.commit()
    corrige = "Yesterday I went to the market with my sister and we bought apples."
    faux_ia.champs = {"score": 40, "erreurs": [ERREUR_GO, ERREUR_BUY], "reformulation": corrige}

    corps = envoyer(client, apprenant, ids).json()

    assert corps["statut"] == "A_REVOIR"
    assert (corps["phase"], corps["lecon_atteinte"], corps["reformulation"]) == ("ACTIVE", 56, corrige)
    # La leçon du contexte est celle du parcours, pas celle de l'exercice refait
    assert faux_ia.requetes[0].contexte.lecon_atteinte == 56
    assert faux_ia.requetes[0].contexte.niveau_preliminaire == "A2"


def test_refaire_un_exercice_remplace_la_correction(client, db, apprenant, faux_ia) -> None:
    ids = creer_parcours(db, apprenant)
    envoyer(client, apprenant, ids)
    faux_ia.champs = {"score": 90, "erreurs": []}
    envoyer(client, apprenant, ids, reponse="Yesterday I went to the market.")

    db.expire_all()
    ligne = db.get(ParcoursExercice, ids[1])
    assert ligne.score_obtenu == 90
    assert ligne.reponse_apprenant == "Yesterday I went to the market."


# Accès et exercice


def test_acces_refuse_hors_de_son_parcours(client, db, apprenant, faux_ia) -> None:
    ids = creer_parcours(db, apprenant)
    autre = creer_utilisateur(db, email="autre@exemple.com")
    formateur = creer_utilisateur(db, Role.FORMATEUR, email="formateur@exemple.com")

    assert envoyer(client, autre, ids).status_code == 404
    assert envoyer(client, formateur, ids).status_code == 403
    assert client.post(url(*ids), json={"format": "redaction", "reponse": REPONSE}).status_code == 401
    assert envoyer(client, apprenant, (ids[0], ids[1] + 99)).status_code == 404
    assert faux_ia.requetes == []


@pytest.mark.parametrize(
    ("options", "corps", "statut"),
    [
        ({"numero_lecon": 24}, {}, 403),
        ({"contenu": "pas du JSON"}, {}, 409),
        ({"contenu": {"format": "redaction", "consigne": "Écrivez."}}, {}, 409),
        ({}, {"format": "choix"}, 422),
        ({}, {"reponse": "   "}, 422),
        ({}, {"reponse": "x", "note": 20}, 422),
    ],
    ids=[
        "lecon-non-atteinte",
        "contenu-illisible",
        "enonce-manquant",
        "format-different",
        "reponse-vide",
        "champ-inconnu",
    ],
)
def test_refus_avant_tout_appel_ia(client, db, apprenant, faux_ia, options, corps, statut) -> None:
    ids = creer_parcours(db, apprenant, **options)
    assert envoyer(client, apprenant, ids, **corps).status_code == statut
    assert faux_ia.requetes == []


# Pannes et feedback incohérent : rien n'est enregistré


@pytest.mark.parametrize(
    ("code", "statut"),
    [
        ("timeout", 504),
        ("http_504", 504),
        ("indisponible", 503),
        ("non_configure", 503),
        ("http_429", 503),
        ("reponse_invalide", 502),
        ("http_422", 502),
    ],
)
def test_panne_ia_traduite_sans_enregistrer(client, db, apprenant, faux_ia, code, statut) -> None:
    ids = creer_parcours(db, apprenant)
    faux_ia.erreur = ErreurServiceIA(code)

    reponse = envoyer(client, apprenant, ids)

    assert reponse.status_code == statut
    assert REPONSE not in reponse.text
    db.expire_all()
    assert db.get(ParcoursExercice, ids[1]).reponse_apprenant is None


@pytest.mark.parametrize(
    "champs",
    [{"lecon": 24}, {"erreurs": [{**ERREUR_GO, "extrait": "I goes"}]}],
    ids=["autre-lecon", "extrait-invente"],
)
def test_feedback_incoherent_refuse(client, db, apprenant, faux_ia, champs) -> None:
    ids = creer_parcours(db, apprenant)
    faux_ia.champs = champs

    assert envoyer(client, apprenant, ids).status_code == 502
    db.expire_all()
    assert db.get(ParcoursExercice, ids[1]).score_obtenu is None


# Client HTTP réel vers le service IA


@pytest.fixture
def service_ia(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("IA_SERVICE_URL", "http://ia.test")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def requete_ia(lecon: int | None = 23) -> RequeteCorrectionIA:
    return RequeteCorrectionIA(
        request_id=UUID("3f1c9b7e-6a2d-4f0e-9c1a-2b7d5e8f4a10"),
        contexte=ContexteApprenantIA(
            code_langue="en", referentiel="CECRL", niveau_preliminaire="B1", lecon_atteinte=lecon
        ),
        entree=EntreeCorrectionIA(**{k: v for k, v in CONTENU_REDACTION.items() if k != "format"}, reponse=REPONSE),
    )


def test_client_appelle_la_route_de_correction(service_ia) -> None:
    appels: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        appels.append(request)
        return httpx.Response(200, json=enveloppe(requete_ia().request_id))

    reponse = corriger_reponse_libre(requete_ia(), transport=httpx.MockTransport(handler))

    assert reponse.resultat.phase == "PASSIVE"
    assert appels[0].url == "http://ia.test/correction/reponse-libre"
    corps = json.loads(appels[0].read())
    assert corps["contexte"]["lecon_atteinte"] == 23
    assert set(corps) == {"request_id", "contexte", "entree"}


@pytest.mark.parametrize(
    "corps",
    [
        {"agent": "diagnostic"},
        {"resultat": resultat(erreurs=[ERREUR_GO, ERREUR_BUY, ERREUR_GO, ERREUR_BUY])},
        {"resultat": resultat(reformulation="Yesterday I went.")},
        {"resultat": resultat("ACTIVE", 56)},
    ],
    ids=["autre-agent", "passif-trop-d-erreurs", "passif-avec-version-corrigee", "actif-sans-version-corrigee"],
)
def test_client_refuse_un_feedback_hors_contrat(service_ia, corps: dict[str, object]) -> None:
    contenu = {**enveloppe(requete_ia().request_id), **corps}
    with pytest.raises(ErreurServiceIA) as erreur:
        corriger_reponse_libre(requete_ia(), transport=httpx.MockTransport(lambda _: httpx.Response(200, json=contenu)))
    assert erreur.value.code == "reponse_invalide"


def test_requete_sans_lecon_refusee() -> None:
    with pytest.raises(ValueError, match="leçon atteinte"):
        requete_ia(lecon=None)
