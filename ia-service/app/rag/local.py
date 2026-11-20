"""Récupérateur lexical déterministe sur le corpus CECRL local (PRE-08).

Le service ne dispose pas d'index vectoriel : ce récupérateur classe les descripteurs du corpus par pertinence
lexicale (BM25) après filtrage par langue, niveau et compétence. Aucun appel réseau, aucune dépendance
supplémentaire, aucun accès à PostgreSQL : le corpus est un fichier monté en lecture seule.

Deux garanties rendent le résultat reproductible :

- l'ordre de tri est total : score, compétence demandée, numéro de source, identifiant ;
- une requête sans terme exploitable retourne une séquence vide — le prompt applique alors sa règle de prudence —
  plutôt qu'une sélection arbitraire de descripteurs.

Le noyau BM25 est partagé avec le récupérateur expérimental via :mod:`app.rag.lexical` ; seul le chargement du
corpus officiel et la projection vers le prompt restent propres à ce module.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence

from app.prompts.variables import DescripteurRAGPrompt
from app.rag.base import RequeteRAG
from app.rag.corpus import CorpusCecrl, DescripteurCorpus
from app.rag.lexical import (
    DocumentLexical,
    StatistiquesLexicales,
    calculer_scores,
    construire_index,
    jetons,  # ré-exporté : les tests historiques l'importent depuis ce module
)

# Lorsqu'un descripteur lexical est retenu, il est étiqueté avec la compétence de la requête : le contrat
# ``Competence`` ne possède pas de valeur ``lexique``. L'ordre reprend la règle existante du domaine
# (``COMPETENCES_DESCRIPTEUR_PAR_DOMAINE["vocabulaire"]``).
_ORDRES_VOCABULAIRE: tuple[str, ...] = ("lecture", "ecrit", "oral")


class RecuperateurLocal:
    """Récupérateur BM25 conforme au protocole ``RecuperateurRAG``."""

    nom = "local-cecrl"

    def __init__(self, corpus: CorpusCecrl) -> None:
        self._corpus = corpus
        self.version_corpus = corpus.version
        self._statistiques = self._indexer(corpus.descripteurs)

    @staticmethod
    def _indexer(
        descripteurs: Iterable[DescripteurCorpus],
    ) -> dict[str, StatistiquesLexicales[DescripteurCorpus]]:
        """Précalculer un index par langue : le filtrage par langue est le seul axe global de la requête."""
        return construire_index(
            (
                (descripteur.code_langue, f"{descripteur.echelle} {descripteur.contenu}", descripteur)
                for descripteur in descripteurs
            ),
            identifiant=lambda descripteur: descripteur.identifiant,
        )

    async def rechercher(self, requete: RequeteRAG) -> tuple[DescripteurRAGPrompt, ...]:
        """Retourner au plus ``requete.limite`` descripteurs, du plus pertinent au moins pertinent."""
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
                self._ordre(couple[1].objet),
                couple[1].objet.source_no,
                couple[1].identifiant,
            ),
        )[: requete.limite]
        return tuple(self._vers_prompt(document.objet, requete.competences) for _, document in retenus)

    @staticmethod
    def _ordre(descripteur: DescripteurCorpus) -> str:
        """Placer une compétence explicitement demandée avant une échelle lexicale transverse."""
        return "zzz" if descripteur.competence == "lexique" else descripteur.competence

    @staticmethod
    def _candidats(
        documents: Sequence[DocumentLexical[DescripteurCorpus]],
        requete: RequeteRAG,
    ) -> tuple[DocumentLexical[DescripteurCorpus], ...]:
        """Filtrer par niveau et par compétence demandée, les échelles lexicales restant transverses."""
        demandees = set(requete.competences)
        return tuple(
            document
            for document in documents
            if document.objet.niveau == requete.niveau
            and (document.objet.competence in demandees or document.objet.competence == "lexique")
        )

    @staticmethod
    def _vers_prompt(
        descripteur: DescripteurCorpus,
        competences: Sequence[str],
    ) -> DescripteurRAGPrompt:
        """Projeter un descripteur du corpus sur le contrat du prompt."""
        competence = descripteur.competence
        if competence == "lexique":
            competence = next((valeur for valeur in competences if valeur in _ORDRES_VOCABULAIRE), competences[0])
        return DescripteurRAGPrompt(
            identifiant=descripteur.identifiant,
            code_langue=descripteur.code_langue,
            referentiel=descripteur.referentiel,
            niveau=descripteur.niveau,
            competence=competence,
            contenu=descripteur.contenu,
        )

    async def fermer(self) -> None:
        """Aucune ressource externe à libérer : le corpus est en mémoire."""
        return None
