"""Tests de l'agent Diagnostic : entrée, RAG, prompt, validation et signalement de l'écart."""

import asyncio
import json
import logging
from uuid import UUID

import pytest
from pydantic import ValidationError

from app.agents.diagnostic import (
    BUDGET_MS,
    CODE_AGENT,
    SEUIL_ECART_IMPORTANT,
    VERSION_AGENT,
    DiagnosticAgent,
    EntreeDiagnostic,
    construire_definition,
    est_ecart_important,
)
from app.core.erreurs import ErreurCorpusIndisponible
from app.harness.execution import Harness
from app.harness.registre import RegistreAgents
from app.llm.adaptateurs.factice import FakeLLMClient, ScenarioLLM
from app.prompts import RegistrePrompts
from app.rag import RecuperateurVide, RequeteRAG
from app.schemas.commun import CodeErreur, ReponseAgent, ReponseErreur, RequeteAgent
from app.schemas.contexte import ContexteApprenant
from app.schemas.diagnostic import PhaseAssimil, ResultatDiagnostic
from tests.donnees import REQUEST_ID

CONTEXTE_APPRENANT = {
    "code_langue": "en",
    "referentiel": "CECRL",
    "niveau_preliminaire": "B1",
    "memoire_pedagogique": {
        "resume": "Deux sessions de conversation, bonnes bases lexicales.",
        "points_forts": ["aisance à l'oral"],
        "points_faibles": ["emploi des temps"],
        "nb_activites": 12,
    },
}

REPONSES = [
    {
        "id_question": "q-1",
        "competence": "ecrit",
        "type_reponse": "texte",
        "contenu": "I have been learning English for two years.",
    },
    {
        "id_question": "q-2",
        "competence": "oral",
        "type_reponse": "audio",
        "contenu": "Je présente mon parcours professionnel.",
    },
]

ENTREE = {
    "scenario": "quotidien",
    "reponses": REPONSES,
    "score_preliminaire": 64,
}

RESULTAT = {
    "code_langue": "en",
    "referentiel": "CECRL",
    "niveau_estime": "B2",
    "phase_assimil": "activation",
    "points_faibles": [
        {
            "domaine": "expression_ecrite",
            "id_question": "q-1",
            "observation": "La réponse comporte une phrase au présent là où le passé serait attendu.",
            "justification": "Cette observation semble indiquer un emploi irrégulier des temps ; à confirmer.",
        }
    ],
    "score_confiance": 0.78,
    "niveau_preliminaire": "B1",
    "ecart_avec_niveau_preliminaire": 1,
}

RESULTAT_PRUDENT = {
    "code_langue": "en",
    "referentiel": "CECRL",
    "niveau_estime": "B1",
    "phase_assimil": "impregnation",
    "points_faibles": [],
    "score_confiance": 0.0,
    "niveau_preliminaire": "B1",
    "ecart_avec_niveau_preliminaire": 0,
}

DESCRIPTEURS = [
    {
        "identifiant": "cecrl-b1-ecrit",
        "code_langue": "en",
        "referentiel": "CECRL",
        "niveau": "B1",
        "competence": "ecrit",
        "contenu": "Peut écrire un texte simple et cohérent sur des sujets familiers.",
    },
    {
        "identifiant": "cecrl-b1-oral",
        "code_langue": "en",
        "referentiel": "CECRL",
        "niveau": "B1",
        "competence": "oral",
        "contenu": "Peut exposer simplement un parcours personnel.",
    },
]


class RecuperateurFactice:
    """Port RAG contrôlé par les tests : retourne des descripteurs ou lève une erreur préparée."""

    nom = "rag-factice"
    version_corpus = "2026.11"

    def __init__(self, descripteurs: tuple[dict, ...] | list[dict], *, erreur: Exception | None = None) -> None:
        self.descripteurs = tuple(descripteurs)
        self.erreur = erreur
        self.requetes: list[RequeteRAG] = []
        self.ferme = False

    async def rechercher(self, requete: RequeteRAG):
        self.requetes.append(requete)
        if self.erreur is not None:
            raise self.erreur
        return self.descripteurs

    async def fermer(self) -> None:
        self.ferme = True


