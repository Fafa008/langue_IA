"""Progression par leçon et avancement de la leçon atteinte (US48).

Règle (docs/api/contrat-frontend.md, « À faire avec US48 ») : une leçon compte 3 exercices, pondérés 30, 30 et 40 selon
leur rang dans la leçon. Le score de leçon est calculé dès que les 3 exercices ont un score ; la leçon est validée à
70 ou plus sur son **meilleur** score. Valider la leçon atteinte fait passer à la suivante.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Parcours, ParcoursExercice, ProgressionLecon
from app.services.parcours import associer_exercices, exercices_de_lecon

# Poids de chaque exercice selon son rang dans la leçon : somme 100.
POIDS_PAR_RANG: dict[int, int] = {1: 30, 2: 30, 3: 40}
SEUIL_VALIDATION = 70


def score_lecon(scores_par_rang: dict[int, int | None]) -> int | None:
    """Score de leçon sur 100, arrondi à l'entier le plus proche (moitié vers le haut).

    Retourne ``None`` tant qu'un des trois rangs n'a pas de score : la leçon n'est pas encore notée.
    """
    if any(scores_par_rang.get(rang) is None for rang in POIDS_PAR_RANG):
        return None
    total = sum(scores_par_rang[rang] * poids for rang, poids in POIDS_PAR_RANG.items())
    return (total + 50) // 100


def mettre_a_jour_progression(db: Session, parcours: Parcours, numero_lecon: int) -> None:
    """Recalcule le score de la leçon après une correction et fait avancer la leçon atteinte si elle est validée.

    À appeler dans la transaction de la correction, après l'enregistrement du score de l'exercice. Sans effet tant que
    les trois premiers exercices de la leçon n'ont pas de score. Le dernier score est toujours remplacé ; le meilleur
    ne fait que monter, donc une leçon validée le reste.
    """
    lignes = db.scalars(
        select(ParcoursExercice)
        .where(ParcoursExercice.id_parcours == parcours.id_parcours, ParcoursExercice.numero_lecon == numero_lecon)
        .order_by(ParcoursExercice.id_parcours_exercice)
    ).all()
    scores_par_rang = {rang: ligne.score_obtenu for rang, ligne in enumerate(lignes, start=1) if rang in POIDS_PAR_RANG}

    dernier = score_lecon(scores_par_rang)
    if dernier is None:
        return

    progression = db.scalar(
        select(ProgressionLecon).where(
            ProgressionLecon.id_parcours == parcours.id_parcours, ProgressionLecon.numero_lecon == numero_lecon
        )
    )
    if progression is None:
        progression = ProgressionLecon(id_parcours=parcours.id_parcours, numero_lecon=numero_lecon)
        db.add(progression)
    progression.last_score = dernier
    progression.best_score = dernier if progression.best_score is None else max(progression.best_score, dernier)
    progression.is_validated = progression.best_score >= SEUIL_VALIDATION

    # Un seul pas à la fois : seule la leçon atteinte peut être validée et faire avancer le parcours.
    if progression.is_validated and numero_lecon == parcours.lecon_atteinte:
        parcours.lecon_atteinte += 1
        # La leçon suivante reçoit ses exercices (rattachés à son numéro), dans l'ordre des rangs.
        suivantes = exercices_de_lecon(db, parcours.id_langue, parcours.lecon_atteinte)
        associer_exercices(db, parcours, suivantes, parcours.lecon_atteinte)
