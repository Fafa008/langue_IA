"""Validation structurelle des agents (RESULTATS_AGENTS_IA.md, section 3), avec le fournisseur factice.

Ces tests vérifient la forme des données et le câblage réel du service, pas la qualité des réponses.
"""

from __future__ import annotations

import asyncio
import hashlib
import re
import shutil
import typing
from pathlib import Path

import pytest
from pydantic import BaseModel

from app.core.config import ConfigMemoire
from app.core.erreurs import ErreurAgentInconnu
from app.harness.execution import Harness
from app.llm.adaptateurs.factice import FakeLLMClient, ScenarioLLM
from app.memory.redis import MemoireRedis
from app.prompts import RegistrePrompts
from app.prompts.registre import VERSION_TRADUCTION_CHATBOT
from app.schemas.chatbot import TourMemoire
from app.schemas.commun import CodeErreur, ReponseAgent, ReponseErreur
from tests.test_chatbot import REPONSE_MODELE
from tests.test_memory_redis import RedisFactice
from tests.validation_structurelle.outils import registre_complet, requete

PROMPTS_SOURCE = Path(__file__).resolve().parents[2] / "app" / "prompts"


def _modeles_imbriques(modele: type[BaseModel], vus: set[type[BaseModel]] | None = None) -> set[type[BaseModel]]:
    """Le modèle et tous les modèles Pydantic atteignables par ses champs (listes, unions, optionnels…)."""
    vus = vus if vus is not None else set()
    if modele in vus:
        return vus
    vus.add(modele)
    for champ in modele.model_fields.values():
        a_explorer = [champ.annotation]
        while a_explorer:
            annotation = a_explorer.pop()
            if isinstance(annotation, type) and issubclass(annotation, BaseModel):
                _modeles_imbriques(annotation, vus)
            a_explorer.extend(typing.get_args(annotation))
    return vus


# --- Rejet des champs inconnus ----------------------------------------------------------------------------------


def test_les_dix_agents_sont_enregistres() -> None:
    _, registre = registre_complet()
    assert len(registre) == 10
    assert {(d.code, d.version) for d in registre.lister()} == {
        ("chatbot", "1.2.0"),
        ("chatbot", "2.0.0"),
        ("chatbot-correction", "1.0.0"),
        ("chatbot-exercice", "1.0.0"),
        ("chatbot-memoire", "1.0.0"),
        ("chatbot-traduction", "1.0.0"),
        ("correction", "1.0.0"),
        ("diagnostic", "1.0.0"),
        ("diagnostic", "1.2.0"),
        ("recommandation", "1.0.0"),
    }


@pytest.mark.parametrize("sens", ["schema_entree", "schema_sortie"])
def test_tous_les_schemas_d_agent_refusent_les_champs_inconnus(sens: str) -> None:
    """Chaque schéma d'entrée et de sortie, et chaque modèle imbriqué, est en ``extra="forbid"``."""
    _, registre = registre_complet()
    permissifs = []
    for definition in registre.lister():
        for modele in _modeles_imbriques(getattr(definition, sens)):
            if modele.model_config.get("extra") != "forbid":
                permissifs.append(f"{definition.code}@{definition.version}:{modele.__name__}")
    assert permissifs == []


def test_harness_refuse_un_champ_inconnu_en_entree_sans_appeler_le_llm() -> None:
    prompts, registre = registre_complet()
    client = FakeLLMClient([ScenarioLLM(reponse=REPONSE_MODELE)])
    harness = Harness(registre, client, registre_prompts=prompts)

    resultat = asyncio.run(
        harness.executer("chatbot", requete({"message": "Hello", "champ_inconnu": True}, version_agent="1.2.0"))
    )

    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code == CodeErreur.ENTREE_INVALIDE
    assert client.appels == []


def test_harness_refuse_un_champ_inconnu_en_sortie() -> None:
    prompts, registre = registre_complet()
    client = FakeLLMClient([ScenarioLLM(reponse={**REPONSE_MODELE, "champ_inconnu": "valeur"})])
    harness = Harness(registre, client, registre_prompts=prompts)

    resultat = asyncio.run(harness.executer("chatbot", requete({"message": "Hello"}, version_agent="1.2.0")))

    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code == CodeErreur.LLM_REPONSE_INVALIDE


