"""Exceptions métier du service IA (US-154).

Chaque exception porte son **code public** : c'est la seule information que le gestionnaire d'erreurs utilise pour
construire la réponse. Le message porté par l'exception est un message **interne** destiné aux journaux : il peut
citer un statut HTTP ou une cause technique, mais jamais une clé, un prompt ou un contenu d'apprenant.

Le caractère rejouable n'est pas stocké sur l'exception : il est déduit du code via ``CODES_RETRYABLES``, afin qu'un
même code ne puisse pas être annoncé rejouable à un endroit et définitif à un autre.
"""

from app.core.codes_erreur import CODES_RETRYABLES, MESSAGES_PUBLICS, CodeErreur


class ErreurServiceIA(Exception):
    """Erreur interne du service IA, avec un code public et un message interne sans détail sensible."""

    code: CodeErreur = CodeErreur.ERREUR_INTERNE

    def __init__(self, message: str | None = None) -> None:
        super().__init__(message if message is not None else MESSAGES_PUBLICS[self.code])

    @property
    def rejouable(self) -> bool:
        """Vrai si l'erreur peut être retentée sans modifier la requête."""
        return self.code in CODES_RETRYABLES

    @property
    def message_public(self) -> str:
        """Message sûr, identique pour un même code, quel que soit le détail interne."""
        return MESSAGES_PUBLICS[self.code]


class ErreurConfiguration(ErreurServiceIA):
    """Configuration absente, incohérente ou fournisseur LLM inconnu (définitif : réessayer n'y change rien)."""

    code = CodeErreur.LLM_CONFIGURATION


class ErreurLlm(ErreurServiceIA):
    """Erreur générique d'un fournisseur LLM."""

    code = CodeErreur.LLM_INDISPONIBLE


class ErreurLlmTimeout(ErreurLlm):
    """Le fournisseur n'a pas répondu dans le délai imparti (temporaire)."""

    code = CodeErreur.LLM_TIMEOUT


class ErreurLlmIndisponible(ErreurLlm):
    """Fournisseur injoignable ou erreur serveur transitoire (temporaire)."""

    code = CodeErreur.LLM_INDISPONIBLE


class ErreurLlmLimiteRequetes(ErreurLlm):
    """Le fournisseur limite le débit (HTTP 429). ``retry_after_s`` reprend son en-tête ``Retry-After``."""

    code = CodeErreur.LLM_LIMITE_REQUETES

    def __init__(self, message: str | None = None, *, retry_after_s: float | None = None) -> None:
        super().__init__(message)
        self.retry_after_s = retry_after_s


class ErreurLlmAuthentification(ErreurLlm):
    """Clé absente, invalide ou révoquée (définitif : réessayer ne corrige pas une clé refusée)."""

    code = CodeErreur.LLM_AUTHENTIFICATION


class ErreurLlmRequete(ErreurLlm):
    """Requête refusée par le fournisseur (HTTP 400, 404, 422) : elle ne deviendra pas valide en la rejouant."""

    code = CodeErreur.LLM_REQUETE_INVALIDE


class ErreurReponseLlm(ErreurLlm):
    """Réponse vide, mal formée ou non conforme au schéma demandé (souvent transitoire côté modèle)."""

    code = CodeErreur.LLM_REPONSE_INVALIDE


class ErreurRegistre(ErreurServiceIA):
    """Registre mal initialisé : doublon, identifiant ou définition invalide (défaut de programmation)."""

    code = CodeErreur.ERREUR_INTERNE


class ErreurAgentInconnu(ErreurServiceIA):
    """Aucun agent (ou aucune version demandée) n'est enregistré."""

    code = CodeErreur.AGENT_INCONNU
