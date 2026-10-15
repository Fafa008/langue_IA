"""Dépendances communes aux routes : session, utilisateur connecté, contrôle du rôle."""

from typing import Annotated

from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import USAGE_ACCES, lire_jeton
from app.models import Role, StatutUtilisateur, Utilisateur

DbSession = Annotated[Session, Depends(get_db)]

_bearer = HTTPBearer(auto_error=False)

SESSION_INVALIDE = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Session expirée ou invalide : reconnectez-vous.",
    headers={"WWW-Authenticate": "Bearer"},
)


def utilisateur_connecte(
    db: DbSession, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]
) -> Utilisateur:
    """401 si le JWT est absent, expiré, invalide, ou si le compte n'est plus actif (session révoquée)."""
    if credentials is None:
        raise SESSION_INVALIDE
    claims = lire_jeton(credentials.credentials, USAGE_ACCES)
    if claims is None:
        raise SESSION_INVALIDE
    utilisateur = db.get(Utilisateur, int(claims["sub"]))
    if utilisateur is None or utilisateur.statut != StatutUtilisateur.ACTIF:
        raise SESSION_INVALIDE
    return utilisateur


UtilisateurConnecte = Annotated[Utilisateur, Depends(utilisateur_connecte)]


def administrateur_connecte(utilisateur: UtilisateurConnecte) -> Utilisateur:
    if utilisateur.role != Role.ADMINISTRATEUR:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès réservé aux administrateurs.")
    return utilisateur


AdministrateurConnecte = Annotated[Utilisateur, Depends(administrateur_connecte)]


class Pagination:
    """Paramètres page / page_size communs aux listes paginées (10, 20 ou 50 par page)."""

    TAILLES = (10, 20, 50)

    def __init__(self, page: Annotated[int, Query(ge=1)] = 1, page_size: Annotated[int, Query()] = 10) -> None:
        if page_size not in self.TAILLES:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "page_size doit valoir 10, 20 ou 50.")
        self.page = page
        self.page_size = page_size

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size
