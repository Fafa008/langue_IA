"""Tests de la route chat backend (US67/US74) : relais IA, quota, historique et journal anonymisé."""

import json
from collections.abc import Iterator
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Role
from app.models.chatbot import JournalChatbot, MessageChatbot, QuotaChatbot
from app.schemas.ia import (
    CorrectionChatbotIA,
    MetaExecutionIA,
    ReponseChatbotIA,
    RequeteChatbotIA,
    ResultatChatbotIA,
)
from app.services import ia as service_ia
from tests.conftest import creer_utilisateur, entete
from tests.fabriques_parcours import creer_parcours_vide


def enveloppe(
    message: str = "Très bien !",
    corrections: list[dict[str, str]] | None = None,
    traduction: str = "Très bien !",
    explication: str = "Cette expression sert à encourager l'apprenant.",
) -> ReponseChatbotIA:
    return ReponseChatbotIA(
        request_id=uuid4(),
        agent="chatbot",
        version_agent="1.2.0",
        version_prompt="chatbot/conversation@1.2.0",
        resultat=ResultatChatbotIA(
            reponse=message,
            corrections=[CorrectionChatbotIA(**c) for c in (corrections or [])],
            traduction=traduction,
            explication=explication,
        ),
        meta=MetaExecutionIA(
            duree_ms=12,
            fournisseur="factice",
            modele="modele-test",
            empreinte_prompt="sha256:test",
        ),
    )


def corps_chat(message: str = "How long I study English?", session: str = "session-a") -> dict[str, object]:
    return {"message": message, "identifiant_session": session, "historique": []}


@pytest.fixture
def apprenant_avec_parcours(db: Session):
    apprenant = creer_utilisateur(db)
    creer_parcours_vide(db, apprenant)
    db.commit()
    return apprenant


def test_message_retourne_reponse_et_corrections(
    client: TestClient, db: Session, apprenant_avec_parcours, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "app.services.chatbot.envoyer_message_chatbot",
        lambda requete: enveloppe(
            "On dit « How long have I been studying? ».",
            [
                {
                    "extrait": "How long I study",
                    "correction": "How long have I been studying",
                    "explication": "Utilisez le present perfect continu.",
                }
            ],
        ),
    )

    reponse = client.post("/api/v1/chatbot/message", headers=entete(apprenant_avec_parcours), json=corps_chat())

    assert reponse.status_code == 200
    corps = reponse.json()
    assert corps["reponse"].startswith("On dit")
    assert corps["corrections"][0]["extrait"] == "How long I study"
    assert corps["traduction"] == "Très bien !"
    assert corps["explication"] == "Cette expression sert à encourager l'apprenant."
    assert corps["quota_restant"] == 19
    assert corps["version_prompt"] == "chatbot/conversation@1.2.0"
    assert [m.role for m in db.scalars(select(MessageChatbot)).all()] == ["apprenant", "assistant"]


