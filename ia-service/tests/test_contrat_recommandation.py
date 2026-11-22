"""Test de contrat côté service IA (REC-00) : exemples partagés avec le backend (``contrats/ia/``).

Le backend redéfinit le contrat de son côté ; ces exemples sont la référence commune. Ici, on vérifie que le
service IA accepte la requête que le backend produit, peut produire la réponse qu'il accepte, et refuse les
réponses que le backend refuse.
"""

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.schemas.commun import ReponseAgent, RequeteAgent
from app.schemas.recommandation import EntreeRecommandation, RecommandationIncoherente, ResultatRecommandation

CONTRATS = Path(__file__).resolve().parents[2] / "contrats" / "ia" / "recommandation-parcours"
INVALIDES = sorted(p.name for p in (CONTRATS / "invalides").glob("*.json"))


def lire(nom: str) -> dict:
    chemin = CONTRATS / nom
    if not chemin.is_file():
        pytest.fail(f"Exemple de contrat introuvable : {chemin} (dossier contrats/ monté ?)")
    return json.loads(chemin.read_text(encoding="utf-8"))


def test_les_exemples_partages_sont_presents() -> None:
    assert len(INVALIDES) >= 5, f"Exemples invalides introuvables dans {CONTRATS}"


def test_accepte_la_requete_du_backend() -> None:
    requete = RequeteAgent[EntreeRecommandation].model_validate(lire("requete.json"))
    assert requete.entree.niveau_vise == "B2"


def test_peut_produire_la_reponse_attendue_par_le_backend() -> None:
    requete = RequeteAgent[EntreeRecommandation].model_validate(lire("requete.json"))
    enveloppe = ReponseAgent[ResultatRecommandation].model_validate(lire("reponse.json"))
    enveloppe.resultat.verifier_coherence(requete.entree, requete.contexte)


@pytest.mark.parametrize("nom", INVALIDES)
def test_refuse_ce_que_le_backend_refuse(nom: str) -> None:
    requete = RequeteAgent[EntreeRecommandation].model_validate(lire("requete.json"))
    with pytest.raises((ValidationError, RecommandationIncoherente)):
        enveloppe = ReponseAgent[ResultatRecommandation].model_validate(lire(f"invalides/{nom}"))
        enveloppe.resultat.verifier_coherence(requete.entree, requete.contexte)
