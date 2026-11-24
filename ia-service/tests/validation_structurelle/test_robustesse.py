"""Robustesse des agents (RESULTATS_AGENTS_IA.md, section 4), avec le fournisseur factice.

Chaque cas simule une panne et vérifie que l'appelant reçoit une réponse contrôlée (enveloppe d'erreur codée ou
réponse dégradée), jamais une exception Python brute. Aucun service n'est modifié : les pannes sont injectées dans
des doublures construites pour le test.
"""

from __future__ import annotations

import asyncio
import dataclasses
import logging
from pathlib import Path

import pytest
from redis.exceptions import ConnectionError as RedisConnectionError

from app.core.erreurs import ErreurLlmIndisponible, ErreurLlmTimeout
from app.harness.execution import Harness
from app.harness.registre import RegistreAgents
from app.llm.adaptateurs.factice import FakeLLMClient, ScenarioLLM
from app.memory.redis import MemoireRedis
from app.rag.config import ConfigRAG
from app.rag.fabrique import construire_recuperateur
from app.rag.vide import RecuperateurVide
from app.schemas.commun import CodeErreur, ReponseAgent, ReponseErreur
from tests.test_agent_diagnostic import RESULTAT_PRUDENT, executer, preparer
from tests.test_agent_diagnostic import requete as requete_diagnostic
from tests.test_chatbot import REPONSE_MODELE
from tests.test_memory_redis import RedisFactice
from tests.validation_structurelle.outils import registre_complet, requete


def _executer_chatbot_v1(client: FakeLLMClient, registre: RegistreAgents | None = None) -> ReponseAgent | ReponseErreur:
    prompts, complet = registre_complet()
    harness = Harness(registre or complet, client, registre_prompts=prompts)
    return asyncio.run(harness.executer("chatbot", requete({"message": "Hello"}, version_agent="1.2.0")))


def test_fournisseur_indisponible_donne_une_erreur_controlee() -> None:
    resultat = _executer_chatbot_v1(FakeLLMClient([ScenarioLLM(erreur=ErreurLlmIndisponible("panne simulée"))]))

    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code == CodeErreur.LLM_INDISPONIBLE
    assert resultat.erreur.retryable is True
    assert "panne simulée" not in resultat.erreur.message  # aucun détail technique recopié


def test_delai_du_fournisseur_depasse_donne_une_erreur_controlee() -> None:
    resultat = _executer_chatbot_v1(FakeLLMClient([ScenarioLLM(erreur=ErreurLlmTimeout("délai simulé"))]))

    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code == CodeErreur.LLM_TIMEOUT


def test_budget_de_l_agent_depasse_donne_une_erreur_controlee() -> None:
    """Le fournisseur répond trop tard : le Harness coupe au budget de l'agent (réduit à 50 ms pour le test)."""
    prompts, complet = registre_complet()
    registre = RegistreAgents()
    registre.enregistrer(dataclasses.replace(complet.resoudre("chatbot", "1.2.0"), budget_ms=50))
    client = FakeLLMClient([ScenarioLLM(reponse=REPONSE_MODELE, delai_s=0.5)])
    harness = Harness(registre, client, registre_prompts=prompts)

    resultat = asyncio.run(harness.executer("chatbot", requete({"message": "Hello"}, version_agent="1.2.0")))

    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code == CodeErreur.LLM_TIMEOUT


@pytest.mark.parametrize(
    "reponse",
    ["pas du JSON", {"reponse": "Bonjour"}, {**REPONSE_MODELE, "traduction": 42}],
    ids=["texte-non-json", "champs-manquants", "type-invalide"],
)
def test_reponse_non_conforme_au_schema_est_rejetee(reponse: object) -> None:
    resultat = _executer_chatbot_v1(FakeLLMClient([ScenarioLLM(reponse=reponse)]))

    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code == CodeErreur.LLM_REPONSE_INVALIDE


def test_redis_indisponible_la_conversation_continue_sans_etat(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.WARNING)
    prompts, registre = registre_complet()
    memoire = MemoireRedis(RedisFactice(erreur=RedisConnectionError("Redis arrêté")))
    harness = Harness(
        registre, FakeLLMClient([ScenarioLLM(reponse=REPONSE_MODELE)]), registre_prompts=prompts, memoire=memoire
    )

    resultat = asyncio.run(
        harness.executer("chatbot", requete({"message": "Hello", "identifiant_session": "session-panne"}))
    )

    assert isinstance(resultat, ReponseAgent)
    assert resultat.version_agent == "2.0.0"
    assert "redis_indisponible" in caplog.text


@pytest.mark.parametrize("type_corpus", ["officiel", "pdf", "experimental"])
def test_corpus_absent_recuperateur_vide_et_absence_signalee(
    type_corpus: str, tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.ERROR, logger="app.rag.fabrique")
    configuration = ConfigRAG(
        corpus_actif=True,
        corpus_type=type_corpus,
        corpus_officiel_autorise=True,
        corpus_chemin=tmp_path / "absent",
    )

    recuperateur = construire_recuperateur(configuration)

    assert isinstance(recuperateur, RecuperateurVide)
    assert "indisponible" in caplog.text


def test_corpus_incoherent_recuperateur_vide(tmp_path: Path) -> None:
    (tmp_path / "manifeste.json").write_text('{"pas": "un manifeste"}', encoding="utf-8")
    (tmp_path / "descripteurs.jsonl").write_text("ligne invalide\n", encoding="utf-8")

    recuperateur = construire_recuperateur(
        ConfigRAG(corpus_actif=True, corpus_officiel_autorise=True, corpus_chemin=tmp_path)
    )

    assert isinstance(recuperateur, RecuperateurVide)


def test_corpus_absent_le_diagnostic_repond_en_signalant_le_repli(tmp_path: Path) -> None:
    recuperateur = construire_recuperateur(
        ConfigRAG(corpus_actif=True, corpus_officiel_autorise=True, corpus_chemin=tmp_path / "absent")
    )
    harness, _, _, _ = preparer(resultat=RESULTAT_PRUDENT, recuperateur=recuperateur)

    resultat = executer(harness, requete_diagnostic())

    assert isinstance(resultat, ReponseAgent)
    assert resultat.meta.version_corpus == "synthetique_fallback"
