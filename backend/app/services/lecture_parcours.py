"""Lecture du parcours personnalisé par l'apprenant : parcours en cours, exercices, leçon (US41 à US44).

Le backend reste l'autorité : chaque lecture vérifie que le parcours appartient à l'apprenant et que la leçon est
atteinte (règles dans ``services/parcours.py`` et ``services/phase_parcours.py``).

Le ``contenu`` d'un exercice contient la bonne réponse et l'explication : elles ne sortent jamais d'ici. Seuls les
champs de ``CHAMPS_VISIBLES`` sont renvoyés (liste blanche : un champ ajouté plus tard reste caché par défaut).
"""

import json
import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Exercice, Parcours, ParcoursExercice, ProgressionLecon, StatutParcours, TestDiagnostic
from app.schemas.parcours import (
    ExerciceLeconOut,
    ExerciceParcoursOut,
    LeconParcoursOut,
    ParcoursEnCoursOut,
    ProgressionLeconOut,
)
from app.services.parcours import SEUIL_REUSSITE, niveau_estime, referentiel_de_langue
from app.services.phase_parcours import est_lecon_de_revision

logger = logging.getLogger(__name__)

CHAMPS_VISIBLES = (
    "format",
    "consigne",
    "enonce",
    "choix",
    "question",
    "audio_url",
    "texte_audio",
    "phrase",
    "sujet",
    "message_initial",
    "echanges_minimum",
    "mots_minimum",
)


class LeconNonAtteinte(Exception):
    """La leçon demandée est après la leçon atteinte : elle n'est pas encore accessible."""


def parcours_en_cours(db: Session, id_user: int) -> Parcours | None:
    """Le parcours en cours de l'apprenant (le plus récent s'il y en a plusieurs)."""
    return db.scalar(
        select(Parcours)
        .join(TestDiagnostic, TestDiagnostic.id_test == Parcours.id_test)
        .where(Parcours.statut == StatutParcours.EN_COURS, TestDiagnostic.id_apprenant == id_user)
        .order_by(Parcours.date_creation.desc())
        .limit(1)
    )


def statut_exercice(score: int | None) -> str:
    """Statut déduit du score : à faire tant qu'il n'y a pas de réponse, sinon réussi ou à revoir."""
    if score is None:
        return "A_FAIRE"
    return "REUSSI" if score >= SEUIL_REUSSITE else "A_REVOIR"


def progressions_du_parcours(db: Session, parcours: Parcours) -> list[ProgressionLeconOut]:
    """Les leçons notées du parcours, par numéro de leçon (une leçon sans score n'apparaît pas)."""
    lignes = db.scalars(
        select(ProgressionLecon)
        .where(ProgressionLecon.id_parcours == parcours.id_parcours, ProgressionLecon.last_score.is_not(None))
        .order_by(ProgressionLecon.numero_lecon)
    ).all()
    return [
        ProgressionLeconOut(
            numero_lecon=ligne.numero_lecon,
            last_score=ligne.last_score,
            best_score=ligne.best_score,
            is_validated=ligne.is_validated,
        )
        for ligne in lignes
    ]


def vers_parcours_en_cours(parcours: Parcours, progressions: list[ProgressionLeconOut]) -> ParcoursEnCoursOut:
    langue = parcours.langue
    return ParcoursEnCoursOut(
        id_parcours=parcours.id_parcours,
        statut=parcours.statut,
        date_creation=parcours.date_creation,
        code_langue=langue.code,
        libelle_langue=langue.libelle,
        cadre=referentiel_de_langue(langue.code),
        niveaux_cadre=[niveau.code for niveau in langue.niveaux],
        niveau_depart=niveau_estime(parcours.test_diagnostic).code,
        niveau_vise=parcours.niveau_vise.code,
        lecon_atteinte=parcours.lecon_atteinte,
        phase=parcours.phase,
        est_lecon_de_revision=parcours.est_lecon_de_revision,
        # Modules (regroupements de leçons avec titre) : modèle de données encore à décider, liste vide en attendant.
        modules=[],
        progressions=progressions,
    )


def exercices_du_parcours(db: Session, parcours: Parcours) -> list[ExerciceParcoursOut]:
    """Les exercices des leçons atteintes, par leçon. Les leçons futures ne sont jamais renvoyées."""
    lignes = _lignes_jusqu_a_la_lecon_atteinte(db, parcours)
    return [_vers_exercice(ligne) for ligne in lignes]


def lecon_du_parcours(db: Session, parcours: Parcours, numero_lecon: int) -> LeconParcoursOut:
    """Une leçon atteinte et le contenu visible de ses exercices.

    Lève ``LeconNonAtteinte`` si la leçon est après ``lecon_atteinte``.
    """
    if numero_lecon > parcours.lecon_atteinte:
        raise LeconNonAtteinte
    lignes = db.scalars(
        select(ParcoursExercice)
        .options(selectinload(ParcoursExercice.exercice))
        .where(ParcoursExercice.id_parcours == parcours.id_parcours, ParcoursExercice.numero_lecon == numero_lecon)
        .order_by(ParcoursExercice.id_parcours_exercice)
    ).all()
    return LeconParcoursOut(
        numero_lecon=numero_lecon,
        est_lecon_de_revision=est_lecon_de_revision(numero_lecon),
        code_langue=parcours.langue.code,
        exercices=[_vers_exercice_de_lecon(ligne) for ligne in lignes],
    )


def _lignes_jusqu_a_la_lecon_atteinte(db: Session, parcours: Parcours) -> list[ParcoursExercice]:
    return list(
        db.scalars(
            select(ParcoursExercice)
            .options(selectinload(ParcoursExercice.exercice))
            .where(
                ParcoursExercice.id_parcours == parcours.id_parcours,
                ParcoursExercice.numero_lecon <= parcours.lecon_atteinte,
            )
            .order_by(ParcoursExercice.numero_lecon, ParcoursExercice.id_parcours_exercice)
        ).all()
    )


def _champs_communs(ligne: ParcoursExercice) -> dict[str, Any]:
    """Champs partagés par la liste du parcours et la leçon ; l'intitule vient du ``contenu`` (clé ``intitule``)."""
    intitule = _contenu(ligne.exercice).get("intitule")
    return {
        "id_parcours_exercice": ligne.id_parcours_exercice,
        "id_exercice": ligne.id_exercice,
        "numero_lecon": ligne.numero_lecon,
        "type": ligne.exercice.type,
        "difficulte": ligne.exercice.difficulte,
        "intitule": intitule if isinstance(intitule, str) else None,
        "statut": statut_exercice(ligne.score_obtenu),
        "score_obtenu": ligne.score_obtenu,
    }


def _vers_exercice(ligne: ParcoursExercice) -> ExerciceParcoursOut:
    return ExerciceParcoursOut(**_champs_communs(ligne))


def _vers_exercice_de_lecon(ligne: ParcoursExercice) -> ExerciceLeconOut:
    contenu_visible = {cle: valeur for cle, valeur in _contenu(ligne.exercice).items() if cle in CHAMPS_VISIBLES}
    return ExerciceLeconOut(**_champs_communs(ligne), contenu=json.dumps(contenu_visible, ensure_ascii=False))


def _contenu(exercice: Exercice) -> dict[str, Any]:
    """Le ``contenu`` JSON de l'exercice ; un contenu illisible donne un dictionnaire vide (journalisé)."""
    try:
        contenu = json.loads(exercice.contenu)
    except ValueError:
        contenu = None
    if not isinstance(contenu, dict):
        logger.warning("Exercice sans contenu JSON exploitable (exercice=%s)", exercice.id_exercice)
        return {}
    return contenu
