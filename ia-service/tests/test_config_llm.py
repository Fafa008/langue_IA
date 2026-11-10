"""Tests de configuration du client LLM."""

import pytest
from pydantic import SecretStr, ValidationError

from app.core.config import ConfigLLM, _detail_validation, charger_config
from app.core.erreurs import ErreurConfiguration


def test_detail_validation_champ_manquant() -> None:
    assert "api_key (champ obligatoire)" == _detail_validation({"loc": ("api_key",), "type": "missing"})


def test_detail_validation_type_inconnu() -> None:
    assert "agent (valeur invalide)" == _detail_validation({"loc": ("agent",), "type": "type_inconnu"})


def test_config_defauts_dev(env_propre: pytest.MonkeyPatch) -> None:
    c = ConfigLLM()
    assert c.environnement == "dev"
    assert c.fournisseur == "factice"
    assert c.temperature == 0.2
    assert c.max_tokens == 600
    assert c.timeout_s == 12.0
    assert c.max_retries == 1
    assert c.reprise_delai_s == 0.5
    assert c.reprise_delai_max_s == 4.0
    assert c.budget_total_s == 30.0
    assert c.est_factice is True


def test_politique_de_reprise_issue_de_la_config(env_propre: pytest.MonkeyPatch) -> None:
    c = ConfigLLM(max_retries=2, reprise_delai_s=0.25, reprise_delai_max_s=3.0, budget_total_s=20.0)
    politique = c.politique_reprise
    assert politique.max_reprises == 2
    assert politique.tentatives_max == 3
    assert politique.delai_initial_s == 0.25
    assert politique.delai_max_s == 3.0
    assert politique.budget_total_s == 20.0


def test_plafond_de_reprise_inferieur_au_delai_initial() -> None:
    with pytest.raises(ValidationError, match="LLM_REPRISE_DELAI_MAX_S"):
        ConfigLLM(reprise_delai_s=2.0, reprise_delai_max_s=1.0)


def test_budget_total_inferieur_au_timeout() -> None:
    with pytest.raises(ValidationError, match="LLM_BUDGET_TOTAL_S"):
        ConfigLLM(timeout_s=30.0, budget_total_s=10.0)


def test_cle_api_en_secretstr() -> None:
    c = ConfigLLM(fournisseur="factice", api_key="toto")
    assert isinstance(c.api_key, SecretStr)
    assert "toto" not in repr(c)
    assert c.api_key.get_secret_value() == "toto"


def test_chaine_vide_devient_absent() -> None:
    c = ConfigLLM(fournisseur="factice", api_key="", modele="", base_url="")
    assert c.api_key is None
    assert c.modele is None
    assert c.base_url is None


def test_prod_interdit_factice() -> None:
    with pytest.raises(ValidationError, match="factice"):
        ConfigLLM(environnement="prod", fournisseur="factice")


def test_fournisseur_reel_exige_parametres() -> None:
    with pytest.raises(ValidationError, match="modele"):
        ConfigLLM(environnement="dev", fournisseur="compatible-openai")
    with pytest.raises(ValidationError, match="base_url"):
        ConfigLLM(environnement="dev", fournisseur="compatible-openai", modele="gpt-4o-mini")
    with pytest.raises(ValidationError, match="api_key"):
        ConfigLLM(
            environnement="dev",
            fournisseur="compatible-openai",
            modele="gpt-4o-mini",
            base_url="https://api.openai.com/v1",
        )


def test_fournisseur_gemini_exige_un_modele_et_une_cle() -> None:
    with pytest.raises(ValidationError, match="GEMINI_MODEL.*GEMINI_API_KEY"):
        ConfigLLM(fournisseur="gemini")
    with pytest.raises(ValidationError, match="GEMINI_API_KEY"):
        ConfigLLM(fournisseur="gemini", gemini_modele="modele-configurable")


def test_config_gemini_lit_les_variables_dediees(env_propre: pytest.MonkeyPatch) -> None:
    env_propre.setenv("LLM_FOURNISSEUR", "gemini")
    env_propre.setenv("GEMINI_MODEL", "modele-configurable")
    env_propre.setenv("GEMINI_API_KEY", "cle-test-gemini")

    c = charger_config()

    assert c.fournisseur == "gemini"
    assert c.gemini_modele == "modele-configurable"
    assert c.gemini_cle_api is not None
    assert c.gemini_cle_api.get_secret_value() == "cle-test-gemini"
    assert "cle-test-gemini" not in repr(c)


def test_charger_config_gemini_sans_cle_ne_revele_aucune_valeur(env_propre: pytest.MonkeyPatch) -> None:
    env_propre.setenv("LLM_FOURNISSEUR", "gemini")
    env_propre.setenv("GEMINI_MODEL", "modele-configurable")

    with pytest.raises(ErreurConfiguration) as exc:
        charger_config()

    assert "GEMINI_API_KEY" in str(exc.value)
    assert "GEMINI_MODEL" not in str(exc.value)
    assert "cle-test-gemini" not in str(exc.value)


