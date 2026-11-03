"""Tests du Harness commun."""

import asyncio
import time
from typing import Any

from pydantic import Field

from app.core.erreurs import ErreurConfiguration, ErreurLlmIndisponible, ErreurLlmTimeout, ErreurReponseLlm
from app.harness import execution as execution_module
from app.harness.agent import ContexteExecution, DefinitionAgent, OutilsCommuns
from app.harness.execution import Harness
from app.harness.registre import RegistreAgents
from app.llm.adaptateurs.factice import FakeLLMClient
from app.schemas.base import ModeleStrict
from app.schemas.commun import CodeErreur, ReponseAgent, ReponseErreur, RequeteAgent
from app.schemas.contexte import ContexteApprenant
from tests.donnees import CONTEXTE_MINIMAL, REQUEST_ID


class Entree(ModeleStrict):
    texte: str = Field(min_length=1)


class Sortie(ModeleStrict):
    reponse: str


ENTREE = {"texte": "bonjour"}


def requete(entree: dict | None = None, version_agent: str | None = "1.0.0") -> RequeteAgent[Entree]:
    donnees: dict[str, Any] = {
        "request_id": REQUEST_ID,
        "contexte": CONTEXTE_MINIMAL,
        "entree": entree if entree is not None else dict(ENTREE),
    }
    if version_agent is not None:
        donnees["version_agent"] = version_agent
    return RequeteAgent[Entree].model_validate(donnees)


def requete_non_validee(entree: object, version_agent: str | None = "1.0.0") -> RequeteAgent:
    """Requête construite sans validation de ``entree`` : sert à vérifier la revalidation du Harness."""
    contexte = ContexteApprenant.model_validate(CONTEXTE_MINIMAL)
    return RequeteAgent.model_construct(
        request_id=REQUEST_ID,
        version_agent=version_agent,
        contexte=contexte,
        entree=entree,
    )


def definition_executant(retour: object, *, erreur: Exception | None = None, budget_ms: int = 1000):
    if erreur is not None:

        async def executer(entree: Entree, contexte: ContexteExecution) -> Sortie:
            raise erreur

        return executer

    async def executer(entree: Entree, contexte: ContexteExecution) -> Sortie:
        assert isinstance(entree, Entree)
        assert isinstance(contexte.outils, OutilsCommuns)
        assert contexte.outils.client_llm is not None
        assert contexte.request_id is not None
        return retour if isinstance(retour, Sortie) else Sortie(**retour)  # type: ignore[arg-type]

    return executer


def agent(retour: object = None, erreur: Exception | None = None, budget_ms: int = 1000) -> DefinitionAgent:
    if retour is None:
        retour = {"reponse": "ok"}
    return DefinitionAgent(
        code="diagnostic",
        version="1.0.0",
        schema_entree=Entree,
        schema_sortie=Sortie,
        budget_ms=budget_ms,
        version_prompt="diagnostic/evaluation@1.0.0",
        empreinte_prompt="sha256:" + "a" * 64,
        executer=definition_executant(retour, erreur=erreur, budget_ms=budget_ms),
    )


def construire_harness(
    client_llm: FakeLLMClient | None = None, horloge=time.monotonic
) -> tuple[Harness, RegistreAgents, FakeLLMClient]:
    registre = RegistreAgents()
    client = client_llm if client_llm is not None else FakeLLMClient()
    return Harness(registre, client, horloge=horloge), registre, client


def test_executer_succes() -> None:
    harness, registre, client = construire_harness()
    registre.enregistrer(agent())

    resultat = asyncio.run(harness.executer("diagnostic", requete()))

    assert isinstance(resultat, ReponseAgent)
    assert resultat.statut == "succes"
    assert resultat.request_id == requete().request_id
    assert resultat.agent == "diagnostic"
    assert resultat.version_agent == "1.0.0"
    assert resultat.version_prompt == "diagnostic/evaluation@1.0.0"
    assert resultat.resultat == Sortie(reponse="ok")
    assert resultat.meta.fournisseur == "factice"
    assert resultat.meta.modele == "factice-1"
    assert resultat.meta.empreinte_prompt == "sha256:" + "a" * 64
    assert resultat.meta.version_corpus is None
    assert resultat.meta.duree_ms >= 0
    assert isinstance(client, FakeLLMClient)


def test_utilise_la_version_demandee_par_la_requete() -> None:
    harness, registre, _ = construire_harness()
    registre.enregistrer(agent())
    deuxieme = DefinitionAgent(
        code="diagnostic",
        version="2.0.0",
        schema_entree=Entree,
        schema_sortie=Sortie,
        budget_ms=1000,
        version_prompt="diagnostic/evaluation@2.0.0",
        empreinte_prompt="sha256:" + "b" * 64,
        executer=definition_executant({"reponse": "v2"}),
    )
    registre.enregistrer(deuxieme)

    resultat = asyncio.run(harness.executer("diagnostic", requete(version_agent="1.0.0")))
    assert isinstance(resultat, ReponseAgent)
    assert resultat.version_agent == "1.0.0"

    resultat2 = asyncio.run(harness.executer("diagnostic", requete(version_agent="2.0.0")))
    assert isinstance(resultat2, ReponseAgent)
    assert resultat2.version_agent == "2.0.0"


