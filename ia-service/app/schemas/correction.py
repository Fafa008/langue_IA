"""Contrat v2 du feedback IA sur une réponse libre (US157).

Le retour dépend de la **phase** du parcours, déduite de la leçon atteinte transmise par le backend dans
``ContexteApprenant.lecon_atteinte`` (même règle que ``backend/app/services/phase_parcours.py``) :

- ``PASSIVE`` (leçons 1 à 49) : l'apprenant s'imprègne de la langue ; seules les erreurs essentielles sont
  relevées (trois au plus) et aucune réécriture complète n'est imposée ;
- ``ACTIVE`` (leçon 50 et plus) : l'apprenant produit ; toutes les erreurs utiles sont relevées et le texte
  entièrement corrigé (``reformulation``) est fourni dès qu'une erreur est relevée.

Le service IA reste non autoritaire : le backend revalide ce contrat, enregistre le score et décide du statut.
"""

from typing import Literal

from pydantic import Field, field_validator, model_validator

from app.schemas.base import ModeleStrict
from app.schemas.regles import erreur, normaliser_espaces

PhaseParcours = Literal["PASSIVE", "ACTIVE"]

# Même règle que backend/app/services/phase_parcours.py : passive jusqu'à la leçon 49, active à partir de la 50.
PREMIERE_LECON_ACTIVE = 50
LECON_MAX = 10_000

ERREURS_MAX_PASSIVE = 3
ERREURS_MAX_ACTIVE = 8
POINTS_FORTS_MAX = 3

REPONSE_LIBRE_MAX = 5_000
CONSIGNE_MAX = 500
ENONCE_MAX = 2_000
MOTS_MINIMUM_MAX = 500
COMMENTAIRE_MAX = 300
POINT_FORT_MAX = 160
EXTRAIT_MAX = 120
EXPLICATION_MAX = 240
CONSEIL_MAX = 240


def phase_de_lecon(lecon_atteinte: int) -> PhaseParcours:
    """Phase du parcours pour une leçon atteinte (≥ 1)."""
    if isinstance(lecon_atteinte, bool) or not isinstance(lecon_atteinte, int):
        raise TypeError("La leçon atteinte doit être un entier.")
    if lecon_atteinte < 1:
        raise ValueError("La leçon atteinte doit être supérieure ou égale à 1.")
    return "PASSIVE" if lecon_atteinte < PREMIERE_LECON_ACTIVE else "ACTIVE"


class CorrectionIncoherente(ValueError):
    """Le feedback ne correspond pas au contexte (phase, leçon) ou à la réponse transmise."""


class EntreeCorrection(ModeleStrict):
    """Réponse libre à corriger, avec l'exercice qui l'a demandée (données non fiables)."""

    format: Literal["redaction"] = "redaction"
    consigne: str = Field(min_length=1, max_length=CONSIGNE_MAX)
    enonce: str = Field(min_length=1, max_length=ENONCE_MAX)
    mots_minimum: int = Field(default=30, strict=True, ge=1, le=MOTS_MINIMUM_MAX)
    reponse: str = Field(min_length=1, max_length=REPONSE_LIBRE_MAX)


class ErreurRelevee(ModeleStrict):
    """Passage fautif **recopié de la réponse**, sa correction et la règle en une phrase."""

    extrait: str = Field(min_length=1, max_length=EXTRAIT_MAX)
    correction: str = Field(min_length=1, max_length=EXTRAIT_MAX)
    explication: str = Field(min_length=1, max_length=EXPLICATION_MAX)

    @field_validator("extrait", "correction", "explication")
    @classmethod
    def normaliser_texte(cls, valeur: str) -> str:
        return normaliser_espaces(valeur)

    @model_validator(mode="after")
    def verifier_correction(self) -> "ErreurRelevee":
        """Une « erreur » dont la correction est identique à l'extrait n'apprend rien à l'apprenant."""
        if self.extrait == self.correction:
            raise erreur("La correction doit différer de l'extrait relevé.")
        return self


