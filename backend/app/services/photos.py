"""Photos de profil : contrôle du fichier, enregistrement dans MEDIA_DIR/photos, servi sous /media."""

import time
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import get_settings

# Signatures des formats acceptés (le type annoncé par le navigateur ne suffit pas)
SIGNATURES = {
    b"\xff\xd8\xff": "jpg",
    b"\x89PNG\r\n\x1a\n": "png",
}

PREFIXE_URL = "/media/photos/"


def _extension(debut: bytes) -> str | None:
    for signature, extension in SIGNATURES.items():
        if debut.startswith(signature):
            return extension
    if debut[:4] == b"RIFF" and debut[8:12] == b"WEBP":
        return "webp"
    return None


def dossier_photos() -> Path:
    dossier = get_settings().media_dir / "photos"
    dossier.mkdir(parents=True, exist_ok=True)
    return dossier


async def enregistrer_photo(id_user: int, fichier: UploadFile) -> str:
    """Vérifie et enregistre la photo ; renvoie son chemin public (« /media/photos/7-1700000000.jpg »)."""
    taille_max = get_settings().photo_taille_max
    contenu = await fichier.read(taille_max + 1)
    if len(contenu) > taille_max:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "L'image dépasse 2 Mo.")
    extension = _extension(contenu[:12])
    if extension is None:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Format refusé : JPEG, PNG ou WebP uniquement.")

    # Suffixe horodaté : le navigateur ne réaffiche pas l'ancienne image depuis son cache
    nom = f"{id_user}-{int(time.time() * 1000)}.{extension}"
    (dossier_photos() / nom).write_bytes(contenu)
    return PREFIXE_URL + nom


def supprimer_photo(photo_url: str | None) -> None:
    """Supprime le fichier d'une photo servie par le backend (une URL externe est ignorée)."""
    if not photo_url or not photo_url.startswith(PREFIXE_URL):
        return
    nom = Path(photo_url.removeprefix(PREFIXE_URL)).name
    (dossier_photos() / nom).unlink(missing_ok=True)