@pytest.fixture
def url_ia(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """URL joignable pour le client HTTP ; le transport simulé remplace le réseau."""
    monkeypatch.setenv("IA_SERVICE_URL", "http://ia.test")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_integration_relais_http_vers_service_ia(
    client: TestClient, db: Session, apprenant_avec_parcours, monkeypatch: pytest.MonkeyPatch, url_ia: None
) -> None:
    appels: list[httpx.Request] = []

    def simuler_service_ia(requete_http: httpx.Request) -> httpx.Response:
        appels.append(requete_http)
        return httpx.Response(200, json=enveloppe("Bonjour !").model_dump(mode="json"))

    def relais(requete: RequeteChatbotIA) -> ReponseChatbotIA:
        transport = httpx.MockTransport(simuler_service_ia)
        return service_ia.envoyer_message_chatbot(requete, transport=transport)

    monkeypatch.setattr("app.services.chatbot.envoyer_message_chatbot", relais)

    reponse = client.post(
        "/api/v1/chatbot/message",
        headers=entete(apprenant_avec_parcours),
        json=corps_chat("How long I study English?"),
    )

    assert reponse.status_code == 200
    assert reponse.json()["reponse"] == "Bonjour !"
    assert len(appels) == 1
    assert appels[0].method == "POST"
    assert appels[0].url.path == "/chatbot/message"
    corps_ia = json.loads(appels[0].content)
    assert corps_ia["contexte"] == {
        "code_langue": "en",
        "referentiel": "CECRL",
        "niveau_preliminaire": "B1",
        "niveau_confirme": False,
    }
    assert corps_ia["entree"]["message"] == "How long I study English?"
    assert corps_ia["entree"]["historique"] == []
    assert corps_ia["entree"]["identifiant_session"] == "session-a"
    assert [m.role for m in db.scalars(select(MessageChatbot)).all()] == ["apprenant", "assistant"]


def test_journal_sans_texte_brut(
    client: TestClient, db: Session, apprenant_avec_parcours, monkeypatch: pytest.MonkeyPatch
) -> None:
    secret = "mon-message-prive"
    monkeypatch.setattr("app.services.chatbot.envoyer_message_chatbot", lambda requete: enveloppe())

    reponse = client.post("/api/v1/chatbot/message", headers=entete(apprenant_avec_parcours), json=corps_chat(secret))

    assert reponse.status_code == 200
    journaux = db.scalars(select(JournalChatbot)).all()
    assert len(journaux) == 1
    assert journaux[0].nombre_corrections == 0
    assert journaux[0].modele == "modele-test"
    colonnes = {colonne.name for colonne in JournalChatbot.__table__.columns}
    assert colonnes.isdisjoint({"message", "reponse", "contenu", "historique"})
    assert secret not in str(journaux[0].__dict__)


def test_corrections_hors_message_refusees(
    client: TestClient, apprenant_avec_parcours, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "app.services.chatbot.envoyer_message_chatbot",
        lambda requete: enveloppe(
            corrections=[{"extrait": "texte absent", "correction": "autre", "explication": "Explication."}]
        ),
    )

    reponse = client.post(
        "/api/v1/chatbot/message", headers=entete(apprenant_avec_parcours), json=corps_chat("Bonjour")
    )

    assert reponse.status_code == 502
    assert reponse.json()["detail"].startswith("La réponse du chat")


def test_reponse_sans_traduction_refusee(
    client: TestClient, apprenant_avec_parcours, monkeypatch: pytest.MonkeyPatch, url_ia: None
) -> None:
    corps_ia = enveloppe().model_dump(mode="json")
    del corps_ia["resultat"]["traduction"]

    def simuler_service_ia(_requete_http: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=corps_ia)

    def relais(requete: RequeteChatbotIA) -> ReponseChatbotIA:
        return service_ia.envoyer_message_chatbot(requete, transport=httpx.MockTransport(simuler_service_ia))

    monkeypatch.setattr("app.services.chatbot.envoyer_message_chatbot", relais)

    reponse = client.post(
        "/api/v1/chatbot/message", headers=entete(apprenant_avec_parcours), json=corps_chat("Bonjour")
    )

    assert reponse.status_code == 502
    assert reponse.json()["detail"].startswith("La réponse du chat")


def test_quota_20_echanges_par_session(
    client: TestClient, apprenant_avec_parcours, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.services.chatbot.envoyer_message_chatbot", lambda requete: enveloppe())
    entete_http = entete(apprenant_avec_parcours)

    for _ in range(20):
        assert client.post("/api/v1/chatbot/message", headers=entete_http, json=corps_chat()).status_code == 200

    reponse = client.post("/api/v1/chatbot/message", headers=entete_http, json=corps_chat())
    assert reponse.status_code == 429


def test_fermer_session_supprime_historique_et_quota(
    client: TestClient, db: Session, apprenant_avec_parcours, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.services.chatbot.envoyer_message_chatbot", lambda requete: enveloppe())
    client.post("/api/v1/chatbot/message", headers=entete(apprenant_avec_parcours), json=corps_chat())

    reponse = client.delete("/api/v1/chatbot/session/session-a", headers=entete(apprenant_avec_parcours))

    assert reponse.status_code == 200
    assert db.scalars(select(MessageChatbot)).all() == []
    assert db.scalars(select(QuotaChatbot)).all() == []
    assert len(db.scalars(select(JournalChatbot)).all()) == 1


def test_sans_parcours_404(client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    apprenant = creer_utilisateur(db)
    monkeypatch.setattr("app.services.chatbot.envoyer_message_chatbot", lambda requete: enveloppe())

    reponse = client.post("/api/v1/chatbot/message", headers=entete(apprenant), json=corps_chat())

    assert reponse.status_code == 404


def test_formateur_refuse(client: TestClient, db: Session) -> None:
    formateur = creer_utilisateur(db, role=Role.FORMATEUR, email="formateur@exemple.com")

    reponse = client.post("/api/v1/chatbot/message", headers=entete(formateur), json=corps_chat())

    assert reponse.status_code == 403
