"""Recommandations de parcours : préparation, appel IA, revalidation et persistance (REC-03).

Le backend reste l'autorité : il lit les points faibles de l'analyse diagnostique persistée, construit une requête
sans donnée identifiante, appelle le service IA **hors de toute connexion PostgreSQL**, revalide la proposition
(données et cohérence avec la demande) puis enregistre le résultat sur ``parcours.recommandation_ia``.

Toute panne, langue hors contrat ou réponse incohérente dégrade en statut public ``PARTIEL`` avec une liste vide :
l'apprenant ne voit jamais d'erreur technique. L'empreinte de la requête rend le calcul idempotent ; un résultat
partiel n'est toutefois pas mis en cache, afin qu'un rafraîchissement explicite puisse retenter après une panne.
"""

import hashlib
import json
import logging
from dataclasses import dataclass
from typing import Any
from uuid import uuid4

from pydantic import ValidationError
from sqlalchemy import select

from app.core.database import SessionLocal
from app.models import Parcours
from app.schemas.ia import (
    NIVEAUX_IA,
    TYPE_EXERCICE_PAR_DOMAINE_IA,
    ContexteApprenantIA,
    EntreeRecommandationIA,
    PointFaibleIA,
    ReponseRecommandationIA,
    RequeteRecommandationIA,
    ResultatRecommandationIA,
)
from app.schemas.parcours import RecommandationActionOut, RecommandationParcoursOut
from app.services.analyse_diagnostic import LANGUES_IA
from app.services.ia import ErreurServiceIA, recommander_actions
from app.services.parcours import niveau_estime, parcours_de_apprenant, referentiel_de_langue

logger = logging.getLogger(__name__)

RESUME_PARTIEL = "Les recommandations personnalisées ne sont pas disponibles pour le moment."
RECOMMANDATIONS_MAX = 5


class ParcoursIntrouvable(Exception):
    """Le parcours n'existe pas ou n'appartient pas à l'apprenant (course entre le contrôle et l'appel)."""


@dataclass(frozen=True)
class _Donnees:
    """Valeurs détachées de la session : contexte public toujours disponible, entrée IA facultative."""

    public: dict[str, str]
    contexte: dict[str, Any] | None
    entree: dict[str, Any] | None


