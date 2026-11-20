"""Récupérateur BM25 sur le corpus expérimental CARCL (US150-A).

Il implémente le même port ``RecuperateurRAG`` que le récupérateur officiel et partage le noyau lexical de
:mod:`app.rag.lexical`. La seule différence est la source : des exercices pédagogiques non officiels, chargés par
:mod:`app.rag.corpus_experimental`, projetés vers ``DescripteurRAGPrompt`` avec un identifiant ``carcl:`` et un
contenu qui rappelle explicitement qu'ils ne sont pas des descripteurs officiels.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence

from app.prompts.variables import DescripteurRAGPrompt
from app.rag.base import RequeteRAG
from app.rag.corpus_experimental import CorpusExperimental, ExerciceExperimental
from app.rag.lexical import (
    DocumentLexical,
    StatistiquesLexicales,
    calculer_scores,
    construire_index,
    jetons,
)


class RecuperateurExperimental:
    """Récupérateur lexical déterministe sur les exercices non officiels."""

    nom = "local-cecrl-experimental"

    def __init__(self, corpus: CorpusExperimental) -> None:
        self._corpus = corpus
        self.version_corpus = corpus.version
        self._statistiques = self._indexer(corpus.exercices)

    @staticmethod
    def _indexer(
        exercices: Iterable[ExerciceExperimental],
    ) -> dict[str, StatistiquesLexicales[ExerciceExperimental]]:
        """Indexer le texte source seul : le préfixe d'avertissement ne doit pas polluer le BM25."""
        return construire_index(
            ((exercice.code_langue, exercice.texte_bm25, exercice) for exercice in exercices),
            identifiant=lambda exercice: exercice.identifiant,
        )

    async def rechercher(self, requete: RequeteRAG) -> tuple[DescripteurRAGPrompt, ...]:
        """Retourner au plus ``requete.limite`` repères pédagogiques pertinents."""
        statistiques = self._statistiques.get(requete.code_langue)
        if statistiques is None or requete.referentiel != "CECRL":
            return ()

        termes = jetons(requete.texte)
        if not termes:
            return ()

        candidats = self._candidats(statistiques.documents, requete)
        if not candidats:
            return ()

        scores = calculer_scores(candidats, termes, statistiques)
        retenus = sorted(
            (couple for couple in scores if couple[0] > 0),
            key=lambda couple: (
                -couple[0],
                0 if couple[1].objet.competence in requete.competences else 1,
                couple[1].identifiant,
            ),
        )[: requete.limite]
        return tuple(self._vers_prompt(document.objet) for _, document in retenus)

    @staticmethod
    def _candidats(
        documents: Sequence[DocumentLexical[ExerciceExperimental]],
        requete: RequeteRAG,
    ) -> tuple[DocumentLexical[ExerciceExperimental], ...]:
        """Filtrer par langue, niveau et compétence dérivée."""
        demandees = set(requete.competences)
        return tuple(
            document
            for document in documents
            if document.objet.niveau == requete.niveau and document.objet.competence in demandees
        )

    @staticmethod
    def _vers_prompt(exercice: ExerciceExperimental) -> DescripteurRAGPrompt:
        """Projeter un exercice sur le contrat du prompt sans masquer sa nature."""
        return DescripteurRAGPrompt(
            identifiant=exercice.identifiant,
            code_langue=exercice.code_langue,
            referentiel=exercice.referentiel,
            niveau=exercice.niveau,
            competence=exercice.competence,
            contenu=exercice.contenu,
        )

    async def fermer(self) -> None:
        """Aucune ressource externe à libérer : le corpus est en mémoire."""
        return None
