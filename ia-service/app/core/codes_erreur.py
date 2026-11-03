"""Catalogue des codes d'erreur publics du service IA (US-154).

Un seul endroit décide de tout ce qui sort du service : le code stable, le message public, le caractère rejouable et
le statut HTTP associé. Aucun autre module ne doit réécrire ces valeurs, sinon un même incident finirait par être
annoncé rejouable ici et définitif ailleurs.

Les messages sont volontairement génériques : ils ne recopient ni l'entrée, ni le contexte apprenant, ni la réponse
du fournisseur, ni un secret. Ce sont les seuls textes autorisés vers l'extérieur du service.
"""

from enum import Enum


class CodeErreur(str, Enum):
    """Codes d'erreur stables du service IA (cadrage AJ02, §11.5 ; codes LLM complétés par l'US-154)."""

    # Entrée et routage
    ENTREE_INVALIDE = "ENTREE_INVALIDE"
    AGENT_INCONNU = "AGENT_INCONNU"
    TAILLE_DEPASSEE = "TAILLE_DEPASSEE"
    QUOTA_DEPASSE = "QUOTA_DEPASSE"

    # Fournisseur LLM
    LLM_INDISPONIBLE = "LLM_INDISPONIBLE"
    LLM_TIMEOUT = "LLM_TIMEOUT"
    LLM_LIMITE_REQUETES = "LLM_LIMITE_REQUETES"
    LLM_AUTHENTIFICATION = "LLM_AUTHENTIFICATION"
    LLM_REQUETE_INVALIDE = "LLM_REQUETE_INVALIDE"
    LLM_CONFIGURATION = "LLM_CONFIGURATION"
    LLM_REPONSE_INVALIDE = "LLM_REPONSE_INVALIDE"

    # Contexte documentaire
    CORPUS_INDISPONIBLE = "CORPUS_INDISPONIBLE"
    PROMPT_INTROUVABLE = "PROMPT_INTROUVABLE"

    # Interne
    ERREUR_INTERNE = "ERREUR_INTERNE"


# Messages publics : une ligne, aucune donnée d'entrée, aucun détail de fournisseur.
MESSAGES_PUBLICS: dict[CodeErreur, str] = {
    CodeErreur.ENTREE_INVALIDE: "L'entrée ne respecte pas le contrat attendu par l'agent.",
    CodeErreur.AGENT_INCONNU: "L'agent demandé n'existe pas ou sa version est inconnue.",
    CodeErreur.TAILLE_DEPASSEE: "La requête dépasse la taille autorisée.",
    CodeErreur.QUOTA_DEPASSE: "Le quota de requêtes est atteint, réessayez plus tard.",
    CodeErreur.LLM_INDISPONIBLE: "Le fournisseur LLM est momentanément indisponible.",
    CodeErreur.LLM_TIMEOUT: "Le fournisseur LLM n'a pas répondu dans le délai imparti.",
    CodeErreur.LLM_LIMITE_REQUETES: "Le fournisseur LLM a atteint sa limite de requêtes.",
    CodeErreur.LLM_AUTHENTIFICATION: "Le fournisseur LLM a refusé l'authentification.",
    CodeErreur.LLM_REQUETE_INVALIDE: "Le fournisseur LLM a refusé la requête.",
    CodeErreur.LLM_CONFIGURATION: "La configuration du fournisseur LLM est invalide.",
    CodeErreur.LLM_REPONSE_INVALIDE: "Le fournisseur LLM a renvoyé une réponse inexploitable.",
    CodeErreur.CORPUS_INDISPONIBLE: "Le corpus documentaire est momentanément indisponible.",
    CodeErreur.PROMPT_INTROUVABLE: "Le prompt de l'agent est introuvable.",
    CodeErreur.ERREUR_INTERNE: "Une erreur interne est survenue pendant l'exécution de l'agent.",
}

# Seules ces erreurs justifient une nouvelle tentative. Une entrée invalide, une clé refusée ou une configuration
# incorrecte ne se corrigent pas en réessayant : les rejouer gaspillerait du budget et masquerait le vrai problème.
CODES_RETRYABLES: frozenset[CodeErreur] = frozenset(
    {
        CodeErreur.QUOTA_DEPASSE,
        CodeErreur.LLM_INDISPONIBLE,
        CodeErreur.LLM_TIMEOUT,
        CodeErreur.LLM_LIMITE_REQUETES,
        CodeErreur.LLM_REPONSE_INVALIDE,
        CodeErreur.CORPUS_INDISPONIBLE,
    }
)

# Statut HTTP à utiliser quand une route exposera ces erreurs au backend. Le service reste interne : ces valeurs
# servent surtout à la supervision et aux tests du gestionnaire d'erreurs.
STATUTS_HTTP: dict[CodeErreur, int] = {
    CodeErreur.ENTREE_INVALIDE: 422,
    CodeErreur.AGENT_INCONNU: 404,
    CodeErreur.TAILLE_DEPASSEE: 413,
    CodeErreur.QUOTA_DEPASSE: 429,
    CodeErreur.LLM_INDISPONIBLE: 503,
    CodeErreur.LLM_TIMEOUT: 504,
    CodeErreur.LLM_LIMITE_REQUETES: 429,
    CodeErreur.LLM_AUTHENTIFICATION: 502,
    CodeErreur.LLM_REQUETE_INVALIDE: 502,
    CodeErreur.LLM_CONFIGURATION: 500,
    CodeErreur.LLM_REPONSE_INVALIDE: 502,
    CodeErreur.CORPUS_INDISPONIBLE: 503,
    CodeErreur.PROMPT_INTROUVABLE: 500,
    CodeErreur.ERREUR_INTERNE: 500,
}


def est_rejouable(code: CodeErreur) -> bool:
    """Indique si une erreur de ce code peut être retentée sans corriger quoi que ce soit côté appelant."""
    return code in CODES_RETRYABLES
