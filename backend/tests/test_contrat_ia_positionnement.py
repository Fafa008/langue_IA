"""Contrat IA v2 du test de positionnement : exemples partagés, versions gelées et repli partiel."""

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.schemas.ia import (
    VERSION_AGENT_DIAGNOSTIC,
    VERSION_AGENT_POSITIONNEMENT,
    VERSION_PROMPT_POSITIONNEMENT,
    ReponsePositionnementIA,
    RequetePositionnementIA,
)
from app.services.analyse_diagnostic import _analyser_document, verifier_reponse_diagnostic_v2

CONTRATS = Path(__file__).resolve().parents[2] / "contrats" / "ia" / "diagnostic-evaluer-v2"
INVALIDES = sorted(p.name for p in (CONTRATS / "invalides").glob("*.json"))


def lire(nom: str) -> dict:
    chemin = CONTRATS / nom
    if not chemin.is_file():
        pytest.fail(f"Exemple de contrat introuvable : {chemin} (dossier contrats/ monté ?)")
    return json.loads(chemin.read_text(encoding="utf-8"))


def test_les_exemples_du_positionnement_sont_presents() -> None:
    assert len(INVALIDES) >= 5, f"Exemples invalides introuvables dans {CONTRATS}"


def test_versions_du_contrat_v2_sont_geles() -> None:
    requete = lire("requete.json")
    reponse = lire("reponse.json")
    assert VERSION_AGENT_POSITIONNEMENT == "1.2.0" != VERSION_AGENT_DIAGNOSTIC
    assert requete["version_agent"] == VERSION_AGENT_POSITIONNEMENT == reponse["version_agent"]
    assert reponse["version_prompt"] == VERSION_PROMPT_POSITIONNEMENT == "diagnostic/evaluation@1.2.0"
    fait = requete["entree"]["reponses"][0]
    assert {"format", "difficulte", "justesse", "score_competence", "temps_reponse_secondes"} <= fait.keys()
    assert "temps_reponse_s" not in fait


def test_produit_exactement_la_requete_de_reference() -> None:
    reference = lire("requete.json")
    requete = RequetePositionnementIA.model_validate(reference)
    assert requete.model_dump(mode="json", exclude_none=True) == reference


def test_accepte_la_reponse_du_service_ia() -> None:
    requete = RequetePositionnementIA.model_validate(lire("requete.json"))
    enveloppe = ReponsePositionnementIA.model_validate(lire("reponse.json"))
    assert enveloppe.resultat.statut == "succes"
    assert verifier_reponse_diagnostic_v2(enveloppe, requete)


@pytest.mark.parametrize("nom", INVALIDES)
def test_refuse_les_exemples_invalides(nom: str) -> None:
    contenu = lire(f"invalides/{nom}")
    if "entree" in contenu:
        with pytest.raises(ValidationError):
            RequetePositionnementIA.model_validate(contenu)
        return
    try:
        enveloppe = ReponsePositionnementIA.model_validate(contenu)
    except ValidationError:
        return
    requete = RequetePositionnementIA.model_validate(lire("requete.json"))
    assert not verifier_reponse_diagnostic_v2(enveloppe, requete), f"{nom} est accepté par le backend"


def test_refuse_une_version_d_agent_incoherente() -> None:
    requete = RequetePositionnementIA.model_validate(lire("requete.json"))
    enveloppe = ReponsePositionnementIA.model_validate(lire("reponse.json"))
    enveloppe.version_agent = VERSION_AGENT_DIAGNOSTIC
    assert not verifier_reponse_diagnostic_v2(enveloppe, requete)


def test_statut_a_verifier_donne_un_resultat_partiel() -> None:
    document = lire("reponse.json")
    document["resultat"]["statut"] = "a_verifier"
    analyse = _analyser_document(document)
    assert analyse.points_faibles == []
    assert analyse.phase_assimil == "activation"
    assert "a_verifier" not in str(analyse.points_faibles)
