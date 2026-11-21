"""Tests de l'agent Recommandation : contrat, prompt, validations et repli sans domaine exploitable."""

import asyncio
import json
from uuid import UUID

import pytest
from pydantic import ValidationError

from app.agents.recommandation import (
    BUDGET_MS,
    CODE_AGENT,
    VERSION_AGENT,
    RecommandationAgent,
    definir_agent_recommandation,
)
from app.core.erreurs import ErreurReponseLlm
from app.harness.execution import Harness
from app.harness.registre import RegistreAgents
from app.llm.adaptateurs.factice import FakeLLMClient, ScenarioLLM
from app.llm.demonstration import repondre_demonstration
from app.prompts import RegistrePrompts
from app.schemas.commun import ReponseAgent, ReponseErreur, RequeteAgent
from app.schemas.contexte import ContexteApprenant
from app.schemas.recommandation import (
    EntreeRecommandation,
    RecommandationIncoherente,
    ResultatRecommandation,
)
from tests.donnees import REQUEST_ID

CONTEXTE = {"code_langue": "en", "referentiel": "CECRL", "niveau_preliminaire": "B1"}
ENTREE = {
    "points_faibles": [
        {
            "domaine": "grammaire",
            "id_question": "q-12",
            "observation": "Le prétérit manque dans « yesterday I go ».",
            "justification": "Le repère temporel situe l'action dans le passé.",
        },
        {
            "domaine": "vocabulaire",
            "id_question": "q-18",
            "observation": "« marchandise » est employé à la place de « goods ».",
            "justification": "Le champ lexical des achats reste imprécis.",
        },
    ],
    "niveau_vise": "B2",
}
RESULTAT = {
    "code_langue": "en",
    "referentiel": "CECRL",
    "niveau_cible": "B2",
    "recommandations": [
        {
            "domaine": "grammaire",
            "type_exercice": "GRAMMAIRE",
            "action": "Refaire un exercice de conjugaison au prétérit.",
            "justification": "Le point faible porte sur le prétérit.",
            "priorite": 1,
        },
        {
            "domaine": "vocabulaire",
            "type_exercice": "VOCABULAIRE",
            "action": "Réviser le vocabulaire des achats.",
            "justification": "Le terme employé est imprécis.",
            "priorite": 2,
        },
    ],
    "resume": "Deux actions courtes : grammaire puis vocabulaire.",
    "confiance": 0.72,
}


def preparer(resultat: dict | None = None, repondeur=None):
    """Construire le Harness réel avec un faux client LLM."""
    if repondeur is not None:
        client = FakeLLMClient(repondeur=repondeur)
    else:
        client = FakeLLMClient([ScenarioLLM(reponse=resultat if resultat is not None else RESULTAT)])
    registre_prompts = RegistrePrompts()
    registre = RegistreAgents()
    definition = definir_agent_recommandation(registre_prompts)
    registre.enregistrer(definition)
    harness = Harness(registre, client, registre_prompts=registre_prompts)
    return harness, client, definition


def requete(entree: dict | None = None, contexte: dict | None = None) -> RequeteAgent:
    return RequeteAgent[EntreeRecommandation].model_validate(
        {
            "request_id": REQUEST_ID,
            "version_agent": VERSION_AGENT,
            "contexte": contexte if contexte is not None else CONTEXTE,
            "entree": entree if entree is not None else ENTREE,
        }
    )


def executer(harness: Harness, requete_agent: RequeteAgent) -> ReponseAgent | ReponseErreur:
    return asyncio.run(harness.executer(CODE_AGENT, requete_agent))


def corps_prompt(client: FakeLLMClient) -> dict:
    """Extraire le JSON du bloc de données non fiables du message utilisateur."""
    contenu = client.appels[0][1].contenu
    bloc = contenu.split("<donnees_recommandation_non_fiables>\n", 1)[1]
    return json.loads(bloc.split("\n</donnees_recommandation_non_fiables>", 1)[0])


def test_recommandation_nominale() -> None:
    harness, llm, _definition = preparer()

    reponse = executer(harness, requete())

    assert isinstance(reponse, ReponseAgent)
    assert reponse.agent == CODE_AGENT
    assert reponse.version_agent == VERSION_AGENT
    assert reponse.version_prompt == "recommandation/actions@1.0.0"
    assert reponse.resultat.model_dump(mode="json") == RESULTAT
    assert reponse.meta.fournisseur == "factice"
    assert len(llm.appels) == 1
    donnees = corps_prompt(llm)
    assert donnees["niveau_vise"] == "B2"
    assert [point["domaine"] for point in donnees["points_faibles"]] == ["grammaire", "vocabulaire"]


