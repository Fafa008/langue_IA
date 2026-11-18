"""Tests du scénario de démonstration du fournisseur factice (I-01) : valide, déterministe, sans réseau."""

import asyncio
import json
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.core.config import ConfigLLM
from app.core.erreurs import ErreurConfiguration
from app.llm import fabrique
from app.llm.adaptateurs.factice import FakeLLMClient, ScenarioLLM
from app.llm.base import MessageLLM
from app.llm.demonstration import JUSTIFICATION, repondre_demonstration, resultat_diagnostic_demonstration
from app.main import app
from app.schemas.base import ModeleStrict
from app.schemas.contexte import ContexteApprenant
from app.schemas.diagnostic import PhaseAssimil, PreuveReponse, ResultatDiagnostic
from tests.donnees import REQUEST_ID, RESULTAT_VALIDE

REPONSES = [
    {"id_question": "1", "competence": "grammaire", "type_reponse": "choix", "contenu": "B"},
    {"id_question": "2", "competence": "ecrit", "type_reponse": "texte", "contenu": "I live in Antananarivo."},
    {"id_question": "3", "competence": "oral", "type_reponse": "audio", "contenu": "Hello, my name is Rova."},
    {"id_question": "4", "competence": "ecrit", "type_reponse": "texte", "contenu": "I like reading."},
]


def messages(niveau: str = "B1", score: float = 64, reponses: list[dict] | None = None, langue: str = "en") -> list:
    """Messages au format du prompt d'évaluation diagnostic (bloc JSON entre balises)."""
    referentiel = "HSK" if langue == "zh" else "CECRL"
    donnees = {
        "code_langue": langue,
        "referentiel": referentiel,
        "reponses": REPONSES if reponses is None else reponses,
        "score_preliminaire": score,
        "contexte_apprenant": {"code_langue": langue, "referentiel": referentiel, "niveau_preliminaire": niveau},
        "descripteurs_rag": [],
        "exemples_few_shot": [],
    }
    contenu = f"Évalue.\n<donnees_diagnostic_non_fiables>\n{json.dumps(donnees)}\n</donnees_diagnostic_non_fiables>"
    return [MessageLLM(role="system", contenu="Système"), MessageLLM(role="user", contenu=contenu)]


def verifier(resultat: ResultatDiagnostic, niveau: str, reponses: list[dict], langue: str = "en") -> None:
    """Le résultat passe les mêmes contrôles que ceux appliqués par l'agent à une vraie réponse LLM."""
    contexte = ContexteApprenant(
        code_langue=langue, referentiel="HSK" if langue == "zh" else "CECRL", niveau_preliminaire=niveau
    )
    preuves = [PreuveReponse(**{k: r[k] for k in ("id_question", "competence", "type_reponse")}) for r in reponses]
    resultat.verifier_coherence(contexte, preuves)


def test_resultat_valide_coherent_et_honnete() -> None:
    resultat = resultat_diagnostic_demonstration(messages())

    assert resultat is not None
    verifier(resultat, "B1", REPONSES)
    assert resultat.niveau_estime == "B1"
    assert resultat.ecart_avec_niveau_preliminaire == 0
    assert resultat.phase_assimil is PhaseAssimil.ACTIVATION
    # Deux domaines distincts au plus, chacun prouvé par une production libre
    points = [(p.domaine, p.id_question) for p in resultat.points_faibles]
    assert points == [("expression_ecrite", "2"), ("expression_orale", "3")]
    assert all(p.justification == JUSTIFICATION for p in resultat.points_faibles)
    assert "démonstration" in resultat.points_faibles[0].observation


def test_resultat_deterministe() -> None:
    assert resultat_diagnostic_demonstration(messages()) == resultat_diagnostic_demonstration(messages())


@pytest.mark.parametrize(
    ("niveau", "score", "attendu", "ecart"),
    [("B1", 90, "B2", 1), ("B1", 20, "A2", -1), ("C2", 95, "C2", 0), ("A1", 10, "A1", 0)],
)
def test_niveau_estime_selon_le_score(niveau: str, score: float, attendu: str, ecart: int) -> None:
    resultat = resultat_diagnostic_demonstration(messages(niveau=niveau, score=score))
    assert resultat is not None
    assert (resultat.niveau_estime, resultat.ecart_avec_niveau_preliminaire) == (attendu, ecart)
    verifier(resultat, niveau, REPONSES)


