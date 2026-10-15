"""Schémas Utilisateur, Apprenant, authentification et profil (docs/api/contrat-frontend.md)."""

from datetime import date, datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, BeforeValidator, ConfigDict, Field

from app.models import Role, StatutUtilisateur
from app.models.utilisateurs import Utilisateur
from app.schemas import regles

Email = Annotated[str, AfterValidator(regles.valider_email)]
Prenom = Annotated[str, AfterValidator(lambda v: regles.valider_nom_personne(v, "prénom"))]
Nom = Annotated[str, AfterValidator(lambda v: regles.valider_nom_personne(v, "nom"))]
MotDePasse = Annotated[str, AfterValidator(regles.valider_mot_de_passe)]
Telephone = Annotated[str | None, BeforeValidator(regles.normaliser_telephone)]
DateNaissance = Annotated[date, AfterValidator(regles.valider_date_naissance)]


class UtilisateurOut(BaseModel):
    """Objet `Utilisateur` : jamais le mot de passe."""

    model_config = ConfigDict(from_attributes=True)

    id_user: int
    nom: str
    prenom: str
    email: str
    telephone: str | None
    role: Role
    statut: StatutUtilisateur
    date_inscription: datetime
    photo_url: str | None


class ApprenantOut(UtilisateurOut):
    """Utilisateur + attributs de la classe Apprenant."""

    date_naissance: date | None
    pays: str | None
    ville: str | None
    objectif: str | None

    @classmethod
    def depuis(cls, utilisateur: Utilisateur) -> "ApprenantOut":
        apprenant = utilisateur.apprenant
        return cls(
            **UtilisateurOut.model_validate(utilisateur).model_dump(),
            date_naissance=apprenant.date_naissance if apprenant else None,
            pays=apprenant.pays if apprenant else None,
            ville=apprenant.ville if apprenant else None,
            objectif=apprenant.objectif if apprenant else None,
        )


# ----- Authentification -----


class LoginIn(BaseModel):
    email: Annotated[str, AfterValidator(lambda v: v.strip().lower())]
    mot_de_passe: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    utilisateur: UtilisateurOut


class RegisterIn(BaseModel):
    prenom: Prenom
    nom: Nom
    email: Email
    mot_de_passe: MotDePasse
    date_naissance: DateNaissance
    # Codes de langue (« en », « zh ») : au moins une
    langues: Annotated[list[str], Field(min_length=1)]
    id_formule: int


class ForgotPasswordIn(BaseModel):
    email: Annotated[str, AfterValidator(lambda v: v.strip().lower())]


class ResetPasswordIn(BaseModel):
    token: str
    nouveau_mot_de_passe: MotDePasse


# ----- Profil de l'utilisateur connecté -----


class ProfilUpdate(BaseModel):
    """Le rôle et le statut ne sont pas modifiables par cette route (champs ignorés s'ils sont envoyés)."""

    prenom: Prenom | None = None
    nom: Nom | None = None
    email: Email | None = None
    telephone: Telephone = None
    mot_de_passe: MotDePasse | None = None
    mot_de_passe_actuel: str | None = None


# ----- Administration -----


class UtilisateurAdminUpdate(BaseModel):
    """Modification partielle par un administrateur : seuls les champs envoyés changent."""

    prenom: Prenom | None = None
    nom: Nom | None = None
    email: Email | None = None
    telephone: Telephone = None
    role: Role | None = None
    statut: StatutUtilisateur | None = None


class PageUtilisateurs(BaseModel):
    items: list[UtilisateurOut]
    total: int
    page: int
    page_size: int
