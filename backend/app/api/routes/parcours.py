"""Routes du parcours personnalisé (rôle APPRENANT) : correction d'une réponse libre par l'IA (US157-BE).

Les autres routes du contrat (``GET /parcours/en-cours``, exercices, leçon) et la correction déterministe
(US43-BE) restent à créer : voir docs/api/contrat-frontend.md, section « Parcours personnalisé ».
"""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, status

from app.api.deps import DbSession, UtilisateurConnecte
from app.models import Role
from app.schemas.parcours import CorrectionExerciceOut, ReponseExerciceIn
from app.services.correction_exercice import CodeErreurCorrection, ErreurCorrection, corriger_exercice

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
    CodeErreurCorrection.CORRECTION_AUTOMATIQUE_ABSENTE: (
        status.HTTP_501_NOT_IMPLEMENTED,
        "La correction automatique de ce format d'exercice n'est pas encore disponible.",
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


@router.post("/{id_parcours}/exercices/{id_parcours_exercice}/reponse", response_model=CorrectionExerciceOut)
def corriger_reponse(
    id_parcours: Annotated[int, Path(gt=0)],
    id_parcours_exercice: Annotated[int, Path(gt=0)],
    corps: ReponseExerciceIn,
    db: DbSession,
    utilisateur: UtilisateurConnecte,
) -> CorrectionExerciceOut:
    """Corriger la réponse à un exercice du parcours ; seule la rédaction (réponse libre) est prise en charge."""
    if utilisateur.role != Role.APPRENANT:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Seul un apprenant peut répondre à un exercice de son parcours.")
    id_user = utilisateur.id_user
    # Libérer la connexion PostgreSQL avant l'appel HTTP : le service IA peut prendre plusieurs dizaines de secondes.
    db.close()
    try:
        return corriger_exercice(id_user, id_parcours, id_parcours_exercice, corps)
    except ErreurCorrection as erreur:
        statut_http, message = _ERREURS_HTTP[erreur.code]
        raise HTTPException(statut_http, message) from None
