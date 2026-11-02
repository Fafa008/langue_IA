"""Contrat commun du Harness : enveloppes de requête et de réponse, erreurs standardisées.

Le Harness est unique : il valide l'enveloppe avant de confier l'entrée typée à l'agent. L'entrée elle-même est
générique (``RequeteAgent[T]``) afin que les neuf agents partagent le même contrat sans que le service accepte pour
autant du JSON arbitraire : chaque route instancie ``T`` avec un modèle strict.
"""

from enum import Enum
from typing import Generic, Literal, TypeVar
from uuid import UUID

from pydantic import Field, field_validator, model_validator

from app.schemas.base import ModeleStrict
from app.schemas.contexte import ContexteApprenant
from app.schemas.regles import MESSAGE_ERREUR_MAX, erreur

T = TypeVar("T")

# Identifiants : minuscules, chiffres et tirets (« diagnostic », « assistant-formateur »).
CODE_AGENT_PATTERN = r"^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$"
VERSION_PATTERN = r"^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$"
VERSION_PROMPT_PATTERN = r"^[a-z][a-z0-9-]*/[a-z][a-z0-9-]*@\d+\.\d+\.\d+$"
EMPREINTE_PATTERN = r"^sha256:[0-9a-f]{64}$"


class MetaExecution(ModeleStrict):
    """Métadonnées d'exécution, destinées à l'exploitation ; le backend ne les transmet pas au frontend."""

    duree_ms: int = Field(strict=True, ge=0, le=600_000)
    fournisseur: str = Field(min_length=1, max_length=64)
    modele: str = Field(min_length=1, max_length=128)
    version_corpus: str | None = Field(default=None, max_length=32)
    empreinte_prompt: str = Field(pattern=EMPREINTE_PATTERN)


class RequeteAgent(ModeleStrict, Generic[T]):
    """Enveloppe commune d'appel d'un agent.

    ``version_agent`` est facultative : sans elle, le Harness retient la dernière version enregistrée. ``entree``
    est typée par l'agent ; un champ non déclaré y est refusé comme partout ailleurs.
    """

    request_id: UUID
    version_agent: str | None = Field(default=None, pattern=VERSION_PATTERN)
    contexte: ContexteApprenant
    entree: T


class ReponseAgent(ModeleStrict, Generic[T]):
    """Enveloppe commune de succès."""

    request_id: UUID
    agent: str = Field(pattern=CODE_AGENT_PATTERN, max_length=32)
    version_agent: str = Field(pattern=VERSION_PATTERN)
    version_prompt: str = Field(pattern=VERSION_PROMPT_PATTERN)
    statut: Literal["succes"] = "succes"
    resultat: T
    meta: MetaExecution


class CodeErreur(str, Enum):
    """Codes d'erreur stables du service IA (repris du cadrage AJ02, §11.5)."""

    ENTREE_INVALIDE = "ENTREE_INVALIDE"
    AGENT_INCONNU = "AGENT_INCONNU"
    TAILLE_DEPASSEE = "TAILLE_DEPASSEE"
    QUOTA_DEPASSE = "QUOTA_DEPASSE"
    LLM_INDISPONIBLE = "LLM_INDISPONIBLE"
    LLM_TIMEOUT = "LLM_TIMEOUT"
    LLM_REPONSE_INVALIDE = "LLM_REPONSE_INVALIDE"
    CORPUS_INDISPONIBLE = "CORPUS_INDISPONIBLE"
    PROMPT_INTROUVABLE = "PROMPT_INTROUVABLE"
    ERREUR_INTERNE = "ERREUR_INTERNE"


# Seules ces erreurs justifient une nouvelle tentative : une entrée invalide ne doit jamais être rejouée.
CODES_RETRYABLES = frozenset(
    {
        CodeErreur.QUOTA_DEPASSE,
        CodeErreur.LLM_INDISPONIBLE,
        CodeErreur.LLM_TIMEOUT,
        CodeErreur.LLM_REPONSE_INVALIDE,
        CodeErreur.CORPUS_INDISPONIBLE,
    }
)

DETAILS_MAX = 10


class ErreurAgent(ModeleStrict):
    """Erreur standardisée.

    ``details`` reste plat (chaînes courtes uniquement) et vide en production : il ne doit contenir ni secret, ni
    contenu d'apprenant, ni JSON imbriqué. ``retryable`` est vérifié contre le code pour qu'un même code ne soit
    jamais annoncé tantôt rejouable, tantôt définitif.
    """

    code: CodeErreur
    message: str = Field(min_length=1, max_length=MESSAGE_ERREUR_MAX)
    retryable: bool
    details: dict[str, str] | None = None

    @field_validator("message")
    @classmethod
    def refuser_sauts_de_ligne(cls, valeur: str) -> str:
        """Un message tient sur une ligne : évite la falsification des journaux JSON."""
        if "\n" in valeur or "\r" in valeur:
            raise erreur("Le message d'erreur doit tenir sur une seule ligne.")
        return valeur

    @field_validator("details")
    @classmethod
    def valider_details(cls, details: dict[str, str] | None) -> dict[str, str] | None:
        if details is None:
            return None
        if len(details) > DETAILS_MAX:
            raise erreur(f"Les détails comptent {DETAILS_MAX} entrées au maximum.")
        for cle, valeur in details.items():
            if not cle.strip() or len(cle) > 64:
                raise erreur("Une clé de détail doit contenir entre 1 et 64 caractères.")
            if not valeur.strip() or len(valeur) > 200 or "\n" in valeur or "\r" in valeur:
                raise erreur("Une valeur de détail doit tenir sur une ligne, 200 caractères au maximum.")
        return details

    @model_validator(mode="after")
    def verifier_retryable(self) -> "ErreurAgent":
        attendu = self.code in CODES_RETRYABLES
        if self.retryable != attendu:
            raise erreur(
                f"Le code {self.code.value} est {'rejouable' if attendu else 'définitif'} : "
                f"retryable doit valoir {str(attendu).lower()}."
            )
        return self


class ReponseErreur(ModeleStrict):
    """Enveloppe commune d'erreur, symétrique de ``ReponseAgent``."""

    request_id: UUID
    agent: str = Field(pattern=CODE_AGENT_PATTERN, max_length=32)
    statut: Literal["erreur"] = "erreur"
    erreur: ErreurAgent
