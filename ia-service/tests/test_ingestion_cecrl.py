"""Tests de l'ingestion CECRL : normalisation, extraction, refus d'écriture et commande complète."""

from __future__ import annotations

import hashlib
import zipfile
from pathlib import Path

import pytest
from openpyxl import Workbook

from app.rag.corpus import CorpusCecrl, SourceOfficielle
from scripts.ingestion_cecrl import (
    EMPREINTE_DESCRIPTEURS_2020,
    RACINE_DEPOT,
    _classeur_lisible,
    collecter,
    construire_source,
    descripteur_depuis_ligne,
    ecrire_corpus,
    empreinte_fichier,
    lire_lignes,
    main,
    normaliser_niveau,
    verifier_sortie_hors_depot,
)
from tests.donnees_corpus import corpus_synthetique
from tests.donnees_corpus import manifeste as composer

LIGNE_B1 = (1, "S", "M", "A", "Conversation", "B1", "Can take part in a conversation.")
LIGNE_A2_PLUS = (2, "S", "M", "A", "Conversation", "A2+", "Can exchange simple information.")
LIGNE_LEXIQUE = (3, "S", "M", "A", "Vocabulary range", "B1", "Has a good range of vocabulary.")


@pytest.mark.parametrize(
    ("brut", "attendu"),
    [
        ("B1", ("B1", "B1")),
        ("A2+", ("A2", "A2+")),
        ("B1+", ("B1", "B1+")),
        ("Pre-A1", None),
        ("C1", None),
        ("C2", None),
        ("", None),
        (None, None),
        ("None", None),
        ("b1", None),
    ],
)
def test_normaliser_niveau(brut: object, attendu: tuple[str, str] | None) -> None:
    assert normaliser_niveau(brut) == attendu


def test_descripteur_depuis_ligne() -> None:
    descripteur = descripteur_depuis_ligne(LIGNE_B1, langue="en", annee=2020, avec_sous_niveaux=False)

    assert descripteur is not None
    assert descripteur.identifiant == "cecrl:en:2020:0001"
    assert descripteur.niveau == "B1"
    assert descripteur.competence == "oral"
    assert descripteur.source_no == 1


def test_descripteur_lexical_conserve_sa_competence_de_corpus() -> None:
    descripteur = descripteur_depuis_ligne(LIGNE_LEXIQUE, langue="en", annee=2020, avec_sous_niveaux=False)

    assert descripteur is not None
    assert descripteur.competence == "lexique"
    assert descripteur.echelle == "Vocabulary range"


def test_sous_niveau_facultatif() -> None:
    sans = descripteur_depuis_ligne(LIGNE_A2_PLUS, langue="en", annee=2020, avec_sous_niveaux=False)
    avec = descripteur_depuis_ligne(LIGNE_A2_PLUS, langue="en", annee=2020, avec_sous_niveaux=True)

    assert sans is None
    assert avec is not None
    assert avec.niveau == "A2"
    assert avec.sous_niveau == "A2+"


@pytest.mark.parametrize(
    "ligne",
    [
        (1, "S", "M", "A", "Conversation", "B1"),
        (None, "S", "M", "A", "Conversation", "B1", "Can talk."),
        (1, "S", "M", "A", None, "B1", "Can talk."),
        (1, "S", "M", "A", "Conversation", "B1", None),
        (1, "S", "M", "A", "Conversation", "B1", "No descriptors available for this level."),
        (1, "S", "M", "A", "Conversation", "B1", "   "),
        (1, "S", "M", "A", "Scale inconnue", "B1", "Can talk."),
        (1, "S", "M", "A", "Conversation", "C1", "Can talk."),
    ],
)
def test_ligne_hors_noyau_est_ecartee(ligne: tuple[object, ...]) -> None:
    assert descripteur_depuis_ligne(ligne, langue="en", annee=2020, avec_sous_niveaux=True) is None


def test_collecter_trie_par_numero_de_source() -> None:
    descripteurs = collecter(
        [LIGNE_LEXIQUE, LIGNE_B1, LIGNE_A2_PLUS],
        langue="en",
        annee=2020,
        avec_sous_niveaux=True,
    )

    assert [descripteur.source_no for descripteur in descripteurs] == [1, 2, 3]


def test_verifier_sortie_hors_depot_refuse_le_depot() -> None:
    with pytest.raises(ValueError, match="hors du dépôt"):
        verifier_sortie_hors_depot(RACINE_DEPOT)
    with pytest.raises(ValueError, match="hors du dépôt"):
        verifier_sortie_hors_depot(RACINE_DEPOT / "ia-service" / "corpus" / "cecrl")


def test_verifier_sortie_hors_depot_accepte_un_dossier_externe(tmp_path: Path) -> None:
    assert verifier_sortie_hors_depot(tmp_path) == tmp_path.resolve()


def test_construire_source_reconnue() -> None:
    source = construire_source(Path("classeur.zip"), EMPREINTE_DESCRIPTEURS_2020, accepter_inconnue=False)

    assert source.empreinte_sha256 == EMPREINTE_DESCRIPTEURS_2020
    assert source.editeur == "Conseil de l'Europe"


def test_construire_source_inconnue_refusee() -> None:
    with pytest.raises(ValueError, match="Empreinte inconnue"):
        construire_source(Path("classeur.zip"), "0" * 64, accepter_inconnue=False)


