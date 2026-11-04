"""Récupérateur neutre utilisé tant que le corpus documentaire n'est pas branché.

Il ne fabrique aucun descripteur : il retourne une séquence vide. L'agent transmet cette absence au prompt, dont
la règle de prudence impose une estimation conservatrice plutôt qu'une invention. Le remplacement par le
récupérateur réel se fait au démarrage, sans toucher aux agents.
"""

from app.prompts.variables import DescripteurRAGPrompt
from app.rag.base import RequeteRAG


class RecuperateurVide:
    """Récupérateur sans corpus, conforme au protocole ``RecuperateurRAG``."""

    nom = "aucun"
    version_corpus = None

    async def rechercher(self, requete: RequeteRAG) -> tuple[DescripteurRAGPrompt, ...]:
        """Aucun descripteur n'est disponible : le prompt appliquera sa règle de prudence."""
        return ()

    async def fermer(self) -> None:
        """Aucune ressource à libérer."""
        return None
