"""Validation du résultat du diagnostic, des phases Assimil et de l'intégrité avec le contexte."""

import pytest
from pydantic import ValidationError

from app.schemas.contexte import ContexteApprenant
from app.schemas.diagnostic import (
    DiagnosticIncoherent,
    PhaseAssimil,
    PointFaible,
    ResultatDiagnostic,
    calculer_ecart,
)
from tests.donnees import CONTEXTE_MINIMAL, RESULTAT_VALIDE


def test_resultat_diagnostic_valide() -> None:
    resultat = ResultatDiagnostic.model_validate(RESULTAT_VALIDE)
    assert resultat.phase_assimil == PhaseAssimil.ACTIVE
    assert resultat.score_confiance == 0.78
    assert resultat.ecart_avec_niveau_preliminaire == 1


def test_resultat_sans_points_faibles_valide() -> None:
    resultat = ResultatDiagnostic.model_validate({**RESULTAT_VALIDE, "points_faibles": []})
    assert resultat.points_faibles == []


def test_phase_assimil_seulement_passive_ou_active() -> None:
    ResultatDiagnostic.model_validate({**RESULTAT_VALIDE, "phase_assimil": "passive"})
    with pytest.raises(ValidationError):
        ResultatDiagnostic.model_validate({**RESULTAT_VALIDE, "phase_assimil": "intermediaire"})


def test_points_faibles_sans_doublon() -> None:
    with pytest.raises(ValidationError) as erreur:
        ResultatDiagnostic.model_validate(
            {
                **RESULTAT_VALIDE,
                "points_faibles": [
                    {"competence": "ecrit", "description": "Problème 1"},
                    {"competence": "ecrit", "description": "Problème 2"},
                ],
            }
        )
    assert "une fois" in str(erreur.value)


def test_point_faible_description_normalisee() -> None:
    point = PointFaible.model_validate({"competence": "oral", "description": "  trop   rapide  "})
    assert point.description == "trop rapide"


def test_point_faible_refuse_description_vide() -> None:
    with pytest.raises(ValidationError):
        PointFaible.model_validate({"competence": "oral", "description": "   "})


def test_score_confiance_refuse_booleen() -> None:
    with pytest.raises(ValidationError):
        ResultatDiagnostic.model_validate({**RESULTAT_VALIDE, "score_confiance": True})


def test_score_confiance_refuse_chaine() -> None:
    with pytest.raises(ValidationError):
        ResultatDiagnostic.model_validate({**RESULTAT_VALIDE, "score_confiance": "0.8"})


@pytest.mark.parametrize("score", [-0.01, 1.01])
def test_score_confiance_hors_bornes(score: float) -> None:
    with pytest.raises(ValidationError):
        ResultatDiagnostic.model_validate({**RESULTAT_VALIDE, "score_confiance": score})


def test_resultat_refuse_un_champ_supplementaire() -> None:
    with pytest.raises(ValidationError):
        ResultatDiagnostic.model_validate({**RESULTAT_VALIDE, "cle_inconnue": "x"})


def test_resultat_refuse_niveau_hors_referentiel() -> None:
    with pytest.raises(ValidationError):
        ResultatDiagnostic.model_validate({**RESULTAT_VALIDE, "niveau_estime": "HSK 4"})


def test_resultat_mandarin_hsk() -> None:
    resultat = ResultatDiagnostic.model_validate(
        {
            "code_langue": "zh",
            "referentiel": "HSK",
            "niveau_estime": "HSK 4",
            "phase_assimil": "passive",
            "points_faibles": [{"competence": "lecture", "description": "Caractères peu familiers."}],
            "score_confiance": 0.65,
            "niveau_preliminaire": "HSK 3",
            "ecart_avec_niveau_preliminaire": 1,
        }
    )
    assert resultat.referentiel == "HSK"


