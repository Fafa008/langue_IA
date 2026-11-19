"""Test de contrat côté service IA (US157-QA) : exemples partagés avec le backend (``contrats/ia/``).

Le backend redéfinit le contrat de son côté ; ces exemples sont la référence commune. Ici, on vérifie que le
service IA accepte les requêtes que le backend produit, qu'il peut produire les réponses que le backend accepte, et
qu'il refuse les réponses que le backend refuse.
"""

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.schemas.commun import ReponseAgent, RequeteAgent
from app.schemas.correction import CorrectionIncoherente, EntreeCorrection, ResultatCorrection

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
