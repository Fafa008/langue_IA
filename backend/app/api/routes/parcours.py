"""Routes du parcours personnalisé (rôle APPRENANT) : lecture du parcours et correction (US41 à US44).

Lecture : ``GET /parcours/en-cours``, ``GET /parcours/{id}/exercices``, ``GET /parcours/{id}/lecons/{n}``
(logique dans ``services/lecture_parcours.py``). Correction : ``POST .../reponse``, réponses courtes sans IA
(US43-BE, ``services/correction_automatique.py``) et réponse libre par l'IA (US157-BE). Voir
docs/api/contrat-frontend.md.
"""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, status

from app.api.deps import DbSession, UtilisateurConnecte
from app.models import Role, Utilisateur
from app.schemas.parcours import (
    CorrectionExerciceOut,
    ExerciceParcoursOut,
    LeconParcoursOut,
    ParcoursEnCoursOut,
    ReponseExerciceIn,
)
from app.services.correction_exercice import CodeErreurCorrection, ErreurCorrection, corriger_exercice
from app.services.lecture_parcours import (
    LeconNonAtteinte,
    exercices_du_parcours,
    lecon_du_parcours,
    parcours_en_cours,
    progressions_du_parcours,
    vers_parcours_en_cours,
)
from app.services.parcours import parcours_de_apprenant

router = APIRouter(prefix="/parcours", tags=["parcours"])

_ERREURS_HTTP = {
    CodeErreurCorrection.PARCOURS_INCONNU: (status.HTTP_404_NOT_FOUND, "Parcours introuvable."),
    CodeErreurCorrection.EXERCICE_INCONNU: (status.HTTP_404_NOT_FOUND, "Exercice introuvable dans ce parcours."),
    CodeErreurCorrection.LECON_NON_ATTEINTE: (
        status.HTTP_403_FORBIDDEN,
        "Cet exercice appartient à une leçon que vous n'avez pas encore atteinte.",
    ),
    CodeErreurCorrection.EXERCICE_MAL_CONFIGURE: (
        status.HTTP_409_CONFLICT,
        "Cet exercice est mal configuré : il ne peut pas être corrigé pour le moment.",
    ),
    CodeErreurCorrection.FORMAT_DIFFERENT: (
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "Le format de la réponse ne correspond pas à celui de l'exercice.",
    ),
    CodeErreurCorrection.IA_NON_DISPONIBLE_POUR_LANGUE: (
        status.HTTP_503_SERVICE_UNAVAILABLE,
        "Le professeur IA ne corrige pas encore cette langue ou ce niveau.",
    ),
    CodeErreurCorrection.IA_TIMEOUT: (
        status.HTTP_504_GATEWAY_TIMEOUT,
        "La correction de votre réponse prend plus de temps que prévu. Réessayez dans un instant.",
    ),
    CodeErreurCorrection.IA_INDISPONIBLE: (
        status.HTTP_503_SERVICE_UNAVAILABLE,
        "Le professeur IA est momentanément indisponible. Réessayez dans un instant.",
    ),
    CodeErreurCorrection.IA_REPONSE_INVALIDE: (
        status.HTTP_502_BAD_GATEWAY,
        "La correction n'a pas pu être obtenue. Réessayez dans un instant.",
    ),
}


def _exiger_apprenant(utilisateur: Utilisateur) -> None:
    if utilisateur.role != Role.APPRENANT:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Seul un apprenant peut consulter ou faire son parcours.")


@router.get("/en-cours", response_model=ParcoursEnCoursOut)
def lire_parcours_en_cours(db: DbSession, utilisateur: UtilisateurConnecte) -> ParcoursEnCoursOut:
    """Le parcours en cours de l'apprenant connecté ; 404 s'il n'a pas encore de parcours."""
    _exiger_apprenant(utilisateur)
    parcours = parcours_en_cours(db, utilisateur.id_user)
    if parcours is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Aucun parcours en cours. Passez le test de positionnement.")
    return vers_parcours_en_cours(parcours, progressions_du_parcours(db, parcours))


@router.get("/{id_parcours}/exercices", response_model=list[ExerciceParcoursOut])
def lire_exercices(
    id_parcours: Annotated[int, Path(gt=0)], db: DbSession, utilisateur: UtilisateurConnecte
) -> list[ExerciceParcoursOut]:
    """Les exercices des leçons atteintes du parcours, avec leur statut."""
    _exiger_apprenant(utilisateur)
    parcours = parcours_de_apprenant(db, utilisateur.id_user, id_parcours)
    if parcours is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Parcours introuvable.")
    return exercices_du_parcours(db, parcours)


@router.get("/{id_parcours}/lecons/{numero_lecon}", response_model=LeconParcoursOut)
def lire_lecon(
    id_parcours: Annotated[int, Path(gt=0)],
    numero_lecon: Annotated[int, Path(gt=0)],
    db: DbSession,
    utilisateur: UtilisateurConnecte,
) -> LeconParcoursOut:
    """Une leçon atteinte et le contenu visible de ses exercices (sans la bonne réponse)."""
    _exiger_apprenant(utilisateur)
    parcours = parcours_de_apprenant(db, utilisateur.id_user, id_parcours)
    if parcours is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Parcours introuvable.")
    try:
        return lecon_du_parcours(db, parcours, numero_lecon)
    except LeconNonAtteinte:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Cette leçon n'est pas encore accessible : vous ne l'avez pas encore atteinte."
        ) from None


@router.post("/{id_parcours}/exercices/{id_parcours_exercice}/reponse", response_model=CorrectionExerciceOut)
def corriger_reponse(
    id_parcours: Annotated[int, Path(gt=0)],
    id_parcours_exercice: Annotated[int, Path(gt=0)],
    corps: ReponseExerciceIn,
    db: DbSession,
    utilisateur: UtilisateurConnecte,
) -> CorrectionExerciceOut:
    """Corriger la réponse à un exercice du parcours : sans IA pour les réponses courtes, par l'IA pour la rédaction."""
    _exiger_apprenant(utilisateur)
    id_user = utilisateur.id_user
    # Libérer la connexion PostgreSQL avant l'appel HTTP : le service IA peut prendre plusieurs dizaines de secondes.
    db.close()
    try:
        return corriger_exercice(id_user, id_parcours, id_parcours_exercice, corps)
    except ErreurCorrection as erreur:
        statut_http, message = _ERREURS_HTTP[erreur.code]
        raise HTTPException(statut_http, message) from None
