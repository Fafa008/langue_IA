"""Données structurées rendues dans les prompts du diagnostic, du chatbot, de la correction et de la recommandation."""

from collections.abc import Sequence
from typing import Literal

from pydantic import Field, field_validator, model_validator

from app.schemas.base import ModeleStrict
from app.schemas.chatbot import (
    EXTRAIT_CORRECTION_MAX,
    HISTORIQUE_CHATBOT_MAX,
    MESSAGE_CHATBOT_MAX,
    REPONSE_CHATBOT_MAX,
    MessageHistorique,
    PhaseAssimil,
    ResumeSession,
    TypeErreurChatbot,
)
from app.schemas.contexte import ContexteApprenant
from app.schemas.correction import EntreeCorrection, phase_de_lecon
from app.schemas.diagnostic import (
    FormatExercice,
    PointFaible,
    PreuveReponse,
    ResultatDiagnostic,
    ResultatDiagnosticPositionnement,
)
from app.schemas.recommandation import RECOMMANDATIONS_MAX, TYPE_PAR_DOMAINE
from app.schemas.regles import (
    RESUME_MEMOIRE_MAX,
    CodeLangue,
    CodeNiveau,
    Competence,
    Referentiel,
    erreur,
    niveaux_du_referentiel,
)

ScenarioDiagnostic = Literal["quotidien", "entretien", "examen"]


class ReponseDiagnosticPrompt(ModeleStrict):
    """Réponse fournie par le backend, considérée comme une donnée non fiable.

    ``enonce`` est facultatif et sert uniquement à la recherche documentaire de l'agent : il est exclu de la
    sérialisation pour ne pas modifier le contrat du prompt LLM ni exposer le corrigé éventuellement contigu.
    """

    id_question: str = Field(min_length=1, max_length=64)
    competence: Competence
    type_reponse: Literal["choix", "texte", "audio"]
    contenu: str = Field(min_length=1, max_length=5000)
    enonce: str | None = Field(default=None, max_length=2000, exclude=True)


class ReponsePositionnementPrompt(ModeleStrict):
    """Fait factuel du test 4 compétences, transmis au prompt v2 sans le corrigé."""

    id_question: str = Field(min_length=1, max_length=64)
    competence: Competence
    type_reponse: Literal["choix", "texte", "audio"]
    contenu: str = Field(min_length=1, max_length=5000)
    enonce: str | None = Field(default=None, max_length=2000, exclude=True)
    format: FormatExercice
    difficulte: int = Field(ge=1)
    justesse: bool
    score_competence: float = Field(ge=0, le=100)
    temps_reponse_secondes: float = Field(ge=0)
    transcription: str | None = None
    confiance_stt: float | None = Field(default=None, ge=0, le=1)


def preuves_depuis_reponses(reponses: Sequence[ReponseDiagnosticPrompt]) -> tuple[PreuveReponse, ...]:
    """Réduire les réponses aux indices vérifiables par le résultat du diagnostic."""
    return tuple(
        PreuveReponse(
            id_question=reponse.id_question,
            competence=reponse.competence,
            type_reponse=reponse.type_reponse,
        )
        for reponse in reponses
    )


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
        identifiants = [reponse.id_question for reponse in self.reponses]
        if len(identifiants) != len(set(identifiants)):
            raise erreur("Deux réponses d'un exemple few-shot ne peuvent pas partager le même identifiant.")
        return self


class ExempleFewShot(ModeleStrict):
    """Exemple d'entrée et de sortie validé par le contrat Pydantic du diagnostic."""

    scenario: ScenarioDiagnostic = "quotidien"
    entree: EntreeExempleFewShot
    sortie: ResultatDiagnostic
    justification: str = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def verifier_sortie(self) -> "ExempleFewShot":
        self.sortie.verifier_coherence(
            self.entree.contexte_apprenant,
            preuves_depuis_reponses(self.entree.reponses),
        )
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


class VariablesEvaluationPositionnement(VariablesEvaluationDiagnostic):
    """Variables du prompt d'évaluation v2 : les faits enrichis sont sérialisés tels quels."""

    reponses: list[ReponsePositionnementPrompt] = Field(max_length=100)


class ExempleFewShotPositionnement(ModeleStrict):
    """Exemple few-shot du contrat v2 : même entrée pédagogique, sortie avec justification et statut."""

    scenario: ScenarioDiagnostic = "quotidien"
    entree: EntreeExempleFewShot
    sortie: ResultatDiagnosticPositionnement
    justification: str = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def verifier_sortie(self) -> "ExempleFewShotPositionnement":
        self.sortie.verifier_coherence(
            self.entree.contexte_apprenant,
            preuves_depuis_reponses(self.entree.reponses),
        )
        return self


class VariablesConversationChatbot(ModeleStrict):
    """Variables dynamiques du prompt de conversation du chatbot (contrat publié 1.2.0)."""

    contexte_apprenant: ContexteApprenant
    historique: list[MessageHistorique] = Field(max_length=HISTORIQUE_CHATBOT_MAX)
    message: str = Field(min_length=1, max_length=MESSAGE_CHATBOT_MAX)


