"""Contexte apprenant transmis au Harness.

Le contexte ne contient que ce qui est nécessaire au raisonnement pédagogique : la langue, le référentiel, le
niveau préliminaire fourni par le backend et un résumé de la mémoire pédagogique. Aucune donnée identifiante
(nom, e-mail, identifiant d'apprenant) n'y figure : le service IA reste sans état et non autoritaire.
"""

from pydantic import Field, field_validator, model_validator

from app.schemas.base import ModeleStrict
from app.schemas.regles import (
    POINT_MEMOIRE_MAX,
    RESUME_MEMOIRE_MAX,
    CodeLangue,
    CodeNiveau,
    Referentiel,
    erreur,
    niveaux_du_referentiel,
    normaliser_espaces,
    referentiel_pour_langue,
)


class MemoirePedagogique(ModeleStrict):
    """Résumé du parcours de l'apprenant, préparé par le backend.

    C'est un résumé, pas un historique : le service IA n'a pas accès aux réponses brutes ni à la base. Un premier
    diagnostic transmet ``null`` plutôt qu'un objet vide.
    """

    resume: str = Field(min_length=1, max_length=RESUME_MEMOIRE_MAX)
    points_forts: list[str] = Field(default_factory=list, max_length=5)
    points_faibles: list[str] = Field(default_factory=list, max_length=5)
    nb_activites: int = Field(default=0, strict=True, ge=0, le=100_000)

    @field_validator("points_forts", "points_faibles")
    @classmethod
    def valider_points(cls, points: list[str], info) -> list[str]:
        """Points courts, non vides et sans doublon (comparaison insensible à la casse)."""
        normalises: list[str] = []
        vus: set[str] = set()
        for point in points:
            valeur = normaliser_espaces(point)
            if not valeur:
                raise erreur("Un point de la mémoire pédagogique ne peut pas être vide.")
            if len(valeur) > POINT_MEMOIRE_MAX:
                raise erreur(f"Un point de la mémoire pédagogique compte {POINT_MEMOIRE_MAX} caractères au maximum.")
            if valeur.casefold() in vus:
                raise erreur(f"Le point « {valeur} » est présent deux fois dans {info.field_name}.")
            vus.add(valeur.casefold())
            normalises.append(valeur)
        return normalises

    @model_validator(mode="after")
    def verifier_contradictions(self) -> "MemoirePedagogique":
        """Un même point ne peut pas être à la fois un point fort et un point faible."""
        forts = {point.casefold() for point in self.points_forts}
        communs = [point for point in self.points_faibles if point.casefold() in forts]
        if communs:
            raise erreur(f"Le point « {communs[0]} » est à la fois un point fort et un point faible.")
        return self


class ContexteApprenant(ModeleStrict):
    """Contexte minimal d'un appel d'agent.

    Le référentiel est exigé explicitement, mais il est vérifié contre la langue : le mandarin utilise HSK, les
    autres langues le CECRL (``backend/app/services/scoring.py``). Un niveau hors du référentiel est refusé.
    """

    code_langue: CodeLangue
    referentiel: Referentiel
    niveau_preliminaire: CodeNiveau
    memoire_pedagogique: MemoirePedagogique | None = None

    @model_validator(mode="after")
    def verifier_referentiel_et_niveau(self) -> "ContexteApprenant":
        attendu = referentiel_pour_langue(self.code_langue)
        if self.referentiel != attendu:
            raise erreur(f"La langue « {self.code_langue} » impose le référentiel {attendu}, pas {self.referentiel}.")
        if self.niveau_preliminaire not in niveaux_du_referentiel(self.referentiel):
            raise erreur(
                f"Le niveau « {self.niveau_preliminaire} » n'appartient pas au référentiel {self.referentiel}."
            )
        return self
