"""Validation du contexte apprenant et de la mémoire pédagogique."""

import pytest
from pydantic import ValidationError

from app.schemas.contexte import ContexteApprenant, MemoirePedagogique

CONTEXTE_MINIMAL = {
    "code_langue": "en",
    "referentiel": "CECRL",
    "niveau_preliminaire": "B1",
}


def test_contexte_minimal_accepte() -> None:
    contexte = ContexteApprenant.model_validate(CONTEXTE_MINIMAL)
    assert contexte.code_langue == "en"
    assert contexte.memoire_pedagogique is None


def test_contexte_mandarin_utilise_hsk() -> None:
    contexte = ContexteApprenant.model_validate(
        {"code_langue": "zh", "referentiel": "HSK", "niveau_preliminaire": "HSK 3"}
    )
    assert contexte.referentiel == "HSK"


def test_contexte_avec_memoire_pedagogique() -> None:
    contexte = ContexteApprenant.model_validate(
        {
            **CONTEXTE_MINIMAL,
            "memoire_pedagogique": {
                "resume": "Deux sessions de conversation, bonnes bases lexicales.",
                "points_forts": ["aisance à l'oral"],
                "points_faibles": ["emploi des temps"],
                "nb_activites": 12,
            },
        }
    )
    assert contexte.memoire_pedagogique is not None
    assert contexte.memoire_pedagogique.nb_activites == 12


def test_contexte_refuse_un_champ_supplementaire() -> None:
    with pytest.raises(ValidationError) as erreur:
        ContexteApprenant.model_validate({**CONTEXTE_MINIMAL, "id_apprenant": 42})
    assert "extra_forbidden" in str(erreur.value)


def test_contexte_refuse_un_champ_supplementaire_dans_la_memoire() -> None:
    with pytest.raises(ValidationError):
        ContexteApprenant.model_validate(
            {
                **CONTEXTE_MINIMAL,
                "memoire_pedagogique": {"resume": "Résumé.", "email": "apprenant@digitheque.mg"},
            }
        )


def test_referentiel_impose_par_la_langue() -> None:
    with pytest.raises(ValidationError) as erreur:
        ContexteApprenant.model_validate({**CONTEXTE_MINIMAL, "referentiel": "HSK"})
    assert "impose le référentiel CECRL" in str(erreur.value)


def test_mandarin_refuse_le_cecrl() -> None:
    with pytest.raises(ValidationError):
        ContexteApprenant.model_validate({"code_langue": "zh", "referentiel": "CECRL", "niveau_preliminaire": "B1"})


def test_niveau_hors_referentiel_refuse() -> None:
    with pytest.raises(ValidationError) as erreur:
        ContexteApprenant.model_validate({**CONTEXTE_MINIMAL, "niveau_preliminaire": "HSK 2"})
    assert "n'appartient pas au référentiel CECRL" in str(erreur.value)


@pytest.mark.parametrize("niveau", ["A0", "C3", "hsk 3", "", "B1 "])
def test_niveau_inconnu_refuse(niveau: str) -> None:
    """Aucun niveau n'est inventé : seuls les codes du référentiel sont acceptés."""
    with pytest.raises(ValidationError):
        ContexteApprenant.model_validate({**CONTEXTE_MINIMAL, "niveau_preliminaire": niveau})


def test_langue_inconnue_refusee() -> None:
    with pytest.raises(ValidationError):
        ContexteApprenant.model_validate({**CONTEXTE_MINIMAL, "code_langue": "es"})


def test_memoire_resume_vide_refuse() -> None:
    with pytest.raises(ValidationError):
        MemoirePedagogique.model_validate({"resume": "   "})


def test_memoire_resume_trop_long_refuse() -> None:
    with pytest.raises(ValidationError):
        MemoirePedagogique.model_validate({"resume": "a" * 2001})


def test_memoire_limite_a_cinq_points() -> None:
    with pytest.raises(ValidationError):
        MemoirePedagogique.model_validate({"resume": "Résumé.", "points_forts": ["a", "b", "c", "d", "e", "f"]})


def test_memoire_refuse_un_doublon_insensible_a_la_casse() -> None:
    with pytest.raises(ValidationError) as erreur:
        MemoirePedagogique.model_validate({"resume": "Résumé.", "points_faibles": ["Temps", "temps"]})
    assert "présent deux fois" in str(erreur.value)


def test_memoire_refuse_un_point_vide() -> None:
    with pytest.raises(ValidationError):
        MemoirePedagogique.model_validate({"resume": "Résumé.", "points_forts": ["  "]})


def test_memoire_refuse_un_point_trop_long() -> None:
    with pytest.raises(ValidationError):
        MemoirePedagogique.model_validate({"resume": "Résumé.", "points_forts": ["a" * 121]})


def test_memoire_normalise_les_espaces() -> None:
    memoire = MemoirePedagogique.model_validate({"resume": "  Résumé.  ", "points_forts": ["  aisance   orale "]})
    assert memoire.resume == "Résumé."
    assert memoire.points_forts == ["aisance orale"]


def test_memoire_refuse_un_point_a_la_fois_fort_et_faible() -> None:
    with pytest.raises(ValidationError) as erreur:
        MemoirePedagogique.model_validate(
            {"resume": "Résumé.", "points_forts": ["Fluidité"], "points_faibles": ["fluidité"]}
        )
    assert "à la fois" in str(erreur.value)


def test_memoire_refuse_un_nombre_d_activites_negatif() -> None:
    with pytest.raises(ValidationError):
        MemoirePedagogique.model_validate({"resume": "Résumé.", "nb_activites": -1})


@pytest.mark.parametrize("valeur", [True, "12", 12.5])
def test_memoire_refuse_un_nombre_d_activites_non_entier(valeur: object) -> None:
    """Le type est strict : ni booléen, ni chaîne, ni décimal."""
    with pytest.raises(ValidationError):
        MemoirePedagogique.model_validate({"resume": "Résumé.", "nb_activites": valeur})
