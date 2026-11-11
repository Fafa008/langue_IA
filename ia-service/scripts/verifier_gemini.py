"""Vérification locale du client Gemini, sans endpoint HTTP ni prompt fourni par l'utilisateur."""

import asyncio
import sys

from app.core.config import charger_config
from app.core.erreurs import ErreurConfiguration, ErreurServiceIA
from app.llm.base import MessageLLM
from app.llm.fabrique import creer_client
from scripts._env_local import charger_env_local


async def verifier() -> int:
    """Effectuer une génération courte et afficher les métadonnées non sensibles."""
    charger_env_local()
    client = None
    try:
        configuration = charger_config()
        if configuration.fournisseur != "gemini":
            raise ErreurConfiguration("Cette vérification nécessite LLM_FOURNISSEUR=gemini.")

        client = creer_client(configuration)
        contenu, reponse = await client.generer_texte(
            [MessageLLM(role="user", contenu="Réponds uniquement par : OK Gemini.")],
        )
    except ErreurServiceIA as erreur:
        print(f"Échec de la vérification Gemini : {erreur.message_public}", file=sys.stderr)
        return 1
    finally:
        if client is not None:
            await client.fermer()

    print(f"Fournisseur : {reponse.fournisseur}")
    print(f"Modèle : {reponse.modele}")
    print(f"Latence : {reponse.duree_ms} ms")
    print(f"Réponse : {contenu}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(verifier()))
