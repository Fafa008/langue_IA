"""Frontière de confiance backend ↔ service IA (PRE-05).

Le backend ne partage pas les modèles du service IA : il redéfinit ici le strict nécessaire du contrat
``POST /diagnostic/evaluer``. Cette duplication est volontaire — elle empêche le backend de dépendre du paquet
``ia-service`` et lui permet de refuser une réponse hors contrat au lieu de la relayer au frontend.

Aucune donnée identifiante n'est transmise : le service IA reçoit la langue, le référentiel, le niveau
préliminaire, les énoncés nécessaires à la recherche documentaire, les réponses et le score déterministe.
Le score et le niveau publics restent calculés par le backend.
"""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

CodeLangueIA = Literal["fr", "en", "zh", "it", "de"]
ReferentielIA = Literal["CECRL", "HSK"]
NIVEAUX_IA: dict[str, tuple[str, ...]] = {
    "CECRL": ("A1", "A2", "B1", "B2", "C1", "C2"),
    "HSK": ("HSK 1", "HSK 2", "HSK 3", "HSK 4", "HSK 5", "HSK 6"),
}
CompetenceIA = Literal["grammaire", "lecture", "ecoute", "ecrit", "oral"]
DomaineFaiblesseIA = Literal[
    "grammaire",
    "vocabulaire",
    "comprehension_ecrite",
    "comprehension_orale",
    "expression_ecrite",
    "expression_orale",
]
PhaseAssimilIA = Literal["impregnation", "activation"]
TypeReponseIA = Literal["choix", "texte", "audio"]
ScenarioDiagnosticIA = Literal["quotidien", "entretien", "examen"]


class _ModeleIA(BaseModel):
    """Modèle de la frontière IA : aucun champ inconnu n'est accepté."""

    model_config = ConfigDict(extra="forbid")


class ContexteApprenantIA(_ModeleIA):
    """Contexte minimal attendu par les agents ; ``lecon_atteinte`` (US157) sert à la correction des réponses libres."""

    code_langue: CodeLangueIA
    referentiel: ReferentielIA
    niveau_preliminaire: str = Field(min_length=1, max_length=20)
    lecon_atteinte: int | None = Field(default=None, ge=1, le=10_000)


class PreuveDiagnosticIA(_ModeleIA):
    """Réponse transmise à l'agent ; le corrigé et l'identité de l'apprenant restent côté backend.

    ``enonce`` est un contexte pédagogique facultatif, utilisé par le service IA pour construire sa requête
    documentaire. Il ne contient ni corrigé ni donnée personnelle ; son absence reste valide.
    """

    id_question: str = Field(min_length=1, max_length=64)
    competence: CompetenceIA
    type_reponse: TypeReponseIA
    contenu: str = Field(min_length=1, max_length=5000)
    enonce: str | None = Field(default=None, max_length=2000)


class EntreeDiagnosticIA(_ModeleIA):
    """Entrée de l'agent Diagnostic."""

    scenario: ScenarioDiagnosticIA = "quotidien"
    reponses: list[PreuveDiagnosticIA] = Field(min_length=1, max_length=100)
    score_preliminaire: float = Field(ge=0, le=100)


class RequeteDiagnosticIA(_ModeleIA):
    """Enveloppe envoyée à ``POST /diagnostic/evaluer``."""

    request_id: UUID
    version_agent: str | None = None
    contexte: ContexteApprenantIA
    entree: EntreeDiagnosticIA


class PointFaibleIA(_ModeleIA):
    """Point faible produit par l'agent ; ``justification`` devient ``detail`` côté contrat public."""

    domaine: DomaineFaiblesseIA
    id_question: str = Field(min_length=1, max_length=64)
    observation: str = Field(min_length=1, max_length=160)
    justification: str = Field(min_length=1, max_length=240)


class ResultatDiagnosticIA(_ModeleIA):
    """Estimation validée par le service IA."""

    code_langue: CodeLangueIA
    referentiel: ReferentielIA
    niveau_estime: str = Field(min_length=1, max_length=20)
    phase_assimil: PhaseAssimilIA
    points_faibles: list[PointFaibleIA] = Field(default_factory=list, max_length=5)
    score_confiance: float = Field(ge=0.0, le=1.0)
    niveau_preliminaire: str = Field(min_length=1, max_length=20)
    ecart_avec_niveau_preliminaire: int = Field(ge=-5, le=5)


class MetaExecutionIA(_ModeleIA):
    """Métadonnées d'exécution, conservées pour l'audit et jamais exposées au frontend."""

    duree_ms: int = Field(ge=0, le=600_000)
    fournisseur: str = Field(min_length=1, max_length=64)
    modele: str = Field(min_length=1, max_length=128)
    version_corpus: str | None = None
    empreinte_prompt: str = Field(min_length=1, max_length=128)


