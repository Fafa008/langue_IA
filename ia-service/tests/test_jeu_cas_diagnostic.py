"""Validation du jeu de cas US152 et des réponses LLM simulées."""

import asyncio
from pathlib import Path
from typing import Annotated, Literal
from uuid import UUID

import pytest
from pydantic import Field, model_validator

from app.core.codes_erreur import CodeErreur
from app.core.erreurs import ErreurLlmIndisponible, ErreurReponseLlm
from app.harness.agent import ContexteExecution, DefinitionAgent
from app.harness.execution import Harness
from app.harness.registre import RegistreAgents
from app.llm.adaptateurs.factice import FakeLLMClient, ScenarioLLM
from app.llm.base import MessageLLM
from app.prompts.variables import ReponseDiagnosticPrompt, VariablesEvaluationDiagnostic
from app.schemas.base import ModeleStrict
from app.schemas.commun import CodeErreur as CodeErreurSchema
from app.schemas.commun import ReponseAgent, ReponseErreur, RequeteAgent
from app.schemas.contexte import ContexteApprenant
from app.schemas.diagnostic import ResultatDiagnostic, calculer_ecart
from app.schemas.regles import CodeLangue, CodeNiveau, Competence, Referentiel

CHEMIN_JEU_CAS = Path(__file__).parent / "data" / "diagnostic" / "jeu_cas.json"
REFERENTIELS_ATTENDUS = {"fr": "CECRL", "en": "CECRL", "it": "CECRL", "de": "CECRL", "zh": "HSK"}
CATEGORIES_ATTENDUES = {
    "debutant",
    "intermediaire",
    "avance",
    "reponses_insuffisantes",
    "reponses_incoherentes",
    "hors_sujet",
    "cecrl",
    "hsk",
    "json_invalide",
    "llm_indisponible",
    "timeout",
    "ecart_niveau",
}


class SimulationLLM(ModeleStrict):
    mode: Literal["reponse_attendue", "json_invalide", "indisponible", "timeout"]
    contenu_brut: str | None = None

    @model_validator(mode="after")
    def verifier_contenu(self) -> "SimulationLLM":
        if self.mode == "json_invalide" and self.contenu_brut is None:
            raise ValueError("Le cas JSON invalide doit fournir le texte brut à simuler.")
        if self.mode != "json_invalide" and self.contenu_brut is not None:
            raise ValueError("Le texte brut n'est utilisé que pour simuler un JSON invalide.")
        return self


class ResultatSuccesAttendu(ModeleStrict):
    type: Literal["succes"]
    resultat: ResultatDiagnostic


class ErreurAttendue(ModeleStrict):
    type: Literal["erreur"]
    code: CodeErreurSchema
    retryable: bool


ResultatAttendu = Annotated[ResultatSuccesAttendu | ErreurAttendue, Field(discriminator="type")]


class CriteresAcceptation(ModeleStrict):
    deterministes: list[str] = Field(min_length=1)
    revue_humaine: list[str]


class EntreeCasTest(ModeleStrict):
    id_cas: str


class ReponseCas(ModeleStrict):
    id_question: str = Field(min_length=1, max_length=64)
    competence: Competence
    type_reponse: Literal["choix", "texte", "audio"]
    contenu: str = Field(min_length=1, max_length=5000)
    consigne: str = Field(min_length=1, max_length=1000)


class CasEvaluationDiagnostic(ModeleStrict):
    id: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    categorie: str
    code_langue: CodeLangue
    referentiel: Referentiel
    niveau_preliminaire: CodeNiveau
    reponses: list[ReponseCas] = Field(min_length=1, max_length=100)
    simulation_llm: SimulationLLM
    resultat_attendu: ResultatAttendu
    criteres_acceptation: CriteresAcceptation

    @model_validator(mode="after")
    def verifier_coherence_du_cas(self) -> "CasEvaluationDiagnostic":
        identifiants = [reponse.id_question for reponse in self.reponses]
        if len(identifiants) != len(set(identifiants)):
            raise ValueError("Les réponses d'un cas doivent avoir des identifiants distincts.")
        for reponse in self.reponses:
            ReponseDiagnosticPrompt.model_validate(reponse.model_dump(exclude={"consigne"}))

        contexte = ContexteApprenant.model_validate(
            {
                "code_langue": self.code_langue,
                "referentiel": self.referentiel,
                "niveau_preliminaire": self.niveau_preliminaire,
            }
        )
        VariablesEvaluationDiagnostic.model_validate(
            {
                "code_langue": self.code_langue,
                "referentiel": self.referentiel,
                "reponses": [reponse.model_dump(exclude={"consigne"}) for reponse in self.reponses],
                "score_preliminaire": None,
                "contexte_apprenant": contexte.model_dump(mode="json"),
                "descripteurs_rag": [],
            }
        )
        if isinstance(self.resultat_attendu, ResultatSuccesAttendu):
            self.resultat_attendu.resultat.verifier_coherence(contexte)
            if self.simulation_llm.mode != "reponse_attendue":
                raise ValueError("Un succès attendu exige une simulation LLM de réponse valide.")
        elif self.simulation_llm.mode == "reponse_attendue":
            raise ValueError("Une erreur attendue exige une simulation LLM d'erreur.")
        return self


