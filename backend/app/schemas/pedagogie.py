"""Schémas Langue et Niveau (docs/api/contrat-frontend.md, sections « Langues » et « Niveaux »)."""

from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

from app.schemas import regles

CodeLangue = Annotated[str, AfterValidator(regles.valider_code_langue)]
LibelleLangue = Annotated[str, AfterValidator(regles.valider_libelle_langue)]
CodeNiveau = Annotated[str, AfterValidator(regles.valider_code_niveau)]
LibelleRequis = Annotated[str, AfterValidator(regles.valider_libelle_requis)]
# Au moins un niveau ouvert (le frontend l'impose aussi)
IdNiveaux = Annotated[list[int], Field(min_length=1)]


class NiveauOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_niveau: int
    code: str
    libelle: str


class NiveauIn(BaseModel):
    code: CodeNiveau
    libelle: LibelleRequis


class LangueOut(BaseModel):
    """Langue seule (formules, tableau de bord)."""

    model_config = ConfigDict(from_attributes=True)

    id_langue: int
    code: str
    libelle: str


class LangueAvecNiveauxOut(LangueOut):
    """Langue et ses niveaux ouverts (association LangueNiveau), renvoyée par les routes /langues."""

    niveaux: list[NiveauOut]


class LangueCreate(BaseModel):
    libelle: LibelleLangue
    code: CodeLangue
    id_niveaux: IdNiveaux


class LangueUpdate(BaseModel):
    """Modification partielle ; `id_niveaux` remplace toute la liste des niveaux ouverts."""

    libelle: LibelleLangue | None = None
    code: CodeLangue | None = None
    id_niveaux: IdNiveaux | None = None


class PageLangues(BaseModel):
    items: list[LangueAvecNiveauxOut]
    total: int
    page: int
    page_size: int
