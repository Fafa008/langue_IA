"""Correction d'une réponse d'un exercice du parcours.

Réponse libre (rédaction) : par le service IA (US157-BE). Réponses courtes (QCM, texte à trous, écoute, prononciation) :
corrigées par le backend, sans IA, par ``services/correction_automatique.py`` (US43-BE).

Le backend reste l'autorité : il vérifie que l'exercice appartient bien au parcours de l'apprenant et que sa leçon
est atteinte, construit le contexte (langue, référentiel, niveau, **leçon atteinte**), appelle le service IA **hors
de toute connexion PostgreSQL**, revalide le feedback à la frontière puis enregistre la réponse, le score et
l'enveloppe IA sur la ligne ``parcours_exercice``. Une panne de l'IA n'enregistre rien : le frontend garde la
réponse et propose de la renvoyer (502, 503 ou 504).

Contrôles du feedback, en plus du schéma : la leçon et la phase renvoyées sont celles transmises (règle
``services/phase_parcours.py``), et chaque extrait relevé figure dans la réponse de l'apprenant.
Les journaux ne contiennent que des identifiants techniques, jamais la réponse.
"""

import json
import logging
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any
from uuid import uuid4

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models import Parcours, ParcoursExercice
from app.schemas.ia import ContexteApprenantIA, EntreeCorrectionIA, RequeteCorrectionIA, ResultatCorrectionIA
from app.schemas.parcours import CorrectionExerciceOut, ErreurReleveeOut, ReponseExerciceIn
from app.services.analyse_diagnostic import LANGUES_IA, NIVEAUX_IA
from app.services.correction_automatique import FORMATS_AUTOMATIQUES, corriger_automatiquement
from app.services.ia import ErreurServiceIA, corriger_reponse_libre
from app.services.parcours import SEUIL_REUSSITE, niveau_estime, parcours_de_apprenant, referentiel_de_langue
from app.services.phase_parcours import phase_parcours
from app.services.progression_lecon import mettre_a_jour_progression

logger = logging.getLogger(__name__)


class CodeErreurCorrection(StrEnum):
    PARCOURS_INCONNU = "parcours_inconnu"
    EXERCICE_INCONNU = "exercice_inconnu"
    LECON_NON_ATTEINTE = "lecon_non_atteinte"
    EXERCICE_MAL_CONFIGURE = "exercice_mal_configure"
    FORMAT_DIFFERENT = "format_different"
    IA_NON_DISPONIBLE_POUR_LANGUE = "ia_non_disponible_pour_langue"
    IA_TIMEOUT = "ia_timeout"
    IA_INDISPONIBLE = "ia_indisponible"
    IA_REPONSE_INVALIDE = "ia_reponse_invalide"


class ErreurCorrection(Exception):
    def __init__(self, code: CodeErreurCorrection) -> None:
        self.code = code
        super().__init__(code.value)


def _code_pour_erreur_ia(code: str) -> CodeErreurCorrection:
    """Traduire l'échec technique de l'appel en statut lisible par le frontend (504, 503 ou 502)."""
    if code in ("timeout", "http_504"):
        return CodeErreurCorrection.IA_TIMEOUT
    if code in ("non_configure", "indisponible", "http_503", "http_429"):
        return CodeErreurCorrection.IA_INDISPONIBLE
    return CodeErreurCorrection.IA_REPONSE_INVALIDE


def _normaliser(texte: str) -> str:
    return " ".join(texte.split()).casefold()


def _verifier_exercice(
    db: Session, id_user: int, id_parcours: int, id_parcours_exercice: int, format_reponse: str
) -> tuple[Parcours, ParcoursExercice, dict[str, Any]]:
    """Contrôles communs à toutes les corrections : parcours de l'apprenant, exercice du parcours, leçon atteinte,
    contenu exploitable et format attendu. Retourne le parcours, la ligne d'exercice et le contenu JSON."""
    # Verrou sur le parcours d'abord : même ordre (parcours puis exercice) dans les deux chemins de correction
    parcours = parcours_de_apprenant(db, id_user, id_parcours, verrou=True)
    if parcours is None:
        raise ErreurCorrection(CodeErreurCorrection.PARCOURS_INCONNU)
    ligne = db.scalar(
        select(ParcoursExercice).where(
            ParcoursExercice.id_parcours_exercice == id_parcours_exercice,
            ParcoursExercice.id_parcours == id_parcours,
        )
    )
    if ligne is None:
        raise ErreurCorrection(CodeErreurCorrection.EXERCICE_INCONNU)
    if ligne.numero_lecon > parcours.lecon_atteinte:
        raise ErreurCorrection(CodeErreurCorrection.LECON_NON_ATTEINTE)

    try:
        contenu = json.loads(ligne.exercice.contenu)
    except ValueError:
        contenu = None
    if not isinstance(contenu, dict) or "format" not in contenu:
        logger.warning("Exercice sans contenu JSON exploitable (exercice=%s)", ligne.id_exercice)
        raise ErreurCorrection(CodeErreurCorrection.EXERCICE_MAL_CONFIGURE)
    if contenu["format"] != format_reponse:
        raise ErreurCorrection(CodeErreurCorrection.FORMAT_DIFFERENT)
    return parcours, ligne, contenu


