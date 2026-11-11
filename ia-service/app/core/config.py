"""Configuration du client LLM, lue exclusivement depuis les variables d'environnement.

Aucune valeur secrète n'est écrite dans le code : la clé est portée par un ``SecretStr`` et n'apparaît ni dans
``repr``, ni dans les messages d'erreur, ni dans les journaux.

Variables reconnues (préfixe ``LLM_``, sauf ``ENVIRONNEMENT``) :

===================  ===========================================================
``ENVIRONNEMENT``    ``dev`` (défaut), ``test`` ou ``prod``
``LLM_FOURNISSEUR``  ``factice`` (défaut hors production), ``compatible-openai`` ou ``gemini``
``LLM_MODELE``       nom du modèle chez le fournisseur
``LLM_BASE_URL``     racine de l'API, par exemple ``https://api.openai.com/v1``
``LLM_API_KEY``      clé d'API, jamais journalisée
``GEMINI_MODEL``     nom du modèle Gemini, requis avec ``LLM_FOURNISSEUR=gemini``
``GEMINI_API_KEY``   clé Gemini, jamais journalisée
``LLM_TEMPERATURE``  créativité, entre 0 et 2
``LLM_MAX_TOKENS``   1 à 8 192
``LLM_TIMEOUT``      délai d'un appel, de 0 exclus à 120 secondes (``LLM_TIMEOUT_S`` reste accepté)
``LLM_MAX_RETRIES``  reprises sur erreur rejouable, de 0 à 3
``LLM_REPRISE_DELAI_S``  délai initial entre deux tentatives, de 0 à 10 secondes
``LLM_REPRISE_DELAI_MAX_S``  plafond du délai de reprise, de 0 à 60 secondes
``LLM_BUDGET_TOTAL_S``  budget total d'un appel, reprises comprises, de 0 exclu à 600 secondes
===================  ===========================================================
"""

from typing import Literal

from pydantic import AliasChoices, Field, HttpUrl, SecretStr, ValidationError, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.erreurs import ErreurConfiguration
from app.core.reprise import PolitiqueReprise

Environnement = Literal["dev", "test", "prod"]
Fournisseur = Literal["factice", "compatible-openai", "gemini"]