def test_harness_accepte_la_meme_sortie_sans_champ_inconnu() -> None:
    """Témoin : sans le champ inconnu, la même réponse est acceptée."""
    prompts, registre = registre_complet()
    harness = Harness(registre, FakeLLMClient([ScenarioLLM(reponse=REPONSE_MODELE)]), registre_prompts=prompts)

    resultat = asyncio.run(harness.executer("chatbot", requete({"message": "Hello"}, version_agent="1.2.0")))

    assert isinstance(resultat, ReponseAgent)


# --- Résolution de la version d'agent ---------------------------------------------------------------------------


def test_resolution_des_versions_sur_le_registre_reel() -> None:
    _, registre = registre_complet()

    assert registre.resoudre("diagnostic").version == "1.2.0"  # la plus récente par défaut
    assert registre.resoudre("diagnostic", "1.0.0").version == "1.0.0"
    assert registre.resoudre("chatbot").version == "2.0.0"
    assert registre.resoudre("chatbot", "1.2.0").version == "1.2.0"
    with pytest.raises(ErreurAgentInconnu):
        registre.resoudre("diagnostic", "9.9.9")
    with pytest.raises(ErreurAgentInconnu):
        registre.resoudre("agent-inexistant")


def test_harness_signale_une_version_inconnue() -> None:
    prompts, registre = registre_complet()
    harness = Harness(registre, FakeLLMClient(), registre_prompts=prompts)

    resultat = asyncio.run(harness.executer("chatbot", requete({"message": "Hello"}, version_agent="9.9.9")))

    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code == CodeErreur.AGENT_INCONNU


# --- Empreinte SHA-256 des prompts ------------------------------------------------------------------------------


def test_empreinte_sha256_du_prompt_et_changement_si_le_texte_change(tmp_path: Path) -> None:
    copie = tmp_path / "prompts"
    shutil.copytree(PROMPTS_SOURCE, copie)
    nom = f"traduction@{VERSION_TRADUCTION_CHATBOT}"
    systeme = copie / "chatbot" / f"{nom}.systeme.md"
    utilisateur = copie / "chatbot" / f"{nom}.utilisateur.md"

    _, empreinte = RegistrePrompts(copie).definition("chatbot", "traduction", VERSION_TRADUCTION_CHATBOT)
    attendue = hashlib.sha256(systeme.read_bytes() + b"\0" + utilisateur.read_bytes()).hexdigest()
    assert re.fullmatch(r"sha256:[0-9a-f]{64}", empreinte)
    assert empreinte == f"sha256:{attendue}"
    # Mêmes fichiers que le service : même empreinte (stabilité).
    assert RegistrePrompts().definition("chatbot", "traduction", VERSION_TRADUCTION_CHATBOT)[1] == empreinte

    systeme.write_text(systeme.read_text(encoding="utf-8") + "\nPhrase ajoutée pour le test.\n", encoding="utf-8")
    _, modifiee = RegistrePrompts(copie).definition("chatbot", "traduction", VERSION_TRADUCTION_CHATBOT)
    assert modifiee != empreinte


# --- TTL de session et plafond de tours (valeurs par défaut) ----------------------------------------------------


def test_ttl_24_heures_et_plafond_20_tours_par_defaut(monkeypatch: pytest.MonkeyPatch) -> None:
    for variable in ("REDIS_URL", "REDIS_TTL_S", "REDIS_TOURS_MAX"):
        monkeypatch.delenv(variable, raising=False)
    configuration = ConfigMemoire()
    assert configuration.ttl_s == 86_400
    assert configuration.tours_max == 20

    client = RedisFactice()
    memoire = MemoireRedis(client)  # valeurs par défaut du service
    for rang in range(25):
        asyncio.run(memoire.ajouter_tour("session-test", TourMemoire(role="apprenant", contenu=f"Tour {rang}")))

    tours = asyncio.run(memoire.lire_tours("session-test"))
    assert len(tours) == 20
    assert tours[0].contenu == "Tour 5" and tours[-1].contenu == "Tour 24"
    assert client.expirations["session:session-test:turns"] == 86_400