def test_ecart_incoherent_refuse() -> None:
    """L'écart doit correspondre aux indices réels du référentiel."""
    with pytest.raises(ValidationError) as erreur:
        ResultatDiagnostic.model_validate(
            {**RESULTAT_VALIDE, "niveau_estime": "B2", "ecart_avec_niveau_preliminaire": 2}
        )
    assert "ne correspond pas" in str(erreur.value)


@pytest.mark.parametrize("ecart", [1.0, "1", True])
def test_ecart_refuse_un_type_non_entier(ecart: object) -> None:
    with pytest.raises(ValidationError):
        ResultatDiagnostic.model_validate({**RESULTAT_VALIDE, "ecart_avec_niveau_preliminaire": ecart})


@pytest.mark.parametrize("ecart", [-6, 6])
def test_ecart_hors_bornes(ecart: int) -> None:
    with pytest.raises(ValidationError):
        ResultatDiagnostic.model_validate({**RESULTAT_VALIDE, "ecart_avec_niveau_preliminaire": ecart})


@pytest.mark.parametrize(
    ("niveau_preliminaire", "niveau_estime", "ecart_attendu"),
    [
        ("A1", "A2", 1),
        ("C2", "B1", -3),
        ("HSK 1", "HSK 1", 0),
    ],
)
def test_ecart_calcule_correctement(niveau_preliminaire: str, niveau_estime: str, ecart_attendu: int) -> None:
    if niveau_estime.startswith("HSK"):
        donnees = {
            "code_langue": "zh",
            "referentiel": "HSK",
            "niveau_estime": niveau_estime,
            "phase_assimil": "passive",
            "points_faibles": [],
            "score_confiance": 0.5,
            "niveau_preliminaire": niveau_preliminaire,
            "ecart_avec_niveau_preliminaire": ecart_attendu,
        }
    else:
        donnees = {
            **RESULTAT_VALIDE,
            "niveau_estime": niveau_estime,
            "niveau_preliminaire": niveau_preliminaire,
            "ecart_avec_niveau_preliminaire": ecart_attendu,
        }
    resultat = ResultatDiagnostic.model_validate(donnees)
    assert resultat.ecart_avec_niveau_preliminaire == ecart_attendu


def test_verifier_coherence_avec_contexte_ok() -> None:
    contexte = ContexteApprenant.model_validate(CONTEXTE_MINIMAL)
    resultat = ResultatDiagnostic.model_validate(RESULTAT_VALIDE)
    resultat.verifier_coherence(contexte)  # ne lève pas


def test_verifier_coherence_refuse_langue_differente() -> None:
    contexte = ContexteApprenant.model_validate(CONTEXTE_MINIMAL)
    resultat = ResultatDiagnostic.model_validate({**RESULTAT_VALIDE, "code_langue": "fr", "referentiel": "CECRL"})
    with pytest.raises(DiagnosticIncoherent):
        resultat.verifier_coherence(contexte)


def test_verifier_coherence_refuse_niveau_preliminaire_different() -> None:
    contexte = ContexteApprenant.model_validate(CONTEXTE_MINIMAL)
    resultat = ResultatDiagnostic.model_validate(
        {**RESULTAT_VALIDE, "niveau_preliminaire": "A2", "ecart_avec_niveau_preliminaire": 2}
    )
    with pytest.raises(DiagnosticIncoherent):
        resultat.verifier_coherence(contexte)


def test_resultat_refuse_un_referentiel_incoherent_avec_la_langue() -> None:
    with pytest.raises(ValidationError) as erreur:
        ResultatDiagnostic.model_validate({**RESULTAT_VALIDE, "code_langue": "zh"})
    assert "impose le référentiel HSK" in str(erreur.value)


def test_ecart_entre_referentiels_refuse() -> None:
    """On ne compare pas un niveau CECRL à un niveau HSK."""
    with pytest.raises(ValueError):
        calculer_ecart("CECRL", "B1", "HSK 3")
