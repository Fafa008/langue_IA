"""Validation du résultat du diagnostic, des phases Assimil, des points faibles et des preuves."""

import pytest
from pydantic import ValidationError

from app.schemas.contexte import ContexteApprenant
from app.schemas.diagnostic import (
    DiagnosticIncoherent,
    PhaseAssimil,
    PointFaible,
    PreuveReponse,
    ResultatDiagnostic,
    calculer_ecart,
    preuve_directe,
)
from app.schemas.regles import COMPETENCES, COMPETENCES_DESCRIPTEUR_PAR_DOMAINE, DOMAINES_FAIBLESSE
from tests.donnees import CONTEXTE_MINIMAL, RESULTAT_VALIDE


def resultat(**modifications: object) -> ResultatDiagnostic:
    return ResultatDiagnostic.model_validate({**RESULTAT_VALIDE, **modifications})


def test_resultat_diagnostic_valide() -> None:
    donnees = resultat()
    assert donnees.phase_assimil == PhaseAssimil.ACTIVATION
    assert donnees.score_confiance == 0.78
    assert donnees.ecart_avec_niveau_preliminaire == 1
    assert donnees.points_faibles[0].domaine == "expression_ecrite"


def test_resultat_sans_points_faibles_valide() -> None:
    donnees = resultat(points_faibles=[])
    assert donnees.points_faibles == []


def test_phase_assimil_seulement_impregnation_ou_activation() -> None:
    assert resultat(phase_assimil="impregnation").phase_assimil is PhaseAssimil.IMPREGNATION
    assert resultat(phase_assimil="activation").phase_assimil is PhaseAssimil.ACTIVATION
    for valeur in ("passive", "active", "intermediaire"):
        with pytest.raises(ValidationError):
            resultat(phase_assimil=valeur)


def test_points_faibles_sans_doublon_de_domaine() -> None:
    with pytest.raises(ValidationError) as erreur:
        resultat(
            points_faibles=[
                {
                    "domaine": "expression_ecrite",
                    "id_question": "q-1",
                    "observation": "Observation 1.",
                    "justification": "Justification 1.",
                },
                {
                    "domaine": "expression_ecrite",
                    "id_question": "q-2",
                    "observation": "Observation 2.",
                    "justification": "Justification 2.",
                },
            ]
        )
    assert "une fois" in str(erreur.value)


def test_point_faible_normalise_observation_et_justification() -> None:
    point = PointFaible.model_validate(
        {
            "domaine": "expression_orale",
            "id_question": "q-1",
            "observation": "  trop   rapide  ",
            "justification": "  à   confirmer  ",
        }
    )
    assert point.observation == "trop rapide"
    assert point.justification == "à confirmer"


@pytest.mark.parametrize("champ", ["observation", "justification"])
def test_point_faible_refuse_un_texte_vide(champ: str) -> None:
    donnees = {
        "domaine": "expression_orale",
        "id_question": "q-1",
        "observation": "Observation.",
        "justification": "Justification.",
    }
    donnees[champ] = "   "
    with pytest.raises(ValidationError):
        PointFaible.model_validate(donnees)


def test_point_faible_refuse_un_domaine_inconnu() -> None:
    with pytest.raises(ValidationError):
        PointFaible.model_validate(
            {
                "domaine": "prononciation",
                "id_question": "q-1",
                "observation": "Observation.",
                "justification": "Justification.",
            }
        )


def test_point_faible_refuse_un_champ_supplementaire() -> None:
    with pytest.raises(ValidationError):
        PointFaible.model_validate(
            {
                "domaine": "expression_orale",
                "id_question": "q-1",
                "observation": "Observation.",
                "justification": "Justification.",
                "niveau": "B1",
            }
        )


def test_resultat_refuse_un_point_faible_sans_confiance() -> None:
    with pytest.raises(ValidationError) as erreur:
        resultat(score_confiance=0.0)
    assert "sans confiance" in str(erreur.value)


def test_score_confiance_refuse_booleen() -> None:
    with pytest.raises(ValidationError):
        resultat(score_confiance=True)


def test_score_confiance_refuse_chaine() -> None:
    with pytest.raises(ValidationError):
        resultat(score_confiance="0.8")


