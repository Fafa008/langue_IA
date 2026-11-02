"""Validation des enveloppes du Harness et du modèle d'erreur standardisé."""

from typing import Literal

import pytest
from pydantic import Field, ValidationError

from app.schemas.base import ModeleStrict
from app.schemas.commun import (
    CODES_RETRYABLES,
    CodeErreur,
    ErreurAgent,
    MetaExecution,
    ReponseAgent,
    ReponseErreur,
    RequeteAgent,
)
from app.schemas.diagnostic import ResultatDiagnostic
from tests.donnees import CONTEXTE_MINIMAL, META_VALIDE, REQUEST_ID, RESULTAT_VALIDE


class EntreeEvaluation(ModeleStrict):
    """Entrée d'exemple : chaque agent fournira son propre modèle typé."""

    type_reponse: Literal["texte"]
    reponse: str = Field(min_length=1, max_length=4000)


def requete_valide() -> dict:
    return {
        "request_id": REQUEST_ID,
        "version_agent": "1.0.0",
        "contexte": CONTEXTE_MINIMAL,
        "entree": {"type_reponse": "texte", "reponse": "Lifelong learning helps people adapt."},
    }


def test_requete_generique_valide() -> None:
    requete = RequeteAgent[EntreeEvaluation].model_validate(requete_valide())
    assert requete.entree.type_reponse == "texte"
    assert requete.version_agent == "1.0.0"


def test_requete_sans_version_agent() -> None:
    donnees = requete_valide()
    del donnees["version_agent"]
    assert RequeteAgent[EntreeEvaluation].model_validate(donnees).version_agent is None


def test_requete_refuse_un_champ_supplementaire() -> None:
    with pytest.raises(ValidationError):
        RequeteAgent[EntreeEvaluation].model_validate({**requete_valide(), "agent": "diagnostic"})


def test_requete_refuse_une_entree_non_typee() -> None:
    """Le Harness n'accepte pas de JSON arbitraire dans `entree`."""
    with pytest.raises(ValidationError) as erreur:
        RequeteAgent[EntreeEvaluation].model_validate(
            {**requete_valide(), "entree": {"type_reponse": "texte", "reponse": "ok", "inconnu": 1}}
        )
    assert "extra_forbidden" in str(erreur.value)


def test_requete_refuse_une_entree_invalide() -> None:
    with pytest.raises(ValidationError):
        RequeteAgent[EntreeEvaluation].model_validate(
            {**requete_valide(), "entree": {"type_reponse": "texte", "reponse": ""}}
        )


@pytest.mark.parametrize("request_id", ["pas-un-uuid", "", 42])
def test_requete_refuse_un_request_id_invalide(request_id: object) -> None:
    with pytest.raises(ValidationError):
        RequeteAgent[EntreeEvaluation].model_validate({**requete_valide(), "request_id": request_id})


@pytest.mark.parametrize("version", ["1.0", "v1.0.0", "1.0.0.0", ""])
def test_requete_refuse_une_version_non_semver(version: str) -> None:
    with pytest.raises(ValidationError):
        RequeteAgent[EntreeEvaluation].model_validate({**requete_valide(), "version_agent": version})


def test_requete_accepte_une_version_prerelase() -> None:
    requete = RequeteAgent[EntreeEvaluation].model_validate({**requete_valide(), "version_agent": "1.1.0-beta.1"})
    assert requete.version_agent == "1.1.0-beta.1"


def reponse_valide() -> dict:
    return {
        "request_id": REQUEST_ID,
        "agent": "diagnostic",
        "version_agent": "1.0.0",
        "version_prompt": "diagnostic/evaluation@1.0.0",
        "resultat": RESULTAT_VALIDE,
        "meta": META_VALIDE,
    }


def test_reponse_valide() -> None:
    reponse = ReponseAgent[ResultatDiagnostic].model_validate(reponse_valide())
    assert reponse.statut == "succes"
    assert reponse.resultat.niveau_estime == "B2"


def test_reponse_refuse_un_statut_d_erreur() -> None:
    with pytest.raises(ValidationError):
        ReponseAgent[ResultatDiagnostic].model_validate({**reponse_valide(), "statut": "erreur"})


@pytest.mark.parametrize("agent", ["Diagnostic", "diagnostic_ia", "-diagnostic", "diag nostic", "a" * 33])
def test_reponse_refuse_un_code_agent_invalide(agent: str) -> None:
    with pytest.raises(ValidationError):
        ReponseAgent[ResultatDiagnostic].model_validate({**reponse_valide(), "agent": agent})


@pytest.mark.parametrize(
    "version_prompt",
    ["diagnostic@1.0.0", "diagnostic/evaluation", "Diagnostic/Evaluation@1.0.0", "diagnostic/evaluation@1.0"],
)
def test_reponse_refuse_une_version_de_prompt_invalide(version_prompt: str) -> None:
    with pytest.raises(ValidationError):
        ReponseAgent[ResultatDiagnostic].model_validate({**reponse_valide(), "version_prompt": version_prompt})


def test_meta_refuse_une_empreinte_invalide() -> None:
    with pytest.raises(ValidationError):
        MetaExecution.model_validate({**META_VALIDE, "empreinte_prompt": "sha256:xyz"})


