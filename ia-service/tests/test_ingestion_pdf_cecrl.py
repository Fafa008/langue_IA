"""Tests de l'ingestion du corpus CECRL depuis des PDF (US150-C).

Tous les textes sont inventés pour les tests : aucun descripteur officiel n'est reproduit.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from app.rag.base import RequeteRAG
from app.rag.corpus_pdf import CorpusPdf
from app.rag.pdf import RecuperateurPdf
from scripts.ingestion_pdf_cecrl import (
    RACINE_DEPOT,
    Rapport,
    competence_pour,
    dedoublonner,
    detecter_langue,
    extraire_pages,
    joindre,
    lire_grilles,
    main,
    nettoyer_ligne,
    verifier_sortie_hors_depot,
)
from tests.pdf_minimal import pdf_minimal

PAGE_GRILLE = """
3.1. RÉCEPTION
3.1.1. ACTIVITÉS DE RÉCEPTION
3.1.1.1. Compréhension de l'oral
COMPRÉHENSION GÉNÉRALE DE L'ORAL TEST
C2      Peut suivre sans effort une discussion de test très rapide.
B2+     Peut suivre une conférence de test sur un sujet
        familier, avec quelques ajustements.
B1      Peut comprendre les points principaux d'une émission de test.
A1      Pas de descripteur disponible
Pre-A1  Peut reconnaître des mots de test isolés.
"""

PAGE_LINGUISTIQUE = """
5.1. COMPÉTENCE LINGUISTIQUE
5.1.1. Étendue du vocabulaire
B1      Possède un vocabulaire de test suffisant pour les sujets courants.
5.1.2. Correction grammaticale
B1      Utilise de façon assez exacte des structures de test fréquentes.
5.2. Compétence sociolinguistique
B1      Peut s'exprimer de façon polie dans un registre de test neutre.
"""


def test_nettoyage_des_artefacts_de_l_audit() -> None:
    assert nettoyer_ligne("est auto- risée sauf") == "est autorisée sauf"
    assert nettoyer_ligne("Lese- und Hörverstehen") == "Lese- und Hörverstehen"
    assert nettoyer_ligne(" la mediazione").strip() == "la mediazione"
    assert nettoyer_ligne("Kompetenz  Pragmatische") == "Kompetenz   Pragmatische"
    assert nettoyer_ligne("f le sujet des instructions") == "le sujet des instructions"
    assert (
        joindre(["Peut suivre une confé-", "rence de test", "", "et  la noter."])
        == "Peut suivre une conférence de test et la noter."
    )


def test_detection_de_la_langue_par_mots_outils() -> None:
    assert (
        detecter_langue("Les apprenants peuvent suivre des cours dans une école pour que la langue soit utile.") == "fr"
    )
    assert detecter_langue("Der Lernende kann die Hauptpunkte verstehen und sich mit den anderen verständigen.") == "de"
    assert (
        detecter_langue("Il discente può comprendere della lingua e delle sue strutture, che sono utili per gli altri.")
        == "it"
    )
    assert (
        detecter_langue("The learner can understand the main points and is able to use the language with ease.") == "en"
    )


@pytest.mark.parametrize(
    ("section", "titres", "attendue"),
    [
        ("3.1.1.1", ("RÉCEPTION", "Compréhension de l'oral"), "ecoute"),
        ("3.1.1.3", ("Ricezione", "Comprensione di testi scritti", "Lettura per orientarsi"), "lecture"),
        ("3.1.1.2", ("Rezeption", "Audiovisuelle Rezeption"), "ecoute"),
        ("3.2.1", ("Produktion", "Mündliche Produktion"), "oral"),
        ("3.3.3", ("Interaction", "Interaction en ligne"), "ecrit"),
        ("3.3.1.3", ("Interazione", "L'interazione on line"), "ecrit"),
        ("3.3.4", ("INTERACTION", "Stratégies d'interaction"), None),
        ("3.4.1.2", ("MÉDIATION", "MÉDIATION DE CONCEPTS"), None),
        ("5.1.3", ("Linguistic competence", "Grammatical accuracy"), "grammaire"),
        ("5.1.5", ("Competenza linguistica", "Controllo fonologico"), "oral"),
        ("5.1.6", ("Sprachliche Kompetenz", "Beherrschung der Orthographie"), "ecrit"),
        ("5.1.2", ("COMPÉTENCE LINGUISTIQUE", "Étendue du vocabulaire"), "lexique"),
        ("5.2", ("Compétence sociolinguistique",), None),
    ],
)
def test_projection_des_sections_sur_les_competences(
    section: str, titres: tuple[str, ...], attendue: str | None
) -> None:
    assert competence_pour(section, titres) == attendue


def test_lecture_d_une_grille_de_niveaux() -> None:
    rapport = Rapport()
    bruts = lire_grilles([PAGE_GRILLE, PAGE_LINGUISTIQUE], rapport)

    reception = [b for b in bruts if b.section == "3.1.1.1"]
    assert [(b.sous_niveau, b.niveau) for b in reception] == [("C2", "C2"), ("B2+", "B2"), ("B1", "B1")]
    assert (
        reception[1].contenu == "Peut suivre une conférence de test sur un sujet familier, avec quelques ajustements."
    )
    assert {b.competence for b in reception} == {"ecoute"}
    assert reception[0].echelle == "COMPRÉHENSION GÉNÉRALE DE L'ORAL TEST"
    assert all(b.page == 1 for b in reception)

    linguistique = {b.section: b.competence for b in bruts if b.page == 2}
    assert linguistique == {"5.1.1": "lexique", "5.1.2": "grammaire"}
    assert rapport.ecartees_sans_descripteur == 1
    assert rapport.ecartees_pre_a1 == 1
    assert rapport.ecartees_hors_perimetre == {"5.2": 1}


# Mise en page réelle du volume complémentaire (pdftotext -layout) : légende en minuscules, code de niveau centré
# verticalement dans sa cellule, cellules et descripteurs séparés par une simple ligne vide, prose dans la marge.
PAGE_NIVEAU_CENTRE = """
3.1.1.2. Compréhension audiovisuelle
                       Regarder des vidéos de test

            Peut identifier le sujet d'une vidéo de test si le
            commentaire est accompagné d'images.
            Peut suivre une annonce de test, à condition
   A2       que l'élocution soit claire.

            Peut suivre les changements de sujet d'un journal de test.

            Peut reconnaître des mots de test et identifier les sujets dans les gros
   A1       titres de test, en utilisant les informations visuelles.

 Pré-A1     Peut identifier le sujet d'une vidéo de test.


