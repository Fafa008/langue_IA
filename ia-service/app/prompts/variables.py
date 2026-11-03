"""Données structurées rendues dans les prompts du diagnostic."""

from typing import Literal

from pydantic import Field, field_validator, model_validator

from app.schemas.base import ModeleStrict
from app.schemas.contexte import ContexteApprenant
from app.schemas.diagnostic import ResultatDiagnostic
from app.schemas.regles import CodeLangue, CodeNiveau, Competence, Referentiel, erreur, niveaux_du_referentiel

ScenarioDiagnostic = Literal["quotidien", "entretien", "examen"]


class ReponseDiagnosticPrompt(ModeleStrict):
    """Réponse fournie par le backend, considérée comme une donnée non fiable."""

    id_question: str = Field(min_length=1, max_length=64)
    competence: Competence
    type_reponse: Literal["choix", "texte", "audio"]
    contenu: str = Field(min_length=1, max_length=5000)


class DescripteurRAGPrompt(ModeleStrict):
    """Descripteur documentaire renvoyé par le récupérateur partagé."""

    identifiant: str = Field(min_length=1, max_length=128)
    code_langue: CodeLangue
    referentiel: Referentiel
    niveau: CodeNiveau
    competence: Competence
    contenu: str = Field(min_length=1, max_length=3000)

    @model_validator(mode="after")
    def verifier_referentiel(self) -> "DescripteurRAGPrompt":
        if self.referentiel != ("HSK" if self.code_langue == "zh" else "CECRL"):
            raise erreur("Le référentiel du descripteur ne correspond pas à sa langue.")
        if self.niveau not in niveaux_du_referentiel(self.referentiel):
            raise erreur("Le niveau du descripteur n'appartient pas à son référentiel.")
        return self


class EntreeExempleFewShot(ModeleStrict):
    """Entrée anonymisée d'un exemple pédagogique approuvé."""

    contexte_apprenant: ContexteApprenant
    reponses: list[ReponseDiagnosticPrompt] = Field(min_length=1, max_length=10)
    score_preliminaire: float | None = Field(default=None, ge=0, le=100)
    descripteurs_rag: list[DescripteurRAGPrompt] = Field(min_length=1, max_length=10)

    @field_validator("score_preliminaire", mode="before")
    @classmethod
    def refuser_booleen(cls, valeur: object) -> object:
        if isinstance(valeur, bool):
            raise erreur("Le score préliminaire doit être un nombre entre 0 et 100.")
        return valeur

    @model_validator(mode="after")
    def verifier_descripteurs(self) -> "EntreeExempleFewShot":
        contexte = self.contexte_apprenant
        if any(
            descripteur.code_langue != contexte.code_langue or descripteur.referentiel != contexte.referentiel
            for descripteur in self.descripteurs_rag
        ):
            raise erreur("Les descripteurs few-shot doivent correspondre au contexte de l'exemple.")
        return self


class ExempleFewShot(ModeleStrict):
    """Exemple d'entrée et de sortie validé par le contrat Pydantic du diagnostic."""

    scenario: ScenarioDiagnostic = "quotidien"
    entree: EntreeExempleFewShot
    sortie: ResultatDiagnostic
    justification: str = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def verifier_sortie(self) -> "ExempleFewShot":
        self.sortie.verifier_coherence(self.entree.contexte_apprenant)
        return self


class VariablesEvaluationDiagnostic(ModeleStrict):
    """Variables dynamiques du prompt d'évaluation, contrôlées avant tout rendu."""

    scenario: ScenarioDiagnostic = "quotidien"
    code_langue: CodeLangue
    referentiel: Referentiel
    reponses: list[ReponseDiagnosticPrompt] = Field(max_length=100)
    score_preliminaire: float | None = Field(default=None, ge=0, le=100)
    contexte_apprenant: ContexteApprenant
    descripteurs_rag: list[DescripteurRAGPrompt] = Field(max_length=20)
    exemples_few_shot: list[ExempleFewShot] | None = Field(default=None, max_length=3)

    @field_validator("score_preliminaire", mode="before")
    @classmethod
    def refuser_booleen(cls, valeur: object) -> object:
        if isinstance(valeur, bool):
            raise erreur("Le score préliminaire doit être un nombre entre 0 et 100.")
        return valeur

    @model_validator(mode="after")
    def verifier_coherence(self) -> "VariablesEvaluationDiagnostic":
        contexte = self.contexte_apprenant
        if self.code_langue != contexte.code_langue or self.referentiel != contexte.referentiel:
            raise erreur("La langue et le référentiel doivent correspondre au contexte apprenant.")
        if self.exemples_few_shot is not None and any(
            exemple.scenario != self.scenario or exemple.entree.contexte_apprenant.code_langue != self.code_langue
            for exemple in self.exemples_few_shot
        ):
            raise erreur("Les exemples few-shot doivent correspondre au scénario et à la langue du diagnostic.")
        if any(
            descripteur.code_langue != self.code_langue or descripteur.referentiel != self.referentiel
            for descripteur in self.descripteurs_rag
        ):
            raise erreur("Les descripteurs RAG doivent correspondre à la langue et au référentiel du diagnostic.")
        return self
