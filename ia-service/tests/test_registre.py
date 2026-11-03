"""Tests du registre d'agents."""

from typing import Any

import pytest
from pydantic import Field

from app.core.erreurs import ErreurAgentInconnu, ErreurRegistre
from app.harness.agent import ContexteExecution, DefinitionAgent
from app.harness.registre import RegistreAgents
from app.schemas.base import ModeleStrict


class Entree(ModeleStrict):
    texte: str = Field(min_length=1)


class Sortie(ModeleStrict):
    valeur: str


async def executer(entree: Entree, contexte: ContexteExecution) -> Sortie:
    return Sortie(valeur=entree.texte)


def definition(code: str = "diagnostic", version: str = "1.0.0", **surcharges: Any) -> DefinitionAgent:
    base: dict[str, Any] = {
        "code": code,
        "version": version,
        "schema_entree": Entree,
        "schema_sortie": Sortie,
        "budget_ms": 1000,
        "version_prompt": "diagnostic/evaluation@1.0.0",
        "empreinte_prompt": "sha256:" + "a" * 64,
        "executer": executer,
    }
    base.update(surcharges)
    return DefinitionAgent(**base)


def test_enregistrer_et_resoudre() -> None:
    registre = RegistreAgents()
    agent = definition()
    registre.enregistrer(agent)

    assert len(registre) == 1
    assert "diagnostic" in registre
    assert "inconnu" not in registre
    assert registre.resoudre("diagnostic") is agent
    assert registre.resoudre("diagnostic", "1.0.0") is agent


def test_resoudre_la_derniere_version_semver() -> None:
    registre = RegistreAgents()
    registre.enregistrer(definition(version="1.0.0"))
    registre.enregistrer(definition(version="1.10.0"))
    dernier = definition(version="1.2.0")
    registre.enregistrer(dernier)

    assert registre.resoudre("diagnostic").version == "1.10.0"


def test_resoudre_une_prerelease() -> None:
    registre = RegistreAgents()
    registre.enregistrer(definition(version="1.10.0"))
    registre.enregistrer(definition(version="2.0.0-rc.1"))

    assert registre.resoudre("diagnostic").version == "2.0.0-rc.1"


def test_doublon_refuse() -> None:
    registre = RegistreAgents()
    registre.enregistrer(definition())
    with pytest.raises(ErreurRegistre):
        registre.enregistrer(definition())


def test_agent_inconnu() -> None:
    with pytest.raises(ErreurAgentInconnu):
        RegistreAgents().resoudre("diagnostic")


def test_version_inconnue() -> None:
    registre = RegistreAgents()
    registre.enregistrer(definition())
    with pytest.raises(ErreurAgentInconnu):
        registre.resoudre("diagnostic", "9.9.9")


def test_lister_trie_par_code_puis_version() -> None:
    registre = RegistreAgents()
    registre.enregistrer(definition(code="recommandation", version="2.0.0"))
    registre.enregistrer(definition(code="diagnostic", version="1.10.0"))
    registre.enregistrer(definition(code="diagnostic", version="1.2.0"))
    registre.enregistrer(definition(code="assistant-formateur", version="1.0.0"))

    assert [(d.code, d.version) for d in registre.lister()] == [
        ("assistant-formateur", "1.0.0"),
        ("diagnostic", "1.2.0"),
        ("diagnostic", "1.10.0"),
        ("recommandation", "2.0.0"),
    ]


def test_registre_extensible_a_plusieurs_agents() -> None:
    registre = RegistreAgents()
    for indice in range(9):
        registre.enregistrer(definition(code=f"agent-{indice}", version="1.0.0"))
    assert len(registre) == 9


@pytest.mark.parametrize(
    "surcharges",
    [
        {"code": "Diagnostic"},
        {"code": "diag_nostic"},
        {"code": "a" * 33},
        {"code": 42},
        {"version": "1.0"},
        {"version": "v1.0.0"},
        {"version": "1.0.0-.."},
        {"version": 1},
        {"budget_ms": 0},
        {"budget_ms": -1},
        {"budget_ms": 600_001},
        {"budget_ms": True},
        {"schema_entree": dict},
        {"schema_sortie": int},
        {"version_prompt": "diagnostic@1.0.0"},
        {"empreinte_prompt": "sha256:abc"},
        {"executer": "pas-callable"},
    ],
)
def test_definition_invalide_refusee(surcharges: dict[str, Any]) -> None:
    with pytest.raises(ErreurRegistre):
        definition(**surcharges)


def test_definition_valide() -> None:
    agent = definition()
    assert agent.budget_ms == 1000
    assert agent.schema_entree is Entree
    assert agent.schema_sortie is Sortie