def preparer(
    resultat: dict | None = None,
    *,
    descripteurs: tuple[dict, ...] | list[dict] = tuple(DESCRIPTEURS),
    recuperateur: object | None = None,
    client: FakeLLMClient | None = None,
):
    """Construire le Harness réel, l'agent enregistré et les doublures LLM/RAG."""
    if client is None:
        client = FakeLLMClient([ScenarioLLM(reponse=resultat if resultat is not None else RESULTAT)])
    registre_prompts = RegistrePrompts()
    registre = RegistreAgents()
    definition = construire_definition(registre_prompts)
    registre.enregistrer(definition)
    rag = recuperateur if recuperateur is not None else RecuperateurFactice(descripteurs)
    harness = Harness(
        registre,
        client,
        registre_prompts=registre_prompts,
        recuperateur_rag=rag,
    )
    return harness, client, rag, definition


def requete(entree: dict | None = None, contexte: dict | None = None) -> RequeteAgent[EntreeDiagnostic]:
    return RequeteAgent[EntreeDiagnostic].model_validate(
        {
            "request_id": REQUEST_ID,
            "version_agent": VERSION_AGENT,
            "contexte": contexte if contexte is not None else CONTEXTE_APPRENANT,
            "entree": entree if entree is not None else ENTREE,
        }
    )


def requete_non_validee(entree: object) -> RequeteAgent:
    """Requête dont l'entrée n'est pas validée : le Harness doit la rejeter lui-même."""
    return RequeteAgent.model_construct(
        request_id=UUID(REQUEST_ID),
        version_agent=VERSION_AGENT,
        contexte=ContexteApprenant.model_validate(CONTEXTE_APPRENANT),
        entree=entree,
    )


def executer(harness: Harness, requete_agent: RequeteAgent) -> ReponseAgent | ReponseErreur:
    return asyncio.run(harness.executer(CODE_AGENT, requete_agent))


def corps_prompt(client: FakeLLMClient) -> dict:
    """Extraire le JSON des données non fiables du premier message utilisateur envoyé au LLM."""
    contenu = client.appels[0][1].contenu
    bloc = contenu.split("<donnees_diagnostic_non_fiables>\n", 1)[1]
    bloc = bloc.split("\n</donnees_diagnostic_non_fiables>", 1)[0]
    return json.loads(bloc)


def test_execute_le_diagnostic_et_retourne_une_reponse_conforme() -> None:
    harness, client, _, definition = preparer()

    resultat = executer(harness, requete())

    assert isinstance(resultat, ReponseAgent)
    assert resultat.request_id == UUID(REQUEST_ID)
    assert resultat.agent == CODE_AGENT
    assert resultat.version_agent == VERSION_AGENT
    assert resultat.version_prompt == "diagnostic/evaluation@1.1.0"
    assert resultat.resultat == ResultatDiagnostic.model_validate(RESULTAT)
    assert resultat.meta.fournisseur == "factice"
    assert resultat.meta.modele == "factice-1"
    assert resultat.meta.version_corpus == "2026.11"
    assert resultat.meta.empreinte_prompt == definition.empreinte_prompt
    assert len(client.appels) == 1


def test_transmet_au_prompt_les_reponses_le_score_et_les_descripteurs() -> None:
    harness, client, rag, _ = preparer()

    resultat = executer(harness, requete())

    assert isinstance(resultat, ReponseAgent)
    corps = corps_prompt(client)
    assert corps["code_langue"] == "en"
    assert corps["referentiel"] == "CECRL"
    assert corps["score_preliminaire"] == 64
    assert corps["reponses"][0]["contenu"] == REPONSES[0]["contenu"]
    assert corps["reponses"][1]["contenu"] == REPONSES[1]["contenu"]
    assert corps["contexte_apprenant"]["niveau_preliminaire"] == "B1"
    assert corps["contexte_apprenant"]["memoire_pedagogique"]["resume"].startswith("Deux sessions")
    assert [descripteur["identifiant"] for descripteur in corps["descripteurs_rag"]] == [
        "cecrl-b1-ecrit",
        "cecrl-b1-oral",
    ]
    assert len(corps["exemples_few_shot"]) == 1
    assert corps["exemples_few_shot"][0]["scenario"] == "quotidien"
    assert corps["exemples_few_shot"][0]["entree"]["contexte_apprenant"]["code_langue"] == "en"
    assert rag.requetes == [
        RequeteRAG(
            code_langue="en",
            referentiel="CECRL",
            niveau="B1",
            competences=("ecrit", "oral"),
            texte="\n".join(reponse["contenu"] for reponse in REPONSES),
            limite=8,
        )
    ]


