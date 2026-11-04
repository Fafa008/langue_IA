"""Tests de la bibliothèque few-shot : intégrité du catalogue et sélection exacte."""

import json
import shutil
from pathlib import Path

import pytest

from app.core.erreurs import ErreurRegistre
from app.prompts.bibliotheque_few_shot import BibliothequeFewShot

REPERTOIRE_EXEMPLES = Path(__file__).parents[1] / "app" / "prompts" / "exemples" / "diagnostic"
SCENARIOS = ("quotidien", "entretien", "examen")
LANGUES = ("fr", "en", "zh", "it", "de")


@pytest.mark.parametrize("scenario", SCENARIOS)
@pytest.mark.parametrize("langue", LANGUES)
def test_selectionne_un_exemple_compatible_avec_scenario_et_langue(scenario: str, langue: str) -> None:
    (exemple,) = BibliothequeFewShot().selectionner(scenario, langue)

    assert exemple.scenario == scenario
    assert exemple.entree.contexte_apprenant.code_langue == langue
    assert exemple.entree.contexte_apprenant.referentiel == ("HSK" if langue == "zh" else "CECRL")
    assert exemple.entree.reponses
    assert exemple.entree.descripteurs_rag
    assert exemple.sortie.code_langue == langue
    assert exemple.sortie.niveau_preliminaire == exemple.entree.contexte_apprenant.niveau_preliminaire


def _copier_catalogue(destination: Path) -> None:
    for scenario in SCENARIOS:
        shutil.copyfile(REPERTOIRE_EXEMPLES / f"{scenario}.json", destination / f"{scenario}.json")


def test_refuse_un_catalogue_incomplet(tmp_path: Path) -> None:
    _copier_catalogue(tmp_path)
    (tmp_path / "examen.json").unlink()

    with pytest.raises(ErreurRegistre, match="absent ou invalide"):
        BibliothequeFewShot(tmp_path)


def test_refuse_un_exemple_dont_le_scenario_ne_correspond_pas_au_fichier(tmp_path: Path) -> None:
    _copier_catalogue(tmp_path)
    donnees = json.loads((tmp_path / "entretien.json").read_text(encoding="utf-8"))
    donnees[0]["scenario"] = "examen"
    (tmp_path / "entretien.json").write_text(json.dumps(donnees), encoding="utf-8")

    with pytest.raises(ErreurRegistre, match="mauvais scénario"):
        BibliothequeFewShot(tmp_path)


def test_refuse_deux_exemples_pour_la_meme_langue_et_le_meme_scenario(tmp_path: Path) -> None:
    _copier_catalogue(tmp_path)
    chemin = tmp_path / "quotidien.json"
    donnees = json.loads(chemin.read_text(encoding="utf-8"))
    donnees.append(donnees[0])
    chemin.write_text(json.dumps(donnees), encoding="utf-8")

    with pytest.raises(ErreurRegistre, match="Plusieurs exemples"):
        BibliothequeFewShot(tmp_path)


def test_refuse_un_exemple_dont_la_sortie_ne_correspond_pas_a_son_contexte(tmp_path: Path) -> None:
    _copier_catalogue(tmp_path)
    chemin = tmp_path / "quotidien.json"
    donnees = json.loads(chemin.read_text(encoding="utf-8"))
    donnees[0]["sortie"]["code_langue"] = "en"
    chemin.write_text(json.dumps(donnees), encoding="utf-8")

    with pytest.raises(ErreurRegistre, match="exemple few-shot.*invalide"):
        BibliothequeFewShot(tmp_path)


def test_ne_fait_pas_de_repli_vers_un_autre_scenario_ou_une_autre_langue() -> None:
    bibliotheque = BibliothequeFewShot()

    with pytest.raises(ErreurRegistre, match="Aucun exemple few-shot"):
        bibliotheque.selectionner("quotidien", "es")