def test_version_agent_en_parametre_prime_sur_la_requete() -> None:
    harness, registre, _ = construire_harness()
    registre.enregistrer(agent())
    deuxieme = DefinitionAgent(
        code="diagnostic",
        version="2.0.0",
        schema_entree=Entree,
        schema_sortie=Sortie,
        budget_ms=1000,
        version_prompt="diagnostic/evaluation@2.0.0",
        empreinte_prompt="sha256:" + "b" * 64,
        executer=definition_executant({"reponse": "v2"}),
    )
    registre.enregistrer(deuxieme)

    resultat = asyncio.run(harness.executer("diagnostic", requete(version_agent="1.0.0"), version_agent="2.0.0"))
    assert isinstance(resultat, ReponseAgent)
    assert resultat.version_agent == "2.0.0"


def test_prend_la_derniere_version_si_absente() -> None:
    harness, registre, _ = construire_harness()
    registre.enregistrer(agent())
    registre.enregistrer(
        DefinitionAgent(
            code="diagnostic",
            version="1.5.0",
            schema_entree=Entree,
            schema_sortie=Sortie,
            budget_ms=1000,
            version_prompt="diagnostic/evaluation@1.5.0",
            empreinte_prompt="sha256:" + "c" * 64,
            executer=definition_executant({"reponse": "nouveau"}),
        )
    )

    resultat = asyncio.run(harness.executer("diagnostic", requete(version_agent=None)))
    assert isinstance(resultat, ReponseAgent)
    assert resultat.version_agent == "1.5.0"
    assert resultat.version_prompt == "diagnostic/evaluation@1.5.0"


def test_agent_inconnu() -> None:
    harness, registre, _ = construire_harness()
    resultat = asyncio.run(harness.executer("diagnostic", requete()))

    assert isinstance(resultat, ReponseErreur)
    assert resultat.statut == "erreur"
    assert resultat.agent == "diagnostic"
    assert resultat.erreur.code == CodeErreur.AGENT_INCONNU
    assert resultat.erreur.retryable is False
    assert "factice" not in resultat.erreur.message


def test_agent_inconnu_code_invalide_devient_inconnu() -> None:
    harness, registre, _ = construire_harness()
    resultat = asyncio.run(harness.executer("INCONNU", requete()))

    assert isinstance(resultat, ReponseErreur)
    assert resultat.agent == "inconnu"
    assert resultat.erreur.code == CodeErreur.AGENT_INCONNU


def test_version_inconnue() -> None:
    harness, registre, _ = construire_harness()
    registre.enregistrer(agent())
    resultat = asyncio.run(harness.executer("diagnostic", requete(version_agent="9.9.9")))

    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code == CodeErreur.AGENT_INCONNU


def test_entree_invalide_par_le_harness() -> None:
    harness, registre, _ = construire_harness()
    registre.enregistrer(agent())
    resultat = asyncio.run(harness.executer("diagnostic", requete_non_validee({"texte": ""})))

    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code == CodeErreur.ENTREE_INVALIDE
    assert resultat.erreur.retryable is False


def test_entree_refuse_un_champ_supplementaire() -> None:
    """La revalidation par le Harness renforce le contrat (défense en profondeur)."""
    harness, registre, _ = construire_harness()
    registre.enregistrer(agent())

    resultat = asyncio.run(harness.executer("diagnostic", requete_non_validee({"texte": "ok", "inconnu": 1})))
    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code == CodeErreur.ENTREE_INVALIDE


def test_sortie_agent_invalide() -> None:
    harness, registre, _ = construire_harness()
    registre.enregistrer(agent(retour={"inconnu": "x"}))

    resultat = asyncio.run(harness.executer("diagnostic", requete()))

    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code == CodeErreur.LLM_REPONSE_INVALIDE
    assert resultat.erreur.retryable is True


def test_sortie_agent_pas_un_objet_modele() -> None:
    harness, registre, _ = construire_harness()

    async def executer(entree: Entree, contexte: ContexteExecution) -> object:
        return "pas un objet"

    registre.enregistrer(
        DefinitionAgent(
            code="diagnostic",
            version="1.0.0",
            schema_entree=Entree,
            schema_sortie=Sortie,
            budget_ms=1000,
            version_prompt="diagnostic/evaluation@1.0.0",
            empreinte_prompt="sha256:" + "a" * 64,
            executer=executer,
        )
    )
    resultat = asyncio.run(harness.executer("diagnostic", requete()))
    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code == CodeErreur.LLM_REPONSE_INVALIDE


