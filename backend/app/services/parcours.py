"""Génération du parcours personnalisé à partir du diagnostic (US36, US38).

Le parcours est créé après la clôture d'une tentative : le niveau final déterministe fixe la cible,
les points faibles issus de l'analyse IA (quand elle est disponible) orientent l'association des
exercices. La génération est idempotente : un seul parcours par tentative de diagnostic.
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models import (
    Exercice,
    Niveau,
    Parcours,
    ParcoursExercice,
    StatutDiagnostic,
    TestDiagnostic,
    TypeExercice,
)

logger = logging.getLogger(__name__)

# Nombre de leçons par palier de niveau ouvert. Sert à positionner la leçon de départ : une tentative
# estimée au rang n (0 = premier niveau ouvert) démarre au début du palier suivant ce rang.
LECONS_PAR_PALIER = 7

# Limite d'exercices associés automatiquement à la leçon de départ lors de la génération.
EXERCICES_MAX_PAR_LECON = 8

_DOMAINES_TYPES: dict[str, TypeExercice] = {
    "grammaire": TypeExercice.GRAMMAIRE,
    "vocabulaire": TypeExercice.VOCABULAIRE,
    "comprehension_ecrite": TypeExercice.COMPREHENSION,
    "lecture": TypeExercice.COMPREHENSION,
    "comprehension_orale": TypeExercice.ECOUTE,
    "ecoute": TypeExercice.ECOUTE,
    "expression_orale": TypeExercice.ORAL,
    "oral": TypeExercice.ORAL,
}


# Un score de 50 ou plus vaut « réussi » (seuil du contrat frontend, à confirmer par le PO).
SEUIL_REUSSITE = 50


def referentiel_de_langue(code_langue: str) -> str:
    """Référentiel de niveaux d'une langue : HSK pour le chinois, CECRL sinon."""
    return "HSK" if code_langue == "zh" else "CECRL"


def niveau_estime(test: TestDiagnostic) -> Niveau:
    """Niveau estimé par le test (le niveau final s'il existe, sinon le niveau de départ du test)."""
    return test.niveau_final or test.niveau


def parcours_de_apprenant(db: Session, id_user: int, id_parcours: int, verrou: bool = False) -> Parcours | None:
    """Le parcours, s'il appartient à l'apprenant ; ``None`` sinon (même réponse qu'un parcours inexistant).

    ``verrou=True`` pose un verrou de ligne (``FOR UPDATE``) jusqu'à la fin de la transaction : les corrections d'un
    même parcours se succèdent alors au lieu de s'entrelacer (progression par leçon, US48).
    """
    requete = (
        select(Parcours)
        .join(TestDiagnostic, TestDiagnostic.id_test == Parcours.id_test)
        .where(Parcours.id_parcours == id_parcours, TestDiagnostic.id_apprenant == id_user)
    )
    if verrou:
        requete = requete.with_for_update(of=Parcours)
    return db.scalar(requete)


def extraire_domaines_faibles(analyse_ia: dict[str, Any] | None) -> list[str]:
    """Retourne les domaines des points faibles de l'analyse IA, sans doublon, dans l'ordre reçu.

    L'analyse est facultative et best-effort : toute structure inattendue est ignorée plutôt que de
    faire échouer la génération du parcours.
    """
    if not isinstance(analyse_ia, dict):
        return []
    resultat = analyse_ia.get("resultat")
    if not isinstance(resultat, dict):
        return []
    points = resultat.get("points_faibles")
    if not isinstance(points, list):
        return []
    domaines: list[str] = []
    for point in points:
        if not isinstance(point, dict):
            continue
        domaine = point.get("domaine")
        if isinstance(domaine, str) and domaine and domaine not in domaines:
            domaines.append(domaine)
    return domaines


def _niveaux_ordonnes(langue_niveaux: list[Niveau]) -> list[Niveau]:
    """Niveaux ouverts triés par code, dans l'ordre pédagogique de l'échelle (A1→C2, HSK 1→HSK 6)."""
    return sorted(langue_niveaux, key=lambda niveau: niveau.code)


