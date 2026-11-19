"""Test de contrat côté backend (US157-QA) : exemples partagés avec le service IA (``contrats/ia/``).

Le backend redéfinit volontairement le contrat du service IA (``app/schemas/ia.py``) ; ces exemples sont la
référence commune. Ici, on vérifie que le backend produit exactement les requêtes de référence, qu'il accepte les
réponses que le service IA peut produire, et qu'il refuse celles que le service IA refuse.
"""

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.schemas.ia import ReponseCorrectionIA, RequeteCorrectionIA
from app.services.correction_exercice import verifier_feedback

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