class VariablesConversationChatbotV2(ModeleStrict):
    """Variables du prompt 1.3.0 : descripteur CECRL, niveau effectif et phase Assimil."""

    contexte_apprenant: ContexteApprenant
    historique: list[MessageHistorique] = Field(max_length=HISTORIQUE_CHATBOT_MAX)
    message: str = Field(min_length=1, max_length=MESSAGE_CHATBOT_MAX)
    descripteurs_rag: list[DescripteurRAGPrompt] = Field(default_factory=list, max_length=8)
    phase_assimil: PhaseAssimil = "impregnation"
    niveau_effectif: CodeNiveau
    niveau_confirme: bool = False

    @model_validator(mode="after")
    def verifier_niveau_effectif(self) -> "VariablesConversationChatbotV2":
        """Le niveau injecté doit appartenir au référentiel du contexte."""
        if self.niveau_effectif not in niveaux_du_referentiel(self.contexte_apprenant.referentiel):
            raise erreur("Le niveau effectif n'appartient pas au référentiel du contexte apprenant.")
        if any(
            descripteur.code_langue != self.contexte_apprenant.code_langue
            or descripteur.referentiel != self.contexte_apprenant.referentiel
            for descripteur in self.descripteurs_rag
        ):
            raise erreur("Les descripteurs RAG doivent correspondre à la langue et au référentiel du contexte.")
        return self


class VariablesCorrectionChatbot(ModeleStrict):
    """Variables du prompt de correction en marge du chat."""

    message: str = Field(min_length=1, max_length=MESSAGE_CHATBOT_MAX)
    niveau_effectif: CodeNiveau
    phase_assimil: PhaseAssimil
    resume_session: str = Field(default="", max_length=RESUME_MEMOIRE_MAX)


class VariablesTraductionChatbot(ModeleStrict):
    """Variables du prompt de traduction d'une réponse de l'assistant vers le français."""

    message: str = Field(min_length=1, max_length=REPONSE_CHATBOT_MAX)
    code_langue: CodeLangue
    niveau_effectif: CodeNiveau


class VariablesMemoireChatbot(ModeleStrict):
    """Variables du prompt de clôture : résumé courant et tours de la session, sans identité."""

    code_langue: CodeLangue
    referentiel: Referentiel
    niveau_effectif: CodeNiveau
    phase_assimil: PhaseAssimil
    resume_session: ResumeSession
    tours: list[MessageHistorique] = Field(max_length=HISTORIQUE_CHATBOT_MAX)

    @model_validator(mode="after")
    def verifier_coherence(self) -> "VariablesMemoireChatbot":
        if self.referentiel != ("HSK" if self.code_langue == "zh" else "CECRL"):
            raise erreur("Le référentiel ne correspond pas à la langue de la session.")
        if self.niveau_effectif not in niveaux_du_referentiel(self.referentiel):
            raise erreur("Le niveau effectif n'appartient pas au référentiel de la session.")
        return self


class VariablesExerciceChatbot(ModeleStrict):
    """Variables du prompt d'exercice ciblé : une erreur, un niveau et un descripteur documentaire."""

    contexte_apprenant: ContexteApprenant
    type_erreur: TypeErreurChatbot
    erreur: str = Field(min_length=1, max_length=EXTRAIT_CORRECTION_MAX)
    niveau_effectif: CodeNiveau
    descripteurs_rag: list[DescripteurRAGPrompt] = Field(default_factory=list, max_length=8)

    @model_validator(mode="after")
    def verifier_coherence(self) -> "VariablesExerciceChatbot":
        contexte = self.contexte_apprenant
        if self.niveau_effectif not in niveaux_du_referentiel(contexte.referentiel):
            raise erreur("Le niveau effectif n'appartient pas au référentiel du contexte apprenant.")
        if any(
            descripteur.code_langue != contexte.code_langue or descripteur.referentiel != contexte.referentiel
            for descripteur in self.descripteurs_rag
        ):
            raise erreur("Les descripteurs RAG doivent correspondre à la langue et au référentiel du contexte.")
        return self


class VariablesCorrectionReponseLibre(ModeleStrict):
    """Variables du prompt de correction d'une réponse libre (US157).

    La phase est recalculée depuis la leçon atteinte du contexte : elle n'est jamais fournie librement par
    l'appelant. Les descripteurs, s'il y en a, correspondent à la langue et au référentiel de l'apprenant.
    """

    contexte_apprenant: ContexteApprenant
    phase: Literal["PASSIVE", "ACTIVE"]
    exercice: EntreeCorrection
    descripteurs_rag: list[DescripteurRAGPrompt] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def verifier_coherence(self) -> "VariablesCorrectionReponseLibre":
        contexte = self.contexte_apprenant
        if contexte.lecon_atteinte is None:
            raise erreur("La correction d'une réponse libre exige la leçon atteinte dans le contexte.")
        if self.phase != phase_de_lecon(contexte.lecon_atteinte):
            raise erreur("La phase doit découler de la leçon atteinte du contexte.")
        if any(
            descripteur.code_langue != contexte.code_langue or descripteur.referentiel != contexte.referentiel
            for descripteur in self.descripteurs_rag
        ):
            raise erreur("Les descripteurs RAG doivent correspondre à la langue et au référentiel de l'apprenant.")
        return self


class VariablesRecommandation(ModeleStrict):
    """Variables du prompt d'actions, construites par l'agent à partir de l'entrée validée."""

    contexte_apprenant: ContexteApprenant
    points_faibles: list[PointFaible] = Field(min_length=1, max_length=RECOMMANDATIONS_MAX)
    niveau_vise: CodeNiveau

    @model_validator(mode="after")
    def verifier_coherence(self) -> "VariablesRecommandation":
        """Le niveau visé appartient au référentiel et chaque domaine a un type d'exercice connu."""
        if self.niveau_vise not in niveaux_du_referentiel(self.contexte_apprenant.referentiel):
            raise erreur("Le niveau visé n'appartient pas au référentiel du contexte apprenant.")
        if any(point.domaine not in TYPE_PAR_DOMAINE for point in self.points_faibles):
            raise erreur("Un point faible transmis n'a pas de type d'exercice associé.")
        return self
