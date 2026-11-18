"""Port du récupérateur documentaire (RAG) partagé par les agents.

Le port reste stable ; le corpus CECRL (PRE-08) est branché derrière ``RAG_CORPUS_ACTIF`` via
``construire_recuperateur``. Aucun agent ne connaît l'implémentation retenue.
"""

from app.rag.base import (
    DESCRIPTEURS_MAX,
    PREFIXE_IDENTIFIANT_SYNTHETIQUE,
    PROVENANCE_SYNTHETIQUE,
    STATUT_A_VERIFIER,
    TEXTE_REQUETE_MAX,
    RecuperateurRAG,
    RequeteRAG,
)
from app.rag.config import ConfigRAG
from app.rag.corpus import COMPETENCES_CORPUS, CorpusCecrl, DescripteurCorpus, ManifesteCorpus
from app.rag.fabrique import construire_recuperateur
from app.rag.local import RecuperateurLocal
from app.rag.repli import RecuperateurAvecRepli, descripteurs_repli, est_descripteur_synthetique
from app.rag.vide import RecuperateurVide

__all__ = [
    "COMPETENCES_CORPUS",
    "DESCRIPTEURS_MAX",
    "PREFIXE_IDENTIFIANT_SYNTHETIQUE",
    "PROVENANCE_SYNTHETIQUE",
    "STATUT_A_VERIFIER",
    "TEXTE_REQUETE_MAX",
    "ConfigRAG",
    "CorpusCecrl",
    "DescripteurCorpus",
    "ManifesteCorpus",
    "RecuperateurAvecRepli",
    "RecuperateurLocal",
    "RecuperateurRAG",
    "RecuperateurVide",
    "RequeteRAG",
    "construire_recuperateur",
    "descripteurs_repli",
    "est_descripteur_synthetique",
]
