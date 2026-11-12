"""Tests de l'orchestration de l'analyse IA d'une tentative (PRE-05), sur PostgreSQL de test."""

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Langue, Niveau, Question, StatutDiagnostic
from app.models import TestDiagnostic as TentativeDiagnostic
from app.schemas.ia import ReponseDiagnosticIA
from app.services import analyse_diagnostic
from app.services.ia import ErreurServiceIA
from tests.conftest import creer_utilisateur, entete

POINT_FAIBLE = {
    "domaine": "grammaire",
    "observation": "Le présent est utilisé là où le passé serait attendu.",
    "justification": "Emploi irrégulier des temps, à confirmer.",
}


class FauxServiceIA:
    """Remplace l'appel HTTP : enregistre les requêtes et retourne une enveloppe contrôlée."""

    def __init__(self) -> None:
        self.appels = []
        self.erreur: Exception | None = None
        self.phase = "impregnation"
        self.niveau_estime: str | None = None
        self.points: list[dict] | None = None

    def __call__(self, requete):
        self.appels.append(requete)
        if self.erreur is not None:
            raise self.erreur
        points = self.points or []
        return ReponseDiagnosticIA.model_validate(
            {
                "request_id": str(requete.request_id),
                "agent": "diagnostic",
                "version_agent": "1.0.0",
                "version_prompt": "diagnostic/evaluation@1.1.0",
                "statut": "succes",
                "resultat": {
                    "code_langue": requete.contexte.code_langue,
                    "referentiel": requete.contexte.referentiel,
                    "niveau_estime": self.niveau_estime or requete.contexte.niveau_preliminaire,
                    "phase_assimil": self.phase,
                    "points_faibles": [
                        {**point, "id_question": point.get("id_question", requete.entree.reponses[0].id_question)}
                        for point in points
                    ],
                    "score_confiance": 0.6,
                    "niveau_preliminaire": requete.contexte.niveau_preliminaire,
                    "ecart_avec_niveau_preliminaire": 0,
                },
                "meta": {
                    "duree_ms": 1200,
                    "fournisseur": "factice",
                    "modele": "modele-test",
                    "version_corpus": None,
                    "empreinte_prompt": "sha256:" + "a" * 64,
                },
            }
        )


@pytest.fixture
def ia(monkeypatch: pytest.MonkeyPatch) -> FauxServiceIA:
    faux = FauxServiceIA()
    monkeypatch.setattr(analyse_diagnostic, "evaluer_diagnostic", faux)
    return faux


def _creer_tentative(db: Session, apprenant, langue: Langue, niveau: Niveau) -> TentativeDiagnostic:
    tentative = TentativeDiagnostic(apprenant=apprenant.apprenant, langue=langue, niveau=niveau)
    db.add(tentative)
    db.commit()
    return tentative


def _creer_question(
    db: Session,
    langue: Langue,
    niveau: Niveau,
    *,
    competence: str = "grammaire",
    reponse_correcte: str = "is",
    type_reponse: str = "choix",
) -> Question:
    question = Question(
        enonce="She ___ a student." if type_reponse == "choix" else "Présentez-vous en anglais.",
        competence=competence,
        type_reponse=type_reponse,
        choix=["is", "are"] if type_reponse == "choix" else None,
        reponse_correcte=reponse_correcte if type_reponse == "choix" else None,
        langue=langue,
        niveau=niveau,
    )
    db.add(question)
    db.commit()
    return question


def _repondre(client, apprenant, tentative: TentativeDiagnostic, question: Question, valeur: str) -> None:
    response = client.post(
        "/api/v1/diagnostic/reponse",
        headers=entete(apprenant),
        json={
            "id_tentative": tentative.id_test,
            "id_question": str(question.id_question),
            "reponse_fournie": valeur,
        },
    )
    assert response.status_code == 201


