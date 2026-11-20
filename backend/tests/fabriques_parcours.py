"""Fabriques partagées des tests du parcours personnalisé : un parcours, des exercices, un test de diagnostic.

Les deux fonctions de base (``creer_parcours_vide``, ``ajouter_exercice``) ne valident rien : elles servent aux
tests de lecture comme à ceux de correction. ``creer_parcours`` en est le raccourci à un exercice.
"""

import json

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Exercice,
    Langue,
    Niveau,
    Parcours,
    ParcoursExercice,
    Question,
    TypeExercice,
    Utilisateur,
)
from app.models import TestDiagnostic as Diagnostic
from tests.conftest import entete

CONTENU_REDACTION = {
    "format": "redaction",
    "consigne": "Write a short message to a friend.",
    "enonce": "Tell your friend what you did yesterday.",
    "mots_minimum": 10,
}


def creer_parcours_vide(
    db: Session,
    apprenant: Utilisateur,
    *,
    lecon_atteinte: int = 23,
    langue: str = "en",
    niveau_vise: str = "B1",
    niveau_final: str | None = None,
) -> Parcours:
    """Un parcours et son test de diagnostic (pas d'exercice). Le niveau final du test est facultatif."""
    langue_ = db.scalar(select(Langue).where(Langue.code == langue))
    niveau = db.scalar(select(Niveau).where(Niveau.code == niveau_vise))
    final = db.scalar(select(Niveau).where(Niveau.code == niveau_final)) if niveau_final else None
    assert langue_ is not None and niveau is not None
    test = Diagnostic(apprenant=apprenant.apprenant, langue=langue_, niveau=niveau, niveau_final=final)
    parcours = Parcours(test_diagnostic=test, langue=langue_, niveau_vise=niveau, lecon_atteinte=lecon_atteinte)
    db.add_all([test, parcours])
    db.flush()
    return parcours


def ajouter_exercice(
    db: Session,
    parcours: Parcours,
    *,
    numero_lecon: int = 23,
    contenu: object = CONTENU_REDACTION,
    score: int | None = None,
    type_exercice: TypeExercice = TypeExercice.GRAMMAIRE,
) -> ParcoursExercice:
    """Un exercice du catalogue de la langue du parcours, associé au parcours pour une leçon."""
    exercice = Exercice(
        type=type_exercice,
        contenu=contenu if isinstance(contenu, str) else json.dumps(contenu, ensure_ascii=False),
        difficulte=2,
        langue=parcours.langue,
        niveau=parcours.niveau_vise,
    )
    ligne = ParcoursExercice(parcours=parcours, exercice=exercice, numero_lecon=numero_lecon, score_obtenu=score)
    db.add_all([exercice, ligne])
    db.flush()
    return ligne


def creer_parcours(
    db: Session,
    apprenant: Utilisateur,
    *,
    lecon_atteinte: int = 23,
    numero_lecon: int = 23,
    contenu: object = CONTENU_REDACTION,
    langue: str = "en",
) -> tuple[int, int]:
    """Un parcours avec un exercice ; retourne ``(id_parcours, id_parcours_exercice)``."""
    parcours = creer_parcours_vide(db, apprenant, lecon_atteinte=lecon_atteinte, langue=langue)
    ligne = ajouter_exercice(db, parcours, numero_lecon=numero_lecon, contenu=contenu)
    db.commit()
    return parcours.id_parcours, ligne.id_parcours_exercice


def creer_question_diagnostic(
    db: Session, *, code_langue: str = "en", enonce: str = "Smoke ___ test.", niveau_code: str = "A1"
) -> Question:
    """Une question à choix, réponse correcte = premier choix. Sert à passer un diagnostic complet."""
    choix = ["is", "are", "am", "be"]
    question = Question(
        enonce=enonce,
        competence="grammaire",
        type_reponse="choix",
        choix=choix,
        reponse_correcte=choix[0],
        langue=db.scalar(select(Langue).where(Langue.code == code_langue)),
        niveau=db.scalar(select(Niveau).where(Niveau.code == niveau_code)),
    )
    db.add(question)
    db.commit()
    return question


def passer_diagnostic(client: TestClient, apprenant: Utilisateur, question: Question) -> int:
    """Crée une tentative, répond juste à la question et la termine ; retourne l'identifiant de la tentative."""
    creation = client.post(
        "/api/v1/diagnostic/tentatives", headers=entete(apprenant), json={"code_langue": question.langue.code}
    )
    assert creation.status_code == 201
    id_tentative = creation.json()["id_tentative"]
    reponse = client.post(
        "/api/v1/diagnostic/reponse",
        headers=entete(apprenant),
        json={
            "id_tentative": id_tentative,
            "id_question": str(question.id_question),
            "reponse_fournie": question.reponse_correcte,
        },
    )
    assert reponse.status_code == 201
    fin = client.post(f"/api/v1/diagnostic/tentatives/{id_tentative}/terminer", headers=entete(apprenant))
    assert fin.status_code == 200
    return id_tentative


def url_reponse(id_parcours: int, id_ligne: int) -> str:
    """Route de correction d'un exercice du parcours."""
    return f"/api/v1/parcours/{id_parcours}/exercices/{id_ligne}/reponse"