Un paragraphe de prose de test commence dans la marge
et ne doit appartenir à aucun descripteur.
CHAPITRE 6 : ÉCHELLES DE TEST EN LANGUE DES SIGNES
6.1. COMPÉTENCE LINGUISTIQUE DE TEST
   B1       Descripteur de test hors périmètre.
ANNEXE 1 : RÉCAPITULATIF DE TEST
   B1       Descripteur de test d'annexe.
"""


def test_niveau_centre_dans_sa_cellule_et_fin_de_chapitre() -> None:
    rapport = Rapport()
    bruts = lire_grilles([PAGE_NIVEAU_CENTRE], rapport)

    assert [b.sous_niveau for b in bruts] == ["A2", "A1"]
    a2, a1 = bruts
    assert a2.echelle == "Regarder des vidéos de test"
    assert a2.competence == "ecoute"
    assert a2.contenu == (
        "Peut identifier le sujet d'une vidéo de test si le commentaire est accompagné d'images. "
        "Peut suivre une annonce de test, à condition que l'élocution soit claire. "
        "Peut suivre les changements de sujet d'un journal de test."
    )
    assert a1.contenu.startswith("Peut reconnaître des mots de test")
    assert "prose" not in a1.contenu
    assert rapport.ecartees_pre_a1 == 1
    # Chapitre 6 (langue des signes) hors périmètre, annexe hors section : rien n'est rangé en 3.1 ou 5.1.
    assert rapport.ecartees_hors_perimetre == {"6.1": 1}
    assert rapport.ecartees_sans_section == 1


def test_prose_numerotee_n_est_pas_un_titre() -> None:
    page = (
        "5.1. COMPÉTENCE LINGUISTIQUE\n5.1.2 Étendue du vocabulaire\n5.2.1.4 del QCER 2001 è chiara\n"
        "   B1       Possède un vocabulaire de test.\n"
    )
    bruts = lire_grilles([page])
    assert [(b.section, b.competence) for b in bruts] == [("5.1.2", "lexique")]


def test_entrees_de_sommaire_et_lignes_hors_section_ignorees() -> None:
    sommaire = "3.1. RÉCEPTION ........................ 49\n3.2. PRODUCTION 64\n"
    rapport = Rapport()
    bruts = lire_grilles([sommaire + "\n\nB1      Texte de test sans section.\n"], rapport)
    assert bruts == []
    assert rapport.ecartees_sans_section == 1


def test_dedoublonnage_des_cellules_repetees() -> None:
    rapport = Rapport()
    bruts = lire_grilles([PAGE_GRILLE, PAGE_GRILLE], rapport)
    uniques = dedoublonner(bruts, rapport)
    assert len(uniques) == 3
    assert rapport.doublons == 3


def test_sortie_refusee_dans_le_depot(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="hors du dépôt"):
        verifier_sortie_hors_depot(RACINE_DEPOT / "ia-service" / "corpus" / "pdf")
    assert verifier_sortie_hors_depot(tmp_path / "corpus") == (tmp_path / "corpus").resolve()


def _pdf_de_test(dossier: Path) -> Path:
    """PDF « édition française » inventé : une grille de compréhension de l'oral et une de production écrite."""
    pages = [
        [
            [(50, "Les apprenants et les enseignants trouvent ici des exemples pour que la lecture soit utile.")],
            [(50, "3.1. RÉCEPTION")],
            [(50, "3.1.1.1. Compréhension de l'oral")],
            [(50, "COMPRENDRE UNE ANNONCE DE TEST")],
            [(50, "B1"), (110, "Peut comprendre une annonce de gare de test.")],
            [(50, "A2"), (110, "Peut comprendre un message de test très court.")],
        ],
        [
            [(50, "3.2. PRODUCTION")],
            [(50, "3.2.2. Production écrite")],
            [(50, "ÉCRIRE UN MESSAGE DE TEST")],
            [(50, "B1"), (110, "Peut écrire un courriel de test sur un voyage.")],
        ],
    ]
    chemin = dossier / "volume-test_fra.pdf"
    chemin.write_bytes(pdf_minimal(pages))
    return chemin