def test_meta_refuse_une_duree_negative() -> None:
    with pytest.raises(ValidationError):
        MetaExecution.model_validate({**META_VALIDE, "duree_ms": -1})


@pytest.mark.parametrize("valeur", [True, "1840", 1840.5])
def test_meta_refuse_une_duree_non_entier(valeur: object) -> None:
    with pytest.raises(ValidationError):
        MetaExecution.model_validate({**META_VALIDE, "duree_ms": valeur})


def test_meta_refuse_un_champ_supplementaire() -> None:
    with pytest.raises(ValidationError):
        MetaExecution.model_validate({**META_VALIDE, "prix": 0.01})


def test_erreur_rejouable_coherente() -> None:
    erreur = ErreurAgent.model_validate(
        {"code": "LLM_TIMEOUT", "message": "Délai dépassé.", "retryable": True, "details": None}
    )
    assert erreur.code is CodeErreur.LLM_TIMEOUT


def test_erreur_definitive_coherente() -> None:
    erreur = ErreurAgent.model_validate({"code": "ENTREE_INVALIDE", "message": "Entrée invalide.", "retryable": False})
    assert erreur.details is None


def test_erreur_refuse_un_retryable_incoherent() -> None:
    with pytest.raises(ValidationError) as erreur:
        ErreurAgent.model_validate({"code": "LLM_TIMEOUT", "message": "Délai dépassé.", "retryable": False})
    assert "retryable doit valoir true" in str(erreur.value)


def test_erreur_refuse_de_rejouer_une_entree_invalide() -> None:
    with pytest.raises(ValidationError):
        ErreurAgent.model_validate({"code": "ENTREE_INVALIDE", "message": "Entrée invalide.", "retryable": True})


def test_erreur_refuse_un_message_multiligne() -> None:
    with pytest.raises(ValidationError):
        ErreurAgent.model_validate({"code": "ERREUR_INTERNE", "message": "ligne 1\nligne 2", "retryable": False})


def test_erreur_refuse_des_details_imbriques() -> None:
    with pytest.raises(ValidationError):
        ErreurAgent.model_validate(
            {
                "code": "ERREUR_INTERNE",
                "message": "Erreur.",
                "retryable": False,
                "details": {"contexte": {"a": 1}},
            }
        )


def test_erreur_limite_les_details() -> None:
    details = {f"cle{index}": "valeur" for index in range(11)}
    with pytest.raises(ValidationError):
        ErreurAgent.model_validate(
            {"code": "ERREUR_INTERNE", "message": "Erreur.", "retryable": False, "details": details}
        )


def test_erreur_refuse_une_cle_de_detail_vide() -> None:
    with pytest.raises(ValidationError) as erreur:
        ErreurAgent.model_validate(
            {"code": "ERREUR_INTERNE", "message": "Erreur.", "retryable": False, "details": {"": "valeur"}}
        )
    assert "clé de détail" in str(erreur.value)


def test_erreur_refuse_une_cle_de_detail_blanc() -> None:
    with pytest.raises(ValidationError) as erreur:
        ErreurAgent.model_validate(
            {"code": "ERREUR_INTERNE", "message": "Erreur.", "retryable": False, "details": {"   ": "valeur"}}
        )
    assert "clé de détail" in str(erreur.value)


def test_erreur_refuse_une_valeur_de_detail_blanc() -> None:
    with pytest.raises(ValidationError) as erreur:
        ErreurAgent.model_validate(
            {"code": "ERREUR_INTERNE", "message": "Erreur.", "retryable": False, "details": {"cause": "   "}}
        )
    assert "valeur de détail" in str(erreur.value)


def test_erreur_refuse_une_valeur_de_detail_multiligne() -> None:
    with pytest.raises(ValidationError) as erreur:
        ErreurAgent.model_validate(
            {"code": "ERREUR_INTERNE", "message": "Erreur.", "retryable": False, "details": {"cause": "a\nb"}}
        )
    assert "valeur de détail" in str(erreur.value)


def test_erreur_accepte_des_details_plats() -> None:
    erreur = ErreurAgent.model_validate(
        {"code": "LLM_TIMEOUT", "message": "Délai dépassé.", "retryable": True, "details": {"agent": "diagnostic"}}
    )
    assert erreur.details == {"agent": "diagnostic"}


def test_reponse_erreur_valide() -> None:
    reponse = ReponseErreur.model_validate(
        {
            "request_id": REQUEST_ID,
            "agent": "diagnostic",
            "erreur": {"code": "LLM_TIMEOUT", "message": "Délai dépassé.", "retryable": True},
        }
    )
    assert reponse.statut == "erreur"


def test_reponse_erreur_refuse_un_statut_de_succes() -> None:
    with pytest.raises(ValidationError):
        ReponseErreur.model_validate({"request_id": REQUEST_ID, "agent": "diagnostic", "statut": "succes"})


def test_codes_rejouables_attendus() -> None:
    assert CODES_RETRYABLES == {
        CodeErreur.QUOTA_DEPASSE,
        CodeErreur.LLM_INDISPONIBLE,
        CodeErreur.LLM_TIMEOUT,
        CodeErreur.LLM_REPONSE_INVALIDE,
        CodeErreur.CORPUS_INDISPONIBLE,
    }
