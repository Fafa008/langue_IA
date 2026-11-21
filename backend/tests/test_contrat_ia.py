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
    ReponseCorrectionIA,
    ReponseRecommandationIA,
    RequeteCorrectionIA,
    RequeteRecommandationIA,
)
from app.services.correction_exercice import verifier_feedback
from app.services.recommandation import verifier_recommandation

# En CI : <dépôt>/contrats ; dans le conteneur de développement : /contrats, monté en lecture seule.
CONTRATS = Path(__file__).resolve().parents[2] / "contrats" / "ia" / "correction-reponse-libre"
CONTRATS_RECOMMANDATION = Path(__file__).resolve().parents[2] / "contrats" / "ia" / "recommandation-parcours"


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
