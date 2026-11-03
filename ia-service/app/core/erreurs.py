"""Exceptions internes du service IA.

Aucune de ces exceptions n'est exposée telle quelle au client : le Harness les traduit en ``ErreurAgent`` avec un
message fixe et un code stable. Les messages internes ne doivent jamais contenir de clé API, de prompt ni de contenu
d'apprenant.
"""


class ErreurServiceIA(Exception):
    """Erreur interne du service IA, sans détail sensible dans le message."""


class ErreurConfiguration(ErreurServiceIA):
    """Configuration absente, incohérente ou fournisseur LLM inconnu."""


class ErreurLlm(ErreurServiceIA):
    """Erreur générique d'un fournisseur LLM."""


class ErreurLlmTimeout(ErreurLlm):
    """Le fournisseur n'a pas répondu dans le délai imparti (rejouable)."""


class ErreurLlmIndisponible(ErreurLlm):
    """Fournisseur injoignable, authentification refusée ou erreur HTTP transitoire (rejouable)."""


class ErreurReponseLlm(ErreurLlm):
    """Réponse du fournisseur vide, mal formée ou non conforme au schéma demandé (rejouable)."""


class ErreurRegistre(ErreurServiceIA):
    """Registre mal initialisé : doublon, identifiant ou définition invalide."""


class ErreurAgentInconnu(ErreurServiceIA):
    """Aucun agent (ou aucune version demandée) n'est enregistré."""
