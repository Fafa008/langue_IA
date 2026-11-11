"""Récupérateur lexical déterministe sur le corpus CECRL local (PRE-08).

Le service ne dispose pas d'index vectoriel : ce récupérateur classe les descripteurs du corpus par pertinence
lexicale (BM25) après filtrage par langue, niveau et compétence. Aucun appel réseau, aucune dépendance
supplémentaire, aucun accès à PostgreSQL : le corpus est un fichier monté en lecture seule.

Deux garanties rendent le résultat reproductible :

- l'ordre de tri est total : score, compétence demandée, numéro de source, identifiant ;
- une requête sans terme exploitable retourne une séquence vide — le prompt applique alors sa règle de prudence —
  plutôt qu'une sélection arbitraire de descripteurs.
"""

from __future__ import annotations

import math
import re
import unicodedata
from collections import Counter
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass

from app.prompts.variables import DescripteurRAGPrompt
from app.rag.base import RequeteRAG
from app.rag.corpus import CorpusCecrl, DescripteurCorpus

# Paramètres BM25 usuels : saturation modérée de la fréquence et normalisation par la longueur du document.
K1 = 1.5
B = 0.75
LONGUEUR_JETON_MIN = 2

_MOTIF_JETON = re.compile(r"[0-9a-z']+")
_MOTS_VIDES = frozenset(
    "a an and are as at be been being but by can do does for from had has have he her his i if in into is it its "
    "me my no not of on one or our she so than that the their them then there these they this to up was we were "
    "what when which who will with you your au aux avec ce ces comme dans de des du elle en est et eux il ils je "
    "la le les leur lui ma mais mes mon ne nos notre nous on ou par pas pour que qui sa se ses son sur ta te tes "
    "toi ton tu un une vos votre vous y".split()
)

# Lorsqu'un descripteur lexical est retenu, il est étiqueté avec la compétence de la requête : le contrat
# ``Competence`` ne possède pas de valeur ``lexique``. L'ordre reprend la règle existante du domaine
# (``COMPETENCES_DESCRIPTEUR_PAR_DOMAINE["vocabulaire"]``).
_ORDRES_VOCABULAIRE: tuple[str, ...] = ("lecture", "ecrit", "oral")


def jetons(texte: str) -> tuple[str, ...]:
    """Découper un texte en jetons minuscules, sans accents ni mots vides.

    L'analyse sans accents rapproche « compréhension » de « comprehension » et rend le classement stable entre un
    corpus anglais et un corpus français.
    """
    decompose = unicodedata.normalize("NFKD", texte.lower())
    sans_accents = "".join(caractere for caractere in decompose if not unicodedata.combining(caractere))
    return tuple(
        jeton
        for jeton in _MOTIF_JETON.findall(sans_accents)
        if len(jeton) >= LONGUEUR_JETON_MIN and jeton not in _MOTS_VIDES
    )


@dataclass(frozen=True, slots=True)
class _Document:
    """Descripteur indexé et ses statistiques lexicales précalculées."""

    descripteur: DescripteurCorpus
    frequences: Mapping[str, int]
    longueur: int


@dataclass(frozen=True, slots=True)
class _Statistiques:
    """Statistiques d'une langue : documents, fréquence documentaire et longueur moyenne."""

    documents: tuple[_Document, ...]
    frequence_documentaire: Mapping[str, int]
    longueur_moyenne: float


class RecuperateurLocal:
    """Récupérateur BM25 conforme au protocole ``RecuperateurRAG``."""

    nom = "local-cecrl"

    def __init__(self, corpus: CorpusCecrl) -> None:
        self._corpus = corpus
        self.version_corpus = corpus.version
        self._statistiques = self._indexer(corpus.descripteurs)

    @staticmethod
    def _indexer(descripteurs: Iterable[DescripteurCorpus]) -> dict[str, _Statistiques]:
        """Précalculer un index par langue : le filtrage par langue est le seul axe global de la requête."""
        par_langue: dict[str, list[_Document]] = {}
        for descripteur in descripteurs:
            texte = f"{descripteur.echelle} {descripteur.contenu}"
            frequences = Counter(jetons(texte))
            document = _Document(descripteur=descripteur, frequences=frequences, longueur=sum(frequences.values()))
            par_langue.setdefault(descripteur.code_langue, []).append(document)

        statistiques: dict[str, _Statistiques] = {}
        for langue, documents in par_langue.items():
            frequence_documentaire = Counter[str]()
            for document in documents:
                frequence_documentaire.update(document.frequences.keys())
            longueur_moyenne = sum(document.longueur for document in documents) / len(documents)
            statistiques[langue] = _Statistiques(
                documents=tuple(documents),
                frequence_documentaire=frequence_documentaire,
                longueur_moyenne=longueur_moyenne or 1.0,
            )
        return statistiques

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

        scores = self._scores(candidats, termes, statistiques)
        retenus = sorted(
            (couple for couple in scores if couple[0] > 0),
            key=lambda couple: (
                -couple[0],
                self._ordre(couple[1].descripteur),
                couple[1].descripteur.source_no,
                couple[1].descripteur.identifiant,
            ),
        )[: requete.limite]
        return tuple(self._vers_prompt(document.descripteur, requete.competences) for _, document in retenus)

    @staticmethod
    def _ordre(descripteur: DescripteurCorpus) -> str:
        """Placer une compétence explicitement demandée avant une échelle lexicale transverse."""
        return "zzz" if descripteur.competence == "lexique" else descripteur.competence

    @staticmethod
    def _candidats(documents: Sequence[_Document], requete: RequeteRAG) -> tuple[_Document, ...]:
        """Filtrer par niveau et par compétence demandée, les échelles lexicales restant transverses."""
        demandees = set(requete.competences)
        return tuple(
            document
            for document in documents
            if document.descripteur.niveau == requete.niveau
            and (document.descripteur.competence in demandees or document.descripteur.competence == "lexique")
        )

    @staticmethod
    def _scores(
        candidats: Sequence[_Document],
        termes: Sequence[str],
        statistiques: _Statistiques,
    ) -> list[tuple[float, _Document]]:
        """Calculer le score BM25 de chaque candidat."""
        nombre_documents = len(statistiques.documents)
        scores: list[tuple[float, _Document]] = []
        for document in candidats:
            score = 0.0
            for terme in set(termes):
                frequence = document.frequences.get(terme, 0)
                if frequence == 0:
                    continue
                documentaire = statistiques.frequence_documentaire.get(terme, 0)
                idf = math.log(1 + (nombre_documents - documentaire + 0.5) / (documentaire + 0.5))
                denominateur = frequence + K1 * (1 - B + B * document.longueur / statistiques.longueur_moyenne)
                score += idf * frequence * (K1 + 1) / denominateur
            scores.append((score, document))
        return scores

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
