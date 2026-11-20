"""Tests du corpus expérimental CARCL : provenance, recherche, garde-fous et repli."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from collections import Counter
from datetime import date
from pathlib import Path

import pytest

from app.core.erreurs import ErreurCorpusIndisponible
from app.rag.base import (
    PREFIXE_IDENTIFIANT_EXPERIMENTAL,
    PREFIXE_IDENTIFIANT_SYNTHETIQUE,
    VERSION_CORPUS_EXPERIMENTAL,
    RequeteRAG,
)
from app.rag.config import CHEMIN_CORPUS_PAR_DEFAUT, ConfigRAG
from app.rag.corpus_experimental import (
    FICHIER_MANIFESTE_EXPERIMENTAL,
    ComptagesExperimental,
    FichierSourceExperimental,
    ManifesteExperimental,
    charger_corpus_experimental,
    empreinte_fichiers,
)
from app.rag.experimental import RecuperateurExperimental
from app.rag.fabrique import construire_recuperateur
from app.rag.repli import RecuperateurAvecRepli
from app.rag.vide import RecuperateurVide


def _rechercher(recuperateur: RecuperateurExperimental, requete: RequeteRAG):
    """Exécuter une recherche asynchrone sans plugin pytest-asyncio."""
    return asyncio.run(recuperateur.rechercher(requete))


def _recuperateur_reel() -> RecuperateurExperimental:
    """Charger le vrai corpus expérimental avec vérification d'empreinte."""
    corpus = charger_corpus_experimental(CHEMIN_CORPUS_PAR_DEFAUT, verifier_empreinte=True)
    return RecuperateurExperimental(corpus)