def test_construire_source_inconnue_acceptee() -> None:
    source = construire_source(Path("classeur.xlsx"), "0" * 64, accepter_inconnue=True)

    assert isinstance(source, SourceOfficielle)
    assert source.oeuvre == "classeur.xlsx"
    assert source.empreinte_sha256 == "0" * 64


def test_empreinte_fichier(tmp_path: Path) -> None:
    chemin = tmp_path / "fichier.bin"
    chemin.write_bytes(b"preuve")

    assert empreinte_fichier(chemin) == hashlib.sha256(b"preuve").hexdigest()


def test_classeur_lisible_recopie_une_archive_xlsx(tmp_path: Path) -> None:
    archive = tmp_path / "descripteurs.zip"
    with zipfile.ZipFile(archive, "w") as fichier:
        fichier.writestr("[Content_Types].xml", "<Types/>")
        fichier.writestr("xl/workbook.xml", "<workbook/>")

    classeur, empreinte = _classeur_lisible(archive, tmp_path)

    assert classeur.suffix == ".xlsx"
    assert classeur.read_bytes() == archive.read_bytes()
    assert empreinte == empreinte_fichier(archive)


def test_classeur_lisible_refuse_une_archive_sans_classeur(tmp_path: Path) -> None:
    archive = tmp_path / "autre.zip"
    with zipfile.ZipFile(archive, "w") as fichier:
        fichier.writestr("lisez-moi.txt", "pas un classeur")

    with pytest.raises(ValueError, match="classeur XLSX"):
        _classeur_lisible(archive, tmp_path)


def test_classeur_lisible_accepte_un_fichier_simple(tmp_path: Path) -> None:
    fichier = tmp_path / "classeur.xlsx"
    fichier.write_bytes(b"contenu opaque")

    classeur, empreinte = _classeur_lisible(fichier, tmp_path)

    assert classeur == fichier
    assert empreinte == empreinte_fichier(fichier)


def _ecrire_classeur(chemin: Path, lignes: list[tuple[object, ...]], feuille: str = "English") -> Path:
    """Créer un classeur minimal avec l'en-tête attendu par l'ingestion."""
    classeur = Workbook()
    active = classeur.active
    active.title = feuille
    active.append(["No", "Schema", "Mode", "Activity", "Scale", "Level", "Descriptor"])
    for ligne in lignes:
        active.append(list(ligne))
    classeur.save(chemin)
    return chemin


def test_lire_lignes_ignore_l_en_tete(tmp_path: Path) -> None:
    chemin = _ecrire_classeur(tmp_path / "classeur.xlsx", [LIGNE_B1, LIGNE_LEXIQUE])

    lignes = lire_lignes(chemin, "en")

    assert lignes == [LIGNE_B1, LIGNE_LEXIQUE]


def test_lire_lignes_refuse_une_feuille_absente(tmp_path: Path) -> None:
    chemin = _ecrire_classeur(tmp_path / "classeur.xlsx", [LIGNE_B1], feuille="English")

    with pytest.raises(ValueError, match="Feuille"):
        lire_lignes(chemin, "fr")


def test_ecrire_corpus_est_rechargeable(tmp_path: Path) -> None:
    descripteurs = corpus_synthetique()
    ecrire_corpus(tmp_path, composer(descripteurs), descripteurs)

    corpus = CorpusCecrl.charger(tmp_path)

    assert corpus.version == "cecrl-test.1"
    assert len(corpus.descripteurs) == len(descripteurs)


def test_main_genere_un_corpus_valide(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    source = _ecrire_classeur(tmp_path / "classeur.xlsx", [LIGNE_B1, LIGNE_A2_PLUS, LIGNE_LEXIQUE])
    sortie = tmp_path / "corpus"

    code = main(
        [
            "--source",
            str(source),
            "--sortie",
            str(sortie),
            "--accepter-source-inconnue",
            "--avec-sous-niveaux",
        ]
    )

    assert code == 0
    corpus = CorpusCecrl.charger(sortie)
    assert corpus.version == "cecrl-2020.1"
    assert [descripteur.source_no for descripteur in corpus.descripteurs] == [1, 2, 3]
    assert "descripteurs : 3" in capsys.readouterr().out


def test_main_refuse_une_sortie_dans_le_depot(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    source = _ecrire_classeur(tmp_path / "classeur.xlsx", [LIGNE_B1])

    code = main(
        [
            "--source",
            str(source),
            "--sortie",
            str(RACINE_DEPOT / "corpus-interdit"),
            "--accepter-source-inconnue",
        ]
    )

    assert code == 1
    assert "hors du dépôt" in capsys.readouterr().err


def test_main_refuse_une_source_sans_descripteur(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    source = _ecrire_classeur(tmp_path / "classeur.xlsx", [(1, "S", "M", "A", "Hors noyau", "B1", "Can talk.")])

    code = main(
        [
            "--source",
            str(source),
            "--sortie",
            str(tmp_path / "corpus"),
            "--accepter-source-inconnue",
        ]
    )

    assert code == 1
    assert "Aucun descripteur" in capsys.readouterr().err


def test_main_refuse_une_empreinte_inconnue(tmp_path: Path) -> None:
    source = _ecrire_classeur(tmp_path / "classeur.xlsx", [LIGNE_B1])

    code = main(["--source", str(source), "--sortie", str(tmp_path / "corpus")])

    assert code == 1
