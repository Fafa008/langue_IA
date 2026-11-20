"""Cohérence du parcours de bout en bout (US46-QA) : diagnostic → génération → lecture → correction.

Complète les tests unitaires des règles (test_generation_parcours.py) et le test de fumée
(test_smoke_generation_parcours.py) : ici, un même apprenant suit son parcours à travers les routes, et chaque étape
doit confirmer ce que la précédente a décidé.
"""

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Exercice, Langue, Niveau, Parcours, TypeExercice
from app.services.parcours import calculer_lecon_atteinte
from app.services.phase_parcours import PhaseParcours, phase_parcours
from tests.conftest import creer_utilisateur, entete
from tests.fabriques_parcours import creer_question_diagnostic, passer_diagnostic

CONTENU_QCM = {
    "format": "choix",
    "intitule": "Les articles",
    "consigne": "Choisissez l'article correct.",
    "enonce": "I see ___ apple.",
    "choix": ["a", "an"],
    "reponses": ["an"],
    "explication": "Devant une voyelle, on utilise « an ».",
}


def _ajouter_exercice_c2(db: Session, contenu: dict) -> Exercice:
    """Un exercice d'anglais au niveau C2 : le niveau du parcours généré (le test est au niveau C2)."""
    exercice = Exercice(
        type=TypeExercice.GRAMMAIRE,
        contenu=json.dumps(contenu, ensure_ascii=False),
        difficulte=2,
        langue=db.scalar(select(Langue).where(Langue.code == "en")),
        niveau=db.scalar(select(Niveau).where(Niveau.code == "C2")),
    )
    db.add(exercice)
    db.commit()
    return exercice


def test_parcours_genere_se_lit_et_se_corrige_de_bout_en_bout(client, db: Session) -> None:
    apprenant = creer_utilisateur(db, email="coherence.parcours@exemple.com")
    _ajouter_exercice_c2(db, CONTENU_QCM)
    id_tentative = passer_diagnostic(client, apprenant, creer_question_diagnostic(db))
    id_parcours = db.scalar(select(Parcours.id_parcours).where(Parcours.id_test == id_tentative))
    entetes = entete(apprenant)

    # 1. Le parcours décrit par « en-cours » est celui que la génération a créé
    en_cours = client.get("/api/v1/parcours/en-cours", headers=entetes).json()
    assert en_cours["id_parcours"] == id_parcours
    assert en_cours["niveau_depart"] == en_cours["niveau_vise"] == "C2"
    assert en_cours["lecon_atteinte"] == 36
    assert en_cours["phase"] == "PASSIVE"

    # 2. La liste des exercices reflète la génération : une seule ligne, sur la leçon de départ, à faire
    exercices = client.get(f"/api/v1/parcours/{id_parcours}/exercices", headers=entetes).json()
    assert len(exercices) == 1
    exercice = exercices[0]
    assert exercice["numero_lecon"] == en_cours["lecon_atteinte"]
    assert exercice["intitule"] == "Les articles"
    assert exercice["statut"] == "A_FAIRE"

    # 3. La leçon de départ renvoie le contenu visible, sans la bonne réponse
    lecon = client.get(f"/api/v1/parcours/{id_parcours}/lecons/{en_cours['lecon_atteinte']}", headers=entetes).json()
    contenu_visible = json.loads(lecon["exercices"][0]["contenu"])
    assert contenu_visible["choix"] == ["a", "an"]
    assert "reponses" not in contenu_visible and "explication" not in contenu_visible

    # 4. La correction porte sur cet exercice, et la liste reflète son résultat ensuite
    correction = client.post(
        f"/api/v1/parcours/{id_parcours}/exercices/{exercice['id_parcours_exercice']}/reponse",
        headers=entetes,
        json={"format": "choix", "reponse": "an"},
    ).json()
    assert correction["statut"] == "REUSSI"
    assert correction["mode_correction"] == "AUTOMATIQUE"

    apres = client.get(f"/api/v1/parcours/{id_parcours}/exercices", headers=entetes).json()
    assert apres[0]["statut"] == "REUSSI"
    assert apres[0]["score_obtenu"] == 100


def test_la_generation_ne_passe_pas_en_mode_actif_avant_la_lecon_50(db: Session) -> None:
    """Invariant de cohérence : aucun niveau ouvert ne mène à la leçon 50 à la génération.

    Le mode actif commence à la leçon 50 et ne doit donc être atteint que par la progression (US48), jamais directement
    à la génération. Si la liste des niveaux d'une langue grandit, ce test signale qu'il faut revoir la règle.
    """
    langue = db.scalar(select(Langue).where(Langue.code == "en"))
    niveaux = list(langue.niveaux)

    lecons = [calculer_lecon_atteinte(niveau, niveaux) for niveau in niveaux]

    assert max(lecons) < 50
    assert all(phase_parcours(lecon) is PhaseParcours.PASSIVE for lecon in lecons)
