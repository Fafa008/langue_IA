"""Tests de la règle de phase et de révision d'un parcours."""

import pytest

from app.models.enums import StatutParcours, TypeExercice
from app.services.phase_parcours import PhaseParcours, est_lecon_de_revision, phase_parcours


@pytest.mark.parametrize(
    ("lecon", "phase"),
    [(1, PhaseParcours.PASSIVE), (49, PhaseParcours.PASSIVE), (50, PhaseParcours.ACTIVE), (56, PhaseParcours.ACTIVE)],
)
def test_determine_la_phase(lecon: int, phase: PhaseParcours) -> None:
    assert phase_parcours(lecon) is phase


@pytest.mark.parametrize(("lecon", "revision"), [(49, False), (50, False), (56, True), (63, True), (70, True)])
def test_determine_les_lecons_de_revision(lecon: int, revision: bool) -> None:
    assert est_lecon_de_revision(lecon) is revision


@pytest.mark.parametrize("lecon", [0, -1])
def test_refuse_les_numeros_de_lecon_inferieurs_a_un(lecon: int) -> None:
    with pytest.raises(ValueError):
        phase_parcours(lecon)


@pytest.mark.parametrize("lecon", ["1", 1.0, None, True])
def test_refuse_les_numeros_de_lecon_non_entiers(lecon: object) -> None:
    with pytest.raises(TypeError):
        phase_parcours(lecon)


def test_proprietes_non_persistees_du_modele_parcours() -> None:
    from app.models import Parcours

    parcours = Parcours(lecon_atteinte=49, statut=StatutParcours.EN_COURS)
    assert parcours.phase is PhaseParcours.PASSIVE
    assert parcours.est_lecon_de_revision is False
    assert "phase" not in Parcours.__table__.columns
    assert "est_lecon_de_revision" not in Parcours.__table__.columns


def test_enums_des_modeles_sont_accessibles() -> None:
    assert StatutParcours.EN_COURS.value == "EN_COURS"
    assert TypeExercice.GRAMMAIRE.value == "GRAMMAIRE"