@pytest.mark.parametrize("score", [-0.01, 1.01])
def test_score_confiance_hors_bornes(score: float) -> None:
    with pytest.raises(ValidationError):
        resultat(score_confiance=score)


def test_resultat_refuse_un_champ_supplementaire() -> None:
    with pytest.raises(ValidationError):
        resultat(cle_inconnue="x")


def test_resultat_refuse_niveau_hors_referentiel() -> None:
    with pytest.raises(ValidationError):
        resultat(niveau_estime="HSK 4")


def test_resultat_mandarin_hsk() -> None:
    donnees = ResultatDiagnostic.model_validate(
        {
            "code_langue": "zh",
            "referentiel": "HSK",
            "niveau_estime": "HSK 4",
            "phase_assimil": "impregnation",
            "points_faibles": [
                {
                    "domaine": "comprehension_ecrite",
                    "id_question": "q-zh-1",
                    "observation": "La réponse indique que le texte n'a pas été compris.",
                    "justification": "Cette observation signale une difficulté de lecture à confirmer.",
                }
            ],
            "score_confiance": 0.65,
            "niveau_preliminaire": "HSK 3",
            "ecart_avec_niveau_preliminaire": 1,
        }
    )
    assert donnees.referentiel == "HSK"


def test_ecart_incoherent_refuse() -> None:
    """L'écart doit correspondre aux indices réels du référentiel."""
    with pytest.raises(ValidationError) as erreur:
        resultat(niveau_estime="B2", ecart_avec_niveau_preliminaire=2)
    assert "ne correspond pas" in str(erreur.value)


@pytest.mark.parametrize("ecart", [1.0, "1", True])
def test_ecart_refuse_un_type_non_entier(ecart: object) -> None:
    with pytest.raises(ValidationError):
        resultat(ecart_avec_niveau_preliminaire=ecart)


@pytest.mark.parametrize("ecart", [-6, 6])
def test_ecart_hors_bornes(ecart: int) -> None:
    with pytest.raises(ValidationError):
        resultat(ecart_avec_niveau_preliminaire=ecart)


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
            "phase_assimil": "impregnation",
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
    donnees_validees = ResultatDiagnostic.model_validate(donnees)
    assert donnees_validees.ecart_avec_niveau_preliminaire == ecart_attendu


def test_verifier_coherence_avec_contexte_ok() -> None:
    contexte = ContexteApprenant.model_validate(CONTEXTE_MINIMAL)
    resultat().verifier_coherence(contexte)  # ne lève pas


def test_verifier_coherence_refuse_langue_differente() -> None:
    contexte = ContexteApprenant.model_validate(CONTEXTE_MINIMAL)
    donnees = resultat(code_langue="fr", referentiel="CECRL")
    with pytest.raises(DiagnosticIncoherent):
        donnees.verifier_coherence(contexte)


def test_verifier_coherence_refuse_niveau_preliminaire_different() -> None:
    contexte = ContexteApprenant.model_validate(CONTEXTE_MINIMAL)
    donnees = resultat(niveau_preliminaire="A2", ecart_avec_niveau_preliminaire=2)
    with pytest.raises(DiagnosticIncoherent):
        donnees.verifier_coherence(contexte)


def test_verifier_coherence_avec_les_reponses_ok() -> None:
    contexte = ContexteApprenant.model_validate(CONTEXTE_MINIMAL)
    preuves = [PreuveReponse(id_question="q-1", competence="ecrit", type_reponse="texte")]
    resultat().verifier_coherence(contexte, preuves)  # ne lève pas


@pytest.mark.parametrize(
    ("domaine", "competence", "type_reponse", "attendu"),
    [
        ("grammaire", "ecrit", "texte", True),
        ("vocabulaire", "oral", "audio", True),
        ("grammaire", "grammaire", "choix", False),
        ("expression_ecrite", "ecrit", "texte", True),
        ("expression_ecrite", "ecrit", "choix", False),
        ("expression_orale", "oral", "audio", True),
        ("expression_orale", "oral", "texte", False),
        ("comprehension_ecrite", "lecture", "texte", True),
        ("comprehension_ecrite", "lecture", "choix", False),
        ("comprehension_orale", "ecoute", "audio", True),
        ("comprehension_orale", "ecoute", "choix", False),
    ],
)
def test_preuve_directe_par_domaine(
    domaine: str,
    competence: str,
    type_reponse: str,
    attendu: bool,
) -> None:
    preuve = PreuveReponse(id_question="q-1", competence=competence, type_reponse=type_reponse)
    assert preuve_directe(domaine, preuve) is attendu