def test_selectionne_le_few_shot_du_scenario_demande() -> None:
    harness, client, _, _ = preparer()
    entree = {**ENTREE, "scenario": "entretien"}

    resultat = executer(harness, requete(entree=entree))

    assert isinstance(resultat, ReponseAgent)
    exemple = corps_prompt(client)["exemples_few_shot"][0]
    assert exemple["scenario"] == "entretien"
    assert exemple["entree"]["contexte_apprenant"]["code_langue"] == "en"


def test_borne_et_deduplique_les_descripteurs() -> None:
    descripteurs = [{**DESCRIPTEURS[0], "identifiant": f"cecrl-b1-{index}"} for index in range(10)]
    # Doublon placé avant la limite de huit : il doit être ignoré sans consommer de place.
    descripteurs.insert(2, {**DESCRIPTEURS[0], "identifiant": "cecrl-b1-0"})
    descripteurs.append({**DESCRIPTEURS[0], "identifiant": "cecrl-b1-1"})
    harness, client, _, _ = preparer(descripteurs=descripteurs)

    resultat = executer(harness, requete())

    assert isinstance(resultat, ReponseAgent)
    rendus = corps_prompt(client)["descripteurs_rag"]
    assert len(rendus) == 8
    assert [descripteur["identifiant"] for descripteur in rendus] == [f"cecrl-b1-{index}" for index in range(8)]


def test_procede_sans_descripteur_et_signale_la_prudence(caplog: pytest.LogCaptureFixture) -> None:
    harness, client, _, _ = preparer(resultat=RESULTAT_PRUDENT, descripteurs=())
    caplog.set_level(logging.WARNING, logger="app.agents.diagnostic")

    resultat = executer(harness, requete())

    assert isinstance(resultat, ReponseAgent)
    assert resultat.resultat == ResultatDiagnostic.model_validate(RESULTAT_PRUDENT)
    assert corps_prompt(client)["descripteurs_rag"] == []
    assert "Aucun descripteur RAG disponible" in caplog.text


def test_signale_un_ecart_important(caplog: pytest.LogCaptureFixture) -> None:
    resultat_ecarte = {
        **RESULTAT,
        "niveau_estime": "C2",
        "ecart_avec_niveau_preliminaire": 3,
        "points_faibles": [],
    }
    harness, _, _, _ = preparer(resultat=resultat_ecarte)
    caplog.set_level(logging.WARNING, logger="app.agents.diagnostic")

    resultat = executer(harness, requete())

    assert isinstance(resultat, ReponseAgent)
    messages = [enregistrement.getMessage() for enregistrement in caplog.records]
    assert any("Écart important" in message and "ecart=+3" in message for message in messages)
    assert all(REPONSES[0]["contenu"] not in message for message in messages)


def test_ne_signale_pas_un_ecart_modere(caplog: pytest.LogCaptureFixture) -> None:
    harness, _, _, _ = preparer()
    caplog.set_level(logging.WARNING, logger="app.agents.diagnostic")

    resultat = executer(harness, requete())

    assert isinstance(resultat, ReponseAgent)
    assert "Écart important" not in caplog.text


@pytest.mark.parametrize(
    ("ecart", "attendu"),
    [(0, False), (1, False), (-1, False), (2, True), (-2, True), (3, True), (-3, True)],
)
def test_ecart_important_est_signe_et_seuil(ecart: int, attendu: bool) -> None:
    assert est_ecart_important(ecart) is attendu


def test_ecart_important_refuse_un_ecart_ou_un_seuil_invalide() -> None:
    with pytest.raises(TypeError):
        est_ecart_important(True)  # type: ignore[arg-type]
    with pytest.raises(TypeError):
        est_ecart_important(2.0)  # type: ignore[arg-type]
    with pytest.raises(ValueError):
        est_ecart_important(SEUIL_ECART_IMPORTANT, 0)


def test_refuse_une_entree_sans_reponse_sans_appeler_le_llm() -> None:
    harness, client, rag, _ = preparer()

    resultat = executer(harness, requete_non_validee({"reponses": [], "score_preliminaire": 64}))

    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code is CodeErreur.ENTREE_INVALIDE
    assert resultat.erreur.retryable is False
    assert client.appels == []
    assert rag.requetes == []


@pytest.mark.parametrize("score", [True, -1, 101])
def test_refuse_un_score_preliminaire_invalide(score: object) -> None:
    with pytest.raises(ValidationError):
        EntreeDiagnostic.model_validate({**ENTREE, "score_preliminaire": score})


def test_exige_le_score_preliminaire_et_un_scenario_connu() -> None:
    with pytest.raises(ValidationError):
        EntreeDiagnostic.model_validate({"reponses": REPONSES})
    with pytest.raises(ValidationError):
        EntreeDiagnostic.model_validate({**ENTREE, "scenario": "telephone"})


