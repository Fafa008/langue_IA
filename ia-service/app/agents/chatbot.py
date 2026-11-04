"""Agent chatbot (US67) : répond au message d'un apprenant à l'aide du prompt versionné.

L'agent ne construit ni client LLM ni Harness : il rend le prompt avec le registre partagé, puis demande au client
injecté une réponse JSON validée par ``ResultatChatbot``. Le budget couvre les reprises du client LLM.
"""

from app.harness.agent import ContexteExecution, DefinitionAgent
from app.prompts import RegistrePrompts
from app.prompts.registre import VERSION_CONVERSATION_CHATBOT
from app.prompts.variables import VariablesConversationChatbot
from app.schemas.chatbot import EntreeChatbot, ResultatChatbot

CODE_AGENT_CHATBOT = "chatbot"
VERSION_AGENT_CHATBOT = "1.0.0"
BUDGET_CHATBOT_MS = 30_000


async def repondre(entree: EntreeChatbot, contexte: ContexteExecution) -> ResultatChatbot:
    """Rendre le prompt de conversation et obtenir la réponse du modèle."""
    variables = VariablesConversationChatbot(
        contexte_apprenant=contexte.contexte,
        historique=entree.historique,
        message=entree.message,
    )
    rendu = contexte.outils.registre_prompts.rendre_conversation_chatbot(variables)
    resultat, _ = await contexte.outils.client_llm.generer_json(
        rendu.messages,
        schema=ResultatChatbot,
        temperature=rendu.temperature,
        max_tokens=rendu.max_tokens,
    )
    return resultat


def definir_agent_chatbot(registre_prompts: RegistrePrompts) -> DefinitionAgent[EntreeChatbot, ResultatChatbot]:
    """Déclarer l'agent avec la version et l'empreinte du prompt réellement chargé."""
    version_prompt, empreinte_prompt = registre_prompts.definition(
        "chatbot", "conversation", VERSION_CONVERSATION_CHATBOT
    )
    return DefinitionAgent(
        code=CODE_AGENT_CHATBOT,
        version=VERSION_AGENT_CHATBOT,
        schema_entree=EntreeChatbot,
        schema_sortie=ResultatChatbot,
        budget_ms=BUDGET_CHATBOT_MS,
        version_prompt=version_prompt,
        empreinte_prompt=empreinte_prompt,
        executer=repondre,
    )
