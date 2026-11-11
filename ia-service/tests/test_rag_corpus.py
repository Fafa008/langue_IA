"""Tests du corpus CECRL : manifeste, validation des descripteurs et chargement local."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.core.erreurs import ErreurCorpusIndisponible
from app.rag.corpus import (
    CorpusCecrl,
    DescripteurCorpus,
    ManifesteCorpus,
    composer_manifeste,
    serialiser_descripteurs,
)
from tests.donnees_corpus import LICENCE_SYNTHETIQUE, SOURCE_SYNTHETIQUE, corpus_synthetique, descripteur, ecrire

MANIFESTE_VERSIONNE = Path(__file__).resolve().parents[1] / "corpus" / "cecrl" / "manifeste.json"


def _rehash(manifeste: ManifesteCorpus, octets: bytes) -> ManifesteCorpus:
    """Manifeste dont l'empreinte correspond à un fichier de descripteurs modifié par le test."""
    return manifeste.model_copy(update={"empreinte_descripteurs_sha256": hashlib.sha256(octets).hexdigest()})


def _ecrire_octets(dossier: Path, manifeste: ManifesteCorpus, octets: bytes) -> None:
    dossier.mkdir(parents=True, exist_ok=True)
    (dossier / "manifeste.json").write_bytes((manifeste.model_dump_json(indent=2) + "\n").encode("utf-8"))
    (dossier / "descripteurs.jsonl").write_bytes(octets)


def test_charger_corpus_synthetique(tmp_path: Path) -> None:
    descripteurs = corpus_synthetique()
    ecrire(tmp_path, descripteurs)

    corpus = CorpusCecrl.charger(tmp_path)

    assert corpus.version == "cecrl-test.1"
    assert len(corpus.descripteurs) == len(descripteurs)
    assert corpus.manifeste.comptages.total == len(descripteurs)
    assert corpus.manifeste.comptages.par_niveau == {"A2": 1, "B1": 7, "B2": 1}


def test_charger_dossier_absent(tmp_path: Path) -> None:
    with pytest.raises(ErreurCorpusIndisponible, match="dossier absent"):
        CorpusCecrl.charger(tmp_path / "inexistant")


def test_charger_manifeste_seul(tmp_path: Path) -> None:
    manifeste = ecrire(tmp_path, corpus_synthetique())
    (tmp_path / "descripteurs.jsonl").unlink()

    with pytest.raises(ErreurCorpusIndisponible, match="illisible"):
        CorpusCecrl.charger(tmp_path)
    assert manifeste.comptages.total > 0


def test_charger_manifeste_invalide(tmp_path: Path) -> None:
    ecrire(tmp_path, corpus_synthetique())
    (tmp_path / "manifeste.json").write_text("{", encoding="utf-8")

    with pytest.raises(ErreurCorpusIndisponible, match="manifeste.json non conforme"):
        CorpusCecrl.charger(tmp_path)


def test_charger_empreinte_differente(tmp_path: Path) -> None:
    ecrire(tmp_path, corpus_synthetique())
    with (tmp_path / "descripteurs.jsonl").open("ab") as flux:
        flux.write(b"\n")

    with pytest.raises(ErreurCorpusIndisponible, match="empreinte"):
        CorpusCecrl.charger(tmp_path)


def test_charger_empreinte_desactivee(tmp_path: Path) -> None:
    ecrire(tmp_path, corpus_synthetique())
    with (tmp_path / "descripteurs.jsonl").open("ab") as flux:
        flux.write(b"\n")

    corpus = CorpusCecrl.charger(tmp_path, verifier_empreinte=False)

    assert corpus.manifeste.comptages.total == len(corpus_synthetique())


def test_charger_refuse_identifiant_en_double(tmp_path: Path) -> None:
    descripteurs = corpus_synthetique()
    manifeste = ecrire(tmp_path, descripteurs)
    octets = serialiser_descripteurs((*descripteurs, descripteurs[0]))
    _ecrire_octets(tmp_path, _rehash(manifeste, octets), octets)

    with pytest.raises(ErreurCorpusIndisponible, match="en double"):
        CorpusCecrl.charger(tmp_path)


def test_charger_refuse_comptage_divergent(tmp_path: Path) -> None:
    descripteurs = corpus_synthetique()
    manifeste = ecrire(tmp_path, descripteurs)
    octets = serialiser_descripteurs((*descripteurs, descripteur(99, contenu="Can order a coffee.")))
    _ecrire_octets(tmp_path, _rehash(manifeste, octets), octets)

    with pytest.raises(ErreurCorpusIndisponible, match="au lieu de"):
        CorpusCecrl.charger(tmp_path)


def test_charger_refuse_langue_hors_manifeste(tmp_path: Path) -> None:
    descripteurs = corpus_synthetique()
    manifeste = ecrire(tmp_path, descripteurs)
    octets = serialiser_descripteurs((*descripteurs, descripteur(98, contenu="Peut saluer.", langue="it")))
    _ecrire_octets(tmp_path, _rehash(manifeste, octets), octets)

    with pytest.raises(ErreurCorpusIndisponible, match="langue hors manifeste"):
        CorpusCecrl.charger(tmp_path)


def test_charger_refuse_ligne_invalide(tmp_path: Path) -> None:
    descripteurs = corpus_synthetique()
    manifeste = ecrire(tmp_path, descripteurs)
    octets = serialiser_descripteurs(descripteurs) + b'{"identifiant": "incomplet"}\n'
    _ecrire_octets(tmp_path, _rehash(manifeste, octets), octets)

    with pytest.raises(ErreurCorpusIndisponible, match="ligne 10 invalide"):
        CorpusCecrl.charger(tmp_path)


