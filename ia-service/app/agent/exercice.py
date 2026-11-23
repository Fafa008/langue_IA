"""Exercice ciblé (US-IA-CHAT-04) : un exercice court généré à partir d'une erreur récurrente.

Le type d'erreur est traduit en compétence documentaire, le descripteur est sélectionné par le RAG existant et son
identifiant est ajouté par le service IA : le modèle ne choisit jamais de référence de corpus. Aucun score ni
correction n'est produit ici ; le backend décide seul du stockage de l'exercice dans sa banque.
"""

from __future__ import annotations

import logging

from app.cecrl.niveau import niveau_effectif as resoudre_niveau_effectif
from app.cecrl.selection import selectionner_descripteurs
from app.harness.agent import ContexteExecution, DefinitionAgent
from app.memory import clefs
from app.prompts import RegistrePrompts
from app.prompts.registre import VERSION_EXERCICE_CHATBOT
from app.prompts.variables import VariablesExerciceChatbot
from app.rag.repli import est_descripteur_synthetique
from app.schemas.chatbot import EntreeExercice, ExerciceGenere, ResultatExercice
from app.schemas.regles import Competence

logger = logging.getLogger(__name__)

CODE_AGENT_EXERCICE_CHATBOT = "chatbot-exercice"
VERSION_AGENT_EXERCICE_CHATBOT = "1.0.0"
BUDGET_EXERCICE_CHATBOT_MS = 20_000

COMPETENCE_PAR_ERREUR: dict[str, Competence] = {
    "grammaire": "grammaire",
    "orthographe": "ecrit",
    "syntaxe": "grammaire",
}


async def generer(entree: EntreeExercice, contexte: ContexteExecution) -> ResultatExercice:
    """Générer un exercice unique, adossé à un descripteur réel ou signalé comme synthétique."""
    clefs.valider_identifiant_session(entree.identifiant_session)
    apprenant = contexte.contexte
    niveau = resoudre_niveau_effectif(
        entree.niveau,
        confirme=True,
        referentiel=apprenant.referentiel,
    )
    descripteurs = await selectionner_descripteurs(
        contexte.outils.recuperateur_rag,
        code_langue=apprenant.code_langue,
        referentiel=apprenant.referentiel,
        niveau=niveau,
        competence=COMPETENCE_PAR_ERREUR[entree.type_erreur],
        texte=entree.erreur,
        limite=1,
    )
    if descripteurs and all(est_descripteur_synthetique(descripteur) for descripteur in descripteurs):
        contexte.signalement.provenance = "synthetique_fallback"
        contexte.signalement.statut_verification = "A_VERIFIER"
        contexte.signalement.version_corpus_effective = "synthetique_fallback"
        logger.info("descripteur_exercice_synthetique niveau=%s", niveau)

    variables = VariablesExerciceChatbot(
        contexte_apprenant=apprenant,
        type_erreur=entree.type_erreur,
        erreur=entree.erreur,
        niveau_effectif=niveau,
        descripteurs_rag=list(descripteurs),
    )
    rendu = contexte.outils.registre_prompts.rendre_exercice_chatbot(variables)
    genere, _ = await contexte.outils.client_llm.generer_json(
        rendu.messages,
        schema=ExerciceGenere,
        temperature=rendu.temperature,
        max_tokens=rendu.max_tokens,
    )
    return ResultatExercice(
        enonce=genere.enonce,
        consigne=genere.consigne,
        descripteur_id=descripteurs[0].identifiant,
        niveau=niveau,
    )


def definir_agent_exercice_chatbot(
    registre_prompts: RegistrePrompts,
) -> DefinitionAgent[EntreeExercice, ResultatExercice]:
    """Déclarer la tâche d'exercice ciblé dans le registre partagé du Harness."""
    version_prompt, empreinte_prompt = registre_prompts.definition("chatbot", "exercice", VERSION_EXERCICE_CHATBOT)
    return DefinitionAgent(
        code=CODE_AGENT_EXERCICE_CHATBOT,
        version=VERSION_AGENT_EXERCICE_CHATBOT,
        schema_entree=EntreeExercice,
        schema_sortie=ResultatExercice,
        budget_ms=BUDGET_EXERCICE_CHATBOT_MS,
        version_prompt=version_prompt,
        empreinte_prompt=empreinte_prompt,
        executer=generer,
    )
