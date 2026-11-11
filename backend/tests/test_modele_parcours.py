"""Tests des contraintes PostgreSQL des parcours et exercices."""

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Exercice, Langue, Niveau, Parcours, ParcoursExercice, TypeExercice
from app.models import TestDiagnostic as Diagnostic
from tests.conftest import creer_utilisateur


def _creer_parcours_et_exercice(db: Session) -> tuple[Parcours, Exercice]:
    apprenant = creer_utilisateur(db)
    langue = db.scalar(select(Langue).where(Langue.code == "en"))
    niveau = db.scalar(select(Niveau).where(Niveau.code == "A1"))
    assert langue is not None
    assert niveau is not None
    test_diagnostic = Diagnostic(apprenant=apprenant.apprenant, langue=langue, niveau=niveau)
    db.add(test_diagnostic)
    db.flush()
    parcours = Parcours(test_diagnostic=test_diagnostic, langue=langue, niveau_vise=niveau)
    exercice = Exercice(
        type=TypeExercice.GRAMMAIRE,
        contenu="Choose a verb.",
        difficulte=1,
        langue=langue,
        niveau=niveau,
    )
    db.add_all([parcours, exercice])
    db.commit()
    return parcours, exercice


@pytest.mark.parametrize("lecon_atteinte", [0, -1])
def test_refuse_une_lecon_atteinte_inferieure_a_un(db: Session, lecon_atteinte: int) -> None:
    parcours, _ = _creer_parcours_et_exercice(db)
    parcours.lecon_atteinte = lecon_atteinte
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_refuse_une_difficulte_superieure_a_cinq(db: Session) -> None:
    _, exercice = _creer_parcours_et_exercice(db)
    exercice.difficulte = 6
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_refuse_un_score_superieur_a_cent(db: Session) -> None:
    parcours, exercice = _creer_parcours_et_exercice(db)
    db.add(ParcoursExercice(parcours=parcours, exercice=exercice, numero_lecon=1, score_obtenu=101))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_refuse_un_doublon_parcours_lecon_exercice(db: Session) -> None:
    parcours, exercice = _creer_parcours_et_exercice(db)
    db.add_all(
        [
            ParcoursExercice(parcours=parcours, exercice=exercice, numero_lecon=1),
            ParcoursExercice(parcours=parcours, exercice=exercice, numero_lecon=1),
        ]
    )
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_refuse_plusieurs_parcours_pour_un_test_diagnostic(db: Session) -> None:
    parcours, _ = _creer_parcours_et_exercice(db)
    second_parcours = Parcours(
        id_test=parcours.id_test,
        id_langue=parcours.id_langue,
        id_niveau_vise=parcours.id_niveau_vise,
    )
    db.add(second_parcours)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
