"""Test de contrat côté backend (US157-QA) : exemples partagés avec le service IA (``contrats/ia/``).

Le backend redéfinit volontairement le contrat du service IA (``app/schemas/ia.py``) ; ces exemples sont la
référence commune. Ici, on vérifie que le backend produit exactement les requêtes de référence, qu'il accepte les
réponses que le service IA peut produire, et qu'il refuse celles que le service IA refuse.
"""

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.schemas.ia import (
    VERSION_AGENT_DIAGNOSTIC,
    VERSION_PROMPT_DIAGNOSTIC,
    ReponseCorrectionIA,
    ReponseDiagnosticIA,
    ReponseRecommandationIA,
    RequeteCorrectionIA,
    RequeteDiagnosticIA,
    RequeteRecommandationIA,
)
from app.services.analyse_diagnostic import verifier_reponse_diagnostic
from app.services.correction_exercice import verifier_feedback
from app.services.recommandation import verifier_recommandation
from scripts import verifier_contrat_ia as script_contrat

# En CI : <dépôt>/contrats ; dans le conteneur de développement : /contrats, monté en lecture seule.
CONTRATS = Path(__file__).resolve().parents[2] / "contrats" / "ia" / "correction-reponse-libre"
CONTRATS_RECOMMANDATION = Path(__file__).resolve().parents[2] / "contrats" / "ia" / "recommandation-parcours"
CONTRATS_DIAGNOSTIC = Path(__file__).resolve().parents[2] / "contrats" / "ia" / "diagnostic-evaluer"


def lire(nom: str) -> dict:
    chemin = CONTRATS / nom
    if not chemin.is_file():
        pytest.fail(f"Exemple de contrat introuvable : {chemin} (dossier contrats/ monté ?)")
    return json.loads(chemin.read_text(encoding="utf-8"))


INVALIDES = sorted(p.name for p in (CONTRATS / "invalides").glob("*.json"))


def test_les_exemples_partages_sont_presents() -> None:
    assert len(INVALIDES) >= 5, f"Exemples invalides introuvables dans {CONTRATS}"


@pytest.mark.parametrize("nom", ["requete-passive.json", "requete-active.json"])
def test_produit_exactement_la_requete_de_reference(nom: str) -> None:
    reference = lire(nom)
    requete = RequeteCorrectionIA.model_validate(reference)
    # Ce que le client envoie réellement (services/ia.py) : même forme, champ pour champ
    assert requete.model_dump(mode="json", exclude_none=True) == reference


@pytest.mark.parametrize(
    ("requete", "reponse"), [("requete-passive", "reponse-passive"), ("requete-active", "reponse-active")]
)
def test_accepte_la_reponse_du_service_ia(requete: str, reponse: str) -> None:
    enveloppe = ReponseCorrectionIA.model_validate(lire(f"{reponse}.json"))
    assert verifier_feedback(enveloppe.resultat, RequeteCorrectionIA.model_validate(lire(f"{requete}.json")))


@pytest.mark.parametrize("nom", INVALIDES)
def test_refuse_ce_que_le_service_ia_refuse(nom: str) -> None:
    requete = RequeteCorrectionIA.model_validate(lire("requete-passive.json"))
    try:
        enveloppe = ReponseCorrectionIA.model_validate(lire(f"invalides/{nom}"))
    except ValidationError:
        return
    assert not verifier_feedback(enveloppe.resultat, requete), f"{nom} est accepté par le backend"


# --- REC-00 : contrat partagé de la recommandation de parcours ---

INVALIDES_RECOMMANDATION = sorted(p.name for p in (CONTRATS_RECOMMANDATION / "invalides").glob("*.json"))


def lire_recommandation(nom: str) -> dict:
    chemin = CONTRATS_RECOMMANDATION / nom
    if not chemin.is_file():
        pytest.fail(f"Exemple de contrat introuvable : {chemin} (dossier contrats/ monté ?)")
    return json.loads(chemin.read_text(encoding="utf-8"))


def test_les_exemples_recommandation_sont_presents() -> None:
    assert len(INVALIDES_RECOMMANDATION) >= 5, f"Exemples invalides introuvables dans {CONTRATS_RECOMMANDATION}"


def test_produit_exactement_la_requete_recommandation_de_reference() -> None:
    reference = lire_recommandation("requete.json")
    requete = RequeteRecommandationIA.model_validate(reference)
    assert requete.model_dump(mode="json", exclude_none=True) == reference