def test_aucun_domaine_exploitable_sans_appel_llm() -> None:
    harness, llm, _definition = preparer()
    entree = {
        "points_faibles": [
            {
                "domaine": "expression_ecrite",
                "id_question": "q-9",
                "observation": "Phrase courte.",
                "justification": "Production à développer.",
            }
        ],
        "niveau_vise": "B2",
    }

    reponse = executer(harness, requete(entree))

    assert isinstance(reponse, ReponseAgent)
    assert reponse.resultat.recommandations == []
    assert reponse.resultat.confiance == 0.0
    assert llm.appels == []


def test_entree_hors_contrat_refusee_par_le_harness() -> None:
    """Le Harness revalide l'entrée même si l'enveloppe a été construite sans validation (API contournée)."""
    harness, _llm, _definition = preparer()
    brute = RequeteAgent.model_construct(
        request_id=UUID(REQUEST_ID),
        version_agent=VERSION_AGENT,
        contexte=ContexteApprenant.model_validate(CONTEXTE),
        entree={**ENTREE, "points_faibles": []},
    )

    reponse = executer(harness, brute)

    assert isinstance(reponse, ReponseErreur)
    assert reponse.erreur.code == "ENTREE_INVALIDE"


def test_resultat_incoherent_avec_la_demande_refuse() -> None:
    incoherent = {**RESULTAT, "niveau_cible": "A2"}
    harness, _llm, _definition = preparer(incoherent)

    reponse = executer(harness, requete())

    assert isinstance(reponse, ReponseErreur)
    assert reponse.erreur.code == "LLM_REPONSE_INVALIDE"


def test_resultat_hors_schema_refuse() -> None:
    harness, _llm, _definition = preparer({"niveau_cible": "B2"})

    reponse = executer(harness, requete())

    assert isinstance(reponse, ReponseErreur)
    assert reponse.erreur.code == "LLM_REPONSE_INVALIDE"


def test_definition_est_valide_au_demarrage() -> None:
    _harness, _llm, definition = preparer()

    assert definition.code == CODE_AGENT
    assert definition.version == VERSION_AGENT
    assert definition.budget_ms == BUDGET_MS
    assert definition.version_prompt == "recommandation/actions@1.0.0"
    assert definition.empreinte_prompt.startswith("sha256:")


def test_repondeur_demonstration_produit_un_resultat_valide() -> None:
    """Le scénario factice doit respecter le contrat sans clé LLM ni réseau."""
    harness, _llm, _definition = preparer(repondeur=repondre_demonstration)

    reponse = executer(harness, requete())

    assert isinstance(reponse, ReponseAgent)
    assert len(reponse.resultat.recommandations) == 2
    assert reponse.resultat.confiance > 0


@pytest.mark.parametrize(
    "mutation",
    [
        lambda r: r["recommandations"][1].__setitem__("type_exercice", "ECOUTE"),
        lambda r: r["recommandations"][1].__setitem__("priorite", 3),
        lambda r: r.__setitem__("confiance", 0.0),
        lambda r: r["recommandations"][1].__setitem__("domaine", "grammaire"),
        lambda r: r.__setitem__("referentiel", "HSK"),
    ],
)
def test_schema_refuse_les_resultats_incoherents(mutation) -> None:
    donnees = json.loads(json.dumps(RESULTAT))
    mutation(donnees)
    with pytest.raises(ValidationError):
        ResultatRecommandation.model_validate(donnees)


def test_verifier_coherence_refuse_un_domaine_non_demande() -> None:
    resultat = ResultatRecommandation.model_validate(RESULTAT)
    entree = EntreeRecommandation.model_validate({**ENTREE, "points_faibles": [ENTREE["points_faibles"][0]]})

    with pytest.raises(RecommandationIncoherente):
        resultat.verifier_coherence(entree, ContexteApprenant.model_validate(CONTEXTE))


def test_agent_transforme_incoherence_en_erreur_llm() -> None:
    resultat = ResultatRecommandation.model_validate(RESULTAT)
    entree = EntreeRecommandation.model_validate({**ENTREE, "points_faibles": [ENTREE["points_faibles"][0]]})
    with pytest.raises(ErreurReponseLlm):
        RecommandationAgent._verifier_coherence(resultat, entree, ContexteApprenant.model_validate(CONTEXTE))
