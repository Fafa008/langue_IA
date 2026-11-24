"""Contrat diagnostic v2 du service IA : exemples partagés, statut STT et démonstration sans clé."""

import asyncio
import json
from pathlib import Path
from uuid import UUID

import pytest
from pydantic import ValidationError

from app.agents.diagnostic import (
    VERSION_AGENT_POSITIONNEMENT,
    EntreeDiagnosticPositionnement,
    construire_definition_positionnement,
)
from app.harness.execution import Harness
from app.harness.registre import RegistreAgents
from app.llm.adaptateurs.factice import FakeLLMClient, ScenarioLLM
from app.llm.demonstration import repondre_demonstration
from app.prompts import RegistrePrompts
from app.prompts.registre import VERSION_EVALUATION_POSITIONNEMENT
from app.prompts.variables import preuves_depuis_reponses
from app.rag import RecuperateurVide
from app.schemas.commun import ReponseAgent, RequeteAgent
from app.schemas.diagnostic import (
    DiagnosticIncoherent,
    ResultatDiagnosticPositionnement,
    statut_positionnement,
)

CONTRATS = Path(__file__).resolve().parents[2] / "contrats" / "ia" / "diagnostic-evaluer-v2"
INVALIDES = sorted(p.name for p in (CONTRATS / "invalides").glob("*.json"))
REQUEST_ID = UUID("9c25e67a-13bd-4f80-a6c1-7b2d3e4f5a6b")

RESULTAT_V2 = {
    "code_langue": "en",
    "referentiel": "CECRL",
    "niveau_estime": "B1",
    "phase_assimil": "activation",
    "points_faibles": [],
    "score_confiance": 0.6,
    "niveau_preliminaire": "B1",
    "ecart_avec_niveau_preliminaire": 0,
    "justification": "Les faits transmis montrent une production écrite correcte.",
    "statut": "succes",
}


def lire(nom: str) -> dict:
    chemin = CONTRATS / nom
    if not chemin.is_file():
        pytest.fail(f"Exemple de contrat introuvable : {chemin} (dossier contrats/ monté ?)")
    return json.loads(chemin.read_text(encoding="utf-8"))


def harness(reponse: dict | None = None, *, demonstration: bool = False) -> Harness:
    registre_prompts = RegistrePrompts()
    registre = RegistreAgents()
    registre.enregistrer(construire_definition_positionnement(registre_prompts))
    client = FakeLLMClient(
        [ScenarioLLM(reponse=reponse or RESULTAT_V2)] if not demonstration else (),
        repondeur=repondre_demonstration if demonstration else None,
    )
    return Harness(registre, client, registre_prompts=registre_prompts, recuperateur_rag=RecuperateurVide())


def test_versions_du_contrat_v2_sont_geles() -> None:
    requete = lire("requete.json")
    reponse = lire("reponse.json")
    assert requete["version_agent"] == VERSION_AGENT_POSITIONNEMENT == reponse["version_agent"]
    assert reponse["version_prompt"] == f"diagnostic/evaluation@{VERSION_EVALUATION_POSITIONNEMENT}"


def test_accepte_la_requete_du_backend() -> None:
    requete = RequeteAgent[EntreeDiagnosticPositionnement].model_validate(lire("requete.json"))
    assert requete.request_id == REQUEST_ID
    assert [preuve.id_question for preuve in requete.entree.reponses] == ["ex-12", "ex-18"]
    assert requete.entree.reponses[1].confiance_stt == 0.82


def test_peut_produire_la_reponse_attendue_par_le_backend() -> None:
    requete = RequeteAgent[EntreeDiagnosticPositionnement].model_validate(lire("requete.json"))
    enveloppe = ReponseAgent[ResultatDiagnosticPositionnement].model_validate(lire("reponse.json"))
    enveloppe.resultat.verifier_coherence(requete.contexte, preuves_depuis_reponses(requete.entree.reponses))


@pytest.mark.parametrize("nom", INVALIDES)
def test_refuse_les_exemples_invalides(nom: str) -> None:
    contenu = lire(f"invalides/{nom}")
    if "entree" in contenu:
        with pytest.raises(ValidationError):
            RequeteAgent[EntreeDiagnosticPositionnement].model_validate(contenu)
        return
    requete = RequeteAgent[EntreeDiagnosticPositionnement].model_validate(lire("requete.json"))
    with pytest.raises((ValidationError, DiagnosticIncoherent)):
        enveloppe = ReponseAgent[ResultatDiagnosticPositionnement].model_validate(contenu)
        enveloppe.resultat.verifier_coherence(requete.contexte, preuves_depuis_reponses(requete.entree.reponses))


def test_statut_a_verifier_sous_le_seuil_stt() -> None:
    assert statut_positionnement([0.82, None]) == "succes"
    assert statut_positionnement([0.82, 0.69]) == "a_verifier"

    requete = RequeteAgent[EntreeDiagnosticPositionnement].model_validate(lire("requete.json"))
    requete.entree.reponses[1].confiance_stt = 0.4
    reponse = asyncio.run(harness().executer("diagnostic", requete, version_agent=VERSION_AGENT_POSITIONNEMENT))
    assert isinstance(reponse, ReponseAgent)
    assert reponse.version_agent == VERSION_AGENT_POSITIONNEMENT
    assert reponse.version_prompt == f"diagnostic/evaluation@{VERSION_EVALUATION_POSITIONNEMENT}"
    assert reponse.resultat.statut == "a_verifier"


def test_demonstration_sans_cle_est_deterministe_et_ne_donne_pas_de_score() -> None:
    requete = RequeteAgent[EntreeDiagnosticPositionnement].model_validate(lire("requete.json"))
    premiere = asyncio.run(
        harness(demonstration=True).executer("diagnostic", requete, version_agent=VERSION_AGENT_POSITIONNEMENT)
    )
    seconde = asyncio.run(
        harness(demonstration=True).executer("diagnostic", requete, version_agent=VERSION_AGENT_POSITIONNEMENT)
    )
    assert premiere.resultat.model_dump(mode="json") == seconde.resultat.model_dump(mode="json")
    assert premiere.resultat.statut == "succes"
    assert premiere.resultat.justification
    assert "score" not in premiere.resultat.model_dump(mode="json")
