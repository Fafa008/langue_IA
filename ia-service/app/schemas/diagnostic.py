"""Résultat du diagnostic produit par l'agent IA.

Le service IA ne fournit qu'une **estimation**. Il ne doit pas reproduire le score objectif calculé par le backend
(``backend/app/schemas/diagnostic.py`` et ``backend/app/services/scoring.py``) : le score de confiance et l'écart
avec le niveau préliminaire servent à documenter l'estimation, pas à recalculer la note du test.
"""

from enum import Enum

from pydantic import Field, field_validator, model_validator

from app.schemas.base import ModeleStrict
from app.schemas.contexte import ContexteApprenant
from app.schemas.regles import (
    DESCRIPTION_POINT_FAIBLE_MAX,
    CodeLangue,
    CodeNiveau,
    Competence,
    Referentiel,
    erreur,
    niveaux_du_referentiel,
    normaliser_espaces,
    referentiel_pour_langue,
)

ECART_MIN = -5
ECART_MAX = 5


class DiagnosticIncoherent(ValueError):
    """Le résultat ne correspond pas au contexte transmis par le backend."""


class PhaseAssimil(str, Enum):
    """Phase de la méthode Assimil.

    La méthode distingue deux phases : la **phase passive** (écoute, lecture, imprégnation) puis la **phase
    active** (réutilisation et expression). Aucune autre phase n'existe dans le dépôt : en ajouter une relève de
    l'équipe pédagogique, pas de ce module.
    """

    PASSIVE = "passive"
    ACTIVE = "active"


class PointFaible(ModeleStrict):
    """Point faible identifié par compétence, avec une description courte destinée au formateur."""

    competence: Competence
    description: str = Field(min_length=1, max_length=DESCRIPTION_POINT_FAIBLE_MAX)

    @field_validator("description")
    @classmethod
    def normaliser_description(cls, valeur: str) -> str:
        """«  très   rapide  » → « très rapide » (la longueur minimale est vérifiée par le champ)."""
        return normaliser_espaces(valeur)


def calculer_ecart(referentiel: str, niveau_preliminaire: str, niveau_estime: str) -> int:
    """Écart en nombre de niveaux, positif quand l'estimation dépasse le niveau préliminaire.

    Les deux niveaux doivent appartenir au référentiel ; la position suit l'ordre officiel (A1 < A2 < … < C2,
    HSK 1 < … < HSK 6).
    """
    niveaux = niveaux_du_referentiel(referentiel)
    if niveau_preliminaire not in niveaux or niveau_estime not in niveaux:
        raise erreur(f"Les niveaux doivent appartenir au référentiel {referentiel}.")
    return niveaux.index(niveau_estime) - niveaux.index(niveau_preliminaire)


class ResultatDiagnostic(ModeleStrict):
    """Estimation structurée de l'agent Diagnostic.

    - ``niveau_estime`` : proposition de l'agent, dans le référentiel imposé par la langue.
    - ``phase_assimil`` : phase suggérée ; le backend reste libre de la retenir ou non.
    - ``points_faibles`` : zéro à cinq compétences, sans doublon (un diagnostic peut n'en signaler aucun).
    - ``score_confiance`` : fiabilité de l'estimation, entre 0 et 1. Ce n'est jamais un score de bonnes réponses.
    - ``niveau_preliminaire`` : niveau de référence effectivement utilisé, conservé pour l'auditabilité.
    - ``ecart_avec_niveau_preliminaire`` : différence d'indices (``-5`` à ``+5``), vérifiée par le modèle.
    """

    code_langue: CodeLangue
    referentiel: Referentiel
    niveau_estime: CodeNiveau
    phase_assimil: PhaseAssimil
    points_faibles: list[PointFaible] = Field(default_factory=list, max_length=5)
    score_confiance: float = Field(ge=0.0, le=1.0)
    niveau_preliminaire: CodeNiveau
    ecart_avec_niveau_preliminaire: int = Field(strict=True, ge=ECART_MIN, le=ECART_MAX)

    @field_validator("score_confiance", mode="before")
    @classmethod
    def refuser_booleen_et_texte(cls, valeur: object) -> object:
        """Un score se mesure en nombre : ni ``true``, ni ``"0.8"``."""
        if isinstance(valeur, bool) or isinstance(valeur, str):
            raise erreur("Le score de confiance doit être un nombre entre 0 et 1.")
        return valeur

    @field_validator("points_faibles")
    @classmethod
    def verifier_competences_uniques(cls, points: list[PointFaible]) -> list[PointFaible]:
        competences = [point.competence for point in points]
        if len(competences) != len(set(competences)):
            raise erreur("Une compétence ne peut apparaître qu'une fois dans les points faibles.")
        return points

    @model_validator(mode="after")
    def verifier_referentiel_et_niveaux(self) -> "ResultatDiagnostic":
        attendu = referentiel_pour_langue(self.code_langue)
        if self.referentiel != attendu:
            raise erreur(f"La langue « {self.code_langue} » impose le référentiel {attendu}, pas {self.referentiel}.")
        niveaux = niveaux_du_referentiel(self.referentiel)
        for champ, valeur in (
            ("niveau estimé", self.niveau_estime),
            ("niveau préliminaire", self.niveau_preliminaire),
        ):
            if valeur not in niveaux:
                raise erreur(f"Le {champ} « {valeur} » n'appartient pas au référentiel {self.referentiel}.")
        return self

    @model_validator(mode="after")
    def verifier_ecart(self) -> "ResultatDiagnostic":
        attendu = calculer_ecart(self.referentiel, self.niveau_preliminaire, self.niveau_estime)
        if attendu != self.ecart_avec_niveau_preliminaire:
            raise erreur(
                "L'écart avec le niveau préliminaire ne correspond pas aux niveaux transmis "
                f"(attendu {attendu}, reçu {self.ecart_avec_niveau_preliminaire})."
            )
        return self

    def verifier_coherence(self, contexte: ContexteApprenant) -> None:
        """Vérifie que le résultat concerne bien le contexte reçu (langue et niveau de départ).

        Le référentiel n'est pas comparé séparément : il découle de la langue, déjà vérifiée.
        """
        if self.code_langue != contexte.code_langue:
            raise DiagnosticIncoherent(
                f"Le résultat concerne la langue « {self.code_langue} », le contexte « {contexte.code_langue} »."
            )
        if self.niveau_preliminaire != contexte.niveau_preliminaire:
            raise DiagnosticIncoherent(
                "Le résultat utilise le niveau préliminaire "
                f"« {self.niveau_preliminaire} », le contexte « {contexte.niveau_preliminaire} »."
            )
