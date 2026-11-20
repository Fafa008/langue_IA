"""Port du récupérateur documentaire (RAG) partagé par les agents.

Le port reste stable ; le corpus CECRL (PRE-08) est branché derrière ``RAG_CORPUS_ACTIF`` via
``construire_recuperateur``. Aucun agent ne connaît l'implémentation retenue.
"""

from app.rag.base import (
    DESCRIPTEURS_MAX,
    PREFIXE_IDENTIFIANT_EXPERIMENTAL,
    PREFIXE_IDENTIFIANT_SYNTHETIQUE,
    PROVENANCE_EXPERIMENTALE,
    PROVENANCE_SYNTHETIQUE,
    STATUT_A_VERIFIER,
    TEXTE_REQUETE_MAX,
    VERSION_CORPUS_EXPERIMENTAL,
    RecuperateurRAG,
    RequeteRAG,
)
from app.rag.config import ConfigRAG
from app.rag.corpus import COMPETENCES_CORPUS, CorpusCecrl, DescripteurCorpus, ManifesteCorpus
from app.rag.corpus_experimental import CorpusExperimental, ExerciceExperimental, charger_corpus_experimental
from app.rag.experimental import RecuperateurExperimental
from app.rag.fabrique import construire_recuperateur
from app.rag.local import RecuperateurLocal
from app.rag.repli import RecuperateurAvecRepli, descripteurs_repli, est_descripteur_synthetique
from app.rag.vide import RecuperateurVide

__all__ = [
    "COMPETENCES_CORPUS",
    "DESCRIPTEURS_MAX",
    "PREFIXE_IDENTIFIANT_EXPERIMENTAL",
    "PREFIXE_IDENTIFIANT_SYNTHETIQUE",
    "PROVENANCE_EXPERIMENTALE",
    "PROVENANCE_SYNTHETIQUE",
    "STATUT_A_VERIFIER",
    "TEXTE_REQUETE_MAX",
    "VERSION_CORPUS_EXPERIMENTAL",
    "ConfigRAG",
    "CorpusCecrl",
    "CorpusExperimental",
    "DescripteurCorpus",
    "ExerciceExperimental",
    "ManifesteCorpus",
    "RecuperateurAvecRepli",
    "RecuperateurExperimental",
    "RecuperateurLocal",
    "RecuperateurRAG",
    "RecuperateurVide",
    "RequeteRAG",
    "charger_corpus_experimental",
    "construire_recuperateur",
    "descripteurs_repli",
    "est_descripteur_synthetique",
]
