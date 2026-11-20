"""Progression par lecon (US48) : score de lecon pondéré, validation sur le meilleur score, avancement.

Le score de lecon est pondéré 30 / 30 / 40 selon le rang des exercices ; la lecon est validée à 70 ou plus, et seule la
lecon atteinte fait avancer le parcours. Les exercices sont corrigés sans IA (QCM), ce qui rend les cas déterministes.
"""

import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, select
from sqlalchemy.orm import Session

from app.models import Exercice, Langue, Niveau, Parcours, ParcoursExercice, ProgressionLecon, TypeExercice
from app.services.parcours import parcours_de_apprenant
from app.services.progression_lecon import score_lecon
from tests.conftest import creer_utilisateur, entete
from tests.fabriques_parcours import ajouter_exercice, creer_parcours_vide, url_reponse

CONTENU_QCM = {
    "format": "choix",
    "intitule": "Les articles",
    "consigne": "Choisissez l'article correct.",
    "enonce": "I see ___ apple.",
    "choix": ["a", "an"],
    "reponses": ["an"],
}
JUSTE = "an"
FAUX = "a"


@pytest.mark.parametrize(
    ("scores", "attendu"),
    [
        ({1: 80, 2: 60, 3: 90}, 78),  # 24 + 18 + 36
        ({1: 100, 2: 100, 3: 100}, 100),
        ({1: 100, 2: 0, 3: 0}, 30),
        ({1: 100, 2: 0, 3: 100}, 70),  # seuil exact de validation
        ({1: 5, 2: 0, 3: 0}, 2),  # 1,5 arrondi à l'entier supérieur
        ({1: 80, 2: 60}, None),  # le rang 3 n'est pas encore noté
        ({1: None, 2: 60, 3: 90}, None),
    ],
)
def test_score_de_lecon_pondere_et_arrondi(scores: dict, attendu: int | None) -> None:
    assert score_lecon(scores) == attendu


def _lecon_a_trois_exercices(db: Session, apprenant, lecon: int = 23, rangs: int = 3) -> tuple[Parcours, list[int]]:
    """Un parcours à la leçon ``lecon`` avec ``rangs`` exercices QCM ; retourne le parcours et les ids de ligne."""
    parcours = creer_parcours_vide(db, apprenant, lecon_atteinte=lecon)
    lignes = [ajouter_exercice(db, parcours, numero_lecon=lecon, contenu=CONTENU_QCM) for _ in range(rangs)]
    db.commit()
    return parcours, [ligne.id_parcours_exercice for ligne in lignes]


def _repondre(client: TestClient, apprenant, parcours: Parcours, id_ligne: int, reponse: str):
    return client.post(
        url_reponse(parcours.id_parcours, id_ligne),
        headers=entete(apprenant),
        json={"format": "choix", "reponse": reponse},
    )


def _progression(db: Session, parcours: Parcours, lecon: int) -> ProgressionLecon | None:
    db.expire_all()
    return db.scalar(
        select(ProgressionLecon).where(
            ProgressionLecon.id_parcours == parcours.id_parcours, ProgressionLecon.numero_lecon == lecon
        )
    )


def _atteinte(db: Session, parcours: Parcours) -> int:
    db.expire_all()
    return db.get(Parcours, parcours.id_parcours).lecon_atteinte


def test_lecon_validee_a_70_fait_avancer_le_parcours(client: TestClient, db: Session) -> None:
    apprenant = creer_utilisateur(db)
    parcours, (r1, r2, r3) = _lecon_a_trois_exercices(db, apprenant)

    _repondre(client, apprenant, parcours, r1, JUSTE)  # 100 × 30
    _repondre(client, apprenant, parcours, r2, FAUX)  # 0 × 30
    _repondre(client, apprenant, parcours, r3, JUSTE)  # 100 × 40 → 70

    progression = _progression(db, parcours, 23)
    assert progression.last_score == 70
    assert progression.best_score == 70
    assert progression.is_validated is True
    assert _atteinte(db, parcours) == 24


def test_lecon_sous_70_reste_sur_place(client: TestClient, db: Session) -> None:
    apprenant = creer_utilisateur(db)
    parcours, (r1, r2, r3) = _lecon_a_trois_exercices(db, apprenant)

    _repondre(client, apprenant, parcours, r1, JUSTE)  # 30
    _repondre(client, apprenant, parcours, r2, FAUX)
    _repondre(client, apprenant, parcours, r3, FAUX)

    progression = _progression(db, parcours, 23)
    assert progression.last_score == 30
    assert progression.is_validated is False
    assert _atteinte(db, parcours) == 23