def _terminer(client, apprenant, tentative: TentativeDiagnostic):
    return client.post(
        f"/api/v1/diagnostic/tentatives/{tentative.id_test}/terminer",
        headers=entete(apprenant),
    )


def _references(db: Session, code_langue: str = "en"):
    langue = db.scalar(select(Langue).where(Langue.code == code_langue))
    niveau = db.scalar(select(Niveau).where(Niveau.code == "A1"))
    return langue, niveau


def test_persiste_l_analyse_et_expose_les_champs_publics(client, db: Session, ia: FauxServiceIA):
    apprenant = creer_utilisateur(db)
    langue, niveau = _references(db)
    tentative = _creer_tentative(db, apprenant, langue, niveau)
    questions = [
        _creer_question(db, langue, niveau, competence="grammaire"),
        _creer_question(db, langue, niveau, competence="lecture"),
        _creer_question(db, langue, niveau, competence="grammaire"),
        _creer_question(db, langue, niveau, competence="ecrit", type_reponse="texte"),
    ]
    _repondre(client, apprenant, tentative, questions[0], "is")
    _repondre(client, apprenant, tentative, questions[1], "are")
    _repondre(client, apprenant, tentative, questions[2], "is")
    _repondre(client, apprenant, tentative, questions[3], "My name is Rova.")
    ia.points = [POINT_FAIBLE]
    ia.niveau_estime = "C2"

    response = _terminer(client, apprenant, tentative)

    assert response.status_code == 200
    corps = response.json()
    # Le niveau public reste celui du scoring déterministe, pas l'estimation du modèle.
    assert corps["level"] == "B2"
    assert corps["score"] == 66.67
    assert corps["competences"] == [
        {"competence": "grammaire", "score": 2, "total": 2},
        {"competence": "lecture", "score": 0, "total": 1},
    ]
    assert corps["points_faibles"] == [{"domaine": "grammaire", "detail": POINT_FAIBLE["justification"]}]
    assert corps["phase_assimil"] == "impregnation"

    # Rien d'identifiant ni de corrigé ne part vers le service IA.
    (requete,) = ia.appels
    assert requete.contexte.code_langue == "en"
    assert requete.contexte.niveau_preliminaire == "A1"
    assert requete.entree.score_preliminaire == 66.67
    assert [reponse.id_question for reponse in requete.entree.reponses] == [str(q.id_question) for q in questions]
    # Seule la réponse de l'apprenant est transmise : jamais la clé de correction, y compris pour une réponse libre.
    assert [reponse.contenu for reponse in requete.entree.reponses] == ["is", "are", "is", "My name is Rova."]
    assert "reponse_correcte" not in requete.model_dump_json()

    db.refresh(tentative)
    assert tentative.analyse_ia is not None
    assert tentative.analyse_ia["request_id"] == str(requete.request_id)
    assert tentative.analyse_ia["resultat"]["niveau_estime"] == "C2"


def test_reutilise_l_analyse_sans_second_appel(client, db: Session, ia: FauxServiceIA):
    apprenant = creer_utilisateur(db)
    langue, niveau = _references(db)
    tentative = _creer_tentative(db, apprenant, langue, niveau)
    question = _creer_question(db, langue, niveau)
    _repondre(client, apprenant, tentative, question, "is")

    premiere = _terminer(client, apprenant, tentative)
    seconde = _terminer(client, apprenant, tentative)

    assert premiere.status_code == seconde.status_code == 200
    assert seconde.json() == premiere.json()
    assert len(ia.appels) == 1


def test_panne_ia_degrade_en_resultat_partiel(client, db: Session, ia: FauxServiceIA):
    apprenant = creer_utilisateur(db)
    langue, niveau = _references(db)
    tentative = _creer_tentative(db, apprenant, langue, niveau)
    question = _creer_question(db, langue, niveau)
    _repondre(client, apprenant, tentative, question, "is")
    ia.erreur = ErreurServiceIA("timeout")

    response = _terminer(client, apprenant, tentative)

    assert response.status_code == 200
    corps = response.json()
    assert corps["score"] == 100
    assert "competences" not in corps
    assert "points_faibles" not in corps
    assert "phase_assimil" not in corps
    db.refresh(tentative)
    assert tentative.statut == StatutDiagnostic.TERMINE
    assert tentative.analyse_ia is None