def test_accepte_la_reponse_recommandation_du_service_ia() -> None:
    enveloppe = ReponseRecommandationIA.model_validate(lire_recommandation("reponse.json"))
    requete = RequeteRecommandationIA.model_validate(lire_recommandation("requete.json"))
    assert verifier_recommandation(enveloppe.resultat, requete)


@pytest.mark.parametrize("nom", INVALIDES_RECOMMANDATION)
def test_refuse_les_recommandations_refusees_par_le_service_ia(nom: str) -> None:
    requete = RequeteRecommandationIA.model_validate(lire_recommandation("requete.json"))
    try:
        enveloppe = ReponseRecommandationIA.model_validate(lire_recommandation(f"invalides/{nom}"))
    except ValidationError:
        return
    assert not verifier_recommandation(enveloppe.resultat, requete), f"{nom} est accepté par le backend"


# --- US-N02 : contrat partagé de l'évaluation diagnostic ---

INVALIDES_DIAGNOSTIC = sorted(p.name for p in (CONTRATS_DIAGNOSTIC / "invalides").glob("*.json"))


def lire_diagnostic(nom: str) -> dict:
    chemin = CONTRATS_DIAGNOSTIC / nom
    if not chemin.is_file():
        pytest.fail(f"Exemple de contrat introuvable : {chemin} (dossier contrats/ monté ?)")
    return json.loads(chemin.read_text(encoding="utf-8"))


def test_les_exemples_diagnostic_sont_presents() -> None:
    assert len(INVALIDES_DIAGNOSTIC) >= 5, f"Exemples invalides introuvables dans {CONTRATS_DIAGNOSTIC}"


def test_versions_et_identifiant_du_contrat_diagnostic_sont_geles() -> None:
    """T2 : `id_question` reste le nom exposé ; agent et prompt sont ceux de l'exemple partagé."""
    requete = lire_diagnostic("requete.json")
    reponse = lire_diagnostic("reponse.json")
    assert requete["version_agent"] == VERSION_AGENT_DIAGNOSTIC == reponse["version_agent"]
    assert reponse["version_prompt"] == VERSION_PROMPT_DIAGNOSTIC
    assert "id_question" in requete["entree"]["reponses"][0]
    assert "id_exercice" not in requete["entree"]["reponses"][0]


def test_produit_exactement_la_requete_diagnostic_de_reference() -> None:
    reference = lire_diagnostic("requete.json")
    requete = RequeteDiagnosticIA.model_validate(reference)
    assert requete.model_dump(mode="json", exclude_none=True) == reference


def test_requete_v2_du_job_docker_reste_identique_a_lexemple_partage() -> None:
    exemple = json.loads((CONTRATS.parent / "diagnostic-evaluer-v2" / "requete.json").read_text(encoding="utf-8"))
    assert script_contrat.requete_positionnement_reference().model_dump(mode="json", exclude_none=True) == exemple


def test_requete_du_job_docker_reste_identique_a_lexemple_partage() -> None:
    """Le job CI n'a pas le montage `contrats/` : sa requête codée en dur doit rester la référence."""
    assert script_contrat.requete_diagnostic_reference().model_dump(mode="json", exclude_none=True) == lire_diagnostic(
        "requete.json"
    )


def test_accepte_la_reponse_diagnostic_du_service_ia() -> None:
    requete = RequeteDiagnosticIA.model_validate(lire_diagnostic("requete.json"))
    enveloppe = ReponseDiagnosticIA.model_validate(lire_diagnostic("reponse.json"))
    assert verifier_reponse_diagnostic(enveloppe, requete)


@pytest.mark.parametrize("nom", INVALIDES_DIAGNOSTIC)
def test_refuse_les_diagnostics_refuses_par_le_service_ia(nom: str) -> None:
    contenu = lire_diagnostic(f"invalides/{nom}")
    if "entree" in contenu:
        with pytest.raises(ValidationError):
            RequeteDiagnosticIA.model_validate(contenu)
        return
    try:
        enveloppe = ReponseDiagnosticIA.model_validate(contenu)
    except ValidationError:
        return
    requete = RequeteDiagnosticIA.model_validate(lire_diagnostic("requete.json"))
    assert not verifier_reponse_diagnostic(enveloppe, requete), f"{nom} est accepté par le backend"