class JeuCasDiagnostic(ModeleStrict):
    version: str
    cas: list[CasEvaluationDiagnostic] = Field(min_length=1)


JEU_CAS = JeuCasDiagnostic.model_validate_json(CHEMIN_JEU_CAS.read_text(encoding="utf-8"))
CAS_PAR_ID = {cas.id: cas for cas in JEU_CAS.cas}
MESSAGES_TEST = [MessageLLM(role="user", contenu="Cas synthétique de diagnostic US152.")]


def _tester_simulation(cas: CasEvaluationDiagnostic) -> None:
    attendu = cas.resultat_attendu
    if isinstance(attendu, ResultatSuccesAttendu):
        client = FakeLLMClient([ScenarioLLM(reponse=attendu.resultat.model_dump_json())])
    else:
        exceptions = {
            "json_invalide": ErreurReponseLlm("sortie JSON factice invalide"),
            "indisponible": ErreurLlmIndisponible("indisponibilité factice"),
        }
        if cas.simulation_llm.mode == "timeout":
            scenario = ScenarioLLM(reponse={}, delai_s=0.2)
        elif cas.simulation_llm.mode == "json_invalide":
            scenario = ScenarioLLM(reponse=cas.simulation_llm.contenu_brut)
        else:
            scenario = ScenarioLLM(erreur=exceptions[cas.simulation_llm.mode])
        client = FakeLLMClient([scenario])

    async def executer(entree: EntreeCasTest, contexte: ContexteExecution) -> ResultatDiagnostic:
        assert entree.id_cas == cas.id
        resultat, _ = await contexte.outils.client_llm.generer_json(MESSAGES_TEST, schema=ResultatDiagnostic)
        return resultat

    definition = DefinitionAgent(
        code="diagnostic",
        version="1.0.0",
        schema_entree=EntreeCasTest,
        schema_sortie=ResultatDiagnostic,
        budget_ms=25 if cas.simulation_llm.mode == "timeout" else 15000,
        version_prompt="diagnostic/evaluation@1.0.0",
        empreinte_prompt="sha256:" + "a" * 64,
        executer=executer,
    )
    registre = RegistreAgents()
    registre.enregistrer(definition)
    contexte = ContexteApprenant(
        code_langue=cas.code_langue,
        referentiel=cas.referentiel,
        niveau_preliminaire=cas.niveau_preliminaire,
    )
    requete = RequeteAgent[EntreeCasTest](
        request_id=UUID("00000000-0000-4000-8000-000000000152"),
        contexte=contexte,
        entree=EntreeCasTest(id_cas=cas.id),
    )
    resultat_harness = asyncio.run(Harness(registre, client).executer("diagnostic", requete))

    if isinstance(attendu, ResultatSuccesAttendu):
        assert isinstance(resultat_harness, ReponseAgent)
        resultat = resultat_harness.resultat
        resultat.verifier_coherence(contexte)
        assert resultat == attendu.resultat
        assert (
            calculer_ecart(
                resultat.referentiel,
                resultat.niveau_preliminaire,
                resultat.niveau_estime,
            )
            == resultat.ecart_avec_niveau_preliminaire
        )
        return

    assert isinstance(resultat_harness, ReponseErreur)
    assert resultat_harness.erreur.code is attendu.code
    assert resultat_harness.erreur.retryable is attendu.retryable
    assert isinstance(resultat_harness.erreur.code, CodeErreur)
    assert all(reponse.contenu not in resultat_harness.erreur.message for reponse in cas.reponses)


def test_jeu_cas_couvre_les_scenarios_requis() -> None:
    assert len(JEU_CAS.cas) == 12
    assert len(CAS_PAR_ID) == len(JEU_CAS.cas)
    assert {cas.categorie for cas in JEU_CAS.cas} == CATEGORIES_ATTENDUES


@pytest.mark.parametrize("cas", JEU_CAS.cas, ids=lambda cas: cas.id)
def test_cas_sont_valides_et_reproductibles(cas: CasEvaluationDiagnostic) -> None:
    assert cas.referentiel == REFERENTIELS_ATTENDUS[cas.code_langue]
    assert cas.criteres_acceptation.deterministes
    assert all(reponse.contenu.strip() for reponse in cas.reponses)
    _tester_simulation(cas)


def test_cas_ecart_important_depasse_le_seuil_documente() -> None:
    resultat = CAS_PAR_ID["ecart-important-en"].resultat_attendu
    assert isinstance(resultat, ResultatSuccesAttendu)
    assert abs(resultat.resultat.ecart_avec_niveau_preliminaire) >= 2


def test_cas_subjectifs_exigent_une_revue_humaine() -> None:
    cas_subjectifs = (
        "debutant-fr-cecrl",
        "intermediaire-en-cecrl",
        "avance-de-cecrl",
        "reponses-incoherentes-fr",
        "reponse-hors-sujet-en",
    )
    for identifiant in cas_subjectifs:
        assert CAS_PAR_ID[identifiant].criteres_acceptation.revue_humaine