def test_langue_non_supportee_n_appelle_pas_l_ia(client, db: Session, ia: FauxServiceIA):
    apprenant = creer_utilisateur(db)
    niveau = db.scalar(select(Niveau).where(Niveau.code == "A1"))
    espagnol = Langue(code="es", libelle="Espagnol")
    db.add(espagnol)
    db.commit()
    tentative = _creer_tentative(db, apprenant, espagnol, niveau)
    question = _creer_question(db, espagnol, niveau)
    _repondre(client, apprenant, tentative, question, "is")

    response = _terminer(client, apprenant, tentative)

    assert response.status_code == 200
    assert "competences" not in response.json()
    assert ia.appels == []


def test_aucune_reponse_n_appelle_pas_l_ia(client, db: Session, ia: FauxServiceIA):
    apprenant = creer_utilisateur(db)
    langue, niveau = _references(db)
    tentative = _creer_tentative(db, apprenant, langue, niveau)
    _creer_question(db, langue, niveau)

    response = _terminer(client, apprenant, tentative)

    assert response.status_code == 200
    assert response.json() == {
        "id_tentative": tentative.id_test,
        "score": 0.0,
        "max_score": 100,
        "percentage": 0.0,
        "level": "A1",
        "framework": "CECRL",
    }
    assert ia.appels == []


def test_competence_inconnue_ignoree(client, db: Session, ia: FauxServiceIA):
    apprenant = creer_utilisateur(db)
    langue, niveau = _references(db)
    tentative = _creer_tentative(db, apprenant, langue, niveau)
    inconnue = _creer_question(db, langue, niveau, competence="calligraphie")
    connue = _creer_question(db, langue, niveau, competence="grammaire")
    _repondre(client, apprenant, tentative, inconnue, "is")
    _repondre(client, apprenant, tentative, connue, "is")

    response = _terminer(client, apprenant, tentative)

    assert response.status_code == 200
    (requete,) = ia.appels
    assert [reponse.id_question for reponse in requete.entree.reponses] == [str(connue.id_question)]
    assert response.json()["competences"] == [{"competence": "grammaire", "score": 1, "total": 1}]


def test_aucune_competence_connue_n_appelle_pas_l_ia(client, db: Session, ia: FauxServiceIA):
    apprenant = creer_utilisateur(db)
    langue, niveau = _references(db)
    tentative = _creer_tentative(db, apprenant, langue, niveau)
    question = _creer_question(db, langue, niveau, competence="calligraphie")
    _repondre(client, apprenant, tentative, question, "is")

    response = _terminer(client, apprenant, tentative)

    assert response.status_code == 200
    assert "competences" not in response.json()
    assert ia.appels == []


def test_ne_transmet_pas_l_identite_de_l_apprenant(client, db: Session, ia: FauxServiceIA):
    apprenant = creer_utilisateur(db, email="rova@exemple.com")
    langue, niveau = _references(db)
    tentative = _creer_tentative(db, apprenant, langue, niveau)
    question = _creer_question(db, langue, niveau)
    _repondre(client, apprenant, tentative, question, "is")

    _terminer(client, apprenant, tentative)

    (requete,) = ia.appels
    # L'enveloppe ne porte aucune identité : ni e-mail, ni identifiant d'utilisateur, ni champ libre.
    assert "rova@exemple.com" not in requete.model_dump_json()
    assert set(requete.model_dump()) == {"request_id", "version_agent", "contexte", "entree"}
    assert set(requete.contexte.model_dump()) == {"code_langue", "referentiel", "niveau_preliminaire"}
    assert "id_user" not in requete.model_dump_json()
