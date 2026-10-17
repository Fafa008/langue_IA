"""Schémas Formateur (docs/api/contrat-frontend.md, section « Formateurs »)."""

from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, Field

from app.models import StatutUtilisateur
from app.models.utilisateurs import Utilisateur
from app.schemas import regles
from app.schemas.pedagogie import LangueOut
from app.schemas.utilisateurs import Email, Nom, Prenom, Telephone, UtilisateurOut

# Valeurs proposées par le frontend (la colonne type_contrat reste un texte libre en base)
TypeContrat = Literal["CDI", "CDD", "VACATAIRE", "PRESTATAIRE"]
Certifications = Annotated[str | None, AfterValidator(regles.valider_certifications)]
# Au moins une langue enseignée (le frontend l'impose aussi)
IdLangues = Annotated[list[int], Field(min_length=1)]


class FormateurOut(UtilisateurOut):
    """Utilisateur + attributs de la classe Formateur et ses langues enseignées."""

    type_contrat: str | None
    certifications: str | None
    langues_enseignees: list[LangueOut]

    @classmethod
    def depuis(cls, utilisateur: Utilisateur) -> "FormateurOut":
        formateur = utilisateur.formateur
        langues = formateur.langues_enseignees if formateur else []
        return cls(
            **UtilisateurOut.model_validate(utilisateur).model_dump(),
            type_contrat=formateur.type_contrat if formateur else None,
            certifications=formateur.certifications if formateur else None,
            langues_enseignees=[LangueOut.model_validate(langue) for langue in langues],
        )


class FormateurCreate(BaseModel):
    prenom: Prenom
    nom: Nom
    email: Email
    telephone: Telephone = None
    type_contrat: TypeContrat
    certifications: Certifications = None
    id_langues: IdLangues


class FormateurUpdate(BaseModel):
    """Modification partielle ; `id_langues` remplace toute la liste des langues enseignées."""

    prenom: Prenom | None = None
    nom: Nom | None = None
    email: Email | None = None
    telephone: Telephone = None
    type_contrat: TypeContrat | None = None
    certifications: Certifications = None
    id_langues: IdLangues | None = None
    statut: StatutUtilisateur | None = None


class PageFormateurs(BaseModel):
    items: list[FormateurOut]
    total: int
    page: int
    page_size: int
