"""Contrat de l'agent Recommandation : propositions d'actions, décision finale au backend.

L'agent ne choisit ni le niveau officiel ni les exercices à afficher : il propose au plus cinq actions, une par
domaine faible transmis par le backend, avec un type d'exercice compatible et une priorité. Le backend revalide
ce contrat, écarte les propositions inexploitables et décide de ce qui alimente le parcours.

Les validations déterministes sont volontairement strictes : un domaine non demandé, un type incompatible, une
priorité discontinue ou une confiance nulle accompagnée d'actions sont refusés avant de quitter le service IA.
"""

from typing import Literal

from pydantic import Field, field_validator, model_validator

from app.schemas.base import ModeleStrict
from app.schemas.contexte import ContexteApprenant
from app.schemas.diagnostic import PointFaible
from app.schemas.regles import (
    CodeLangue,
    CodeNiveau,
    DomaineFaiblesse,
    Referentiel,
    erreur,
    niveaux_du_referentiel,
    normaliser_espaces,
    referentiel_pour_langue,
)

CODE_AGENT = "recommandation"
VERSION_AGENT = "1.0.0"
VERSION_ACTIONS = "1.0.0"
BUDGET_MS = 30_000
RECOMMANDATIONS_MAX = 5

TypeExerciceRecommandation = Literal["GRAMMAIRE", "VOCABULAIRE", "COMPREHENSION", "ECOUTE", "ORAL"]

# Miroir de ``backend/app/services/parcours.py::_DOMAINES_TYPES``. Un domaine absent (expression_ecrite) ne
# donne lieu à aucune proposition : le backend ne sait pas lui associer un type d'exercice.
TYPE_PAR_DOMAINE: dict[DomaineFaiblesse, TypeExerciceRecommandation] = {
    "grammaire": "GRAMMAIRE",
    "vocabulaire": "VOCABULAIRE",
    "comprehension_ecrite": "COMPREHENSION",
    "comprehension_orale": "ECOUTE",
    "expression_orale": "ORAL",
}


class RecommandationIncoherente(ValueError):
    """Le résultat ne correspond pas au contexte ou aux points faibles transmis par le backend."""


class EntreeRecommandation(ModeleStrict):
    """Points faibles du diagnostic et niveau visé, préparés par le backend."""

    points_faibles: list[PointFaible] = Field(min_length=1, max_length=RECOMMANDATIONS_MAX)
    niveau_vise: CodeNiveau

    @field_validator("points_faibles")
    @classmethod
    def verifier_domaines_uniques(cls, points: list[PointFaible]) -> list[PointFaible]:
        """Un seul point faible par domaine : une recommandation par domaine suffit."""
        domaines = [point.domaine for point in points]
        if len(domaines) != len(set(domaines)):
            raise erreur("Un domaine ne peut apparaître qu'une fois dans les points faibles.")
        return points


class ActionRecommandee(ModeleStrict):
    """Une action courte, rattachée à un domaine faible et à un type d'exercice compatible."""

    domaine: DomaineFaiblesse
    type_exercice: TypeExerciceRecommandation
    action: str = Field(min_length=1, max_length=240)
    justification: str = Field(min_length=1, max_length=240)
    priorite: int = Field(strict=True, ge=1, le=RECOMMANDATIONS_MAX)

    @field_validator("action", "justification")
    @classmethod
    def normaliser_texte(cls, valeur: str) -> str:
        return normaliser_espaces(valeur)

    @model_validator(mode="after")
    def verifier_type_et_domaine(self) -> "ActionRecommandee":
        """Le type d'exercice découle du domaine : il ne peut pas être choisi librement par le modèle."""
        attendu = TYPE_PAR_DOMAINE.get(self.domaine)
        if attendu is None:
            raise erreur(f"Le domaine « {self.domaine} » n'a pas de type d'exercice associé.")
        if self.type_exercice != attendu:
            raise erreur(f"Le domaine « {self.domaine} » impose le type {attendu}, pas {self.type_exercice}.")
        return self


class ResultatRecommandation(ModeleStrict):
    """Proposition validée produite par l'agent Recommandation."""

    code_langue: CodeLangue
    referentiel: Referentiel
    niveau_cible: CodeNiveau
    recommandations: list[ActionRecommandee] = Field(default_factory=list, max_length=RECOMMANDATIONS_MAX)
    resume: str = Field(min_length=1, max_length=240)
    confiance: float = Field(ge=0.0, le=1.0)

    @field_validator("confiance", mode="before")
    @classmethod
    def refuser_booleen_et_texte(cls, valeur: object) -> object:
        if isinstance(valeur, bool) or isinstance(valeur, str):
            raise erreur("La confiance doit être un nombre entre 0 et 1.")
        return valeur

    @field_validator("resume")
    @classmethod
    def normaliser_resume(cls, valeur: str) -> str:
        return normaliser_espaces(valeur)

    @model_validator(mode="after")
    def verifier_referentiel_et_niveau(self) -> "ResultatRecommandation":
        attendu = referentiel_pour_langue(self.code_langue)
        if self.referentiel != attendu:
            raise erreur(f"La langue « {self.code_langue} » impose le référentiel {attendu}, pas {self.referentiel}.")
        if self.niveau_cible not in niveaux_du_referentiel(self.referentiel):
            raise erreur(f"Le niveau « {self.niveau_cible} » n'appartient pas au référentiel {self.referentiel}.")
        return self

    @model_validator(mode="after")
    def verifier_unites_et_priorites(self) -> "ResultatRecommandation":
        domaines = [action.domaine for action in self.recommandations]
        if len(domaines) != len(set(domaines)):
            raise erreur("Un domaine ne peut apparaître qu'une fois dans les recommandations.")
        priorites = sorted(action.priorite for action in self.recommandations)
        if priorites != list(range(1, len(priorites) + 1)):
            raise erreur("Les priorités doivent être contiguës, de 1 au nombre de recommandations.")
        return self

    @model_validator(mode="after")
    def verifier_confiance(self) -> "ResultatRecommandation":
        """Sans preuve exploitable, le modèle ne peut pas affirmer d'action."""
        if self.confiance == 0.0 and self.recommandations:
            raise erreur("Une confiance nulle ne peut pas accompagner de recommandation.")
        return self

    def verifier_coherence(self, entree: EntreeRecommandation, contexte: ContexteApprenant) -> None:
        """Vérifier que la proposition concerne bien la langue, le niveau et les domaines demandés."""
        if self.code_langue != contexte.code_langue:
            raise RecommandationIncoherente(
                f"Le résultat concerne la langue « {self.code_langue} », le contexte « {contexte.code_langue} »."
            )
        if self.referentiel != contexte.referentiel:
            raise RecommandationIncoherente(
                f"Le résultat utilise le référentiel « {self.referentiel} », le contexte « {contexte.referentiel} »."
            )
        if self.niveau_cible != entree.niveau_vise:
            raise RecommandationIncoherente(
                f"Le niveau cible « {self.niveau_cible} » ne correspond pas au niveau visé "
                f"« {entree.niveau_vise} »."
            )
        demandes = {point.domaine for point in entree.points_faibles}
        for action in self.recommandations:
            if action.domaine not in demandes:
                raise RecommandationIncoherente(
                    f"Le domaine « {action.domaine} » ne figure pas parmi les points faibles transmis."
                )
