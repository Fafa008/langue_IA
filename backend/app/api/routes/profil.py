"""Profil de l'utilisateur connecté : lecture, modification, photo."""

from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select

from app.api.deps import DbSession, permission_requise
from app.core.security import hacher_mot_de_passe, verifier_mot_de_passe
from app.models import Utilisateur
from app.schemas.utilisateurs import ProfilUpdate, UtilisateurOut
from app.services import photos

router = APIRouter(prefix="/users/me", tags=["profil"])
LectureProfil = Annotated[Utilisateur, Depends(permission_requise("profile:read"))]
ModificationProfil = Annotated[Utilisateur, Depends(permission_requise("profile:write"))]


@router.get("", response_model=UtilisateurOut)
def lire_profil(utilisateur: LectureProfil) -> Utilisateur:
    return utilisateur


@router.patch("", response_model=UtilisateurOut)
def modifier_profil(donnees: ProfilUpdate, utilisateur: ModificationProfil, db: DbSession) -> Utilisateur:
    """Tout est vérifié avant d'écrire : en cas d'erreur, rien n'est modifié."""
    champs = donnees.model_dump(exclude_unset=True)

    if "mot_de_passe" in champs and champs["mot_de_passe"] is not None:
        actuel = champs.get("mot_de_passe_actuel") or ""
        # 400 et non 401 : un 401 signifierait « session expirée » et déconnecterait l'utilisateur
        if not verifier_mot_de_passe(actuel, utilisateur.mot_de_passe):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Le mot de passe actuel est incorrect.")
        if champs["mot_de_passe"] == actuel:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, "Le nouveau mot de passe doit être différent de l'actuel."
            )

    email = champs.get("email")
    if email and email != utilisateur.email:
        pris = db.scalar(select(Utilisateur.id_user).where(Utilisateur.email == email))
        if pris is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "Cette adresse e-mail est déjà utilisée par un autre compte.")

    for champ in ("prenom", "nom", "email"):
        if champs.get(champ):
            setattr(utilisateur, champ, champs[champ])
    if "telephone" in champs:
        utilisateur.telephone = champs["telephone"]
    if champs.get("mot_de_passe"):
        utilisateur.mot_de_passe = hacher_mot_de_passe(champs["mot_de_passe"])
    db.commit()
    return utilisateur


@router.post("/photo", response_model=UtilisateurOut)
async def envoyer_photo(
    photo: Annotated[UploadFile, File(description="JPEG, PNG ou WebP, 2 Mo au plus")],
    utilisateur: ModificationProfil,
    db: DbSession,
) -> Utilisateur:
    ancienne = utilisateur.photo_url
    utilisateur.photo_url = await photos.enregistrer_photo(utilisateur.id_user, photo)
    db.commit()
    photos.supprimer_photo(ancienne)
    return utilisateur


@router.delete("/photo", response_model=UtilisateurOut)
def supprimer_photo(utilisateur: ModificationProfil, db: DbSession) -> Utilisateur:
    ancienne = utilisateur.photo_url
    utilisateur.photo_url = None
    db.commit()
    photos.supprimer_photo(ancienne)
    return utilisateur