def test_refuse_un_resultat_incoherent_avec_la_langue_du_contexte() -> None:
    resultat_francais = {**RESULTAT, "code_langue": "fr"}
    harness, _, _, _ = preparer(resultat=resultat_francais)

    resultat = executer(harness, requete())

    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code is CodeErreur.LLM_REPONSE_INVALIDE
    assert resultat.erreur.retryable is True


def test_refuse_un_resultat_qui_ne_reprend_pas_le_niveau_preliminaire() -> None:
    resultat_decalé = {
        **RESULTAT,
        "niveau_estime": "B1",
        "niveau_preliminaire": "A2",
        "ecart_avec_niveau_preliminaire": 1,
    }
    harness, _, _, _ = preparer(resultat=resultat_decalé)

    resultat = executer(harness, requete())

    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code is CodeErreur.LLM_REPONSE_INVALIDE


def test_refuse_un_point_faible_qui_cite_une_reponse_absente() -> None:
    resultat_invente = {
        **RESULTAT,
        "points_faibles": [
            {
                **RESULTAT["points_faibles"][0],
                "id_question": "q-inconnue",
            }
        ],
    }
    harness, _, _, _ = preparer(resultat=resultat_invente)

    resultat = executer(harness, requete())

    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code is CodeErreur.LLM_REPONSE_INVALIDE
    assert resultat.erreur.retryable is True


def test_refuse_un_point_faible_fonde_sur_une_preuve_indirecte() -> None:
    entree = {
        **ENTREE,
        "reponses": [
            {
                "id_question": "q-1",
                "competence": "ecrit",
                "type_reponse": "choix",
                "contenu": "B",
            }
        ],
    }
    harness, _, _, _ = preparer()

    resultat = executer(harness, requete(entree=entree))

    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code is CodeErreur.LLM_REPONSE_INVALIDE


def test_refuse_l_activation_sans_production_libre() -> None:
    entree = {
        **ENTREE,
        "reponses": [
            {
                "id_question": "q-1",
                "competence": "lecture",
                "type_reponse": "choix",
                "contenu": "B",
            }
        ],
    }
    resultat_sans_production = {**RESULTAT, "points_faibles": []}
    harness, _, _, _ = preparer(resultat=resultat_sans_production)

    resultat = executer(harness, requete(entree=entree))

    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code is CodeErreur.LLM_REPONSE_INVALIDE


def test_accepte_l_impregnation_avec_des_choix_seuls() -> None:
    entree = {
        **ENTREE,
        "reponses": [
            {
                "id_question": "q-1",
                "competence": "lecture",
                "type_reponse": "choix",
                "contenu": "B",
            }
        ],
    }
    resultat_impregnation = {
        **RESULTAT_PRUDENT,
        "score_confiance": 0.4,
    }
    harness, _, _, _ = preparer(resultat=resultat_impregnation)

    resultat = executer(harness, requete(entree=entree))

    assert isinstance(resultat, ReponseAgent)
    assert resultat.resultat.phase_assimil is PhaseAssimil.IMPREGNATION
    assert resultat.resultat.points_faibles == []


def test_refuse_des_identifiants_de_question_dupliques() -> None:
    entree = {
        **ENTREE,
        "reponses": [
            {**REPONSES[0]},
            {**REPONSES[1], "id_question": REPONSES[0]["id_question"]},
        ],
    }

    with pytest.raises(ValidationError) as erreur:
        EntreeDiagnostic.model_validate(entree)
    assert "identifiant de question" in str(erreur.value)


def test_refuse_un_descripteur_hors_contexte_sans_appeler_le_llm() -> None:
    descripteur_francais = {**DESCRIPTEURS[0], "code_langue": "fr"}
    harness, client, _, _ = preparer(descripteurs=(descripteur_francais,))

    resultat = executer(harness, requete())

    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code is CodeErreur.CORPUS_INDISPONIBLE
    assert resultat.erreur.retryable is True
    assert client.appels == []


def test_refuse_un_descripteur_invalide_sans_appeler_le_llm() -> None:
    harness, client, _, _ = preparer(descripteurs=({"identifiant": "incomplet"},))

    resultat = executer(harness, requete())

    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code is CodeErreur.CORPUS_INDISPONIBLE
    assert client.appels == []