def _ecrire_corpus_synthetique(dossier: Path) -> dict[str, Path]:
    """Deux langues, un doublon QCM et un agrégat exclu."""
    fichiers = {
        "anglais/english_a1_dataset_200_QA_200_MCQ.json": {
            "level": "A1",
            "question_answer": [
                {
                    "id": "A1_QA_001",
                    "level": "A1",
                    "skill": "greetings",
                    "question": "How do you introduce yourself?",
                    "answer": "My name is [name].",
                }
            ],
            "mcq": [
                {
                    "id": "A1_MCQ_001",
                    "level": "A1",
                    "question": "Choose the correct form.",
                    "options": [
                        {"id": "A", "text": "I am", "score_pct": 100},
                        {"id": "B", "text": "I is", "score_pct": 0},
                    ],
                    "correct_answer": "I am",
                },
                {
                    "id": "A1_MCQ_002",
                    "level": "A1",
                    "question": "Choose the correct form.",
                    "options": [
                        {"id": "A", "text": "I am", "score_pct": 100},
                        {"id": "B", "text": "I is", "score_pct": 0},
                    ],
                    "correct_answer": "I am",
                },
            ],
        },
        "Deutsch/german_a1_dataset_200_QA_200_MCQ.json": {
            "language_code": "de",
            "cefr_level": "A1",
            "open_questions": [
                {
                    "id": "de_a1_qa_001",
                    "level": "A1",
                    "question": "Wie heißt du?",
                    "answer": "Ich heiße Anna.",
                    "language": "de",
                }
            ],
        },
        "anglais/english_cefr_dataset_aggregate.json": {
            "question_answer": [
                {
                    "id": "A1_QA_001",
                    "level": "A1",
                    "question": "How do you introduce yourself?",
                    "answer": "My name is [name].",
                }
            ]
        },
    }
    ecrits: dict[str, Path] = {}
    for relatif, contenu in fichiers.items():
        chemin = dossier / relatif
        chemin.parent.mkdir(parents=True, exist_ok=True)
        chemin.write_bytes((json.dumps(contenu, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
        ecrits[relatif] = chemin
    return ecrits


def _ecrire_manifeste(dossier: Path) -> None:
    """Écrire un manifeste cohérent avec le petit corpus synthétique."""
    corpus = charger_corpus_experimental(dossier, verifier_empreinte=False)
    sources = []
    for chemin in sorted(dossier.rglob("*.json")):
        if chemin.name == FICHIER_MANIFESTE_EXPERIMENTAL or "cefr" in chemin.name.casefold():
            continue
        donnees = chemin.read_bytes()
        sources.append(
            FichierSourceExperimental(
                chemin=chemin.relative_to(dossier).as_posix(),
                octets=len(donnees),
                sha256=hashlib.sha256(donnees).hexdigest(),
            )
        )
    manifeste = ManifesteExperimental(
        version=VERSION_CORPUS_EXPERIMENTAL,
        genere_le=date(2026, 11, 20),
        description="Corpus synthétique de test, aucun contenu officiel.",
        fichiers=tuple(sources),
        comptages=ComptagesExperimental(
            total=len(corpus.exercices),
            par_langue=dict(Counter(exercice.code_langue for exercice in corpus.exercices)),
            par_niveau=dict(Counter(exercice.niveau for exercice in corpus.exercices)),
            par_nature=dict(Counter(exercice.nature for exercice in corpus.exercices)),
        ),
        empreinte_corpus_sha256=empreinte_fichiers(sources),
    )
    (dossier / FICHIER_MANIFESTE_EXPERIMENTAL).write_bytes(
        (json.dumps(manifeste.model_dump(mode="json"), ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    )


def test_chargement_reel_conserve_provenance_et_volume() -> None:
    corpus = charger_corpus_experimental(CHEMIN_CORPUS_PAR_DEFAUT, verifier_empreinte=True)

    assert corpus.version == VERSION_CORPUS_EXPERIMENTAL
    assert len(corpus.exercices) == 8640
    assert Counter(exercice.code_langue for exercice in corpus.exercices) == {
        "en": 2400,
        "fr": 2400,
        "it": 2310,
        "de": 1530,
    }
    assert corpus.manifeste is not None
    assert corpus.manifeste.licence is None
    assert corpus.manifeste.auteur is None
    assert all(exercice.identifiant.startswith(PREFIXE_IDENTIFIANT_EXPERIMENTAL) for exercice in corpus.exercices)
    assert all(exercice.non_officiel for exercice in corpus.exercices)
    assert all("non officiel" in exercice.contenu for exercice in corpus.exercices)
    assert all("cefr" not in exercice.source_fichier.casefold() for exercice in corpus.exercices)
    assert all(exercice.referentiel == "CECRL" for exercice in corpus.exercices)


def test_chargement_dedupie_sans_confondre_les_langues(tmp_path: Path) -> None:
    dossier = tmp_path / "corpus"
    _ecrire_corpus_synthetique(dossier)

    corpus = charger_corpus_experimental(dossier, verifier_empreinte=False)

    # Un QCM en doublon et l'agrégat exclu sont écartés ; les deux langues restent séparées.
    assert Counter(exercice.code_langue for exercice in corpus.exercices) == {"en": 2, "de": 1}
    assert [exercice.id_original for exercice in corpus.exercices] == ["de_a1_qa_001", "A1_QA_001", "A1_MCQ_001"]
    assert all(exercice.source_fichier.count("aggregate") == 0 for exercice in corpus.exercices)


def test_empreinte_manifeste_valide_puis_modifiee(tmp_path: Path) -> None:
    dossier = tmp_path / "corpus"
    ecrits = _ecrire_corpus_synthetique(dossier)
    _ecrire_manifeste(dossier)

    assert len(charger_corpus_experimental(dossier, verifier_empreinte=True).exercices) == 3

    cible = ecrits["anglais/english_a1_dataset_200_QA_200_MCQ.json"]
    cible.write_bytes(cible.read_bytes() + b"\n")
    with pytest.raises(ErreurCorpusIndisponible):
        charger_corpus_experimental(dossier, verifier_empreinte=True)


@pytest.mark.parametrize(
    ("langue", "competence", "texte", "extrait_attendu"),
    [
        ("en", "oral", "introduce yourself", "introduce yourself"),
        ("fr", "grammaire", "complétez étudiant suis", "étudiant"),
        ("de", "lecture", "Wie heißt du", "Wie heißt du"),
        ("it", "grammaire", "Completa Marco sono", "Marco"),
    ],
)
def test_recherche_par_langue_et_correspondance_des_sources(
    langue: str,
    competence: str,
    texte: str,
    extrait_attendu: str,
) -> None:
    recuperateur = _recuperateur_reel()

    resultats = _rechercher(
        recuperateur,
        RequeteRAG(
            code_langue=langue,  # type: ignore[arg-type]
            referentiel="CECRL",
            niveau="A1",
            competences=(competence,),  # type: ignore[arg-type]
            texte=texte,
        ),
    )

    assert resultats
    assert all(resultat.identifiant.startswith(PREFIXE_IDENTIFIANT_EXPERIMENTAL) for resultat in resultats)
    assert all(resultat.code_langue == langue for resultat in resultats)
    assert all("non officiel" in resultat.contenu for resultat in resultats)
    assert any(extrait_attendu.casefold() in resultat.contenu.casefold() for resultat in resultats)
    assert recuperateur.version_corpus == VERSION_CORPUS_EXPERIMENTAL
    assert recuperateur.nom == "local-cecrl-experimental"


def test_requete_sans_resultat_reste_vide() -> None:
    recuperateur = _recuperateur_reel()

    resultats = _rechercher(
        recuperateur,
        RequeteRAG(
            code_langue="en",
            referentiel="CECRL",
            niveau="A1",
            competences=("oral",),
            texte="astrophysique quantique",
        ),
    )

    assert resultats == ()


def test_corpus_absent_leve_une_erreur_et_la_fabrique_reste_vide(tmp_path: Path) -> None:
    absent = tmp_path / "absent"

    with pytest.raises(ErreurCorpusIndisponible):
        charger_corpus_experimental(absent, verifier_empreinte=False)
    recuperateur = construire_recuperateur(
        ConfigRAG(corpus_actif=True, corpus_type="experimental", corpus_chemin=absent, verifier_empreinte=False)
    )

    assert isinstance(recuperateur, RecuperateurVide)
    assert recuperateur.version_corpus is None


def test_fabrique_selectionne_le_corpus_experimental(tmp_path: Path) -> None:
    dossier = tmp_path / "corpus"
    _ecrire_corpus_synthetique(dossier)

    recuperateur = construire_recuperateur(
        ConfigRAG(corpus_actif=True, corpus_type="experimental", corpus_chemin=dossier, verifier_empreinte=False)
    )

    assert isinstance(recuperateur, RecuperateurExperimental)
    assert recuperateur.version_corpus == VERSION_CORPUS_EXPERIMENTAL


def test_configuration_officielle_sans_autorisation_ne_charge_rien(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
    tmp_path: Path,
) -> None:
    def refuser_chargement(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("Le corpus officiel ne doit pas être chargé sans autorisation.")

    monkeypatch.setattr("app.rag.fabrique.CorpusCecrl.charger", refuser_chargement)
    with caplog.at_level(logging.ERROR, logger="app.rag.fabrique"):
        recuperateur = construire_recuperateur(
            ConfigRAG(
                corpus_actif=True,
                corpus_type="officiel",
                corpus_officiel_autorise=False,
                corpus_chemin=tmp_path,
            )
        )

    assert isinstance(recuperateur, RecuperateurVide)
    assert "Corpus CECRL officiel non autorisé" in caplog.text


def test_repli_reste_synthetique_si_le_corpus_experimental_ne_repond_pas() -> None:
    recuperateur = _recuperateur_reel()
    avec_repli = RecuperateurAvecRepli(recuperateur)

    resultats = asyncio.run(
        avec_repli.rechercher(
            RequeteRAG(
                code_langue="en",
                referentiel="CECRL",
                niveau="A1",
                competences=("oral",),
                texte="astrophysique quantique",
            )
        )
    )

    assert resultats
    assert all(resultat.identifiant.startswith(PREFIXE_IDENTIFIANT_SYNTHETIQUE) for resultat in resultats)
    assert not any(resultat.identifiant.startswith(PREFIXE_IDENTIFIANT_EXPERIMENTAL) for resultat in resultats)
    assert all("non officiel" in resultat.contenu for resultat in resultats)
    assert avec_repli.version_corpus == VERSION_CORPUS_EXPERIMENTAL
