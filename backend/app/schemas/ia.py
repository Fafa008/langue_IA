"""Frontière de confiance backend ↔ service IA (PRE-05).

Le backend ne partage pas les modèles du service IA : il redéfinit ici le strict nécessaire du contrat
``POST /diagnostic/evaluer``. Cette duplication est volontaire — elle empêche le backend de dépendre du paquet
``ia-service`` et lui permet de refuser une réponse hors contrat au lieu de la relayer au frontend.

Aucune donnée identifiante n'est transmise : le service IA reçoit la langue, le référentiel, le niveau
préliminaire, les réponses et le score déterministe. Le score et le niveau publics restent calculés par le backend.
"""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

CodeLangueIA = Literal["fr", "en", "zh", "it", "de"]
ReferentielIA = Literal["CECRL", "HSK"]
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
    """Contexte minimal attendu par l'agent Diagnostic."""

    code_langue: CodeLangueIA
    referentiel: ReferentielIA
    niveau_preliminaire: str = Field(min_length=1, max_length=20)


class PreuveDiagnosticIA(_ModeleIA):
    """Réponse transmise à l'agent ; le corrigé et l'identité de l'apprenant restent côté backend."""

    id_question: str = Field(min_length=1, max_length=64)
    competence: CompetenceIA
    type_reponse: TypeReponseIA
    contenu: str = Field(min_length=1, max_length=5000)


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
