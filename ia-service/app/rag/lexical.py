"""Noyau lexical partagé par les récupérateurs BM25 locaux.

Ce module ne connaît ni les descripteurs officiels, ni les exercices pédagogiques : il reçoit des textes déjà
projetés et des objets opaques. ``RecuperateurLocal`` et ``RecuperateurExperimental`` partagent ainsi exactement
la même tokenisation, les mêmes statistiques BM25 et le même calcul de score, sans dupliquer la logique.
"""

from __future__ import annotations

import math
import re
import unicodedata
from collections import Counter
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass
from typing import Generic, TypeVar

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

T = TypeVar("T")


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
class DocumentLexical(Generic[T]):
    """Objet indexé et ses statistiques lexicales précalculées."""

    identifiant: str
    objet: T
    frequences: Mapping[str, int]
    longueur: int


@dataclass(frozen=True, slots=True)
class StatistiquesLexicales(Generic[T]):
    """Statistiques d'une langue : documents, fréquence documentaire et longueur moyenne."""

    documents: tuple[DocumentLexical[T], ...]
    frequence_documentaire: Mapping[str, int]
    longueur_moyenne: float


def construire_index(
    objets: Iterable[tuple[str, str, T]],
    *,
    identifiant: Callable[[T], str],
) -> dict[str, StatistiquesLexicales[T]]:
    """Précalculer un index par langue.

    Chaque élément est ``(code_langue, texte_indexe, objet)``. Le filtrage par langue est le seul axe global de la
    requête : les autres facettes sont appliquées par le récupérateur sur les objets retournés.
    """
    par_langue: dict[str, list[DocumentLexical[T]]] = {}
    for langue, texte, objet in objets:
        frequences = Counter(jetons(texte))
        document = DocumentLexical(
            identifiant=identifiant(objet),
            objet=objet,
            frequences=frequences,
            longueur=sum(frequences.values()),
        )
        par_langue.setdefault(langue, []).append(document)

    statistiques: dict[str, StatistiquesLexicales[T]] = {}
    for langue, documents in par_langue.items():
        frequence_documentaire = Counter[str]()
        for document in documents:
            frequence_documentaire.update(document.frequences.keys())
        longueur_moyenne = sum(document.longueur for document in documents) / len(documents)
        statistiques[langue] = StatistiquesLexicales(
            documents=tuple(documents),
            frequence_documentaire=frequence_documentaire,
            longueur_moyenne=longueur_moyenne or 1.0,
        )
    return statistiques


def calculer_scores(
    candidats: Sequence[DocumentLexical[T]],
    termes: Sequence[str],
    statistiques: StatistiquesLexicales[T],
) -> list[tuple[float, DocumentLexical[T]]]:
    """Calculer le score BM25 de chaque candidat."""
    nombre_documents = len(statistiques.documents)
    scores: list[tuple[float, DocumentLexical[T]]] = []
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