def test_config_est_gelee() -> None:
    c = ConfigLLM()
    with pytest.raises(ValidationError):
        c.fournisseur = "compatible-openai"  # type: ignore[misc]


def test_charger_config_lit_les_variables(env_propre: pytest.MonkeyPatch) -> None:
    env_propre.setenv("ENVIRONNEMENT", "test")
    env_propre.setenv("LLM_FOURNISSEUR", "factice")
    env_propre.setenv("LLM_TEMPERATURE", "0.7")
    env_propre.setenv("LLM_MAX_TOKENS", "1024")
    env_propre.setenv("LLM_TIMEOUT_S", "8")
    env_propre.setenv("LLM_MAX_RETRIES", "2")
    env_propre.setenv("LLM_REPRISE_DELAI_S", "0.2")
    env_propre.setenv("LLM_REPRISE_DELAI_MAX_S", "2.5")
    env_propre.setenv("LLM_BUDGET_TOTAL_S", "18")
    c = charger_config()
    assert c.environnement == "test"
    assert c.temperature == 0.7
    assert c.max_tokens == 1024
    assert c.politique_reprise.max_reprises == 2
    assert c.politique_reprise.delai_initial_s == 0.2
    assert c.politique_reprise.delai_max_s == 2.5
    assert c.politique_reprise.budget_total_s == 18.0


def test_charger_config_accepte_le_nom_timeout_sans_suffixe(env_propre: pytest.MonkeyPatch) -> None:
    env_propre.setenv("LLM_TIMEOUT", "8")
    assert charger_config().timeout_s == 8.0


def test_charger_config_prod_factice(env_propre: pytest.MonkeyPatch) -> None:
    env_propre.setenv("ENVIRONNEMENT", "prod")
    env_propre.setenv("LLM_FOURNISSEUR", "factice")
    with pytest.raises(ErreurConfiguration) as exc:
        charger_config()
    message = str(exc.value)
    assert "factice" in message.lower()
    assert "sk-" not in message
    assert "changeme" not in message


def test_charger_config_fournisseur_incomplet(env_propre: pytest.MonkeyPatch) -> None:
    env_propre.setenv("ENVIRONNEMENT", "dev")
    env_propre.setenv("LLM_FOURNISSEUR", "compatible-openai")
    env_propre.setenv("LLM_MODELE", "mistral-small")
    env_propre.setenv("LLM_BASE_URL", "http://localhost:11434/v1")
    env_propre.setenv("LLM_API_KEY", "")
    with pytest.raises(ErreurConfiguration) as exc:
        charger_config()
    message = str(exc.value)
    assert "api_key" in message
    assert "Configuration LLM incomplète" in message


def test_charger_config_url_invalide(env_propre: pytest.MonkeyPatch) -> None:
    env_propre.setenv("LLM_BASE_URL", "pas-une-url")
    with pytest.raises(ErreurConfiguration) as exc:
        charger_config()
    assert "base_url" in str(exc.value)
    assert "URL invalide" in str(exc.value)


def test_charger_config_fournisseur_inconnu(env_propre: pytest.MonkeyPatch) -> None:
    env_propre.setenv("LLM_FOURNISSEUR", "anthropic")
    with pytest.raises(ErreurConfiguration) as exc:
        charger_config()
    assert "fournisseur" in str(exc.value)
    assert "valeur non autorisée" in str(exc.value)


@pytest.mark.parametrize(
    ("variable", "valeur", "attendu"),
    [
        ("LLM_TEMPERATURE", "3", "temperature"),
        ("LLM_MAX_TOKENS", "0", "max_tokens"),
        ("LLM_TIMEOUT_S", "0", "LLM_TIMEOUT"),
        ("LLM_MAX_RETRIES", "4", "max_retries"),
        ("LLM_REPRISE_DELAI_S", "-1", "reprise_delai_s"),
        ("LLM_REPRISE_DELAI_MAX_S", "61", "reprise_delai_max_s"),
        ("LLM_BUDGET_TOTAL_S", "0", "budget_total_s"),
        ("LLM_MAX_TOKENS", "beaucoup", "max_tokens"),
    ],
)
def test_charger_config_bornes(
    env_propre: pytest.MonkeyPatch,
    variable: str,
    valeur: str,
    attendu: str,
) -> None:
    env_propre.setenv(variable, valeur)
    with pytest.raises(ErreurConfiguration) as exc:
        charger_config()
    assert attendu in str(exc.value)


def test_charger_config_absent_par_defaut(env_propre: pytest.MonkeyPatch) -> None:
    """Sans aucune variable, le service démarre en mode factice (développement et CI)."""
    assert charger_config().fournisseur == "factice"