def calculer_niveau_vise(niveau_final: Niveau, langue_niveaux: list[Niveau]) -> Niveau:
    """Détermine le niveau visé : le niveau ouvert suivant le niveau estimé, ou le même au maximum."""
    ordonnes = _niveaux_ordonnes(langue_niveaux)
    ids = [niveau.id_niveau for niveau in ordonnes]
    try:
        index = ids.index(niveau_final.id_niveau)
    except ValueError:
        return niveau_final
    if index + 1 < len(ordonnes):
        return ordonnes[index + 1]
    return niveau_final


def calculer_lecon_atteinte(niveau_final: Niveau, langue_niveaux: list[Niveau]) -> int:
    """Calcule la leçon de départ à partir du rang du niveau estimé parmi les niveaux ouverts.

    Règle de positionnement : rang 0 (premier niveau) → leçon 1, rang 1 → leçon 8, etc. La valeur est
    toujours au moins 1 ; la phase (passive/active) en découle côté modèle.
    """
    ordonnes = _niveaux_ordonnes(langue_niveaux)
    ids = [niveau.id_niveau for niveau in ordonnes]
    try:
        rang = ids.index(niveau_final.id_niveau)
    except ValueError:
        rang = 0
    return rang * LECONS_PAR_PALIER + 1


def _types_prioritaires(domaines_faibles: list[str]) -> list[TypeExercice]:
    """Traduit les domaines faibles en types d'exercices prioritaires, sans doublon."""
    types: list[TypeExercice] = []
    for domaine in domaines_faibles:
        type_exercice = _DOMAINES_TYPES.get(domaine)
        if type_exercice is not None and type_exercice not in types:
            types.append(type_exercice)
    return types


def _ids_niveaux_cibles(niveau_final: Niveau, niveau_vise: Niveau, niveaux_ouverts: list[Niveau]) -> set[int]:
    """Niveaux couverts par le parcours initial : du niveau estimé au niveau visé inclus."""
    ordonnes = _niveaux_ordonnes(niveaux_ouverts)
    ids = [niveau.id_niveau for niveau in ordonnes]
    try:
        debut = ids.index(niveau_final.id_niveau)
    except ValueError:
        debut = 0
    try:
        fin = ids.index(niveau_vise.id_niveau)
    except ValueError:
        fin = debut
    if fin < debut:
        fin = debut
    return set(ids[debut : fin + 1])


def selectionner_exercices(
    db: Session,
    id_langue: int,
    niveau_final: Niveau,
    niveau_vise: Niveau,
    niveaux_ouverts: list[Niveau],
    domaines_faibles: list[str],
    numero_lecon: int | None = None,
) -> list[Exercice]:
    """Sélectionne les exercices du catalogue à associer au parcours initial.

    Règle déterministe et best-effort : exercices de la langue, sur les niveaux du niveau estimé au
    niveau visé, en priorisant les types liés aux points faibles quand ils sont connus. Retourne une
    liste vide si le catalogue ne contient aucun exercice éligible.

    Si ``numero_lecon`` est donné, seuls les exercices rattachés à cette leçon ou sans leçon fixée
    (``numero_lecon`` NULL, comportement historique) sont retenus.
    """
    ids_niveaux = _ids_niveaux_cibles(niveau_final, niveau_vise, niveaux_ouverts)
    if not ids_niveaux:
        return []

    filtres = [Exercice.id_langue == id_langue, Exercice.id_niveau.in_(ids_niveaux)]
    if numero_lecon is not None:
        filtres.append(or_(Exercice.numero_lecon.is_(None), Exercice.numero_lecon == numero_lecon))
    candidats = list(db.scalars(select(Exercice).where(*filtres)).all())
    if not candidats:
        return []

    priorites = _types_prioritaires(domaines_faibles)
    ordre_priorite = {type_exercice: index for index, type_exercice in enumerate(priorites)}
    rang_defaut = len(ordre_priorite)
    ids_niveaux_ordonnes = [n.id_niveau for n in _niveaux_ordonnes(niveaux_ouverts)]

    def cle(exercice: Exercice) -> tuple[int, int, int, int]:
        rang_niveau = (
            ids_niveaux_ordonnes.index(exercice.id_niveau)
            if exercice.id_niveau in ids_niveaux_ordonnes
            else len(ids_niveaux_ordonnes)
        )
        return (
            ordre_priorite.get(exercice.type, rang_defaut),
            rang_niveau,
            exercice.difficulte,
            exercice.id_exercice,
        )

    candidats.sort(key=cle)
    return candidats[:EXERCICES_MAX_PAR_LECON]