class ResultatCorrection(ModeleStrict):
    """Feedback v2 de l'IA sur une réponse libre.

    - ``phase`` et ``lecon_atteinte`` : recopiées du contexte, pour que le backend vérifie selon quoi le retour a
      été rédigé ;
    - ``score`` : de 0 à 100, appréciation de la réponse seule (la phase ne le modifie pas) ;
    - ``erreurs`` : trois au plus en phase passive, huit au plus en phase active, sans doublon ;
    - ``reformulation`` : interdite en phase passive, obligatoire en phase active dès qu'une erreur est relevée.
    """

    phase: PhaseParcours
    lecon_atteinte: int = Field(strict=True, ge=1, le=LECON_MAX)
    score: int = Field(strict=True, ge=0, le=100)
    commentaire: str = Field(min_length=1, max_length=COMMENTAIRE_MAX)
    points_forts: list[str] = Field(default_factory=list, max_length=POINTS_FORTS_MAX)
    erreurs: list[ErreurRelevee] = Field(default_factory=list, max_length=ERREURS_MAX_ACTIVE)
    reformulation: str | None = Field(default=None, min_length=1, max_length=REPONSE_LIBRE_MAX)
    conseil: str | None = Field(default=None, min_length=1, max_length=CONSEIL_MAX)

    @field_validator("commentaire")
    @classmethod
    def normaliser_commentaire(cls, valeur: str) -> str:
        return normaliser_espaces(valeur)

    @field_validator("points_forts")
    @classmethod
    def valider_points_forts(cls, points: list[str]) -> list[str]:
        normalises = [normaliser_espaces(point) for point in points]
        if any(not point or len(point) > POINT_FORT_MAX for point in normalises):
            raise erreur(f"Un point fort contient de 1 à {POINT_FORT_MAX} caractères.")
        if len({point.casefold() for point in normalises}) != len(normalises):
            raise erreur("Un point fort ne peut apparaître qu'une fois.")
        return normalises

    @field_validator("erreurs")
    @classmethod
    def verifier_erreurs_uniques(cls, erreurs: list[ErreurRelevee]) -> list[ErreurRelevee]:
        extraits = [e.extrait.casefold() for e in erreurs]
        if len(extraits) != len(set(extraits)):
            raise erreur("Un même extrait ne peut être relevé qu'une fois.")
        return erreurs

    @model_validator(mode="after")
    def verifier_phase(self) -> "ResultatCorrection":
        """La phase découle de la leçon ; elle borne ensuite la forme du retour."""
        attendue = phase_de_lecon(self.lecon_atteinte)
        if self.phase != attendue:
            raise erreur(f"La leçon {self.lecon_atteinte} relève de la phase {attendue}, pas {self.phase}.")
        if self.phase == "PASSIVE":
            if len(self.erreurs) > ERREURS_MAX_PASSIVE:
                raise erreur(f"En phase passive, {ERREURS_MAX_PASSIVE} erreurs essentielles au plus sont relevées.")
            if self.reformulation is not None:
                raise erreur("En phase passive, le retour ne contient pas de version corrigée.")
        elif self.erreurs and self.reformulation is None:
            raise erreur("En phase active, une version corrigée accompagne les erreurs relevées.")
        return self

    def verifier_coherence(self, lecon_atteinte: int, reponse: str) -> None:
        """Le retour concerne la leçon transmise et ne cite que des passages présents dans la réponse."""
        if self.lecon_atteinte != lecon_atteinte:
            raise CorrectionIncoherente(
                f"Le retour cite la leçon {self.lecon_atteinte}, le contexte la leçon {lecon_atteinte}."
            )
        texte = normaliser_espaces(reponse).casefold()
        for erreur_relevee in self.erreurs:
            if erreur_relevee.extrait.casefold() not in texte:
                raise CorrectionIncoherente("Un extrait relevé n'apparaît pas dans la réponse de l'apprenant.")