def test_choix_seuls_impregnation_sans_point_faible() -> None:
    choix = [REPONSES[0]]
    resultat = resultat_diagnostic_demonstration(messages(score=90, reponses=choix))
    assert resultat is not None
    assert resultat.phase_assimil is PhaseAssimil.IMPREGNATION
    assert resultat.points_faibles == []
    verifier(resultat, "B1", choix)


def test_chinois_reste_dans_le_referentiel_hsk() -> None:
    reponses = [{"id_question": "9", "competence": "oral", "type_reponse": "audio", "contenu": "你好"}]
    resultat = resultat_diagnostic_demonstration(messages(niveau="HSK 2", score=88, reponses=reponses, langue="zh"))
    assert resultat is not None
    assert (resultat.referentiel, resultat.niveau_estime) == ("HSK", "HSK 3")
    verifier(resultat, "HSK 2", reponses, langue="zh")


def test_aucune_reponse_hors_diagnostic() -> None:
    class Autre(ModeleStrict):
        valeur: str

    assert repondre_demonstration(messages(), Autre) is None
    assert repondre_demonstration([MessageLLM(role="user", contenu="Bonjour")], ResultatDiagnostic) is None


def test_client_factice_scenarios_prioritaires_puis_repondeur() -> None:
    client = FakeLLMClient([ScenarioLLM(reponse=RESULTAT_VALIDE)], repondeur=repondre_demonstration)

    async def scenario() -> None:
        prepare, _ = await client.generer_json(messages(), schema=ResultatDiagnostic)
        assert prepare == ResultatDiagnostic.model_validate(RESULTAT_VALIDE)
        demo, meta = await client.generer_json(messages(), schema=ResultatDiagnostic)
        assert demo == resultat_diagnostic_demonstration(messages())
        assert meta.fournisseur == "factice"

    asyncio.run(scenario())


def test_client_factice_sans_repondeur_garde_l_erreur_de_configuration() -> None:
    with pytest.raises(ErreurConfiguration):
        asyncio.run(FakeLLMClient().generer_json(messages(), schema=ResultatDiagnostic))


def test_config_et_fabrique(env_propre: pytest.MonkeyPatch) -> None:
    assert ConfigLLM().factice_scenario == "aucun"
    env_propre.setenv("LLM_FACTICE_SCENARIO", "demonstration")
    config = ConfigLLM()
    assert config.factice_scenario == "demonstration"
    client = fabrique.creer_client(config)
    assert isinstance(client, FakeLLMClient)
    assert client._repondeur is repondre_demonstration
    env_propre.setenv("LLM_FACTICE_SCENARIO", "inconnu")
    with pytest.raises(ValueError):
        ConfigLLM()


@pytest.fixture
def client_demonstration(env_propre: pytest.MonkeyPatch) -> Iterator[TestClient]:
    env_propre.setenv("LLM_FOURNISSEUR", "factice")
    env_propre.setenv("LLM_FACTICE_SCENARIO", "demonstration")
    fabrique.reinitialiser_client()
    with TestClient(app) as client:
        yield client
    fabrique.reinitialiser_client()


def test_post_evaluer_repond_200_sans_cle_ni_reseau(client_demonstration: TestClient) -> None:
    """Critère I-01 : POST /diagnostic/evaluer avec le client factice renvoie 200 et une enveloppe valide."""
    corps = {
        "request_id": REQUEST_ID,
        "contexte": {"code_langue": "en", "referentiel": "CECRL", "niveau_preliminaire": "B1"},
        "entree": {"reponses": REPONSES, "score_preliminaire": 64},
    }
    reponse = client_demonstration.post("/diagnostic/evaluer", json=corps)

    assert reponse.status_code == 200
    enveloppe = reponse.json()
    assert enveloppe["statut"] == "succes"
    assert enveloppe["meta"]["fournisseur"] == "factice"
    resultat = ResultatDiagnostic.model_validate(enveloppe["resultat"])
    assert resultat.phase_assimil is PhaseAssimil.ACTIVATION
    assert [p.domaine for p in resultat.points_faibles] == ["expression_ecrite", "expression_orale"]
