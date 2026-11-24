"""Tests du corpus CECRL PDF (US150-C) : chargement, récupérateur et fabrique.

Les descripteurs sont inventés pour les tests : aucun texte officiel n'est reproduit.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
from datetime import date
from pathlib import Path

import pytest

from app.core.erreurs import ErreurCorpusIndisponible
from app.rag.base import RequeteRAG
from app.rag.config import ConfigRAG
from app.rag.corpus import LicenceCorpus
from app.rag.corpus_pdf import (
    FICHIER_DESCRIPTEURS,
    FICHIER_MANIFESTE,
    CorpusPdf,
    DescripteurPdf,
    DocumentPdf,
    composer_manifeste,
    serialiser_descripteurs,
)
from app.rag.fabrique import construire_recuperateur
from app.rag.pdf import RecuperateurPdf
from app.rag.repli import RecuperateurAvecRepli
from app.rag.vide import RecuperateurVide

SHA_FICTIF = "0" * 64


def _descripteur(numero: int, langue: str = "fr", **champs: object) -> DescripteurPdf:
    valeurs: dict[str, object] = {
        "identifiant": f"cecrlpdf:{langue}:{numero:05d}",
        "langue_document": langue,
        "document": f"cv-{langue}",
        "niveau": "B1",
        "sous_niveau": "B1",
        "competence": "ecoute",
        "section": "3.1.1.1",
        "echelle": "ÉCHELLE DE TEST",
        "contenu": f"Descripteur de test numéro {numero}.",
        "page": 10 + numero,
    }
    valeurs.update(champs)
    return DescripteurPdf.model_validate(valeurs)


def _document(langue: str = "fr") -> DocumentPdf:
    return DocumentPdf(
        identifiant=f"cv-{langue}",
        titre="CECR — Volume complémentaire (test)",
        fichier=f"test_{langue}.pdf",
        langue=langue,
        pages=300,
        empreinte_sha256=SHA_FICTIF,
    )


def _ecrire(dossier: Path, descripteurs: list[DescripteurPdf], langues: tuple[str, ...] = ("fr",)) -> None:
    manifeste = composer_manifeste(
        descripteurs,
        version="cecrl-pdf-test.1",
        documents=[_document(langue) for langue in langues],
        licence=LicenceCorpus(statut="non_clarifiee", citation="© Conseil de l'Europe, 2020"),
        genere_le=date(2026, 11, 24),
    )
    dossier.mkdir(parents=True, exist_ok=True)
    (dossier / FICHIER_MANIFESTE).write_text(manifeste.model_dump_json(indent=2), encoding="utf-8")
    (dossier / FICHIER_DESCRIPTEURS).write_bytes(serialiser_descripteurs(descripteurs))


def _corpus_mixte() -> list[DescripteurPdf]:
    """Édition française : écoute B1 (deux échelles), lecture B1, lexique B1, écoute A2."""
    return [
        _descripteur(1, contenu="Peut suivre une annonce de gare de test.", echelle="ANNONCES"),
        _descripteur(2, contenu="Peut suivre une émission de radio de test.", echelle="ANNONCES"),
        _descripteur(3, contenu="Peut suivre une discussion de test entre amis.", echelle="CONVERSATION"),
        _descripteur(4, competence="lecture", section="3.1.1.3", contenu="Peut lire une lettre de test."),
        _descripteur(5, competence="lexique", section="5.1.1", contenu="Possède un vocabulaire de test courant."),
        _descripteur(6, niveau="A2", sous_niveau="A2+", contenu="Peut suivre un message de test court."),
    ]


def _rechercher(recuperateur: RecuperateurPdf, **champs: object):
    valeurs: dict[str, object] = {
        "code_langue": "fr",
        "referentiel": "CECRL",
        "niveau": "B1",
        "competences": ("ecoute",),
    }
    valeurs.update(champs)
    return asyncio.run(recuperateur.rechercher(RequeteRAG.model_validate(valeurs)))


# --- Chargement ------------------------------------------------------------------------------------------------


def test_chargement_d_un_corpus_valide(tmp_path: Path) -> None:
    _ecrire(tmp_path, _corpus_mixte())

    corpus = CorpusPdf.charger(tmp_path)

    assert corpus.version == "cecrl-pdf-test.1"
    assert len(corpus.descripteurs) == 6
    assert corpus.manifeste.comptages.par_niveau == {"A2": 1, "B1": 5}


@pytest.mark.parametrize(
    ("alteration", "message"),
    [
        (lambda d: d.write_bytes(d.read_bytes() + b"\n"), "empreinte"),
        (lambda d: d.write_bytes(d.read_bytes().replace(b"cv-fr", b"cv-it", 1)), "empreinte"),
        (lambda d: d.unlink(), "absent"),
    ],
)
def test_corpus_altere_refuse(tmp_path: Path, alteration, message: str) -> None:
    _ecrire(tmp_path, _corpus_mixte())
    alteration(tmp_path / FICHIER_DESCRIPTEURS)

    with pytest.raises(ErreurCorpusIndisponible, match=message):
        CorpusPdf.charger(tmp_path)


def test_coherence_verifiee_meme_sans_controle_d_empreinte(tmp_path: Path) -> None:
    descripteurs = _corpus_mixte()
    _ecrire(tmp_path, descripteurs)
    lignes = (tmp_path / FICHIER_DESCRIPTEURS).read_text(encoding="utf-8").splitlines()
    premiere = json.loads(lignes[0])
    premiere["document"] = "cv-de"
    lignes[0] = json.dumps(premiere, ensure_ascii=False)
    (tmp_path / FICHIER_DESCRIPTEURS).write_text("\n".join(lignes) + "\n", encoding="utf-8")

    with pytest.raises(ErreurCorpusIndisponible, match="document absent"):
        CorpusPdf.charger(tmp_path, verifier_empreinte=False)


def test_identifiant_et_sous_niveau_coherents() -> None:
    with pytest.raises(ValueError):
        _descripteur(1, langue="fr", identifiant="cecrlpdf:it:00001")
    with pytest.raises(ValueError):
        _descripteur(1, niveau="B1", sous_niveau="B2+")


# --- Récupérateur ----------------------------------------------------------------------------------------------


def test_filtrage_par_niveau_et_competence_sans_texte(tmp_path: Path) -> None:
    _ecrire(tmp_path, _corpus_mixte())
    recuperateur = RecuperateurPdf(CorpusPdf.charger(tmp_path))

    trouves = _rechercher(recuperateur, texte="")

    # Sans terme utile : les descripteurs du niveau et de la compétence restent servis (lexique transverse en fin),
    # une échelle différente d'abord, puis le reste.
    assert [d.identifiant for d in trouves] == [
        "cecrlpdf:fr:00001",
        "cecrlpdf:fr:00003",
        "cecrlpdf:fr:00005",
        "cecrlpdf:fr:00002",
    ]
    assert {d.niveau for d in trouves} == {"B1"}
    assert trouves[2].competence == "ecoute"  # lexique projeté sur une compétence du contrat


def test_bm25_classe_le_descripteur_le_plus_proche(tmp_path: Path) -> None:
    _ecrire(tmp_path, _corpus_mixte())
    recuperateur = RecuperateurPdf(CorpusPdf.charger(tmp_path))

    trouves = _rechercher(recuperateur, texte="une discussion entre amis", limite=1)

    assert [d.identifiant for d in trouves] == ["cecrlpdf:fr:00003"]


def test_edition_de_repli_et_langue_de_la_requete(tmp_path: Path) -> None:
    _ecrire(tmp_path, _corpus_mixte())
    recuperateur = RecuperateurPdf(CorpusPdf.charger(tmp_path))

    trouves = _rechercher(recuperateur, code_langue="de", competences=("lecture",))

    assert recuperateur.edition_pour("de") == "fr"
    assert trouves[0].identifiant == "cecrlpdf:fr:00004"
    # L'agent Diagnostic refuse un descripteur d'une autre langue : la projection reprend celle de la requête.
    assert trouves[0].code_langue == "de"
    assert "édition française, p. 14" in trouves[0].contenu
    assert "niveau B1" in trouves[0].contenu


def test_edition_de_la_langue_apprise_preferee(tmp_path: Path) -> None:
    descripteurs = [*_corpus_mixte(), _descripteur(1, langue="it", contenu="Può seguire un annuncio di prova.")]
    _ecrire(tmp_path, descripteurs, langues=("fr", "it"))
    recuperateur = RecuperateurPdf(CorpusPdf.charger(tmp_path))

    trouves = _rechercher(recuperateur, code_langue="it")

    assert [d.identifiant for d in trouves] == ["cecrlpdf:it:00001"]


def test_niveau_ou_referentiel_absents_donnent_une_liste_vide(tmp_path: Path) -> None:
    _ecrire(tmp_path, _corpus_mixte())
    recuperateur = RecuperateurPdf(CorpusPdf.charger(tmp_path))

    assert _rechercher(recuperateur, niveau="C2") == ()
    assert _rechercher(recuperateur, code_langue="zh", referentiel="HSK", niveau="HSK 1") == ()


def test_repli_synthetique_seulement_sans_resultat(tmp_path: Path) -> None:
    _ecrire(tmp_path, _corpus_mixte())
    avec_repli = RecuperateurAvecRepli(RecuperateurPdf(CorpusPdf.charger(tmp_path)))

    requete = RequeteRAG(code_langue="fr", referentiel="CECRL", niveau="C2", competences=("ecoute",))
    trouves = asyncio.run(avec_repli.rechercher(requete))

    assert trouves and all(d.identifiant.startswith("synthetique_fallback:") for d in trouves)
    assert avec_repli.version_corpus == "cecrl-pdf-test.1"


# --- Fabrique --------------------------------------------------------------------------------------------------


def test_fabrique_exige_l_autorisation(tmp_path: Path) -> None:
    _ecrire(tmp_path, _corpus_mixte())

    sans = construire_recuperateur(ConfigRAG(corpus_actif=True, corpus_type="pdf", corpus_chemin=tmp_path))
    avec = construire_recuperateur(
        ConfigRAG(corpus_actif=True, corpus_type="pdf", corpus_officiel_autorise=True, corpus_chemin=tmp_path)
    )

    assert isinstance(sans, RecuperateurVide)
    assert isinstance(avec, RecuperateurPdf)
    assert avec.version_corpus == "cecrl-pdf-test.1"


def test_fabrique_absorbe_un_corpus_invalide(tmp_path: Path, caplog: pytest.LogCaptureFixture) -> None:
    (tmp_path / FICHIER_MANIFESTE).write_text("{}", encoding="utf-8")
    (tmp_path / FICHIER_DESCRIPTEURS).write_text("", encoding="utf-8")

    recuperateur = construire_recuperateur(
        ConfigRAG(corpus_actif=True, corpus_type="pdf", corpus_officiel_autorise=True, corpus_chemin=tmp_path)
    )

    assert isinstance(recuperateur, RecuperateurVide)
    assert "Corpus CECRL PDF indisponible" in caplog.text


def test_configuration_type_pdf_depuis_l_environnement(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RAG_CORPUS_TYPE", "pdf")
    assert ConfigRAG().corpus_type == "pdf"


def test_serialisation_reproductible() -> None:
    descripteurs = _corpus_mixte()
    assert (
        hashlib.sha256(serialiser_descripteurs(descripteurs)).hexdigest()
        == hashlib.sha256(serialiser_descripteurs(list(descripteurs))).hexdigest()
    )
