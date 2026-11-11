"""Tests du récupérateur lexical local : filtres, classement, déterminisme et projections."""

from __future__ import annotations

import asyncio
from pathlib import Path

from app.rag.base import RequeteRAG
from app.rag.corpus import CorpusCecrl
from app.rag.local import RecuperateurLocal, jetons
from tests.donnees_corpus import corpus_synthetique, ecrire


def _recuperateur(dossier: Path) -> RecuperateurLocal:
    """Corpus synthétique chargé puis indexé."""
    ecrire(dossier, corpus_synthetique())
    return RecuperateurLocal(CorpusCecrl.charger(dossier))


def _rechercher(recuperateur: RecuperateurLocal, requete: RequeteRAG):
    """Exécuter une recherche asynchrone sans plugin pytest-asyncio."""
    return asyncio.run(recuperateur.rechercher(requete))


def test_jetons_sans_accents_ni_mots_vides() -> None:
    assert jetons("Le voyage en détail avec des amis") == ("voyage", "detail", "amis")
    assert jetons("... !!!") == ()
    assert jetons("a b c") == ()


def test_classement_par_pertinence_lexicale(tmp_path: Path) -> None:
    recuperateur = _recuperateur(tmp_path)

    resultats = _rechercher(
        recuperateur,
        RequeteRAG(
            code_langue="en",
            referentiel="CECRL",
            niveau="B1",
            competences=("ecrit", "lecture"),
            texte="write a short email",
        ),
    )

    assert resultats
    assert resultats[0].identifiant == "cecrl:en:2020:0013"
    assert resultats[0].contenu.startswith("Can write a short email")


def test_filtre_par_langue(tmp_path: Path) -> None:
    recuperateur = _recuperateur(tmp_path)

    resultats = _rechercher(
        recuperateur,
        RequeteRAG(code_langue="fr", referentiel="CECRL", niveau="B2", competences=("oral",), texte="voyage"),
    )

    assert [resultat.identifiant for resultat in resultats] == ["cecrl:fr:2020:0018"]
    assert resultats[0].code_langue == "fr"


def test_une_langue_sans_descripteur_retourne_une_sequence_vide(tmp_path: Path) -> None:
    recuperateur = _recuperateur(tmp_path)

    resultats = _rechercher(
        recuperateur,
        RequeteRAG(code_langue="en", referentiel="CECRL", niveau="B2", competences=("oral",), texte="voyage"),
    )

    assert resultats == ()


def test_mandarin_sans_descripteur_cecrl_retourne_une_sequence_vide(tmp_path: Path) -> None:
    recuperateur = _recuperateur(tmp_path)

    resultats = _rechercher(
        recuperateur,
        RequeteRAG(
            code_langue="zh",
            referentiel="HSK",
            niveau="HSK 2",
            competences=("oral",),
            texte="parler de ses vacances",
        ),
    )

    assert resultats == ()


def test_referentiel_non_cecrl_est_ignore_meme_avec_un_corpus(tmp_path: Path) -> None:
    recuperateur = _recuperateur(tmp_path)
    requete = RequeteRAG.model_construct(
        code_langue="en",
        referentiel="HSK",
        niveau="B1",
        competences=("oral",),
        texte="holidays",
        limite=8,
    )

    assert _rechercher(recuperateur, requete) == ()


def test_filtre_par_niveau(tmp_path: Path) -> None:
    recuperateur = _recuperateur(tmp_path)

    resultats = _rechercher(
        recuperateur,
        RequeteRAG(code_langue="en", referentiel="CECRL", niveau="A2", competences=("oral",), texte="greet"),
    )

    assert [resultat.identifiant for resultat in resultats] == ["cecrl:en:2020:0016"]


def test_filtre_par_competence(tmp_path: Path) -> None:
    recuperateur = _recuperateur(tmp_path)

    vide = _rechercher(
        recuperateur,
        RequeteRAG(code_langue="en", referentiel="CECRL", niveau="B1", competences=("oral",), texte="past tense"),
    )
    resultats = _rechercher(
        recuperateur,
        RequeteRAG(code_langue="en", referentiel="CECRL", niveau="B1", competences=("grammaire",), texte="past tense"),
    )

    assert vide == ()
    assert [resultat.identifiant for resultat in resultats] == ["cecrl:en:2020:0014"]


def test_echelle_lexicale_transverse_projetee_sur_la_competence_demandee(tmp_path: Path) -> None:
    recuperateur = _recuperateur(tmp_path)

    lecture = _rechercher(
        recuperateur,
        RequeteRAG(
            code_langue="en",
            referentiel="CECRL",
            niveau="B1",
            competences=("lecture",),
            texte="vocabulary holidays",
        ),
    )
    ecrit = _rechercher(
        recuperateur,
        RequeteRAG(
            code_langue="en",
            referentiel="CECRL",
            niveau="B1",
            competences=("ecrit",),
            texte="vocabulary holidays",
        ),
    )
    grammaire = _rechercher(
        recuperateur,
        RequeteRAG(
            code_langue="en",
            referentiel="CECRL",
            niveau="B1",
            competences=("grammaire",),
            texte="vocabulary holidays",
        ),
    )

    lexicaux = [resultat for resultat in lecture if resultat.identifiant == "cecrl:en:2020:0015"]
    assert lexicaux
    assert lexicaux[0].competence == "lecture"
    assert [resultat.competence for resultat in ecrit if resultat.identifiant == "cecrl:en:2020:0015"] == ["ecrit"]
    assert [resultat.competence for resultat in grammaire if resultat.identifiant == "cecrl:en:2020:0015"] == [
        "grammaire"
    ]


def test_requete_sans_terme_exploitable_retourne_une_sequence_vide(tmp_path: Path) -> None:
    recuperateur = _recuperateur(tmp_path)

    resultats = _rechercher(
        recuperateur,
        RequeteRAG(code_langue="en", referentiel="CECRL", niveau="B1", competences=("oral",), texte="the and of"),
    )

    assert resultats == ()


def test_terme_sans_correspondance_retourne_une_sequence_vide(tmp_path: Path) -> None:
    recuperateur = _recuperateur(tmp_path)

    resultats = _rechercher(
        recuperateur,
        RequeteRAG(code_langue="en", referentiel="CECRL", niveau="B1", competences=("oral",), texte="astrophysics"),
    )

    assert resultats == ()


def test_limite_borne_le_nombre_de_descripteurs(tmp_path: Path) -> None:
    recuperateur = _recuperateur(tmp_path)

    resultats = _rechercher(
        recuperateur,
        RequeteRAG(
            code_langue="en",
            referentiel="CECRL",
            niveau="B1",
            competences=("oral", "lecture", "ecrit"),
            texte="holidays travel",
            limite=2,
        ),
    )

    assert len(resultats) == 2


def test_recherche_deterministe(tmp_path: Path) -> None:
    recuperateur = _recuperateur(tmp_path)
    requete = RequeteRAG(
        code_langue="en",
        referentiel="CECRL",
        niveau="B1",
        competences=("oral", "lecture", "ecrit"),
        texte="holidays travel",
    )

    premier = _rechercher(recuperateur, requete)
    second = _rechercher(recuperateur, requete)

    assert premier == second
    assert len({resultat.identifiant for resultat in premier}) == len(premier)


def test_fermer_est_idempotent(tmp_path: Path) -> None:
    recuperateur = _recuperateur(tmp_path)

    assert asyncio.run(recuperateur.fermer()) is None
    assert asyncio.run(recuperateur.fermer()) is None
    assert recuperateur.version_corpus == "cecrl-test.1"
    assert recuperateur.nom == "local-cecrl"
