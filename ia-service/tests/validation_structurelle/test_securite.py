"""Sécurité et vie privée (RESULTATS_AGENTS_IA.md, section 5), avec le fournisseur factice.

Le test d'injection de prompt n'est volontairement pas écrit ici (voir le document de résultats).
"""

from __future__ import annotations

import asyncio
import logging

import pytest
from pydantic import ValidationError

from app.core.erreurs import ErreurLlmIndisponible
from app.harness.execution import Harness
from app.llm.adaptateurs.factice import FakeLLMClient, ScenarioLLM
from app.schemas.commun import CodeErreur, ReponseAgent, ReponseErreur, RequeteAgent
from tests.donnees import CONTEXTE_MINIMAL, REQUEST_ID
from tests.test_chatbot import REPONSE_MODELE
from tests.validation_structurelle.outils import registre_complet, requete

MARQUEUR = "MARQUEUR-APPRENANT-7731 je m'appelle Jean Dupont"


@pytest.mark.parametrize("champ", ["id_user", "id_apprenant", "email", "nom", "prenom"])
def test_un_identifiant_de_compte_dans_le_contexte_est_refuse(champ: str) -> None:
    with pytest.raises(ValidationError) as erreur:
        RequeteAgent[dict].model_validate(
            {
                "request_id": REQUEST_ID,
                "contexte": {**CONTEXTE_MINIMAL, champ: "valeur-de-compte"},
                "entree": {"message": "Hello"},
            }
        )
    assert erreur.value.errors()[0]["type"] == "extra_forbidden"


def test_un_identifiant_de_compte_dans_l_entree_est_refuse_par_le_harness() -> None:
    prompts, registre = registre_complet()
    client = FakeLLMClient([ScenarioLLM(reponse=REPONSE_MODELE)])
    harness = Harness(registre, client, registre_prompts=prompts)

    resultat = asyncio.run(harness.executer("chatbot", requete({"message": "Hello", "id_user": 42})))

    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code == CodeErreur.ENTREE_INVALIDE
    assert client.appels == []


def test_aucun_identifiant_de_compte_n_atteint_le_modele() -> None:
    """Les messages envoyés au fournisseur ne contiennent que le contexte pédagogique transmis."""
    prompts, registre = registre_complet()
    client = FakeLLMClient([ScenarioLLM(reponse=REPONSE_MODELE)])
    harness = Harness(registre, client, registre_prompts=prompts)

    resultat = asyncio.run(harness.executer("chatbot", requete({"message": "Hello", "identifiant_session": "s-1"})))

    assert isinstance(resultat, ReponseAgent)
    envoye = " ".join(message.contenu for message in client.appels[0])
    for interdit in ("id_user", "id_apprenant", "email", REQUEST_ID):
        assert interdit not in envoye


@pytest.mark.parametrize("succes", [True, False], ids=["tour-reussi", "tour-en-erreur"])
def test_aucun_texte_d_apprenant_dans_les_journaux(succes: bool, caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.DEBUG)
    scenario = ScenarioLLM(reponse=REPONSE_MODELE) if succes else ScenarioLLM(erreur=ErreurLlmIndisponible(MARQUEUR))
    prompts, registre = registre_complet()
    harness = Harness(registre, FakeLLMClient([scenario]), registre_prompts=prompts)

    asyncio.run(harness.executer("chatbot", requete({"message": MARQUEUR, "identifiant_session": "s-journal"})))

    assert MARQUEUR not in caplog.text
    assert "Jean Dupont" not in caplog.text