def test_mappe_une_panne_du_rag_en_corpus_indisponible() -> None:
    rag = RecuperateurFactice(DESCRIPTEURS, erreur=RuntimeError("SECRET-dans-le-corpus"))
    harness, client, _, _ = preparer(recuperateur=rag)

    resultat = executer(harness, requete())

    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code is CodeErreur.CORPUS_INDISPONIBLE
    assert resultat.erreur.retryable is True
    assert "SECRET" not in resultat.erreur.message
    assert client.appels == []


def test_conserve_une_erreur_rag_deja_typee() -> None:
    rag = RecuperateurFactice(DESCRIPTEURS, erreur=ErreurCorpusIndisponible("index vide"))
    harness, _, _, _ = preparer(recuperateur=rag)

    resultat = executer(harness, requete())

    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code is CodeErreur.CORPUS_INDISPONIBLE


def test_une_incoherence_interne_des_variables_reste_une_erreur_interne(monkeypatch: pytest.MonkeyPatch) -> None:
    def variables_en_panne(**_: object) -> None:
        raise ValidationError.from_exception_data(
            "VariablesEvaluationDiagnostic",
            [{"type": "missing", "loc": ("code_langue",), "input": None}],
        )

    monkeypatch.setattr("app.agents.diagnostic.VariablesEvaluationDiagnostic", variables_en_panne)
    harness, _, _, _ = preparer()

    resultat = executer(harness, requete())

    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code is CodeErreur.ERREUR_INTERNE


def test_utilise_le_referentiel_hsk_pour_le_mandarin() -> None:
    contexte = {"code_langue": "zh", "referentiel": "HSK", "niveau_preliminaire": "HSK 2"}
    entree = {
        "scenario": "examen",
        "reponses": [
            {
                "id_question": "q-zh-1",
                "competence": "oral",
                "type_reponse": "audio",
                "contenu": "Transcription fictive en mandarin.",
            }
        ],
        "score_preliminaire": 42,
    }
    descripteur = {
        "identifiant": "hsk2-oral",
        "code_langue": "zh",
        "referentiel": "HSK",
        "niveau": "HSK 2",
        "competence": "oral",
        "contenu": "Peut se présenter avec des phrases simples.",
    }
    resultat_hsk = {
        "code_langue": "zh",
        "referentiel": "HSK",
        "niveau_estime": "HSK 3",
        "phase_assimil": "activation",
        "points_faibles": [],
        "score_confiance": 0.7,
        "niveau_preliminaire": "HSK 2",
        "ecart_avec_niveau_preliminaire": 1,
    }
    harness, client, _, _ = preparer(resultat=resultat_hsk, descripteurs=(descripteur,))

    resultat = executer(harness, requete(entree=entree, contexte=contexte))

    assert isinstance(resultat, ReponseAgent)
    corps = corps_prompt(client)
    assert corps["referentiel"] == "HSK"
    assert corps["descripteurs_rag"][0]["niveau"] == "HSK 2"
    assert corps["exemples_few_shot"][0]["scenario"] == "examen"
    assert corps["exemples_few_shot"][0]["entree"]["contexte_apprenant"]["code_langue"] == "zh"


def test_construit_la_definition_avec_le_prompt_publie() -> None:
    registre_prompts = RegistrePrompts()
    definition = construire_definition(registre_prompts)

    assert definition.code == CODE_AGENT
    assert definition.version == VERSION_AGENT
    assert definition.schema_entree is EntreeDiagnostic
    assert definition.schema_sortie is ResultatDiagnostic
    assert definition.budget_ms == BUDGET_MS
    assert (definition.version_prompt, definition.empreinte_prompt) == (
        registre_prompts.identite_evaluation_diagnostic()
    )
    assert definition.executer.__self__.__class__ is DiagnosticAgent


def test_registre_resout_l_agent_diagnostic() -> None:
    registre = RegistreAgents()
    registre.enregistrer(construire_definition(RegistrePrompts()))

    assert CODE_AGENT in registre
    assert registre.resoudre(CODE_AGENT).version == VERSION_AGENT
    assert registre.resoudre(CODE_AGENT, VERSION_AGENT).code == CODE_AGENT


def test_le_recuperateur_vide_ne_fabrique_aucun_descripteur() -> None:
    recuperateur = RecuperateurVide()
    requete_rag = RequeteRAG(
        code_langue="en",
        referentiel="CECRL",
        niveau="B1",
        competences=("ecrit",),
    )

    assert recuperateur.nom == "aucun"
    assert recuperateur.version_corpus is None
    assert asyncio.run(recuperateur.rechercher(requete_rag)) == ()
    assert asyncio.run(recuperateur.fermer()) is None