def test_preuve_directe_refuse_un_domaine_inconnu() -> None:
    preuve = PreuveReponse(id_question="q-1", competence="oral", type_reponse="audio")
    assert preuve_directe("prononciation", preuve) is False


def test_chaque_domaine_a_un_descripteur_de_reference() -> None:
    """La table des descripteurs reste alignée sur les domaines autorisés, sans compétence inventée."""
    assert tuple(COMPETENCES_DESCRIPTEUR_PAR_DOMAINE) == DOMAINES_FAIBLESSE
    for competences in COMPETENCES_DESCRIPTEUR_PAR_DOMAINE.values():
        assert set(competences) <= set(COMPETENCES)
        assert competences


@pytest.mark.parametrize(
    ("domaine", "competence", "type_reponse"),
    [
        ("grammaire", "ecrit", "texte"),
        ("vocabulaire", "oral", "audio"),
        ("comprehension_ecrite", "lecture", "texte"),
        ("comprehension_orale", "ecoute", "audio"),
        ("expression_ecrite", "ecrit", "texte"),
        ("expression_orale", "oral", "audio"),
    ],
)
def test_verifier_preuves_accepte_chaque_domaine_demontre(
    domaine: str,
    competence: str,
    type_reponse: str,
) -> None:
    donnees = resultat(
        points_faibles=[
            {
                "domaine": domaine,
                "id_question": "q-1",
                "observation": "Fait directement lisible.",
                "justification": "Interprétation prudente à confirmer.",
            }
        ]
    )
    donnees.verifier_preuves([PreuveReponse(id_question="q-1", competence=competence, type_reponse=type_reponse)])


def test_verifier_preuves_refuse_une_reponse_absente() -> None:
    donnees = resultat()
    with pytest.raises(DiagnosticIncoherent, match="absente"):
        donnees.verifier_preuves([PreuveReponse(id_question="q-2", competence="ecrit", type_reponse="texte")])


def test_verifier_preuves_refuse_une_preuve_indirecte() -> None:
    donnees = resultat()
    with pytest.raises(DiagnosticIncoherent, match="preuve directe"):
        donnees.verifier_preuves([PreuveReponse(id_question="q-1", competence="ecrit", type_reponse="choix")])


def test_verifier_preuves_refuse_des_identifiants_dupliques() -> None:
    donnees = resultat(points_faibles=[])
    preuves = [
        PreuveReponse(id_question="q-1", competence="ecrit", type_reponse="texte"),
        PreuveReponse(id_question="q-1", competence="oral", type_reponse="audio"),
    ]
    with pytest.raises(DiagnosticIncoherent, match="même identifiant"):
        donnees.verifier_preuves(preuves)


def test_verifier_preuves_refuse_l_activation_sans_production() -> None:
    donnees = resultat(points_faibles=[])
    preuves = [PreuveReponse(id_question="q-1", competence="lecture", type_reponse="choix")]
    with pytest.raises(DiagnosticIncoherent, match="activation"):
        donnees.verifier_preuves(preuves)


def test_verifier_preuves_accepte_l_impregnation_avec_des_choix() -> None:
    donnees = resultat(phase_assimil="impregnation", points_faibles=[])
    preuves = [PreuveReponse(id_question="q-1", competence="lecture", type_reponse="choix")]
    donnees.verifier_preuves(preuves)  # ne lève pas


def test_resultat_refuse_un_referentiel_incoherent_avec_la_langue() -> None:
    with pytest.raises(ValidationError) as erreur:
        resultat(code_langue="zh")
    assert "impose le référentiel HSK" in str(erreur.value)


def test_ecart_entre_referentiels_refuse() -> None:
    """On ne compare pas un niveau CECRL à un niveau HSK."""
    with pytest.raises(ValueError):
        calculer_ecart("CECRL", "B1", "HSK 3")
