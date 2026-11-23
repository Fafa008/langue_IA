"""Contrat de l'agent chatbot (US67/US74) : réponse et corrections en marge.

Le service IA reste sans état : le backend renvoie à chaque appel le court historique de la conversation qu'il
conservait. L'historique est borné pour garder un prompt de taille prévisible et ne jamais transmettre une
conversation entière au fournisseur. ``ModeleStrict`` retire les espaces superflus : un message fait d'espaces
devient vide et il est refusé par ``min_length``.

Depuis la consigne 1.1.0, l'agent peut renvoyer jusqu'à trois corrections en marge. Elles ne coupent jamais la
conversation : la ``reponse`` reste obligatoire et les ``corrections`` sont optionnelles.

Depuis la consigne 1.2.0, le tuteur IA joint à **chaque** réponse une ``traduction`` et une ``explication`` en
français, affichées à côté de la réponse. Elles sont obligatoires dans le contrat de sortie.
"""

from typing import Literal
from uuid import UUID

from pydantic import Field

from app.schemas.base import ModeleStrict
from app.schemas.regles import RESUME_MEMOIRE_MAX, CodeLangue, CodeNiveau

MESSAGE_CHATBOT_MAX = 2000
REPONSE_CHATBOT_MAX = 4000
HISTORIQUE_CHATBOT_MAX = 20
CORRECTIONS_CHATBOT_MAX = 3
EXTRAIT_CORRECTION_MAX = 120
EXPLICATION_CORRECTION_MAX = 300
TRADUCTION_CHATBOT_MAX = 4000
EXPLICATION_CHATBOT_MAX = 4000


class MessageHistorique(ModeleStrict):
    """Tour de parole déjà échangé, transmis par le backend dans l'ordre chronologique."""

    role: Literal["apprenant", "assistant"]
    contenu: str = Field(min_length=1, max_length=REPONSE_CHATBOT_MAX)


class CorrectionChatbot(ModeleStrict):
    """Correction brève affichée en marge, sans interrompre l'échange (D1)."""

    extrait: str = Field(min_length=1, max_length=EXTRAIT_CORRECTION_MAX)
    correction: str = Field(min_length=1, max_length=EXTRAIT_CORRECTION_MAX)
    explication: str = Field(min_length=1, max_length=EXPLICATION_CORRECTION_MAX)


class EntreeChatbot(ModeleStrict):
    """Nouveau message de l'apprenant et historique récent de la conversation."""

    message: str = Field(min_length=1, max_length=MESSAGE_CHATBOT_MAX)
    historique: list[MessageHistorique] = Field(default_factory=list, max_length=HISTORIQUE_CHATBOT_MAX)


class ResultatChatbot(ModeleStrict):
    """Réponse du tuteur, corrections éventuelles et traduction/explication françaises (texte brut)."""

    reponse: str = Field(min_length=1, max_length=REPONSE_CHATBOT_MAX)
    corrections: list[CorrectionChatbot] = Field(default_factory=list, max_length=CORRECTIONS_CHATBOT_MAX)
    traduction: str = Field(min_length=1, max_length=TRADUCTION_CHATBOT_MAX)
    explication: str = Field(min_length=1, max_length=EXPLICATION_CHATBOT_MAX)


# --- Contrats v2 (US-IA-CHAT-01) : ajoutés sans modifier les contrats publiés 1.2.0 ---

PhaseAssimil = Literal["impregnation", "activation"]
TypeErreurChatbot = Literal["grammaire", "orthographe", "syntaxe"]
IDENTIFIANT_SESSION_MAX = 64


class CorrectionDetaillee(ModeleStrict):
    """Correction produite par l'analyse séparée du message de l'apprenant."""

    type: TypeErreurChatbot
    erreur: str = Field(min_length=1, max_length=EXTRAIT_CORRECTION_MAX)
    correction: str = Field(min_length=1, max_length=EXTRAIT_CORRECTION_MAX)
    explication: str = Field(min_length=1, max_length=EXPLICATION_CORRECTION_MAX)