def _empreinte(contexte: dict[str, Any], entree: dict[str, Any]) -> str:
    """Empreinte stable de la requête, sans ``request_id`` aléatoire ni version d'agent."""
    brut = {"contexte": contexte, "entree": entree}
    canonique = json.dumps(brut, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return "sha256:" + hashlib.sha256(canonique.encode("utf-8")).hexdigest()


def _points_exploitables(analyse_ia: dict[str, Any] | None) -> list[PointFaibleIA]:
    """Extraire les points faibles utilisables de l'analyse IA, sans doublon de domaine.

    ``expression_ecrite`` est écarté : aucun type d'exercice ne lui est associé. Une structure inattendue est
    ignorée plutôt que de faire échouer la demande de recommandation.
    """
    if not isinstance(analyse_ia, dict):
        return []
    resultat = analyse_ia.get("resultat")
    if not isinstance(resultat, dict):
        return []
    points = resultat.get("points_faibles")
    if not isinstance(points, list):
        return []

    retenus: list[PointFaibleIA] = []
    vus: set[str] = set()
    for brut in points:
        if not isinstance(brut, dict):
            continue
        domaine = brut.get("domaine")
        if domaine not in TYPE_EXERCICE_PAR_DOMAINE_IA or domaine in vus:
            continue
        try:
            point = PointFaibleIA.model_validate(brut)
        except ValidationError:
            logger.warning("Point faible IA illisible ignoré (domaine=%s)", domaine)
            continue
        retenus.append(point)
        vus.add(domaine)
        if len(retenus) >= RECOMMANDATIONS_MAX:
            break
    return retenus


def _preparer(parcours: Parcours) -> _Donnees:
    """Construire les données de la demande ; aucun appel n'est possible si un garde-fou s'applique."""
    test = parcours.test_diagnostic
    code_langue = parcours.langue.code
    referentiel = referentiel_de_langue(code_langue)
    niveau_cible = parcours.niveau_vise.code
    public = {"code_langue": code_langue, "referentiel": referentiel, "niveau_cible": niveau_cible}

    if code_langue not in LANGUES_IA or niveau_cible not in NIVEAUX_IA[referentiel]:
        logger.info(
            "Recommandation sans appel : langue ou niveau hors contrat (parcours=%s, langue=%s)",
            parcours.id_parcours,
            code_langue,
        )
        return _Donnees(public=public, contexte=None, entree=None)

    points = _points_exploitables(test.analyse_ia)
    if not points:
        logger.info("Recommandation sans appel : aucun point faible exploitable (parcours=%s)", parcours.id_parcours)
        return _Donnees(public=public, contexte=None, entree=None)

    contexte = {
        "code_langue": code_langue,
        "referentiel": referentiel,
        "niveau_preliminaire": niveau_estime(test).code,
        "lecon_atteinte": parcours.lecon_atteinte,
    }
    entree = {
        "points_faibles": [point.model_dump(mode="json") for point in points],
        "niveau_vise": niveau_cible,
    }
    return _Donnees(public=public, contexte=contexte, entree=entree)


def verifier_recommandation(resultat: ResultatRecommandationIA, requete: RequeteRecommandationIA) -> bool:
    """La proposition concerne la langue, le référentiel, le niveau visé et les domaines demandés."""
    if resultat.code_langue != requete.contexte.code_langue:
        return False
    if resultat.referentiel != requete.contexte.referentiel:
        return False
    if resultat.niveau_cible != requete.entree.niveau_vise:
        return False
    demandes = {point.domaine for point in requete.entree.points_faibles}
    return all(action.domaine in demandes for action in resultat.recommandations)


def vers_recommandation_publique(document: dict[str, Any] | None) -> RecommandationParcoursOut | None:
    """Relire la partie publique d'une recommandation persistée ; un document illisible est ignoré."""
    if not isinstance(document, dict):
        return None
    try:
        return RecommandationParcoursOut.model_validate(document["public"])
    except (KeyError, TypeError, ValidationError):
        logger.warning("Recommandation persistée illisible")
        return None


def _vers_public(contexte: dict[str, str], enveloppe: ReponseRecommandationIA | None) -> RecommandationParcoursOut:
    """Construire la réponse publique : vide et sans code technique quand l'IA n'a pas répondu."""
    if enveloppe is None:
        return RecommandationParcoursOut(
            statut="PARTIEL",
            code_langue=contexte["code_langue"],
            referentiel=contexte["referentiel"],  # type: ignore[arg-type]
            niveau_cible=contexte["niveau_cible"],
            recommandations=[],
            resume=RESUME_PARTIEL,
            confiance=0.0,
        )
    resultat = enveloppe.resultat
    return RecommandationParcoursOut(
        statut="COMPLET",
        code_langue=resultat.code_langue,
        referentiel=resultat.referentiel,
        niveau_cible=resultat.niveau_cible,
        recommandations=[RecommandationActionOut(**action.model_dump()) for action in resultat.recommandations],
        resume=resultat.resume,
        confiance=resultat.confiance,
    )


def recommander_pour_parcours(id_user: int, id_parcours: int) -> RecommandationParcoursOut:
    """Obtenir la recommandation du parcours, en la réutilisant si la demande n'a pas changé."""
    with SessionLocal() as db:
        parcours = parcours_de_apprenant(db, id_user, id_parcours)
        if parcours is None:
            raise ParcoursIntrouvable
        donnees = _preparer(parcours)
        document = parcours.recommandation_ia
        empreinte = (
            _empreinte(donnees.contexte, donnees.entree)
            if donnees.contexte is not None and donnees.entree is not None
            else None
        )
        if isinstance(document, dict) and document.get("empreinte") == empreinte:
            en_cache = vers_recommandation_publique(document)
            # Un résultat partiel n'est pas mis en cache : le rafraîchissement explicite doit pouvoir retenter.
            if en_cache is not None and en_cache.statut == "COMPLET":
                return en_cache

    requete: RequeteRecommandationIA | None = None
    enveloppe: ReponseRecommandationIA | None = None
    code_technique: str | None = "sans_appel"
    if donnees.contexte is not None and donnees.entree is not None:
        code_technique = None
        try:
            requete = RequeteRecommandationIA(
                request_id=uuid4(),
                contexte=ContexteApprenantIA.model_validate(donnees.contexte),
                entree=EntreeRecommandationIA.model_validate(donnees.entree),
            )
        except ValidationError:
            logger.warning("Recommandation impossible : requête invalide (parcours=%s)", id_parcours)
            code_technique = "requete_invalide"

    if requete is not None:
        try:
            enveloppe = recommander_actions(requete)
        except ErreurServiceIA as erreur:
            code_technique = erreur.code
            logger.warning("Recommandation IA indisponible (parcours=%s, code=%s)", id_parcours, erreur.code)
        else:
            if not verifier_recommandation(enveloppe.resultat, requete):
                logger.warning("Recommandation IA incohérente refusée (parcours=%s)", id_parcours)
                enveloppe = None
                code_technique = "reponse_invalide"

    public = _vers_public(donnees.public, enveloppe)
    document_a_enregistrer: dict[str, Any] = {
        "empreinte": empreinte,
        "public": public.model_dump(mode="json"),
        "enveloppe_ia": enveloppe.model_dump(mode="json") if enveloppe is not None else None,
        "code_technique": code_technique,
    }
    with SessionLocal() as db:
        parcours = db.scalar(select(Parcours).where(Parcours.id_parcours == id_parcours).with_for_update())
        if parcours is not None:
            parcours.recommandation_ia = document_a_enregistrer
            db.commit()

    return public