def test_charger_refuse_fichier_non_utf8(tmp_path: Path) -> None:
    descripteurs = corpus_synthetique()
    manifeste = ecrire(tmp_path, descripteurs)
    octets = b"\xff\xfe"
    _ecrire_octets(tmp_path, _rehash(manifeste, octets), octets)

    with pytest.raises(ErreurCorpusIndisponible, match="UTF-8"):
        CorpusCecrl.charger(tmp_path)


def test_charger_refuse_corpus_vide(tmp_path: Path) -> None:
    descripteurs = corpus_synthetique()
    manifeste = ecrire(tmp_path, descripteurs)
    octets = b""
    _ecrire_octets(tmp_path, _rehash(manifeste, octets), octets)

    with pytest.raises(ErreurCorpusIndisponible, match="aucun descripteur"):
        CorpusCecrl.charger(tmp_path)


def test_descripteur_normalise_le_sous_niveau() -> None:
    descripteur_plus = descripteur(1, contenu="Can take part in a conversation.", sous_niveau="A2+", niveau="A2")

    assert descripteur_plus.niveau == "A2"
    assert descripteur_plus.sous_niveau == "A2+"


@pytest.mark.parametrize(
    "champs",
    [
        {"niveau": "B1", "sous_niveau": "B2+"},
        {"langue": "fr", "referentiel": "HSK"},
        {"code_langue": "zh", "referentiel": "CECRL"},
        {"competence": "mediation"},
    ],
)
def test_descripteur_refuse_une_combinaison_incoherente(champs: dict[str, object]) -> None:
    base = {
        "identifiant": "cecrl:en:2020:0001",
        "code_langue": "en",
        "referentiel": "CECRL",
        "niveau": "B1",
        "sous_niveau": "B1",
        "competence": "oral",
        "echelle": "Conversation",
        "contenu": "Can take part in a conversation.",
        "source_no": 1,
    }
    base.update(champs)

    with pytest.raises(ValidationError):
        DescripteurCorpus.model_validate(base)


def test_descripteur_refuse_un_champ_inconnu() -> None:
    with pytest.raises(ValidationError):
        DescripteurCorpus.model_validate(
            {
                "identifiant": "cecrl:en:2020:0001",
                "code_langue": "en",
                "referentiel": "CECRL",
                "niveau": "B1",
                "sous_niveau": "B1",
                "competence": "oral",
                "echelle": "Conversation",
                "contenu": "Can take part in a conversation.",
                "source_no": 1,
                "licence": "inconnue",
            }
        )


@pytest.mark.parametrize(
    "champs",
    [
        {"version": "CECRL 2020"},
        {"version": "v" * 33},
        {"editrice": "x"},
        {"comptages": {"total": 0, "par_niveau": {"B1": 1}, "par_competence": {"oral": 1}}},
        {"comptages": {"total": 1, "par_niveau": {"B1": -1}, "par_competence": {"oral": 2}}},
    ],
)
def test_manifeste_refuse_une_valeur_invalide(champs: dict[str, object]) -> None:
    manifeste = composer_manifeste(
        corpus_synthetique(),
        version="cecrl-test.1",
        edition="2020",
        source=SOURCE_SYNTHETIQUE,
        licence=LICENCE_SYNTHETIQUE,
    )
    donnees = manifeste.model_dump(mode="json")
    donnees.update(champs)

    with pytest.raises(ValidationError):
        ManifesteCorpus.model_validate(donnees)


def test_composer_manifeste_deduit_les_facettes() -> None:
    manifeste = composer_manifeste(
        corpus_synthetique(),
        version="cecrl-test.1",
        edition="2020",
        source=SOURCE_SYNTHETIQUE,
        licence=LICENCE_SYNTHETIQUE,
    )

    assert manifeste.langues == ("en", "fr")
    assert manifeste.niveaux == ("A2", "B1", "B2")
    assert manifeste.competences == ("lecture", "ecrit", "oral", "grammaire", "lexique")
    assert manifeste.comptages.par_competence["oral"] == 5


def test_composer_manifeste_refuse_un_corpus_vide() -> None:
    with pytest.raises(ErreurCorpusIndisponible, match="corpus vide"):
        composer_manifeste(
            (),
            version="cecrl-test.1",
            edition="2020",
            source=SOURCE_SYNTHETIQUE,
            licence=LICENCE_SYNTHETIQUE,
        )


def test_serialiser_descripteurs_est_du_lf_utf8() -> None:
    octets = serialiser_descripteurs(corpus_synthetique())

    assert b"\r" not in octets
    assert octets.endswith(b"\n")
    assert "voyage" in octets.decode("utf-8")


def test_manifeste_versionne_du_depot() -> None:
    manifeste = ManifesteCorpus.model_validate_json(MANIFESTE_VERSIONNE.read_text(encoding="utf-8"))

    assert manifeste.version == "cecrl-2020.1"
    assert manifeste.licence.statut == "non_clarifiee"
    assert manifeste.comptages.total == 325
    assert manifeste.comptages.par_niveau == {"A1": 64, "A2": 93, "B1": 93, "B2": 75}
    assert manifeste.comptages.par_competence == {
        "ecoute": 46,
        "ecrit": 50,
        "grammaire": 12,
        "lecture": 59,
        "lexique": 13,
        "oral": 145,
    }
    assert "descripteurs" not in json.loads(MANIFESTE_VERSIONNE.read_text(encoding="utf-8"))
