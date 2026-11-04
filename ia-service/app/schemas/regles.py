"""Valeurs autorisées et règles de validation du contrat interne du service IA.

Toutes les valeurs sont reprises de l'existant, aucune n'est inventée :

- langues : ``backend/app/seed.py`` (``LANGUES``) et ``frontend/src/types/langue.ts`` ;
- niveaux : ``backend/app/seed.py`` (``CECRL`` et ``HSK``) ;
- compétences et domaines de faiblesse : ``docs/api/contrat-frontend.md`` et
  ``frontend/src/types/test-diagnostic.ts`` ;
- référentiel : ``backend/app/services/scoring.py`` (le mandarin ``zh`` utilise HSK, les autres langues le CECRL).

Les messages d'erreur sont en français et destinés aux journaux du service : le backend les traduit avant de les
exposer au frontend.
"""

from typing import Literal

from pydantic_core import PydanticCustomError

REFERENTIEL_CECRL = "CECRL"
REFERENTIEL_HSK = "HSK"

NIVEAUX_CECRL = ("A1", "A2", "B1", "B2", "C1", "C2")
NIVEAUX_HSK = ("HSK 1", "HSK 2", "HSK 3", "HSK 4", "HSK 5", "HSK 6")

LANGUES = ("fr", "en", "zh", "it", "de")
LANGUE_HSK = "zh"

COMPETENCES = ("grammaire", "lecture", "ecoute", "ecrit", "oral")
DOMAINES_FAIBLESSE = (
    "grammaire",
    "vocabulaire",
    "comprehension_ecrite",
    "comprehension_orale",
    "expression_ecrite",
    "expression_orale",
)

# Alias de types : ils ferment l'OpenAPI et empêchent toute valeur hors référentiel.
CodeLangue = Literal["fr", "en", "zh", "it", "de"]
Referentiel = Literal["CECRL", "HSK"]
NiveauCecrl = Literal["A1", "A2", "B1", "B2", "C1", "C2"]
NiveauHsk = Literal["HSK 1", "HSK 2", "HSK 3", "HSK 4", "HSK 5", "HSK 6"]
CodeNiveau = NiveauCecrl | NiveauHsk
Competence = Literal["grammaire", "lecture", "ecoute", "ecrit", "oral"]
DomaineFaiblesse = Literal[
    "grammaire",
    "vocabulaire",
    "comprehension_ecrite",
    "comprehension_orale",
    "expression_ecrite",
    "expression_orale",
]

# Descripteurs RAG qui peuvent documenter un domaine. Le vocabulaire n'a pas de compétence propre dans le
# contrat : il s'appuie sur les descripteurs des productions et de la lecture.
COMPETENCES_DESCRIPTEUR_PAR_DOMAINE: dict[str, tuple[Competence, ...]] = {
    "grammaire": ("grammaire",),
    "vocabulaire": ("lecture", "ecrit", "oral"),
    "comprehension_ecrite": ("lecture",),
    "comprehension_orale": ("ecoute",),
    "expression_ecrite": ("ecrit",),
    "expression_orale": ("oral",),
}

# Longueurs maximales (caractères), alignées sur les limites du contrat public quand elles existent.
RESUME_MEMOIRE_MAX = 2000
POINT_MEMOIRE_MAX = 120
OBSERVATION_POINT_FAIBLE_MAX = 160
JUSTIFICATION_POINT_FAIBLE_MAX = 240
MESSAGE_ERREUR_MAX = 500


def erreur(message: str) -> PydanticCustomError:
    """Erreur de validation dont le message est repris tel quel (sans le préfixe « Value error, »)."""
    return PydanticCustomError("valeur_invalide", message)


def normaliser_espaces(valeur: str) -> str:
    """«  B1  » → « B1 » : évite qu'une valeur valide soit refusée à cause d'espaces."""
    return " ".join(valeur.split())


def referentiel_pour_langue(code_langue: str) -> str:
    """Référentiel imposé par la langue : HSK pour le mandarin, CECRL pour les autres."""
    return REFERENTIEL_HSK if code_langue == LANGUE_HSK else REFERENTIEL_CECRL


def niveaux_du_referentiel(referentiel: str) -> tuple[str, ...]:
    """Niveaux autorisés d'un référentiel, dans l'ordre croissant."""
    return NIVEAUX_HSK if referentiel == REFERENTIEL_HSK else NIVEAUX_CECRL
