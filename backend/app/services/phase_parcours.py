"""Règles métier de phase et de révision d'un parcours."""

from enum import Enum


class PhaseParcours(str, Enum):
    PASSIVE = "PASSIVE"
    ACTIVE = "ACTIVE"


def phase_parcours(lecon_atteinte: int) -> PhaseParcours:
    """Renvoie la phase correspondant au numéro de leçon atteint."""
    if isinstance(lecon_atteinte, bool) or not isinstance(lecon_atteinte, int):
        raise TypeError("lecon_atteinte doit être un entier")
    if lecon_atteinte < 1:
        raise ValueError("lecon_atteinte doit être supérieur ou égal à 1")
    return PhaseParcours.PASSIVE if lecon_atteinte < 50 else PhaseParcours.ACTIVE


def est_lecon_de_revision(lecon_atteinte: int) -> bool:
    """En phase active, les leçons multiples de sept sont des révisions."""
    return phase_parcours(lecon_atteinte) is PhaseParcours.ACTIVE and lecon_atteinte % 7 == 0
