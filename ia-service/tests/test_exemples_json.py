"""Les exemples JSON livrés sont réellement validés par les modèles (pas seulement documentés)."""

import json
from pathlib import Path

import pytest
from pydantic import BaseModel, ValidationError

from app.agents.diagnostic import EntreeDiagnostic
from app.schemas.commun import ReponseAgent, ReponseErreur, RequeteAgent
from app.schemas.contexte import ContexteApprenant
from app.schemas.diagnostic import ResultatDiagnostic

EXEMPLES = Path(__file__).parent / "exemples"

MODELES_VALIDES: dict[str, type[BaseModel]] = {
    "contexte-apprenant.json": ContexteApprenant,
    "resultat-diagnostic.json": ResultatDiagnostic,
    "requete-diagnostic.json": RequeteAgent[EntreeDiagnostic],
    "reponse-diagnostic.json": ReponseAgent[ResultatDiagnostic],
    "erreur-standard.json": ReponseErreur,
}

# Fichier invalide → (modèle, fragment du message attendu), pour vérifier que l'exemple échoue pour la bonne raison.
MODELES_INVALIDES: dict[str, tuple[type[BaseModel], str]] = {
    "contexte-apprenant-champ-inconnu.json": (ContexteApprenant, "Extra inputs are not permitted"),
    "contexte-apprenant-referentiel-incoherent.json": (ContexteApprenant, "impose le référentiel CECRL"),
    "resultat-diagnostic-ecart-incoherent.json": (ResultatDiagnostic, "ne correspond pas"),
    "resultat-diagnostic-phase-inconnue.json": (ResultatDiagnostic, "passive"),
    "reponse-diagnostic-empreinte-invalide.json": (ReponseAgent[ResultatDiagnostic], "String should match pattern"),
    "erreur-standard-retryable-incoherent.json": (ReponseErreur, "retryable doit valoir false"),
}


def lire(nom: str) -> dict:
    return json.loads((EXEMPLES / "valide" / nom).read_text(encoding="utf-8"))


@pytest.mark.parametrize(("nom", "modele"), MODELES_VALIDES.items())
def test_exemple_valide(nom: str, modele: type[BaseModel]) -> None:
    modele.model_validate(lire(nom))


@pytest.mark.parametrize(("nom", "modele_et_message"), MODELES_INVALIDES.items())
def test_exemple_invalide(nom: str, modele_et_message: tuple[type[BaseModel], str]) -> None:
    modele, fragment = modele_et_message
    contenu = json.loads((EXEMPLES / "invalide" / nom).read_text(encoding="utf-8"))
    with pytest.raises(ValidationError) as erreur:
        modele.model_validate(contenu)
    assert fragment in str(erreur.value)


def test_tous_les_exemples_sont_couverts() -> None:
    """Aucun exemple livré ne doit échapper aux tests."""
    valides = {chemin.name for chemin in (EXEMPLES / "valide").glob("*.json")}
    invalides = {chemin.name for chemin in (EXEMPLES / "invalide").glob("*.json")}
    assert valides == set(MODELES_VALIDES)
    assert invalides == set(MODELES_INVALIDES)