class ReponseDiagnosticIA(_ModeleIA):
    """Enveloppe de succès renvoyée par le service IA."""

    request_id: UUID
    agent: Literal["diagnostic"]
    version_agent: str = Field(min_length=1, max_length=32)
    version_prompt: str = Field(min_length=1, max_length=128)
    statut: Literal["succes"] = "succes"
    resultat: ResultatDiagnosticIA
    meta: MetaExecutionIA


# --- US157 : correction d'une réponse libre, contrat v2 (``POST /correction/reponse-libre``) ---

PhaseParcoursIA = Literal["PASSIVE", "ACTIVE"]
ERREURS_MAX_PASSIVE = 3
ERREURS_MAX_ACTIVE = 8


class EntreeCorrectionIA(_ModeleIA):
    """Réponse libre et exercice transmis à l'agent de correction (sans le corrigé ni l'identité)."""

    format: Literal["redaction"] = "redaction"
    consigne: str = Field(min_length=1, max_length=500)
    enonce: str = Field(min_length=1, max_length=2000)
    mots_minimum: int = Field(default=30, ge=1, le=500)
    reponse: str = Field(min_length=1, max_length=5000)


class RequeteCorrectionIA(_ModeleIA):
    """Enveloppe envoyée à ``POST /correction/reponse-libre`` ; la leçon atteinte est obligatoire."""

    request_id: UUID
    version_agent: str | None = None
    contexte: ContexteApprenantIA
    entree: EntreeCorrectionIA

    @model_validator(mode="after")
    def exiger_lecon(self) -> "RequeteCorrectionIA":
        if self.contexte.lecon_atteinte is None:
            raise ValueError("La correction d'une réponse libre exige la leçon atteinte.")
        return self


class ErreurReleveeIA(_ModeleIA):
    extrait: str = Field(min_length=1, max_length=120)
    correction: str = Field(min_length=1, max_length=120)
    explication: str = Field(min_length=1, max_length=240)


class ResultatCorrectionIA(_ModeleIA):
    """Feedback v2 : la forme du retour dépend de la phase (mêmes règles que le service IA, revalidées ici)."""

    phase: PhaseParcoursIA
    lecon_atteinte: int = Field(ge=1, le=10_000)
    score: int = Field(ge=0, le=100)
    commentaire: str = Field(min_length=1, max_length=300)
    points_forts: list[str] = Field(default_factory=list, max_length=3)
    erreurs: list[ErreurReleveeIA] = Field(default_factory=list, max_length=ERREURS_MAX_ACTIVE)
    reformulation: str | None = Field(default=None, min_length=1, max_length=5000)
    conseil: str | None = Field(default=None, min_length=1, max_length=240)

    @model_validator(mode="after")
    def verifier_forme_selon_phase(self) -> "ResultatCorrectionIA":
        if self.phase == "PASSIVE":
            if len(self.erreurs) > ERREURS_MAX_PASSIVE or self.reformulation is not None:
                raise ValueError("Un feedback de phase passive relève 3 erreurs au plus, sans version corrigée.")
        elif self.erreurs and self.reformulation is None:
            raise ValueError("Un feedback de phase active accompagne ses erreurs d'une version corrigée.")
        return self


class ReponseCorrectionIA(_ModeleIA):
    """Enveloppe de succès de l'agent de correction."""

    request_id: UUID
    agent: Literal["correction"]
    version_agent: str = Field(min_length=1, max_length=32)
    version_prompt: str = Field(min_length=1, max_length=128)
    statut: Literal["succes"] = "succes"
    resultat: ResultatCorrectionIA
    meta: MetaExecutionIA


# --- Chat : contrat ``POST /chatbot/message`` (US67/US74) ---


class MessageHistoriqueChatbotIA(_ModeleIA):
    role: Literal["apprenant", "assistant"]
    contenu: str = Field(min_length=1, max_length=4000)


class EntreeChatbotIA(_ModeleIA):
    message: str = Field(min_length=1, max_length=2000)
    historique: list[MessageHistoriqueChatbotIA] = Field(default_factory=list, max_length=20)


class RequeteChatbotIA(_ModeleIA):
    request_id: UUID
    version_agent: str | None = None
    contexte: ContexteApprenantIA
    entree: EntreeChatbotIA


class CorrectionChatbotIA(_ModeleIA):
    extrait: str = Field(min_length=1, max_length=120)
    correction: str = Field(min_length=1, max_length=120)
    explication: str = Field(min_length=1, max_length=300)


