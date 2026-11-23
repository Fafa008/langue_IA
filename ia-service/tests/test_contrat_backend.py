"""Test de contrat côté service IA (US157-QA) : exemples partagés avec le backend (``contrats/ia/``).

Le backend redéfinit le contrat de son côté ; ces exemples sont la référence commune. Ici, on vérifie que le
service IA accepte les requêtes que le backend produit, qu'il peut produire les réponses que le backend accepte, et
qu'il refuse les réponses que le backend refuse.
"""

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.agents.diagnostic import VERSION_AGENT, EntreeDiagnostic
from app.prompts.registre import VERSION_EVALUATION_DIAGNOSTIC
from app.prompts.variables import preuves_depuis_reponses
from app.schemas.commun import ReponseAgent, RequeteAgent
from app.schemas.correction import CorrectionIncoherente, EntreeCorrection, ResultatCorrection
from app.schemas.diagnostic import DiagnosticIncoherent, ResultatDiagnostic

# En CI : <dépôt>/contrats ; dans le conteneur de développement : /contrats, monté en lecture seule.
CONTRATS = Path(__file__).resolve().parents[2] / "contrats" / "ia" / "correction-reponse-libre"


def lire(nom: str) -> dict:
    chemin = CONTRATS / nom
    if not chemin.is_file():
        pytest.fail(f"Exemple de contrat introuvable : {chemin} (dossier contrats/ monté ?)")
    return json.loads(chemin.read_text(encoding="utf-8"))


INVALIDES = sorted(p.name for p in (CONTRATS / "invalides").glob("*.json"))


def test_les_exemples_partages_sont_presents() -> None:
    assert len(INVALIDES) >= 5, f"Exemples invalides introuvables dans {CONTRATS}"


@pytest.mark.parametrize("nom", ["requete-passive.json", "requete-active.json"])
def test_accepte_la_requete_du_backend(nom: str) -> None:
    requete = RequeteAgent[EntreeCorrection].model_validate(lire(nom))
    assert requete.contexte.lecon_atteinte is not None


@pytest.mark.parametrize(
    ("requete", "reponse"), [("requete-passive", "reponse-passive"), ("requete-active", "reponse-active")]
)
def test_peut_produire_la_reponse_attendue_par_le_backend(requete: str, reponse: str) -> None:
    entree = lire(f"{requete}.json")
    enveloppe = ReponseAgent[ResultatCorrection].model_validate(lire(f"{reponse}.json"))
    enveloppe.resultat.verifier_coherence(entree["contexte"]["lecon_atteinte"], entree["entree"]["reponse"])


@pytest.mark.parametrize("nom", INVALIDES)
def test_refuse_ce_que_le_backend_refuse(nom: str) -> None:
    entree = lire("requete-passive.json")
    with pytest.raises((ValidationError, CorrectionIncoherente)):
        enveloppe = ReponseAgent[ResultatCorrection].model_validate(lire(f"invalides/{nom}"))
        enveloppe.resultat.verifier_coherence(entree["contexte"]["lecon_atteinte"], entree["entree"]["reponse"])


# --- US-N02 : contrat partagé de l'évaluation diagnostic ---

CONTRATS_DIAGNOSTIC = Path(__file__).resolve().parents[2] / "contrats" / "ia" / "diagnostic-evaluer"
INVALIDES_DIAGNOSTIC = sorted(p.name for p in (CONTRATS_DIAGNOSTIC / "invalides").glob("*.json"))


def lire_diagnostic(nom: str) -> dict:
    chemin = CONTRATS_DIAGNOSTIC / nom
    if not chemin.is_file():
        pytest.fail(f"Exemple de contrat introuvable : {chemin} (dossier contrats/ monté ?)")
    return json.loads(chemin.read_text(encoding="utf-8"))


def test_les_exemples_diagnostic_sont_presents() -> None:
    assert len(INVALIDES_DIAGNOSTIC) >= 5, f"Exemples invalides introuvables dans {CONTRATS_DIAGNOSTIC}"


def test_versions_et_identifiant_du_contrat_diagnostic_sont_geles() -> None:
    """T2 : `id_question` reste le nom exposé ; agent et prompt sont ceux déclarés par le service IA."""
    requete = lire_diagnostic("requete.json")
    reponse = lire_diagnostic("reponse.json")
    assert requete["version_agent"] == VERSION_AGENT == reponse["version_agent"]
    assert reponse["version_prompt"] == f"diagnostic/evaluation@{VERSION_EVALUATION_DIAGNOSTIC}"
    assert "id_question" in requete["entree"]["reponses"][0]
    assert "id_exercice" not in requete["entree"]["reponses"][0]


def test_accepte_la_requete_diagnostic_du_backend() -> None:
    requete = RequeteAgent[EntreeDiagnostic].model_validate(lire_diagnostic("requete.json"))
    assert requete.contexte.niveau_preliminaire == "B1"
    assert [preuve.id_question for preuve in requete.entree.reponses] == ["ex-12", "ex-18"]


def test_peut_produire_la_reponse_diagnostic_attendue_par_le_backend() -> None:
    requete = RequeteAgent[EntreeDiagnostic].model_validate(lire_diagnostic("requete.json"))
    enveloppe = ReponseAgent[ResultatDiagnostic].model_validate(lire_diagnostic("reponse.json"))
    enveloppe.resultat.verifier_coherence(requete.contexte, preuves_depuis_reponses(requete.entree.reponses))


@pytest.mark.parametrize("nom", INVALIDES_DIAGNOSTIC)
def test_refuse_les_diagnostics_refuses_par_le_backend(nom: str) -> None:
    contenu = lire_diagnostic(f"invalides/{nom}")
    if "entree" in contenu:
        with pytest.raises(ValidationError):
            RequeteAgent[EntreeDiagnostic].model_validate(contenu)
        return
    requete = RequeteAgent[EntreeDiagnostic].model_validate(lire_diagnostic("requete.json"))
    with pytest.raises((ValidationError, DiagnosticIncoherent)):
        enveloppe = ReponseAgent[ResultatDiagnostic].model_validate(contenu)
        enveloppe.resultat.verifier_coherence(requete.contexte, preuves_depuis_reponses(requete.entree.reponses))
