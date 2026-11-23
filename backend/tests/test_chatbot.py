"""Tests des routes chat backend (US67/US74, US-IA-CHAT-04/05) : relais IA, quota, mémoire et historique."""

import json
from collections.abc import Iterator
from uuid import UUID, uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Exercice, Langue, Niveau, Role, TypeExercice
from app.models.chatbot import (
    ErreurRecurrenteChatbot,
    JournalChatbot,
    MessageChatbot,
    ProfilMemoireChatbot,
    QuotaChatbot,
    SessionMemoireChatbot,
)
from app.schemas.ia import (
    ChargeMemoireLongTermeIA,
    CorrectionChatbotIA,
    CorrectionDetailleeChatbotIA,
    ErreurRecurrenteIA,
    MetaExecutionIA,
    ProfilMemoireIA,
    ReponseChatbotIA,
    ReponseClotureIA,
    ReponseCorrectionChatbotIA,
    ReponseExerciceIA,
    ReponseTraductionChatbotIA,
    RequeteChatbotIA,
    RequeteClotureIA,
    RequeteCorrectionChatbotIA,
    ResultatChatbotIA,
    ResultatCorrectionChatbotIA,
    ResultatExerciceIA,
    ResultatTraductionChatbotIA,
    SessionMemoireIA,
)
from app.services import ia as service_ia
from app.services.ia import ErreurServiceIA
from app.services.memoire_chatbot import identifiant_profil
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


def enveloppe_correction(erreur: str = "I go yesterday") -> ReponseCorrectionChatbotIA:
    return ReponseCorrectionChatbotIA(
        request_id=uuid4(),
        agent="chatbot-correction",
        version_agent="1.0.0",
        version_prompt="chatbot/correction@1.0.0",
        resultat=ResultatCorrectionChatbotIA(
            phrase_originale=f"{erreur} with my sister",
            corrections=[
                CorrectionDetailleeChatbotIA(
                    type="grammaire",
                    erreur=erreur,
                    correction="I went yesterday",
                    explication="Le repère temporel « yesterday » impose le prétérit.",
                )
            ],
        ),
        meta=MetaExecutionIA(
            duree_ms=15,
            fournisseur="factice",
            modele="modele-test",
            empreinte_prompt="sha256:test",
        ),
    )


def enveloppe_traduction(id_message: UUID) -> ReponseTraductionChatbotIA:
    return ReponseTraductionChatbotIA(
        request_id=uuid4(),
        agent="chatbot-traduction",
        version_agent="1.0.0",
        version_prompt="chatbot/traduction@1.0.0",
        resultat=ResultatTraductionChatbotIA(
            id_message=id_message,
            traduction="Hier, je suis allé au marché avec ma sœur.",
            explication="« Went » est le prétérit de « go », utilisé avec un repère passé.",
            cache_hit=False,
        ),
        meta=MetaExecutionIA(
            duree_ms=16,
            fournisseur="factice",
            modele="modele-test",
            empreinte_prompt="sha256:test",
        ),
    )


def corps_traduction(id_message: UUID, message: str = "I went to the market with my sister.") -> dict[str, object]:
    return {"identifiant_session": "session-a", "id_message": str(id_message), "message": message}


def enveloppe_cloture(session: str = "session-a", profil_id: str = "profil-pseudonyme") -> ReponseClotureIA:
    return ReponseClotureIA(
        request_id=uuid4(),
        agent="chatbot-memoire",
        version_agent="1.0.0",
        version_prompt="chatbot/memoire@1.0.0",
        resultat=ChargeMemoireLongTermeIA(
            profil=ProfilMemoireIA(profil_id=profil_id, code_langue="en", niveau_effectif="A1"),
            erreurs=[
                ErreurRecurrenteIA(
                    type="grammaire",
                    erreur="I go yesterday",
                    frequence=2,
                    derniere_occurrence="2026-11-23T10:00:00+00:00",
                )
            ],
            session=SessionMemoireIA(
                identifiant_session=session,
                nombre_tours=2,
                phase_atteinte="activation",
                resume="L'apprenant a travaillé le passé ; les accords restent à consolider.",
            ),
        ),
        meta=MetaExecutionIA(
            duree_ms=18,
            fournisseur="factice",
            modele="modele-test",
            empreinte_prompt="sha256:test",
        ),
    )