def test_pas_de_score_de_lecon_tant_que_les_trois_exercices_ne_sont_pas_notes(client: TestClient, db: Session) -> None:
    apprenant = creer_utilisateur(db)
    parcours, (r1, r2, _r3) = _lecon_a_trois_exercices(db, apprenant)

    _repondre(client, apprenant, parcours, r1, JUSTE)
    _repondre(client, apprenant, parcours, r2, JUSTE)

    assert _progression(db, parcours, 23) is None
    assert _atteinte(db, parcours) == 23


def test_le_meilleur_score_valide_la_lecon_meme_si_la_reprise_est_moins_bonne(client: TestClient, db: Session) -> None:
    apprenant = creer_utilisateur(db)
    parcours, (r1, r2, r3) = _lecon_a_trois_exercices(db, apprenant)
    _repondre(client, apprenant, parcours, r1, JUSTE)
    _repondre(client, apprenant, parcours, r2, FAUX)
    _repondre(client, apprenant, parcours, r3, JUSTE)  # validée à 70, le parcours passe à la lecon 24

    # Reprise de la lecon 23 (toujours accessible) : tout faux, donc 0
    for id_ligne in (r1, r2, r3):
        _repondre(client, apprenant, parcours, id_ligne, FAUX)

    progression = _progression(db, parcours, 23)
    assert progression.last_score == 0
    assert progression.best_score == 70
    assert progression.is_validated is True
    assert _atteinte(db, parcours) == 24


def test_seuls_les_trois_premiers_exercices_comptent(client: TestClient, db: Session) -> None:
    """Un quatrième exercice de la lecon ne change pas le score : seuls les rangs 1, 2 et 3 sont pondérés."""
    apprenant = creer_utilisateur(db)
    parcours, (r1, r2, r3, r4) = _lecon_a_trois_exercices(db, apprenant, rangs=4)

    _repondre(client, apprenant, parcours, r1, JUSTE)
    _repondre(client, apprenant, parcours, r2, FAUX)
    _repondre(client, apprenant, parcours, r3, FAUX)
    _repondre(client, apprenant, parcours, r4, JUSTE)

    assert _progression(db, parcours, 23).last_score == 30
    assert _atteinte(db, parcours) == 23


@pytest.mark.parametrize(("verrou", "attendu"), [(True, True), (False, False)])
def test_verrou_du_parcours_pose_un_for_update(db: Session, verrou: bool, attendu: bool) -> None:
    """Les corrections d'un même parcours se succèdent : la lecture du parcours pose le verrou demandé."""
    requetes: list[str] = []

    def capturer(conn, cursor, statement, parameters, context, executemany) -> None:
        requetes.append(statement)

    moteur = db.get_bind()
    event.listen(moteur, "before_cursor_execute", capturer)
    try:
        parcours_de_apprenant(db, 1, 1, verrou=verrou)
    finally:
        event.remove(moteur, "before_cursor_execute", capturer)

    assert any("FOR UPDATE" in requete for requete in requetes) is attendu


def test_validation_rattache_les_exercices_de_la_lecon_suivante_dans_l_ordre_des_rangs(
    client: TestClient, db: Session
) -> None:
    """Valider la leçon 23 passe à la 24 et lui rattache ses exercices, du plus facile au plus difficile."""
    langue = db.scalar(select(Langue).where(Langue.code == "en"))
    a1 = db.scalar(select(Niveau).where(Niveau.code == "A1"))
    intitules_24 = []
    for difficulte in (3, 1, 2):  # ajoutés dans le désordre : le rattachement suit la difficulté
        intitule = f"Lecon 24 difficulte {difficulte}"
        intitules_24.append((difficulte, intitule))
        db.add(
            Exercice(
                type=TypeExercice.GRAMMAIRE,
                contenu=json.dumps({"format": "choix", "intitule": intitule, "reponses": ["x"], "choix": ["x"]}),
                difficulte=difficulte,
                numero_lecon=24,
                langue=langue,
                niveau=a1,
            )
        )
    db.commit()

    apprenant = creer_utilisateur(db, email="ordre.rangs@exemple.com")
    parcours, (r1, r2, r3) = _lecon_a_trois_exercices(db, apprenant)
    _repondre(client, apprenant, parcours, r1, JUSTE)
    _repondre(client, apprenant, parcours, r2, FAUX)
    _repondre(client, apprenant, parcours, r3, JUSTE)  # validée à 70 : la leçon 24 s'ouvre

    db.expire_all()
    rattaches = db.scalars(
        select(ParcoursExercice)
        .where(ParcoursExercice.id_parcours == parcours.id_parcours, ParcoursExercice.numero_lecon == 24)
        .order_by(ParcoursExercice.id_parcours_exercice)
    ).all()
    intitules_rattaches = [json.loads(ligne.exercice.contenu)["intitule"] for ligne in rattaches]
    assert intitules_rattaches == [f"Lecon 24 difficulte {d}" for d in (1, 2, 3)]
