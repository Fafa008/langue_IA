"""Correction en marge du chat : analyse LLM distincte de la réponse conversationnelle.

Le modèle doit renvoyer un JSON strict. Une première réponse invalide déclenche une seule nouvelle tentative avec
un rappel de format ; si elle échoue encore, la valeur par défaut est une liste vide de corrections. Aucun contenu
d'apprenant n'est journalisé.
"""

from __future__ import annotations

import json
import logging

from pydantic import ValidationError

from app.harness.agent import ContexteExecution, DefinitionAgent
from app.llm.base import MessageLLM
from app.prompts import RegistrePrompts
from app.prompts.registre import VERSION_CORRECTION_CHATBOT
from app.prompts.variables import VariablesCorrectionChatbot
from app.schemas.chatbot import EntreeChatbot, ResultatCorrection

logger = logging.getLogger(__name__)

CODE_AGENT_CORRECTION_CHATBOT = "chatbot-correction"
VERSION_AGENT_CORRECTION_CHATBOT = "1.0.0"
BUDGET_CORRECTION_CHATBOT_MS = 12_000
NOMBRE_TENTATIVES = 2

_REPPEL_JSON = (
    "Réponds uniquement par le JSON strict demandé, sans Markdown, sans commentaire et sans champ supplémentaire."
)


class ParseCorrectionError(ValueError):
    """Raison technique d'un JSON de correction inexploitable (jamais le contenu du message)."""

    def __init__(self, raison: str) -> None:
        self.raison = raison
        super().__init__(raison)


def parser_correction(brut: str, phrase_originale: str) -> ResultatCorrection:
    """Valider le JSON du modèle contre le contrat strict de correction."""
    try:
        donnees = json.loads(brut)
    except (json.JSONDecodeError, TypeError) as erreur:
        raise ParseCorrectionError("json_invalide") from erreur
    try:
        resultat = ResultatCorrection.model_validate(donnees)
    except ValidationError as erreur:
        raise ParseCorrectionError("schema_invalide") from erreur
    if " ".join(resultat.phrase_originale.split()) != " ".join(phrase_originale.split()):
        raise ParseCorrectionError("phrase_originale_incoherente")
    return resultat


async def analyser(entree: EntreeChatbot, contexte: ContexteExecution) -> ResultatCorrection:
    """Demander une correction au LLM, avec une seule reprise sur JSON invalide."""
    variables = VariablesCorrectionChatbot(
        message=entree.message,
        niveau_effectif=contexte.contexte.niveau_preliminaire,
        phase_assimil="impregnation",
    )
    rendu = contexte.outils.registre_prompts.rendre_correction_chatbot(variables)

    for tentative in range(1, NOMBRE_TENTATIVES + 1):
        messages = list(rendu.messages)
        if tentative > 1:
            messages.append(MessageLLM(role="user", contenu=_REPPEL_JSON))
        texte, _ = await contexte.outils.client_llm.generer_texte(
            messages,
            temperature=rendu.temperature,
            max_tokens=rendu.max_tokens,
        )
        try:
            return parser_correction(texte, entree.message)
        except ParseCorrectionError as erreur:
            logger.warning(
                "correction_json_invalide tentative=%s raison=%s",
                tentative,
                erreur.raison,
                extra={"tentative": tentative, "raison": erreur.raison},
            )

    return ResultatCorrection(phrase_originale=entree.message, corrections=[])


def definir_agent_correction_chatbot(
    registre_prompts: RegistrePrompts,
) -> DefinitionAgent[EntreeChatbot, ResultatCorrection]:
    """Déclarer la tâche de correction dans le même registre que l'agent chatbot."""
    version_prompt, empreinte_prompt = registre_prompts.definition("chatbot", "correction", VERSION_CORRECTION_CHATBOT)
    return DefinitionAgent(
        code=CODE_AGENT_CORRECTION_CHATBOT,
        version=VERSION_AGENT_CORRECTION_CHATBOT,
        schema_entree=EntreeChatbot,
        schema_sortie=ResultatCorrection,
        budget_ms=BUDGET_CORRECTION_CHATBOT_MS,
        version_prompt=version_prompt,
        empreinte_prompt=empreinte_prompt,
        executer=analyser,
    )