class ResultatCorrection(ModeleStrict):
    """Format JSON strict de la correction temps réel ; liste vide si la phrase est correcte."""

    phrase_originale: str = Field(min_length=1, max_length=MESSAGE_CHATBOT_MAX)
    corrections: list[CorrectionDetaillee] = Field(default_factory=list, max_length=CORRECTIONS_CHATBOT_MAX)


class TourMemoire(ModeleStrict):
    """Tour conservé dans la mémoire courte Redis."""

    role: Literal["apprenant", "assistant"]
    contenu: str = Field(min_length=1, max_length=REPONSE_CHATBOT_MAX)
    phase: PhaseAssimil | None = None


class ResumeSession(ModeleStrict):
    """Résumé glissant d'une session, stocké dans Redis sous ``session:{id}:summary``."""

    phase: PhaseAssimil
    niveau_effectif: CodeNiveau
    compteur_tours: int = Field(ge=0, le=1000)
    points_forts: list[str] = Field(default_factory=list, max_length=5)
    points_faibles: list[str] = Field(default_factory=list, max_length=5)


class EntreeTraduction(ModeleStrict):
    """Demande de traduction d'un message de l'assistant vers le français."""

    identifiant_session: str = Field(min_length=1, max_length=IDENTIFIANT_SESSION_MAX)
    id_message: UUID
    message: str = Field(min_length=1, max_length=REPONSE_CHATBOT_MAX)


class TraductionGeneree(ModeleStrict):
    """Sortie brute du LLM pour la traduction d'un message de l'assistant."""

    traduction: str = Field(min_length=1, max_length=TRADUCTION_CHATBOT_MAX)
    explication: str = Field(min_length=1, max_length=EXPLICATION_CHATBOT_MAX)


class ResultatTraduction(ModeleStrict):
    """Traduction française mise en cache par identifiant de message."""

    id_message: UUID
    traduction: str = Field(min_length=1, max_length=TRADUCTION_CHATBOT_MAX)
    explication: str = Field(min_length=1, max_length=EXPLICATION_CHATBOT_MAX)
    cache_hit: bool = False


class ProfilMemoire(ModeleStrict):
    """Profil pseudonyme transmis au backend pour la mémoire long terme."""

    profil_id: str = Field(min_length=1, max_length=128)
    code_langue: CodeLangue
    niveau_effectif: CodeNiveau


class ErreurRecurrente(ModeleStrict):
    """Erreur agrégée pour le suivi pédagogique du backend."""

    type: TypeErreurChatbot
    erreur: str = Field(min_length=1, max_length=EXTRAIT_CORRECTION_MAX)
    frequence: int = Field(ge=1, le=10000)
    derniere_occurrence: str = Field(min_length=1, max_length=40)


class SessionMemoire(ModeleStrict):
    """Bilan d'une session transmis au backend à sa clôture."""

    identifiant_session: str = Field(min_length=1, max_length=IDENTIFIANT_SESSION_MAX)
    nombre_tours: int = Field(ge=0, le=1000)
    phase_atteinte: PhaseAssimil
    resume: str = Field(min_length=1, max_length=RESUME_MEMOIRE_MAX)


class ChargeMemoireLongTerme(ModeleStrict):
    """Charge utile renvoyée au backend, qui reste seul propriétaire de PostgreSQL."""

    profil: ProfilMemoire
    erreurs: list[ErreurRecurrente] = Field(default_factory=list, max_length=20)
    session: SessionMemoire


class EntreeExercice(ModeleStrict):
    """Demande d'exercice ciblé à partir des erreurs récurrentes du profil."""

    identifiant_session: str = Field(min_length=1, max_length=IDENTIFIANT_SESSION_MAX)
    type_erreur: TypeErreurChatbot
    niveau: CodeNiveau


class ResultatExercice(ModeleStrict):
    """Exercice généré par le LLM à partir d'un descripteur CECRL ; aucun score n'est produit."""

    enonce: str = Field(min_length=1, max_length=REPONSE_CHATBOT_MAX)
    consigne: str = Field(min_length=1, max_length=REPONSE_CHATBOT_MAX)
    descripteur_id: str = Field(min_length=1, max_length=128)
    niveau: CodeNiveau
