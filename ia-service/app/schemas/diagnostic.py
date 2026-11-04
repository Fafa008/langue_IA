"""Résultat du diagnostic produit par l'agent IA.

Le service IA ne fournit qu'une **estimation**. Il ne doit pas reproduire le score objectif calculé par le backend
(``backend/app/schemas/diagnostic.py`` et ``backend/app/services/scoring.py``) : le score de confiance et l'écart
avec le niveau préliminaire servent à documenter l'estimation, pas à recalculer la note du test.

Un point faible sépare toujours le **fait observé** (``observation``) de son **interprétation** (``justification``)
et cite la réponse qui le démontre (``id_question``). La phase Assimil est déduite des preuves disponibles, jamais
du seul niveau global.
"""

from collections.abc import Sequence
from enum import Enum
from typing import Literal

from pydantic import Field, field_validator, model_validator

from app.schemas.base import ModeleStrict
from app.schemas.contexte import ContexteApprenant
from app.schemas.regles import (
    JUSTIFICATION_POINT_FAIBLE_MAX,
    OBSERVATION_POINT_FAIBLE_MAX,
    CodeLangue,
    CodeNiveau,
    Competence,
    DomaineFaiblesse,
    Referentiel,
    erreur,
    niveaux_du_referentiel,
    normaliser_espaces,
    referentiel_pour_langue,
)

ECART_MIN = -5
ECART_MAX = 5


class DiagnosticIncoherent(ValueError):
    """Le résultat ne correspond pas au contexte ou aux preuves transmis par le backend."""


class PhaseAssimil(str, Enum):
    """Phase de la méthode Assimil.

    La méthode distingue l'**imprégnation** (écoute, lecture, reconnaissance, répétition) puis l'**activation**
    (réutilisation autonome et production personnelle). Aucune autre phase n'existe dans le dépôt : en ajouter une
    relève de l'équipe pédagogique, pas de ce module.
    """

    IMPREGNATION = "impregnation"
    ACTIVATION = "activation"


class PreuveReponse(ModeleStrict):
    """Réponse disponible, réduite aux indices nécessaires pour vérifier une preuve.

    Le contenu n'est pas repris : la vérification porte sur la compétence, le type de réponse et l'identifiant de
    la question citée.
    """

    id_question: str = Field(min_length=1, max_length=64)
    competence: Competence
    type_reponse: Literal["choix", "texte", "audio"]


class PointFaible(ModeleStrict):
    """Difficulté identifiée, avec sa preuve factuelle et son interprétation pédagogique.

    - ``observation`` ne reprend que ce qui est directement lisible dans la réponse citée : formulation,
      absence d'un élément, hésitation explicite, réponse incomplète. Aucun niveau, aucun pourcentage.
    - ``justification`` relie cette observation au domaine et au descripteur, sans attribuer de niveau de
      maîtrise non démontré.
    """

    domaine: DomaineFaiblesse
    id_question: str = Field(min_length=1, max_length=64)
    observation: str = Field(min_length=1, max_length=OBSERVATION_POINT_FAIBLE_MAX)
    justification: str = Field(min_length=1, max_length=JUSTIFICATION_POINT_FAIBLE_MAX)

    @field_validator("observation", "justification")
    @classmethod
    def normaliser_texte(cls, valeur: str) -> str:
        """«  très   rapide  » → « très rapide » (la longueur minimale est vérifiée par le champ)."""
        return normaliser_espaces(valeur)


def preuve_directe(domaine: str, preuve: PreuveReponse) -> bool:
    """Indiquer si une réponse constitue une preuve directe pour un domaine de faiblesse.

    Une réponse à choix seule ne prouve jamais une compréhension : le service IA ne reçoit pas le corrigé. Les
    compétences réceptives ne sont donc exploitables que par une réponse rédigée ou transcrite qui exprime
    elle-même l'incompréhension. La grammaire et le vocabulaire s'observent sur une production libre.
    """
    production = preuve.type_reponse in ("texte", "audio")
    if domaine in ("grammaire", "vocabulaire"):
        return production
    if domaine == "expression_ecrite":
        return preuve.competence == "ecrit" and preuve.type_reponse == "texte"
    if domaine == "expression_orale":
        return preuve.competence == "oral" and preuve.type_reponse == "audio"
    if domaine == "comprehension_ecrite":
        return preuve.competence == "lecture" and production
    if domaine == "comprehension_orale":
        return preuve.competence == "ecoute" and production
    return False


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
    - ``points_faibles`` : zéro à cinq domaines, sans doublon. Chaque point cite la réponse qui le démontre.
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
    def verifier_domaines_uniques(cls, points: list[PointFaible]) -> list[PointFaible]:
        domaines = [point.domaine for point in points]
        if len(domaines) != len(set(domaines)):
            raise erreur("Un domaine ne peut apparaître qu'une fois dans les points faibles.")
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

    @model_validator(mode="after")
    def verifier_confiance_et_points(self) -> "ResultatDiagnostic":
        """Une confiance nulle signifie « aucune preuve » : elle ne peut pas accompagner un point faible affirmé."""
        if self.score_confiance == 0.0 and self.points_faibles:
            raise erreur("Un résultat sans confiance ne peut pas affirmer un point faible.")
        return self

    def verifier_preuves(self, reponses: Sequence[PreuveReponse]) -> None:
        """Vérifier que chaque point faible et la phase reposent sur une réponse réellement disponible.

        Un point faible doit citer une réponse existante et cette réponse doit être une preuve directe du domaine.
        La phase ``activation`` exige au moins une production libre (``texte`` ou ``audio``) ; une phase
        ``impregnation`` reste possible avec des choix seuls.
        """
        preuves = {preuve.id_question: preuve for preuve in reponses}
        if len(preuves) != len(reponses):
            raise DiagnosticIncoherent("Deux réponses disponibles partagent le même identifiant de question.")
        for point in self.points_faibles:
            preuve = preuves.get(point.id_question)
            if preuve is None:
                raise DiagnosticIncoherent(
                    f"Le point faible « {point.domaine} » cite la réponse « {point.id_question} », absente du "
                    "diagnostic."
                )
            if not preuve_directe(point.domaine, preuve):
                raise DiagnosticIncoherent(
                    f"La réponse « {point.id_question} » ne constitue pas une preuve directe pour le domaine "
                    f"« {point.domaine} »."
                )
        if self.phase_assimil is PhaseAssimil.ACTIVATION and not any(
            preuve.type_reponse in ("texte", "audio") for preuve in reponses
        ):
            raise DiagnosticIncoherent("La phase activation exige au moins une production libre (texte ou audio).")

    def verifier_coherence(
        self,
        contexte: ContexteApprenant,
        reponses: Sequence[PreuveReponse] | None = None,
    ) -> None:
        """Vérifier que le résultat concerne bien le contexte reçu (langue et niveau de départ).

        Le référentiel n'est pas comparé séparément : il découle de la langue, déjà vérifiée. Quand les réponses
        sont fournies, les points faibles et la phase sont aussi confrontés aux preuves disponibles.
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
        if reponses is not None:
            self.verifier_preuves(reponses)