def enveloppe_exercice(niveau: str = "A1") -> ReponseExerciceIA:
    return ReponseExerciceIA(
        request_id=uuid4(),
        agent="chatbot-exercice",
        version_agent="1.0.0",
        version_prompt="chatbot/exercice@1.0.0",
        resultat=ResultatExerciceIA(
            enonce="Yesterday, I ___ to the market with my sister.",
            consigne="Choisis la forme au passé qui convient.",
            descripteur_id="cecrl-a1-grammaire-1",
            niveau=niveau,
        ),
        meta=MetaExecutionIA(
            duree_ms=21,
            fournisseur="factice",
            modele="modele-test",
            empreinte_prompt="sha256:test",
        ),
    )


def corps_exercice(session: str = "session-a") -> dict[str, str]:
    return {
        "identifiant_session": session,
        "type_erreur": "grammaire",
        "erreur": "I go yesterday",
    }


def ia_indisponible(_requete: RequeteClotureIA) -> ReponseClotureIA:
    raise ErreurServiceIA("indisponible")


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


def test_fermer_session_sans_ia_supprime_historique_et_quota(
    client: TestClient, db: Session, apprenant_avec_parcours, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.services.chatbot.envoyer_message_chatbot", lambda requete: enveloppe())
    monkeypatch.setattr("app.services.chatbot.clore_session_chatbot", ia_indisponible)
    client.post("/api/v1/chatbot/message", headers=entete(apprenant_avec_parcours), json=corps_chat())

    reponse = client.delete("/api/v1/chatbot/session/session-a", headers=entete(apprenant_avec_parcours))

    assert reponse.status_code == 200
    assert db.scalars(select(MessageChatbot)).all() == []
    assert db.scalars(select(QuotaChatbot)).all() == []
    assert len(db.scalars(select(JournalChatbot)).all()) == 1
    assert db.scalars(select(ProfilMemoireChatbot)).all() == []
    assert db.scalars(select(SessionMemoireChatbot)).all() == []


def test_sans_parcours_404(client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    apprenant = creer_utilisateur(db)
    monkeypatch.setattr("app.services.chatbot.envoyer_message_chatbot", lambda requete: enveloppe())

    reponse = client.post("/api/v1/chatbot/message", headers=entete(apprenant), json=corps_chat())

    assert reponse.status_code == 404


def test_formateur_refuse(client: TestClient, db: Session) -> None:
    formateur = creer_utilisateur(db, role=Role.FORMATEUR, email="formateur@exemple.com")

    reponse = client.post("/api/v1/chatbot/message", headers=entete(formateur), json=corps_chat())

    assert reponse.status_code == 403


def test_fermer_session_persiste_la_memoire_long_terme(
    client: TestClient, db: Session, apprenant_avec_parcours, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.services.chatbot.envoyer_message_chatbot", lambda requete: enveloppe())
    requetes: list[RequeteClotureIA] = []

    def clore(requete: RequeteClotureIA) -> ReponseClotureIA:
        requetes.append(requete)
        return enveloppe_cloture()

    monkeypatch.setattr("app.services.chatbot.clore_session_chatbot", clore)
    client.post("/api/v1/chatbot/message", headers=entete(apprenant_avec_parcours), json=corps_chat())

    reponse = client.delete("/api/v1/chatbot/session/session-a", headers=entete(apprenant_avec_parcours))

    assert reponse.status_code == 200
    assert reponse.json() == {"supprime": True}
    assert len(requetes) == 1
    assert requetes[0].entree.identifiant_session == "session-a"
    assert requetes[0].entree.profil.profil_id == identifiant_profil(apprenant_avec_parcours.id_user)
    assert requetes[0].contexte.niveau_confirme is False
    assert "rova@exemple.com" not in json.dumps(requetes[0].model_dump(mode="json"))

    profil = db.scalar(select(ProfilMemoireChatbot))
    assert profil is not None
    assert profil.id_apprenant == apprenant_avec_parcours.id_user
    assert (profil.profil_id, profil.code_langue, profil.niveau_effectif) == (
        identifiant_profil(apprenant_avec_parcours.id_user),
        "en",
        "A1",
    )

    erreur = db.scalar(select(ErreurRecurrenteChatbot))
    assert erreur is not None
    assert (erreur.id_profil, erreur.type, erreur.erreur, erreur.frequence) == (
        profil.id_profil,
        "grammaire",
        "I go yesterday",
        2,
    )

    bilan = db.scalar(select(SessionMemoireChatbot))
    assert bilan is not None
    assert (bilan.id_apprenant, bilan.identifiant_session, bilan.nombre_tours, bilan.phase_atteinte) == (
        apprenant_avec_parcours.id_user,
        "session-a",
        2,
        "activation",
    )
    assert bilan.resume.startswith("L'apprenant a travaillé")
    assert db.scalars(select(MessageChatbot)).all() == []
    assert db.scalars(select(QuotaChatbot)).all() == []
    assert len(db.scalars(select(JournalChatbot)).all()) == 1


def test_fermer_session_agregue_les_erreurs_recurrentes(
    client: TestClient, db: Session, apprenant_avec_parcours, monkeypatch: pytest.MonkeyPatch
) -> None:
    charges = iter([enveloppe_cloture("session-a"), enveloppe_cloture("session-b")])
    monkeypatch.setattr("app.services.chatbot.clore_session_chatbot", lambda requete: next(charges))

    assert (
        client.delete("/api/v1/chatbot/session/session-a", headers=entete(apprenant_avec_parcours)).status_code == 200
    )
    assert (
        client.delete("/api/v1/chatbot/session/session-b", headers=entete(apprenant_avec_parcours)).status_code == 200
    )

    erreurs = db.scalars(select(ErreurRecurrenteChatbot)).all()
    assert len(erreurs) == 1
    assert erreurs[0].frequence == 4
    assert len(db.scalars(select(SessionMemoireChatbot)).all()) == 2


def test_exercice_cible_genere_un_brouillon_ia(
    client: TestClient, db: Session, apprenant_avec_parcours, monkeypatch: pytest.MonkeyPatch
) -> None:
    requetes: list[object] = []

    def generer(requete: object) -> ReponseExerciceIA:
        requetes.append(requete)
        return enveloppe_exercice()

    monkeypatch.setattr("app.services.chatbot.generer_exercice_chatbot", generer)

    reponse = client.post("/api/v1/chatbot/exercice", headers=entete(apprenant_avec_parcours), json=corps_exercice())

    assert reponse.status_code == 200
    corps = reponse.json()
    assert corps["enonce"].startswith("Yesterday")
    assert corps["consigne"] == "Choisis la forme au passé qui convient."
    assert corps["descripteur_id"] == "cecrl-a1-grammaire-1"
    assert corps["niveau"] == "A1"
    assert len(requetes) == 1

    exercice = db.scalar(select(Exercice).where(Exercice.id_exercice == corps["id_exercice"]))
    assert exercice is not None
    assert (exercice.origine, exercice.auteur, exercice.statut, exercice.donnees_test) == (
        "systeme:ia_chat",
        "systeme:ia_chat",
        "brouillon",
        False,
    )
    assert exercice.numero_lecon is None
    assert exercice.difficulte == 1
    assert (exercice.framework, exercice.level, exercice.usage) == ("CECRL", "A1", "parcours")
    assert json.loads(exercice.contenu)["descripteur_id"] == "cecrl-a1-grammaire-1"


def test_exercice_cible_refuse_un_niveau_hors_referentiel(
    client: TestClient, db: Session, apprenant_avec_parcours, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.services.chatbot.generer_exercice_chatbot", lambda requete: enveloppe_exercice("C3"))

    reponse = client.post("/api/v1/chatbot/exercice", headers=entete(apprenant_avec_parcours), json=corps_exercice())

    assert reponse.status_code == 502
    assert db.scalars(select(Exercice)).all() == []


def test_exercice_cible_sans_parcours_404(client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    apprenant = creer_utilisateur(db)

    reponse = client.post("/api/v1/chatbot/exercice", headers=entete(apprenant), json=corps_exercice())

    assert reponse.status_code == 404


def test_origine_ia_chat_autorisee_et_origine_inconnue_refusee(db: Session) -> None:
    langue = db.scalar(select(Langue).where(Langue.code == "en"))
    niveau = db.scalar(select(Niveau).where(Niveau.code == "A1"))
    assert langue is not None and niveau is not None

    exercice = Exercice(
        type=TypeExercice.GRAMMAIRE,
        contenu="{}",
        difficulte=1,
        langue=langue,
        niveau=niveau,
        numero_lecon=None,
        origine="systeme:inconnu",
    )
    db.add(exercice)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    assert db.scalars(select(Exercice)).all() == []


# --- Routes séparées (US-IA-CHAT-05) ---


def test_correction_separee_relaye_l_agent_dedie(
    client: TestClient, db: Session, apprenant_avec_parcours, monkeypatch: pytest.MonkeyPatch
) -> None:
    requetes: list[RequeteCorrectionChatbotIA] = []

    def corriger(requete: RequeteCorrectionChatbotIA) -> ReponseCorrectionChatbotIA:
        requetes.append(requete)
        return enveloppe_correction()

    monkeypatch.setattr("app.services.chatbot.corriger_message_chatbot", corriger)

    reponse = client.post(
        "/api/v1/chatbot/correction", headers=entete(apprenant_avec_parcours), json=corps_chat("I go yesterday")
    )

    assert reponse.status_code == 200
    assert reponse.json() == {
        "corrections": [
            {
                "type": "grammaire",
                "extrait": "I go yesterday",
                "correction": "I went yesterday",
                "explication": "Le repère temporel « yesterday » impose le prétérit.",
            }
        ],
        "version_prompt": "chatbot/correction@1.0.0",
    }
    assert len(requetes) == 1
    assert requetes[0].entree.message == "I go yesterday"
    assert requetes[0].entree.identifiant_session == "session-a"
    assert requetes[0].contexte.niveau_confirme is False
    assert db.scalars(select(JournalChatbot)).all() == []


def test_correction_separee_refuse_un_extrait_hors_message(
    client: TestClient, db: Session, apprenant_avec_parcours, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "app.services.chatbot.corriger_message_chatbot", lambda requete: enveloppe_correction("She eat apples")
    )

    reponse = client.post(
        "/api/v1/chatbot/correction", headers=entete(apprenant_avec_parcours), json=corps_chat("I go yesterday")
    )

    assert reponse.status_code == 502


def test_traduction_separee_relaye_l_agent_dedie(
    client: TestClient, db: Session, apprenant_avec_parcours, monkeypatch: pytest.MonkeyPatch
) -> None:
    id_message = uuid4()
    requetes: list[object] = []

    def traduire(requete: object) -> ReponseTraductionChatbotIA:
        requetes.append(requete)
        return enveloppe_traduction(id_message)

    monkeypatch.setattr("app.services.chatbot.traduire_message_chatbot", traduire)

    reponse = client.post(
        "/api/v1/chatbot/traduction",
        headers=entete(apprenant_avec_parcours),
        json=corps_traduction(id_message),
    )

    assert reponse.status_code == 200
    corps = reponse.json()
    assert corps["id_message"] == str(id_message)
    assert corps["traduction"].startswith("Hier, je suis allé")
    assert corps["explication"].startswith("« Went »")
    assert corps["version_prompt"] == "chatbot/traduction@1.0.0"
    assert len(requetes) == 1
    assert requetes[0].entree.id_message == id_message
    assert requetes[0].entree.identifiant_session == "session-a"


def test_traduction_separee_refuse_un_identifiant_incoherent(
    client: TestClient, db: Session, apprenant_avec_parcours, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.services.chatbot.traduire_message_chatbot", lambda requete: enveloppe_traduction(uuid4()))

    reponse = client.post(
        "/api/v1/chatbot/traduction", headers=entete(apprenant_avec_parcours), json=corps_traduction(uuid4())
    )

    assert reponse.status_code == 502


def test_traduction_separee_refuse_un_identifiant_de_message_invalide(
    client: TestClient, db: Session, apprenant_avec_parcours
) -> None:
    reponse = client.post(
        "/api/v1/chatbot/traduction",
        headers=entete(apprenant_avec_parcours),
        json={"identifiant_session": "session-a", "id_message": "pas-un-uuid", "message": "Hello"},
    )

    assert reponse.status_code == 422


def test_routes_separees_reservees_aux_apprenants(client: TestClient, db: Session) -> None:
    formateur = creer_utilisateur(db, role=Role.FORMATEUR, email="formateur@exemple.com")

    correction = client.post("/api/v1/chatbot/correction", headers=entete(formateur), json=corps_chat("I go yesterday"))
    traduction = client.post("/api/v1/chatbot/traduction", headers=entete(formateur), json=corps_traduction(uuid4()))

    assert correction.status_code == 403
    assert traduction.status_code == 403
