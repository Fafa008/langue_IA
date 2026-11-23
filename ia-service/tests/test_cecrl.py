"""Tests de la résolution du niveau, de la sélection CECRL et des phases Assimil."""

import asyncio

import pytest

from app.cecrl.assimil import SEUIL_ACTIVATION_TOURS, phase_pour_tours
from app.cecrl.niveau import diagnostic_requis, niveau_effectif, niveau_par_defaut
from app.cecrl.selection import selectionner_descripteurs
from app.core.erreurs import ErreurCorpusIndisponible
from app.prompts.variables import DescripteurRAGPrompt
from app.rag.base import RequeteRAG
from app.rag.vide import RecuperateurVide


def descripteur(identifiant: str) -> DescripteurRAGPrompt:
    return DescripteurRAGPrompt(
        identifiant=identifiant,
        code_langue="en",
        referentiel="CECRL",
        niveau="A1",
        competence="grammaire",
        contenu="Repère de test.",
    )


class RAGFactice:
    nom = "factice"
    version_corpus = "test"

    def __init__(self, resultats: tuple[DescripteurRAGPrompt, ...], erreur: Exception | None = None) -> None:
        self.resultats = resultats
        self.erreur = erreur
        self.requete: RequeteRAG | None = None

    async def rechercher(self, requete: RequeteRAG) -> tuple[DescripteurRAGPrompt, ...]:
        self.requete = requete
        if self.erreur is not None:
            raise self.erreur
        return self.resultats

    async def fermer(self) -> None:
        return None


@pytest.mark.parametrize(
    ("niveau", "confirme", "referentiel", "attendu"),
    [
        ("B1", True, "CECRL", "B1"),
        ("B1", False, "CECRL", "A1"),
        ("HSK 3", True, "HSK", "HSK 3"),
        ("HSK 3", False, "HSK", "HSK 1"),
        ("A1", True, "HSK", "HSK 1"),
    ],
)
def test_niveau_effectif(niveau: str, confirme: bool, referentiel: str, attendu: str) -> None:
    assert niveau_effectif(niveau, confirme=confirme, referentiel=referentiel) == attendu


def test_niveau_par_defaut_et_diagnostic() -> None:
    assert niveau_par_defaut("CECRL") == "A1"
    assert niveau_par_defaut("HSK") == "HSK 1"
    assert diagnostic_requis(False) is True
    assert diagnostic_requis(True) is False


def test_selection_filtre_par_niveau_et_borne() -> None:
    rag = RAGFactice((descripteur("un"), descripteur("deux")))

    resultat = asyncio.run(
        selectionner_descripteurs(
            rag,
            code_langue="en",
            referentiel="CECRL",
            niveau="A1",
            limite=1,
        )
    )

    assert [descripteur_.identifiant for descripteur_ in resultat] == ["un"]
    assert rag.requete is not None
    assert rag.requete.niveau == "A1"
    assert rag.requete.competences == ("grammaire",)


def test_selection_repli_sur_descripteur_synthetique() -> None:
    resultat = asyncio.run(
        selectionner_descripteurs(
            RecuperateurVide(),
            code_langue="en",
            referentiel="CECRL",
            niveau="A1",
        )
    )

    assert len(resultat) == 1
    assert resultat[0].identifiant.startswith("synthetique_fallback:")


def test_selection_repli_quand_corpus_indisponible() -> None:
    rag = RAGFactice((), erreur=ErreurCorpusIndisponible("corpus absent"))

    resultat = asyncio.run(
        selectionner_descripteurs(
            rag,
            code_langue="en",
            referentiel="CECRL",
            niveau="A1",
        )
    )

    assert resultat and resultat[0].niveau == "A1"


@pytest.mark.parametrize(
    ("nombre_tours", "attendu"),
    [(0, "impregnation"), (SEUIL_ACTIVATION_TOURS - 1, "impregnation"), (SEUIL_ACTIVATION_TOURS, "activation")],
)
def test_phase_assimil_par_tours(nombre_tours: int, attendu: str) -> None:
    assert phase_pour_tours(nombre_tours) == attendu


def test_phase_explicite_prend_le_pas_sur_le_compteur() -> None:
    assert phase_pour_tours(0, "activation") == "activation"