class ConfigLLM(BaseSettings):
    """Paramètres du client LLM partagé.

    La configuration est gelée après construction : un client ne peut pas changer de fournisseur ou de clé en cours
    d'exécution. En production, le fournisseur ``factice`` est refusé pour éviter de servir des réponses simulées.
    """

    model_config = SettingsConfigDict(
        env_prefix="LLM_",
        extra="ignore",
        frozen=True,
        populate_by_name=True,
    )

    environnement: Environnement = Field(default="dev", validation_alias="ENVIRONNEMENT")
    fournisseur: Fournisseur = "factice"
    modele: str | None = Field(default=None, min_length=1, max_length=128)
    base_url: HttpUrl | None = None
    api_key: SecretStr | None = None
    gemini_modele: str | None = Field(default=None, validation_alias="GEMINI_MODEL", min_length=1, max_length=128)
    gemini_cle_api: SecretStr | None = Field(default=None, validation_alias="GEMINI_API_KEY")
    temperature: float = Field(default=0.2, ge=0.0, le=2.0)
    max_tokens: int = Field(default=600, ge=1, le=8192)
    timeout_s: float = Field(
        default=12.0,
        validation_alias=AliasChoices("LLM_TIMEOUT", "LLM_TIMEOUT_S"),
        gt=0.0,
        le=120.0,
    )
    max_retries: int = Field(default=1, ge=0, le=3)
    reprise_delai_s: float = Field(default=0.5, ge=0.0, le=10.0)
    reprise_delai_max_s: float = Field(default=4.0, ge=0.0, le=60.0)
    budget_total_s: float = Field(default=30.0, gt=0.0, le=600.0)

    @field_validator("modele", "base_url", "api_key", "gemini_modele", "gemini_cle_api", mode="before")
    @classmethod
    def vide_en_absent(cls, valeur: object) -> object:
        """Une variable présente mais vide (``LLM_API_KEY=``) vaut « non renseignée »."""
        if isinstance(valeur, str) and not valeur.strip():
            return None
        return valeur

    @model_validator(mode="after")
    def verifier_coherence(self) -> "ConfigLLM":
        """Interdit le factice en production et exige les paramètres d'un vrai fournisseur."""
        if self.environnement == "prod" and self.fournisseur == "factice":
            raise ValueError("LLM_FOURNISSEUR=factice est interdit quand ENVIRONNEMENT=prod.")

        if self.fournisseur == "compatible-openai":
            manquants = [nom for nom in ("modele", "base_url", "api_key") if getattr(self, nom) is None]
            if manquants:
                raise ValueError(
                    "Configuration LLM incomplète : " + ", ".join(manquants) + " requis pour ce fournisseur."
                )
        elif self.fournisseur == "gemini":
            manquants_gemini = []
            if self.gemini_modele is None:
                manquants_gemini.append("GEMINI_MODEL")
            if self.gemini_cle_api is None:
                manquants_gemini.append("GEMINI_API_KEY")
            if manquants_gemini:
                raise ValueError("Configuration Gemini incomplète : " + ", ".join(manquants_gemini) + " requis.")

        if self.reprise_delai_max_s < self.reprise_delai_s:
            raise ValueError("LLM_REPRISE_DELAI_MAX_S doit être supérieur ou égal à LLM_REPRISE_DELAI_S.")
        if self.budget_total_s < self.timeout_s:
            raise ValueError("LLM_BUDGET_TOTAL_S doit être supérieur ou égal à LLM_TIMEOUT.")
        return self

    @property
    def est_factice(self) -> bool:
        """Indique si le client simulé est actif (utile aux tests et à la supervision)."""
        return self.fournisseur == "factice"

    @property
    def politique_reprise(self) -> PolitiqueReprise:
        """Bornes de reprise d'un appel LLM, déduites de la configuration."""
        return PolitiqueReprise(
            max_reprises=self.max_retries,
            delai_initial_s=self.reprise_delai_s,
            delai_max_s=self.reprise_delai_max_s,
            budget_total_s=self.budget_total_s,
        )


def _detail_validation(erreur: dict) -> str:
    """Décrit une erreur de configuration sans recopier la valeur fautive (qui peut être un secret)."""
    emplacement = ".".join(str(partie) for partie in erreur.get("loc", ())) or "configuration"
    type_erreur = str(erreur.get("type", ""))

    if type_erreur == "missing":
        return f"{emplacement} (champ obligatoire)"
    if type_erreur == "literal_error":
        return f"{emplacement} (valeur non autorisée)"
    if type_erreur.startswith(("greater_than", "less_than", "float_", "int_")):
        return f"{emplacement} (valeur hors bornes)"
    if type_erreur.startswith("url_"):
        return f"{emplacement} (URL invalide)"
    if type_erreur == "value_error":
        message = str(erreur.get("msg", "")).removeprefix("Value error, ").strip()
        return message or f"{emplacement} (valeur invalide)"
    return f"{emplacement} (valeur invalide)"


def charger_config() -> ConfigLLM:
    """Lit la configuration dans l'environnement et la traduit en ``ErreurConfiguration`` lisible.

    Le message final ne cite que les noms de champs et des explications génériques : jamais la clé, ni la valeur
    refusée. Il est donc sûr de le journaliser.
    """
    try:
        return ConfigLLM()
    except ValidationError as exc:
        details: list[str] = []
        for erreur in exc.errors():
            detail = _detail_validation(erreur)
            if detail not in details:
                details.append(detail)
        message = "Configuration LLM invalide"
        if details:
            message += " : " + "; ".join(details[:5])
        raise ErreurConfiguration(message + ".") from None
