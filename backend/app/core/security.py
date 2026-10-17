"""Mots de passe (bcrypt) et jetons JWT (connexion, réinitialisation du mot de passe)."""

from datetime import UTC, datetime, timedelta

import bcrypt
from jose import JWTError, jwt

from app.core.config import get_settings

# Usage du jeton : un jeton de réinitialisation ne doit jamais ouvrir une session, et inversement
USAGE_ACCES = "acces"
USAGE_REINITIALISATION = "reinitialisation"


def hacher_mot_de_passe(mot_de_passe: str) -> str:
    sel = bcrypt.gensalt(rounds=get_settings().bcrypt_rounds)
    return bcrypt.hashpw(mot_de_passe.encode(), sel).decode()


def verifier_mot_de_passe(mot_de_passe: str, hache: str) -> bool:
    try:
        return bcrypt.checkpw(mot_de_passe.encode(), hache.encode())
    except ValueError:
        return False


def _creer_jeton(claims: dict, duree: timedelta) -> str:
    settings = get_settings()
    maintenant = datetime.now(UTC)
    return jwt.encode({**claims, "iat": maintenant, "exp": maintenant + duree}, settings.secret_key, settings.algorithm)


def creer_jeton_acces(id_user: int) -> str:
    """Jeton de session ; le frontend ne lit que `exp`."""
    duree = timedelta(minutes=get_settings().access_token_expire_minutes)
    return _creer_jeton({"sub": str(id_user), "usage": USAGE_ACCES}, duree)


def empreinte_mot_de_passe(hache: str) -> str:
    """Fin du hachage actuel : le lien de réinitialisation devient invalide dès que le mot de passe change."""
    return hache[-12:]


def creer_jeton_reinitialisation(id_user: int, hache_actuel: str, duree_minutes: int | None = None) -> str:
    """Par défaut valable reset_token_expire_minutes ; plus longtemps pour l'invitation d'un formateur."""
    duree = timedelta(minutes=duree_minutes or get_settings().reset_token_expire_minutes)
    claims = {"sub": str(id_user), "usage": USAGE_REINITIALISATION, "mdp": empreinte_mot_de_passe(hache_actuel)}
    return _creer_jeton(claims, duree)


def lire_jeton(jeton: str, usage: str) -> dict | None:
    """Claims du jeton s'il est valide, non expiré et du bon usage ; sinon None."""
    settings = get_settings()
    try:
        claims = jwt.decode(jeton, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return None
    if claims.get("usage") != usage or not str(claims.get("sub", "")).isdigit():
        return None
    return claims
