"""Énumérations du diagramme de classes.

En base, chaque valeur est un entier (colonne SMALLINT) ; l'API les reçoit et les renvoie en texte.
Les codes ci-dessous sont enregistrés en base : ne jamais en changer un, seulement en ajouter.
"""

import enum

from sqlalchemy import SmallInteger
from sqlalchemy.types import TypeDecorator


class Role(str, enum.Enum):
    APPRENANT = "APPRENANT"
    FORMATEUR = "FORMATEUR"
    ADMINISTRATEUR = "ADMINISTRATEUR"


class StatutUtilisateur(str, enum.Enum):
    ACTIF = "ACTIF"
    INACTIF = "INACTIF"
    SUSPENDU = "SUSPENDU"


class StatutAbonnement(str, enum.Enum):
    ACTIF = "ACTIF"
    EXPIRE = "EXPIRE"
    SUSPENDU = "SUSPENDU"


class StatutAtelier(str, enum.Enum):
    OUVERT = "OUVERT"
    COMPLET = "COMPLET"
    ANNULE = "ANNULE"


CODES: dict[type[enum.Enum], dict[enum.Enum, int]] = {
    Role: {Role.APPRENANT: 1, Role.FORMATEUR: 2, Role.ADMINISTRATEUR: 3},
    StatutUtilisateur: {StatutUtilisateur.ACTIF: 1, StatutUtilisateur.INACTIF: 2, StatutUtilisateur.SUSPENDU: 3},
    StatutAbonnement: {StatutAbonnement.ACTIF: 1, StatutAbonnement.EXPIRE: 2, StatutAbonnement.SUSPENDU: 3},
    StatutAtelier: {StatutAtelier.OUVERT: 1, StatutAtelier.COMPLET: 2, StatutAtelier.ANNULE: 3},
}


class EnumEntier(TypeDecorator):
    """Colonne SMALLINT côté base, énumération côté Python."""

    impl = SmallInteger
    cache_ok = True

    def __init__(self, enum_cls: type[enum.Enum]) -> None:
        super().__init__()
        self.enum_cls = enum_cls
        self._vers_code = CODES[enum_cls]
        self._depuis_code = {code: membre for membre, code in self._vers_code.items()}

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return self._vers_code[self.enum_cls(value)]

    def process_result_value(self, value, dialect):
        return None if value is None else self._depuis_code[value]
