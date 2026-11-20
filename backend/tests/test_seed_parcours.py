"""Contenu de démonstration du parcours (leçons 1 à 7) : chargement idempotent, cohérence, rattachement aux leçons."""

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Exercice, Langue, Niveau
from app.seed_parcours import EXERCICES_DEMO_PAR_LECON, charger_parcours_demo
from app.services.parcours import exercices_de_lecon, selectionner_exercices

TOUTES_LES_DEMO = [(numero, demo) for numero, exercices in EXERCICES_DEMO_PAR_LECON.items() for demo in exercices]


def _langue_et_niveaux(db: Session):
    langue = db.scalar(select(Langue).where(Langue.code == "en"))
    a1 = db.scalar(select(Niveau).where(Niveau.code == "A1"))
    a2 = db.scalar(select(Niveau).where(Niveau.code == "A2"))
    return langue, a1, a2


def test_sept_lecons_de_trois_exercices() -> None:
    assert sorted(EXERCICES_DEMO_PAR_LECON) == [1, 2, 3, 4, 5, 6, 7]
    assert all(len(exercices) == 3 for exercices in EXERCICES_DEMO_PAR_LECON.values())


def test_chargement_idempotent(db: Session) -> None:
    assert charger_parcours_demo(db) == len(TOUTES_LES_DEMO)
    assert charger_parcours_demo(db) == 0


def test_chaque_exercice_respecte_son_format() -> None:
    for _numero, demo in TOUTES_LES_DEMO:
        contenu = demo.contenu
        assert contenu["intitule"], "chaque exercice a un intitulé affiché au parcours"
        if contenu["format"] == "choix":
            assert contenu["reponses"], "un QCM a au moins une réponse acceptée"
            assert set(contenu["reponses"]) <= set(contenu["choix"])
            assert contenu["explication"]
        else:
            assert contenu["format"] == "redaction"
            assert contenu["mots_minimum"] >= 1
            assert "reponses" not in contenu, "une rédaction est corrigée par l'IA, pas par une réponse attendue"


def test_difficulte_croissante_avec_le_rang() -> None:
    for exercices in EXERCICES_DEMO_PAR_LECON.values():
        difficultes = [demo.difficulte for demo in exercices]
        assert difficultes == [1, 2, 3]


def test_chaque_exercice_est_rattache_a_sa_lecon(db: Session) -> None:
    charger_parcours_demo(db)
    langue, _a1, _a2 = _langue_et_niveaux(db)

    for numero, exercices in EXERCICES_DEMO_PAR_LECON.items():
        rattaches = exercices_de_lecon(db, langue.id_langue, numero)
        assert [json.loads(e.contenu)["intitule"] for e in rattaches] == [
            demo.contenu["intitule"] for demo in exercices
        ]


def test_la_generation_de_la_lecon_1_renvoie_les_rangs_dans_l_ordre(db: Session) -> None:
    """La génération rattache les exercices dans l'ordre de ``selectionner_exercices`` : c'est lui qui fixe le rang."""
    charger_parcours_demo(db)
    langue, a1, a2 = _langue_et_niveaux(db)

    selection = selectionner_exercices(
        db, langue.id_langue, a1, a2, list(langue.niveaux), domaines_faibles=[], numero_lecon=1
    )

    intitules = [json.loads(exercice.contenu)["intitule"] for exercice in selection]
    assert intitules == [demo.contenu["intitule"] for demo in EXERCICES_DEMO_PAR_LECON[1]]


def test_la_generation_ne_prend_pas_les_exercices_d_une_autre_lecon(db: Session) -> None:
    charger_parcours_demo(db)
    langue, a1, a2 = _langue_et_niveaux(db)

    selection = selectionner_exercices(
        db, langue.id_langue, a1, a2, list(langue.niveaux), domaines_faibles=[], numero_lecon=5
    )

    numeros = {exercice.numero_lecon for exercice in selection}
    assert numeros == {5}
    assert db.scalar(select(Exercice).where(Exercice.numero_lecon == 5)) is not None