def test_extraction_pypdf_d_un_pdf(tmp_path: Path) -> None:
    pages = extraire_pages(_pdf_de_test(tmp_path), "pypdf")
    assert len(pages) == 2
    assert "Peut comprendre une annonce de gare de test." in pages[0]


def test_ingestion_complete_puis_recherche(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    source = tmp_path / "pdf"
    source.mkdir()
    _pdf_de_test(source)
    sortie = tmp_path / "corpus-pdf"

    assert main(["--source", str(source), "--sortie", str(sortie), "--extracteur", "pypdf"]) == 0
    rapport = capsys.readouterr().out
    assert "total : 3" in rapport
    assert "Peut comprendre" not in rapport  # aucun texte de descripteur dans le rapport

    corpus = CorpusPdf.charger(sortie)
    assert corpus.manifeste.langues == ("fr",)
    assert corpus.manifeste.licence.statut == "non_clarifiee"
    assert {d.competence for d in corpus.descripteurs} == {"ecoute", "ecrit"}
    assert corpus.manifeste.documents[0].identifiant == "cv-fr"

    recuperateur = RecuperateurPdf(corpus)
    trouves = asyncio.run(
        recuperateur.rechercher(
            RequeteRAG(code_langue="en", referentiel="CECRL", niveau="B1", competences=("ecoute",), texte="train")
        )
    )
    assert [d.identifiant for d in trouves] == ["cecrlpdf:fr:00001"]
    assert trouves[0].code_langue == "en"
    assert "p. 1" in trouves[0].contenu


def test_ingestion_en_echec_sans_descripteur(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    vide = tmp_path / "vide.pdf"
    vide.write_bytes(pdf_minimal([[[(50, "Une page de test sans grille de niveaux.")]]]))

    assert main(["--source", str(vide), "--sortie", str(tmp_path / "sortie"), "--extracteur", "pypdf"]) == 1
    assert "Aucun descripteur" in capsys.readouterr().err
    assert not (tmp_path / "sortie").exists()


# Édition anglaise : aucune ligne vide entre les cellules ; une phrase à cheval ne doit pas être coupée.
PAGE_SANS_LIGNE_VIDE = """
3.1.1.1. Oral comprehension

                              Test overall scale
               Can follow a long test discourse even when it is not
               clearly structured.
     B2        Can understand the main test ideas.
               Can follow test arguments, provided the topic is reasonably
               familiar, and the direction is signposted.
               Can understand straightforward test information, provided people articulate clearly in a generally
     B1        familiar variety.
"""


def test_phrase_a_cheval_entre_deux_niveaux_non_coupee() -> None:
    b2, b1 = lire_grilles([PAGE_SANS_LIGNE_VIDE])

    assert b2.sous_niveau == "B2"
    assert b2.echelle == "Test overall scale"
    assert b2.contenu.startswith("Can follow a long test discourse")
    assert b2.contenu.endswith(
        "Can follow test arguments, provided the topic is reasonably familiar, and the direction is signposted."
    )
    assert b1.contenu == (
        "Can understand straightforward test information, provided people articulate clearly "
        "in a generally familiar variety."
    )
