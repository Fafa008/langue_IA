"""Traduction en marge du chat : appel LLM distinct, mis en cache par identifiant de message.

L'agent ne traduit que la réponse de l'assistant. Il consulte d'abord la mémoire courte injectée par le Harness :
un cache hit renvoie le résultat enregistré avec ``cache_hit=True``, sans appel LLM. En cas de miss, la sortie JSON
du modèle est validée puis mise en cache ; une panne Redis est absorbée par la mémoire courte et ne bloque jamais la
traduction. Le service IA ne persiste rien au-delà de ce cache volatile, dont la durée de vie est bornée.
"""

from app.harness.agent import ContexteExecution, DefinitionAgent
from app.memory import clefs
from app.prompts import RegistrePrompts
from app.prompts.registre import VERSION_TRADUCTION_CHATBOT
from app.prompts.variables import VariablesTraductionChatbot
from app.schemas.chatbot import EntreeTraduction, ResultatTraduction, TraductionGeneree

CODE_AGENT_TRADUCTION_CHATBOT = "chatbot-traduction"
VERSION_AGENT_TRADUCTION_CHATBOT = "1.0.0"
BUDGET_TRADUCTION_CHATBOT_MS = 15_000


async def traduire(entree: EntreeTraduction, contexte: ContexteExecution) -> ResultatTraduction:
    """Traduire la réponse de l'assistant, avec relecture du cache avant tout appel LLM."""
    identifiant_session = clefs.valider_identifiant_session(entree.identifiant_session)

    en_cache = await contexte.outils.memoire.lire_traduction(identifiant_session, entree.id_message)
    if en_cache is not None:
        return en_cache.model_copy(update={"cache_hit": True})

    variables = VariablesTraductionChatbot(
        message=entree.message,
        code_langue=contexte.contexte.code_langue,
        niveau_effectif=contexte.contexte.niveau_preliminaire,
    )
    rendu = contexte.outils.registre_prompts.rendre_traduction_chatbot(variables)
    generee, _ = await contexte.outils.client_llm.generer_json(
        rendu.messages,
        schema=TraductionGeneree,
        temperature=rendu.temperature,
        max_tokens=rendu.max_tokens,
    )

    resultat = ResultatTraduction(
        id_message=entree.id_message,
        traduction=generee.traduction,
        explication=generee.explication,
    )
    await contexte.outils.memoire.ecrire_traduction(identifiant_session, resultat)
    return resultat


def definir_agent_traduction_chatbot(
    registre_prompts: RegistrePrompts,
) -> DefinitionAgent[EntreeTraduction, ResultatTraduction]:
    """Déclarer la tâche de traduction dans le registre partagé du Harness."""
    version_prompt, empreinte_prompt = registre_prompts.definition("chatbot", "traduction", VERSION_TRADUCTION_CHATBOT)
    return DefinitionAgent(
        code=CODE_AGENT_TRADUCTION_CHATBOT,
        version=VERSION_AGENT_TRADUCTION_CHATBOT,
        schema_entree=EntreeTraduction,
        schema_sortie=ResultatTraduction,
        budget_ms=BUDGET_TRADUCTION_CHATBOT_MS,
        version_prompt=version_prompt,
        empreinte_prompt=empreinte_prompt,
        executer=traduire,
    )
