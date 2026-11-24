"""Récupérateur du corpus CECRL extrait des PDF (US150-C), conforme au protocole ``RecuperateurRAG``.

Le texte d'une requête est surtout fait des réponses de l'apprenant, dans la langue qu'il apprend ; un descripteur
CECRL décrit une capacité (« Peut comprendre… »). Un classement purement lexical renverrait donc presque toujours
une liste vide. Ce récupérateur procède en trois temps :

1. **édition** : celle de la langue apprise si le corpus la contient, sinon la première édition disponible dans
   ``ORDRE_EDITIONS_REPLI`` (le descripteur décrit une capacité valable pour toute langue) ;
2. **filtrage** par facettes : niveau exact et compétences demandées, les échelles lexicales restant transverses ;
3. **classement** : score BM25 quand le texte apporte des termes, puis rang de la compétence demandée, puis ordre du
   document ; les échelles sont ensuite **diversifiées** pour ne pas renvoyer huit descripteurs d'une même grille.

Le résultat est déterministe. Chaque descripteur est projeté sur le contrat du prompt avec la langue de la requête
(l'agent Diagnostic refuse un descripteur d'une autre langue) et un rappel de source : édition, page, échelle.
"""

from __future__ import annotations

from collections.abc import Sequence

from app.prompts.variables import DescripteurRAGPrompt
from app.rag.base import RequeteRAG
from app.rag.corpus_pdf import CorpusPdf, DescripteurPdf, LangueDocument
from app.rag.lexical import DocumentLexical, StatistiquesLexicales, calculer_scores, construire_index, jetons

ORDRE_EDITIONS_REPLI: tuple[LangueDocument, ...] = ("fr", "en", "it", "de")
CONTENU_MAX = 3000

# Même règle que le récupérateur du classeur : le contrat ``Competence`` n'a pas de valeur ``lexique``.
_ORDRES_VOCABULAIRE: tuple[str, ...] = ("lecture", "ecrit", "oral")
_NOMS_EDITIONS = {"fr": "française", "en": "anglaise", "it": "italienne", "de": "allemande"}


class RecuperateurPdf:
    """Recherche par facettes et BM25 sur les descripteurs extraits des PDF du volume complémentaire."""

    nom = "pdf-cecrl"

    def __init__(self, corpus: CorpusPdf, *, ordre_editions: Sequence[LangueDocument] = ORDRE_EDITIONS_REPLI) -> None:
        self._corpus = corpus
        self.version_corpus = corpus.version
        self._ordre_editions = tuple(ordre_editions)
        self._titres = {document.identifiant: document.titre for document in corpus.manifeste.documents}
        self._statistiques: dict[str, StatistiquesLexicales[DescripteurPdf]] = construire_index(
            ((d.langue_document, f"{d.echelle} {d.contenu}", d) for d in corpus.descripteurs),
            identifiant=lambda descripteur: descripteur.identifiant,
        )

    def edition_pour(self, code_langue: str) -> str | None:
        """Édition consultée pour une langue apprise : la même si elle existe, sinon la première de repli."""
        for langue in (code_langue, *self._ordre_editions):
            if langue in self._statistiques:
                return langue
        return None

    async def rechercher(self, requete: RequeteRAG) -> tuple[DescripteurRAGPrompt, ...]:
        """Retourner au plus ``requete.limite`` descripteurs du niveau et des compétences demandés."""
        if requete.referentiel != "CECRL":
            return ()
        edition = self.edition_pour(requete.code_langue)
        if edition is None:
            return ()
        statistiques = self._statistiques[edition]

        demandees = tuple(requete.competences)
        candidats = tuple(
            document
            for document in statistiques.documents
            if document.objet.niveau == requete.niveau
            and (document.objet.competence in demandees or document.objet.competence == "lexique")
        )
        if not candidats:
            return ()

        termes = jetons(requete.texte)
        scores = calculer_scores(candidats, termes, statistiques) if termes else [(0.0, d) for d in candidats]
        tries = sorted(
            scores,
            key=lambda couple: (
                -couple[0],
                self._rang(couple[1].objet, demandees),
                couple[1].objet.document,
                couple[1].objet.page,
                couple[1].identifiant,
            ),
        )
        retenus = self._diversifier([document for _, document in tries], requete.limite)
        return tuple(self._vers_prompt(document.objet, requete) for document in retenus)

    @staticmethod
    def _rang(descripteur: DescripteurPdf, demandees: Sequence[str]) -> int:
        """Ordre des compétences demandées ; une échelle lexicale transverse passe après."""
        if descripteur.competence in demandees:
            return demandees.index(descripteur.competence)
        return len(demandees)

    @staticmethod
    def _diversifier(
        documents: list[DocumentLexical[DescripteurPdf]], limite: int
    ) -> list[DocumentLexical[DescripteurPdf]]:
        """Un descripteur par échelle d'abord (dans l'ordre du classement), puis compléter jusqu'à la limite."""
        premiers: list[DocumentLexical[DescripteurPdf]] = []
        suivants: list[DocumentLexical[DescripteurPdf]] = []
        echelles: set[tuple[str, str]] = set()
        for document in documents:
            cle = (document.objet.section, document.objet.echelle)
            (suivants if cle in echelles else premiers).append(document)
            echelles.add(cle)
        return (premiers + suivants)[:limite]

    def _vers_prompt(self, descripteur: DescripteurPdf, requete: RequeteRAG) -> DescripteurRAGPrompt:
        """Projeter sur le contrat du prompt, dans la langue de la requête, avec la source du descripteur."""
        competence = descripteur.competence
        if competence == "lexique":
            competence = next((c for c in requete.competences if c in _ORDRES_VOCABULAIRE), requete.competences[0])
        source = (
            f" [Source : {self._titres[descripteur.document]}, édition {_NOMS_EDITIONS[descripteur.langue_document]}, "
            f"p. {descripteur.page}, échelle « {descripteur.echelle} », niveau {descripteur.sous_niveau}.]"
        )
        contenu = descripteur.contenu[: CONTENU_MAX - len(source)] + source
        return DescripteurRAGPrompt(
            identifiant=descripteur.identifiant,
            code_langue=requete.code_langue,
            referentiel="CECRL",
            niveau=descripteur.niveau,
            competence=competence,
            contenu=contenu,
        )

    async def fermer(self) -> None:
        """Aucune ressource externe : le corpus est en mémoire."""
        return None
