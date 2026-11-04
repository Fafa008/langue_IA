"""Port du récupérateur documentaire (RAG).

Le RAG n'est pas encore déployé. L'agent Diagnostic ne dépend donc que de ce protocole : un récupérateur réel
(index vectoriel, recherche lexicale, service externe) pourra être injecté par le Harness sans modifier ni l'agent,
ni le pipeline. Les descripteurs renvoyés reprennent exactement ``DescripteurRAGPrompt``, la forme déjà rendue par
le prompt d'évaluation.

Le port ne journalise ni les réponses de l'apprenant, ni les descripteurs : il reçoit une requête et retourne une
séquence de descripteurs typés.
"""

from collections.abc import Sequence
from typing import Protocol

from pydantic import Field, model_validator

from app.prompts.variables import DescripteurRAGPrompt
from app.schemas.base import ModeleStrict
from app.schemas.regles import (
    CodeLangue,
    CodeNiveau,
    Competence,
    Referentiel,
    erreur,
    niveaux_du_referentiel,
    referentiel_pour_langue,
)

# Le prompt accepte vingt descripteurs ; l'agent en demande huit au maximum pour borner la taille de l'appel LLM.
DESCRIPTEURS_MAX = 8
TEXTE_REQUETE_MAX = 4_000


class RequeteRAG(ModeleStrict):
    """Recherche documentaire déterministe, filtrée par les facettes du diagnostic.

    ``texte`` reprend les productions de l'apprenant pour une éventuelle recherche sémantique. Il est borné :
    l'agent ne transmet jamais l'intégralité d'un long historique.
    """

    code_langue: CodeLangue
    referentiel: Referentiel
    niveau: CodeNiveau
    competences: tuple[Competence, ...] = Field(min_length=1, max_length=5)
    texte: str = Field(default="", max_length=TEXTE_REQUETE_MAX)
    limite: int = Field(default=DESCRIPTEURS_MAX, strict=True, ge=1, le=20)

    @model_validator(mode="after")
    def verifier_contexte(self) -> "RequeteRAG":
        """Le référentiel, le niveau et les compétences doivent former une demande exploitable."""
        if self.referentiel != referentiel_pour_langue(self.code_langue):
            raise erreur("Le référentiel de la requête RAG ne correspond pas à sa langue.")
        if self.niveau not in niveaux_du_referentiel(self.referentiel):
            raise erreur("Le niveau de la requête RAG n'appartient pas à son référentiel.")
        if len(set(self.competences)) != len(self.competences):
            raise erreur("Une compétence ne peut apparaître qu'une fois dans une requête RAG.")
        return self


class RecuperateurRAG(Protocol):
    """Contrat structurel d'un récupérateur documentaire.

    ``version_corpus`` est une étiquette courte (32 caractères au maximum) reprise dans ``MetaExecution``. Elle
    permet à l'exploitation de savoir quel index a produit une estimation.
    """

    nom: str
    version_corpus: str | None

    async def rechercher(self, requete: RequeteRAG) -> Sequence[DescripteurRAGPrompt]:
        """Retourner les descripteurs pertinents, dans l'ordre de pertinence du récupérateur.

        Une séquence vide est un résultat valide : l'agent applique alors la règle de prudence du prompt au lieu
        d'inventer un descripteur. Un index indisponible doit lever ``ErreurCorpusIndisponible``.
        """
        ...

    async def fermer(self) -> None:
        """Libérer les ressources éventuelles (index, connexion). Idempotent."""
        ...
