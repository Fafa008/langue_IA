"""Outils partagés par les tests de validation structurelle (fournisseur factice uniquement)."""

from __future__ import annotations

from typing import Any

from app.agent.conversation import definir_agent_conversation_chatbot
from app.agent.correction import definir_agent_correction_chatbot
from app.agent.exercice import definir_agent_exercice_chatbot
from app.agent.memoire import definir_agent_memoire_chatbot
from app.agent.traduction import definir_agent_traduction_chatbot
from app.agents.chatbot import definir_agent_chatbot
from app.agents.correction import definir_agent_correction
from app.agents.diagnostic import construire_definition, construire_definition_positionnement
from app.agents.recommandation import definir_agent_recommandation
from app.harness.registre import RegistreAgents
from app.prompts import RegistrePrompts
from app.schemas.commun import RequeteAgent
from tests.donnees import CONTEXTE_MINIMAL, REQUEST_ID


def registre_complet() -> tuple[RegistrePrompts, RegistreAgents]:
    """Les dix définitions enregistrées au démarrage du service (même ordre que ``app.main``)."""
    prompts = RegistrePrompts()
    registre = RegistreAgents()
    for definition in (
        construire_definition(prompts),
        construire_definition_positionnement(prompts),
        definir_agent_chatbot(prompts),
        definir_agent_conversation_chatbot(prompts),
        definir_agent_correction_chatbot(prompts),
        definir_agent_traduction_chatbot(prompts),
        definir_agent_memoire_chatbot(prompts),
        definir_agent_exercice_chatbot(prompts),
        definir_agent_correction(prompts),
        definir_agent_recommandation(prompts),
    ):
        registre.enregistrer(definition)
    return prompts, registre


def requete(entree: dict[str, Any], *, version_agent: str | None = None, contexte: dict[str, Any] | None = None):
    """Enveloppe d'appel ; l'entrée n'est validée que par le Harness, comme en production."""
    donnees: dict[str, Any] = {
        "request_id": REQUEST_ID,
        "contexte": contexte or CONTEXTE_MINIMAL,
        "entree": entree,
    }
    if version_agent is not None:
        donnees["version_agent"] = version_agent
    return RequeteAgent[dict].model_validate(donnees)
