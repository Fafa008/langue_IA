"""Tests de la configuration et de la fabrique du récupérateur CECRL."""

from __future__ import annotations

import logging
from pathlib import Path

import pytest

from app.rag.config import CHEMIN_CORPUS_PAR_DEFAUT, ConfigRAG
from app.rag.fabrique import construire_recuperateur
from app.rag.local import RecuperateurLocal
from app.rag.vide import RecuperateurVide
from tests.donnees_corpus import corpus_synthetique, ecrire


def test_configuration_par_defaut_desactivee() -> None:
    configuration = ConfigRAG()

    assert configuration.corpus_actif is False
    assert configuration.corpus_chemin is None
    assert configuration.verifier_empreinte is True
    assert configuration.dossier == CHEMIN_CORPUS_PAR_DEFAUT


def test_configuration_lue_dans_l_environnement(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("RAG_CORPUS_ACTIF", "true")
    monkeypatch.setenv("RAG_CORPUS_CHEMIN", str(tmp_path))
    monkeypatch.setenv("RAG_CORPUS_VERIFIER_EMPREINTE", "false")

    configuration = ConfigRAG()

    assert configuration.corpus_actif is True
    assert configuration.corpus_chemin == tmp_path
    assert configuration.verifier_empreinte is False
    assert configuration.dossier == tmp_path


def test_chemin_vide_vaut_non_renseigne(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RAG_CORPUS_CHEMIN", "   ")

    assert ConfigRAG().corpus_chemin is None


def test_flag_desactive_retourne_le_recuperateur_vide(tmp_path: Path) -> None:
    ecrire(tmp_path, corpus_synthetique())

    recuperateur = construire_recuperateur(ConfigRAG(corpus_actif=False, corpus_chemin=tmp_path))

    assert isinstance(recuperateur, RecuperateurVide)
    assert recuperateur.version_corpus is None


def test_corpus_valide_retourne_le_recuperateur_local(tmp_path: Path) -> None:
    ecrire(tmp_path, corpus_synthetique())

    recuperateur = construire_recuperateur(ConfigRAG(corpus_actif=True, corpus_chemin=tmp_path))

    assert isinstance(recuperateur, RecuperateurLocal)
    assert recuperateur.version_corpus == "cecrl-test.1"


def test_dossier_absent_retourne_le_recuperateur_vide(tmp_path: Path, caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.ERROR, logger="app.rag.fabrique"):
        recuperateur = construire_recuperateur(ConfigRAG(corpus_actif=True, corpus_chemin=tmp_path / "absent"))

    assert isinstance(recuperateur, RecuperateurVide)
    assert "Corpus CECRL indisponible" in caplog.text


def test_corpus_corrompu_retourne_le_recuperateur_vide(tmp_path: Path, caplog: pytest.LogCaptureFixture) -> None:
    ecrire(tmp_path, corpus_synthetique())
    (tmp_path / "manifeste.json").write_text("{", encoding="utf-8")

    with caplog.at_level(logging.ERROR, logger="app.rag.fabrique"):
        recuperateur = construire_recuperateur(ConfigRAG(corpus_actif=True, corpus_chemin=tmp_path))

    assert isinstance(recuperateur, RecuperateurVide)
    assert "Corpus CECRL indisponible" in caplog.text


def test_empreinte_desactivee_tolere_un_fichier_modifie(tmp_path: Path) -> None:
    ecrire(tmp_path, corpus_synthetique())
    with (tmp_path / "descripteurs.jsonl").open("ab") as flux:
        flux.write(b"\n")

    refuse = construire_recuperateur(ConfigRAG(corpus_actif=True, corpus_chemin=tmp_path))
    accepte = construire_recuperateur(ConfigRAG(corpus_actif=True, corpus_chemin=tmp_path, verifier_empreinte=False))

    assert isinstance(refuse, RecuperateurVide)
    assert isinstance(accepte, RecuperateurLocal)