def exercices_de_lecon(db: Session, id_langue: int, numero_lecon: int) -> list[Exercice]:
    """Les exercices rattachés à une leçon, du plus facile au plus difficile : cet ordre fixe le rang (US48)."""
    return list(
        db.scalars(
            select(Exercice)
            .where(Exercice.id_langue == id_langue, Exercice.numero_lecon == numero_lecon)
            .order_by(Exercice.difficulte, Exercice.id_exercice)
        ).all()
    )


def associer_exercices(
    db: Session, parcours: Parcours, exercices: list[Exercice], numero_lecon: int
) -> list[ParcoursExercice]:
    """Crée les liens parcours↔exercices manquants pour une leçon donnée.

    Les associations existantes ne sont pas dupliquées ; les nouvelles sont ajoutées sans score.
    """
    if not exercices:
        return []

    existants = set(
        db.scalars(
            select(ParcoursExercice.id_exercice).where(
                ParcoursExercice.id_parcours == parcours.id_parcours,
                ParcoursExercice.numero_lecon == numero_lecon,
            )
        ).all()
    )
    crees: list[ParcoursExercice] = []
    for exercice in exercices:
        if exercice.id_exercice in existants:
            continue
        lien = ParcoursExercice(
            id_parcours=parcours.id_parcours,
            id_exercice=exercice.id_exercice,
            numero_lecon=numero_lecon,
        )
        db.add(lien)
        crees.append(lien)
        existants.add(exercice.id_exercice)

    if crees:
        db.flush()
    return crees


def generer_parcours(db: Session, tentative: TestDiagnostic) -> Parcours | None:
    """Crée le parcours d'une tentative terminée et y associe les exercices initiaux.

    Retourne le parcours créé ou existant, ou ``None`` si la tentative n'est pas éligible
    (non terminée ou sans niveau final). L'association des exercices est best-effort : en l'absence de
    catalogue, le parcours est créé sans exercices.
    """
    if tentative.statut != StatutDiagnostic.TERMINE or tentative.niveau_final is None:
        return None

    existant = db.scalar(select(Parcours).where(Parcours.id_test == tentative.id_test))
    if existant is not None:
        return existant

    niveau_final = tentative.niveau_final
    niveaux_ouverts = list(tentative.langue.niveaux)
    niveau_vise = calculer_niveau_vise(niveau_final, niveaux_ouverts)
    lecon_atteinte = calculer_lecon_atteinte(niveau_final, niveaux_ouverts)
    domaines_faibles = extraire_domaines_faibles(tentative.analyse_ia)

    parcours = Parcours(
        id_test=tentative.id_test,
        id_langue=tentative.id_langue,
        id_niveau_vise=niveau_vise.id_niveau,
        lecon_atteinte=lecon_atteinte,
    )
    db.add(parcours)
    db.flush()

    exercices = selectionner_exercices(
        db, tentative.id_langue, niveau_final, niveau_vise, niveaux_ouverts, domaines_faibles, lecon_atteinte
    )
    liens = associer_exercices(db, parcours, exercices, lecon_atteinte)

    logger.info(
        "Parcours généré (tentative=%s, langue=%s, niveau_vise=%s, lecon=%s, exercices=%s, points_faibles=%s)",
        tentative.id_test,
        tentative.id_langue,
        niveau_vise.code,
        lecon_atteinte,
        len(liens),
        domaines_faibles,
    )
    return parcours


def generer_parcours_pour_tentative(id_tentative: int) -> Parcours | None:
    """Point d'entrée hors requête HTTP : ouvre une session dédiée pour générer le parcours.

    Conçu pour être appelé après la clôture du diagnostic (connexion de requête déjà libérée), sans
    jamais propager d'erreur vers l'appelant.
    """
    try:
        with SessionLocal() as db:
            tentative = db.scalar(select(TestDiagnostic).where(TestDiagnostic.id_test == id_tentative))
            if tentative is None:
                return None
            parcours = generer_parcours(db, tentative)
            db.commit()
            return parcours
    except Exception:
        logger.exception("Échec de la génération du parcours (tentative=%s)", id_tentative)
        return None