class ResultatChatbotIA(_ModeleIA):
    """Miroir du contrat 1.2.0 : chaque réponse du tuteur porte sa traduction et son explication en français."""

    reponse: str = Field(min_length=1, max_length=4000)
    corrections: list[CorrectionChatbotIA] = Field(default_factory=list, max_length=3)
    traduction: str = Field(min_length=1, max_length=4000)
    explication: str = Field(min_length=1, max_length=4000)


class ReponseChatbotIA(_ModeleIA):
    request_id: UUID
    agent: Literal["chatbot"]
    version_agent: str = Field(min_length=1, max_length=32)
    version_prompt: str = Field(min_length=1, max_length=128)
    statut: Literal["succes"] = "succes"
    resultat: ResultatChatbotIA
    meta: MetaExecutionIA


# --- REC-00 : recommandation de parcours (``POST /recommandation/actions``) ---

TypeExerciceRecommandationIA = Literal["GRAMMAIRE", "VOCABULAIRE", "COMPREHENSION", "ECOUTE", "ORAL"]

# Miroir de ``ia-service/app/schemas/recommandation.py::TYPE_PAR_DOMAINE`` ; ``expression_ecrite`` est absent
# volontairement : aucun type d'exercice ne lui est associé dans le backend (services/parcours.py).
TYPE_EXERCICE_PAR_DOMAINE_IA: dict[str, str] = {
    "grammaire": "GRAMMAIRE",
    "vocabulaire": "VOCABULAIRE",
    "comprehension_ecrite": "COMPREHENSION",
    "comprehension_orale": "ECOUTE",
    "expression_orale": "ORAL",
}


class EntreeRecommandationIA(_ModeleIA):
    """Points faibles du diagnostic et niveau visé, tels que le backend les transmet à l'agent."""

    points_faibles: list[PointFaibleIA] = Field(min_length=1, max_length=5)
    niveau_vise: str = Field(min_length=1, max_length=20)


class RequeteRecommandationIA(_ModeleIA):
    """Enveloppe envoyée à ``POST /recommandation/actions``."""

    request_id: UUID
    version_agent: str | None = None
    contexte: ContexteApprenantIA
    entree: EntreeRecommandationIA


class ActionRecommandeeIA(_ModeleIA):
    """Une action proposée par l'agent ; le type d'exercice découle du domaine."""

    domaine: DomaineFaiblesseIA
    type_exercice: TypeExerciceRecommandationIA
    action: str = Field(min_length=1, max_length=240)
    justification: str = Field(min_length=1, max_length=240)
    priorite: int = Field(ge=1, le=5)

    @model_validator(mode="after")
    def verifier_type_et_domaine(self) -> "ActionRecommandeeIA":
        attendu = TYPE_EXERCICE_PAR_DOMAINE_IA.get(self.domaine)
        if attendu is None or self.type_exercice != attendu:
            raise ValueError(f"Le domaine « {self.domaine} » impose le type {attendu}.")
        return self


class ResultatRecommandationIA(_ModeleIA):
    """Proposition validée ; le backend reste seul décisionnaire de son intégration au parcours."""

    code_langue: CodeLangueIA
    referentiel: ReferentielIA
    niveau_cible: str = Field(min_length=1, max_length=20)
    recommandations: list[ActionRecommandeeIA] = Field(default_factory=list, max_length=5)
    resume: str = Field(min_length=1, max_length=240)
    confiance: float = Field(ge=0.0, le=1.0)

    @model_validator(mode="after")
    def verifier_coherence_interne(self) -> "ResultatRecommandationIA":
        """Mêmes règles que le service IA : référentiel, niveau, unicité, priorités et confiance."""
        if self.referentiel != ("HSK" if self.code_langue == "zh" else "CECRL"):
            raise ValueError("Le référentiel ne correspond pas à la langue.")
        if self.niveau_cible not in NIVEAUX_IA[self.referentiel]:
            raise ValueError("Le niveau cible n'appartient pas au référentiel.")
        domaines = [action.domaine for action in self.recommandations]
        if len(domaines) != len(set(domaines)):
            raise ValueError("Un domaine ne peut apparaître qu'une fois.")
        if sorted(action.priorite for action in self.recommandations) != list(range(1, len(domaines) + 1)):
            raise ValueError("Les priorités doivent être contiguës, de 1 au nombre de recommandations.")
        if self.confiance == 0.0 and self.recommandations:
            raise ValueError("Une confiance nulle ne peut pas accompagner de recommandation.")
        return self


class ReponseRecommandationIA(_ModeleIA):
    """Enveloppe de succès de l'agent Recommandation."""

    request_id: UUID
    agent: Literal["recommandation"]
    version_agent: str = Field(min_length=1, max_length=32)
    version_prompt: str = Field(min_length=1, max_length=128)
    statut: Literal["succes"] = "succes"
    resultat: ResultatRecommandationIA
    meta: MetaExecutionIA