def test_budget_depasse_asyncio_timeout() -> None:
    compteur: list[bool] = []

    async def lent(entree: Entree, contexte: ContexteExecution) -> Sortie:
        await asyncio.sleep(10)
        compteur.append(True)
        return Sortie(reponse="trop tard")

    harness, registre, _ = construire_harness()
    registre.enregistrer(
        DefinitionAgent(
            code="diagnostic",
            version="1.0.0",
            schema_entree=Entree,
            schema_sortie=Sortie,
            budget_ms=10,
            version_prompt="diagnostic/evaluation@1.0.0",
            empreinte_prompt="sha256:" + "a" * 64,
            executer=lent,
        )
    )
    resultat = asyncio.run(harness.executer("diagnostic", requete()))
    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code == CodeErreur.LLM_TIMEOUT
    assert resultat.erreur.retryable is True
    assert compteur == []


def test_heure_timeout_elevee() -> None:
    harness, registre, _ = construire_harness()
    registre.enregistrer(agent(erreur=ErreurLlmTimeout("timeout")))
    resultat = asyncio.run(harness.executer("diagnostic", requete()))

    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code == CodeErreur.LLM_TIMEOUT


def test_llm_indisponible() -> None:
    harness, registre, _ = construire_harness()
    registre.enregistrer(agent(erreur=ErreurLlmIndisponible("indispo")))
    resultat = asyncio.run(harness.executer("diagnostic", requete()))

    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code == CodeErreur.LLM_INDISPONIBLE
    assert resultat.erreur.retryable is True


def test_configuration_erreur_traduite() -> None:
    harness, registre, _ = construire_harness()
    registre.enregistrer(agent(erreur=ErreurConfiguration("invalide")))
    resultat = asyncio.run(harness.executer("diagnostic", requete()))

    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code == CodeErreur.LLM_INDISPONIBLE


def test_reponse_llm_invalide() -> None:
    harness, registre, _ = construire_harness()
    registre.enregistrer(agent(erreur=ErreurReponseLlm("mauvais json")))
    resultat = asyncio.run(harness.executer("diagnostic", requete()))

    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code == CodeErreur.LLM_REPONSE_INVALIDE
    assert resultat.erreur.retryable is True


def test_erreur_inattendue_journalisee_et_generique(monkeypatch) -> None:
    journalisations: list[object] = []
    monkeypatch.setattr(execution_module.logger, "exception", lambda *args, **kwargs: journalisations.append(args))

    harness, registre, _ = construire_harness()
    registre.enregistrer(agent(erreur=RuntimeError("SECRET-dans-trace")))
    resultat = asyncio.run(harness.executer("diagnostic", requete()))

    assert isinstance(resultat, ReponseErreur)
    assert resultat.erreur.code == CodeErreur.ERREUR_INTERNE
    assert resultat.erreur.retryable is False
    assert "SECRET" not in resultat.erreur.message
    assert len(journalisations) == 1


def test_meta_utilise_le_client_partage() -> None:
    client = FakeLLMClient(modele="modele-partage")
    harness, registre, _ = construire_harness(client_llm=client)
    registre.enregistrer(agent())

    resultat = asyncio.run(harness.executer("diagnostic", requete()))

    assert isinstance(resultat, ReponseAgent)
    assert resultat.meta.fournisseur == "factice"
    assert resultat.meta.modele == "modele-partage"


def test_duree_bornee_a_600000() -> None:
    def horloge_bizarre() -> float:
        return 1000.0

    def horloge_lente() -> float:
        horloge_lente.t += 1000.0
        return horloge_lente.t

    horloge_lente.t = 0.0

    harness, registre, _ = construire_harness(horloge=horloge_lente)
    registre.enregistrer(agent())

    resultat = asyncio.run(harness.executer("diagnostic", requete()))
    assert isinstance(resultat, ReponseAgent)
    assert resultat.meta.duree_ms == 600000


def test_contexte_transmis_a_l_agent() -> None:
    captures: list[ContexteExecution] = []

    async def executer(entree: Entree, contexte: ContexteExecution) -> Sortie:
        captures.append(contexte)
        return Sortie(reponse="ok")

    harness, registre, _ = construire_harness()
    registre.enregistrer(
        DefinitionAgent(
            code="diagnostic",
            version="1.0.0",
            schema_entree=Entree,
            schema_sortie=Sortie,
            budget_ms=1000,
            version_prompt="diagnostic/evaluation@1.0.0",
            empreinte_prompt="sha256:" + "a" * 64,
            executer=executer,
        )
    )
    req = requete()
    asyncio.run(harness.executer("diagnostic", req))

    assert captures[0].request_id == req.request_id
    assert captures[0].contexte.code_langue == "en"
    assert captures[0].outils.client_llm is not None
    assert captures[0].outils.horloge is not None


def test_injection_outils_horloge() -> None:
    marquage: list[str] = []

    def horloge() -> float:
        marquage.append("temps")
        return time.monotonic()

    harness, registre, _ = construire_harness(horloge=horloge)
    registre.enregistrer(agent())
    asyncio.run(harness.executer("diagnostic", requete()))
    assert "temps" in marquage
