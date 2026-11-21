"""Tests du quota du chat par session (P1-2), sans aucun contenu de conversation."""

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.chatbot import QuotaChatbot
from app.services.quota_chatbot import QuotaDepasseChatbot, consommer_echange, obtenir_quota, terminer_session
from tests.conftest import creer_utilisateur


@pytest.fixture
def quota_par_defaut(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CHATBOT_QUOTA_ECHANGES", "20")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_consommer_echange_cree_puis_incremente(db: Session, quota_par_defaut: None) -> None:
    apprenant = creer_utilisateur(db).apprenant
    assert apprenant is not None

    premier = consommer_echange(db, id_apprenant=apprenant.id_user, identifiant_session="session-a")
    deuxieme = consommer_echange(db, id_apprenant=apprenant.id_user, identifiant_session="session-a")

    assert premier.nombre_echanges == 1
    assert deuxieme.nombre_echanges == 2
    assert len(db.scalars(select(QuotaChatbot)).all()) == 1


def test_limite_a_20_echanges(db: Session, quota_par_defaut: None) -> None:
    apprenant = creer_utilisateur(db).apprenant
    assert apprenant is not None

    for _ in range(20):
        consommer_echange(db, id_apprenant=apprenant.id_user, identifiant_session="session-a")

    with pytest.raises(QuotaDepasseChatbot):
        consommer_echange(db, id_apprenant=apprenant.id_user, identifiant_session="session-a")

    quota = obtenir_quota(db, id_apprenant=apprenant.id_user, identifiant_session="session-a", creer=False)
    assert quota is not None
    assert quota.nombre_echanges == 20


def test_sessions_separees(db: Session, quota_par_defaut: None) -> None:
    apprenant = creer_utilisateur(db).apprenant
    assert apprenant is not None

    consommer_echange(db, id_apprenant=apprenant.id_user, identifiant_session="session-a")
    consommer_echange(db, id_apprenant=apprenant.id_user, identifiant_session="session-b")

    quotas = db.scalars(select(QuotaChatbot)).all()
    assert {q.identifiant_session for q in quotas} == {"session-a", "session-b"}
    assert all(q.nombre_echanges == 1 for q in quotas)


def test_terminer_session_supprime_le_compteur(db: Session, quota_par_defaut: None) -> None:
    apprenant = creer_utilisateur(db).apprenant
    assert apprenant is not None
    consommer_echange(db, id_apprenant=apprenant.id_user, identifiant_session="session-a")

    terminer_session(db, id_apprenant=apprenant.id_user, identifiant_session="session-a")

    assert obtenir_quota(db, id_apprenant=apprenant.id_user, identifiant_session="session-a", creer=False) is None
    consommer_echange(db, id_apprenant=apprenant.id_user, identifiant_session="session-a")
    quota = obtenir_quota(db, id_apprenant=apprenant.id_user, identifiant_session="session-a", creer=False)
    assert quota is not None
    assert quota.nombre_echanges == 1


def test_table_sans_contenu_de_conversation(db: Session, quota_par_defaut: None) -> None:
    colonnes = {colonne.name for colonne in QuotaChatbot.__table__.columns}
    assert colonnes.isdisjoint({"message", "reponse", "historique", "contenu", "prompt"})