def _corriger_automatiquement(
    id_user: int, id_parcours: int, id_parcours_exercice: int, corps: ReponseExerciceIn
) -> CorrectionExerciceOut:
    """Correction sans IA (US43-BE), enregistrée dans une seule transaction. Une réponse remplace la précédente."""
    with SessionLocal() as db:
        parcours, ligne, contenu = _verifier_exercice(db, id_user, id_parcours, id_parcours_exercice, corps.format)
        try:
            resultat = corriger_automatiquement(contenu, corps.reponse)
        except ValueError:
            logger.warning("Exercice sans réponses acceptées (exercice=%s)", ligne.id_exercice)
            raise ErreurCorrection(CodeErreurCorrection.EXERCICE_MAL_CONFIGURE) from None
        ligne.score_obtenu = resultat.score_obtenu
        ligne.reponse_apprenant = corps.reponse
        ligne.feedback_ia = None
        ligne.date_reponse = datetime.now(UTC)
        mettre_a_jour_progression(db, parcours, ligne.numero_lecon)
        db.commit()
    return resultat


def _preparer(
    id_user: int, id_parcours: int, id_parcours_exercice: int, corps: ReponseExerciceIn
) -> RequeteCorrectionIA:
    """Contrôler l'accès et l'exercice, puis construire la requête IA à partir de valeurs détachées de la session."""
    with SessionLocal() as db:
        parcours, ligne, contenu = _verifier_exercice(db, id_user, id_parcours, id_parcours_exercice, corps.format)
        code_langue = parcours.langue.code
        referentiel = referentiel_de_langue(code_langue)
        niveau = niveau_estime(parcours.test_diagnostic).code
        if code_langue not in LANGUES_IA or niveau not in NIVEAUX_IA[referentiel]:
            raise ErreurCorrection(CodeErreurCorrection.IA_NON_DISPONIBLE_POUR_LANGUE)

        try:
            return RequeteCorrectionIA(
                request_id=uuid4(),
                contexte=ContexteApprenantIA(
                    code_langue=code_langue,
                    referentiel=referentiel,
                    niveau_preliminaire=niveau,
                    lecon_atteinte=parcours.lecon_atteinte,
                ),
                entree=EntreeCorrectionIA(
                    consigne=contenu.get("consigne"),
                    enonce=contenu.get("enonce"),
                    mots_minimum=contenu.get("mots_minimum", 30),
                    reponse=corps.reponse,
                ),
            )
        except ValidationError:
            logger.warning("Exercice de rédaction incomplet (exercice=%s)", ligne.id_exercice)
            raise ErreurCorrection(CodeErreurCorrection.EXERCICE_MAL_CONFIGURE) from None


def verifier_feedback(resultat: ResultatCorrectionIA, requete: RequeteCorrectionIA) -> bool:
    """Le feedback concerne la leçon et la phase transmises, et ne cite que des passages de la réponse."""
    lecon = requete.contexte.lecon_atteinte
    if lecon is None or resultat.lecon_atteinte != lecon or resultat.phase != phase_parcours(lecon).value:
        return False
    texte = _normaliser(requete.entree.reponse)
    return all(_normaliser(erreur.extrait) in texte for erreur in resultat.erreurs)


def corriger_exercice(
    id_user: int, id_parcours: int, id_parcours_exercice: int, corps: ReponseExerciceIn
) -> CorrectionExerciceOut:
    """Corriger la réponse : sans IA pour les réponses courtes, par le service IA pour la rédaction."""
    if corps.format in FORMATS_AUTOMATIQUES:
        return _corriger_automatiquement(id_user, id_parcours, id_parcours_exercice, corps)
    requete = _preparer(id_user, id_parcours, id_parcours_exercice, corps)

    try:
        enveloppe = corriger_reponse_libre(requete)
    except ErreurServiceIA as erreur:
        logger.warning("Correction IA indisponible (exercice=%s, code=%s)", id_parcours_exercice, erreur.code)
        raise ErreurCorrection(_code_pour_erreur_ia(erreur.code)) from None

    resultat = enveloppe.resultat
    if not verifier_feedback(resultat, requete):
        logger.warning("Feedback IA incohérent refusé (exercice=%s)", id_parcours_exercice)
        raise ErreurCorrection(CodeErreurCorrection.IA_REPONSE_INVALIDE)

    with SessionLocal() as db:
        # Même ordre que la correction automatique : le parcours est verrouillé avant l'exercice
        parcours = db.scalar(select(Parcours).where(Parcours.id_parcours == id_parcours).with_for_update(of=Parcours))
        ligne = db.scalar(
            select(ParcoursExercice)
            .where(ParcoursExercice.id_parcours_exercice == id_parcours_exercice)
            .with_for_update()
        )
        if parcours is None:
            raise ErreurCorrection(CodeErreurCorrection.PARCOURS_INCONNU)
        if ligne is None:
            raise ErreurCorrection(CodeErreurCorrection.EXERCICE_INCONNU)
        # L'apprenant peut refaire un exercice : la dernière correction remplace la précédente.
        ligne.score_obtenu = resultat.score
        ligne.reponse_apprenant = requete.entree.reponse
        ligne.feedback_ia = enveloppe.model_dump(mode="json")
        ligne.date_reponse = datetime.now(UTC)
        mettre_a_jour_progression(db, parcours, ligne.numero_lecon)
        db.commit()

    return CorrectionExerciceOut(
        statut="REUSSI" if resultat.score >= SEUIL_REUSSITE else "A_REVOIR",
        score_obtenu=resultat.score,
        mode_correction="IA",
        commentaire=resultat.commentaire,
        points_forts=resultat.points_forts,
        erreurs=[ErreurReleveeOut(**erreur.model_dump()) for erreur in resultat.erreurs],
        conseil=resultat.conseil,
        phase=resultat.phase,
        lecon_atteinte=resultat.lecon_atteinte,
        reformulation=resultat.reformulation,
    )
