"""Fabrique du récupérateur documentaire.

Un seul point d'assemblage : le Harness reçoit le récupérateur construit ici. Tant que ``RAG_CORPUS_ACTIF`` est
faux, ou que le corpus est absent ou incohérent, le service conserve ``RecuperateurVide`` et le diagnostic continue
de fonctionner —
 la règle de prudence du prompt s'applique alors, sans blocage du parcours apprenant.
"""

from __future__ import annotations

import logging

from app.core.erreurs import ErreurServiceIA
from app.rag.base import RecuperateurRAG
from app.rag.config import ConfigRAG
from app.rag.corpus import CorpusCecrl
from app.rag.local import RecuperateurLocal
from app.rag.vide import RecuperateurVide

logger = logging.getLogger(__name__)


def construire_recuperateur(config: ConfigRAG | None = None) -> RecuperateurRAG:
    """Charger le corpus si le flag l'autorise, sinon retourner le récupérateur vide.

    Une erreur de corpus est journalisée puis absorbée : un actif documentaire cassé ne doit pas empêcher le
    service de démarrer ni le diagnostic de répondre.
    """
    parametres = config or ConfigRAG()
    if not parametres.corpus_actif:
        return RecuperateurVide()

    try:
        corpus = CorpusCecrl.charger(parametres.dossier, verifier_empreinte=parametres.verifier_empreinte)
    except (ErreurServiceIA, OSError, ValueError) as exc:
        logger.error(
            "Corpus CECRL indisponible (%s) : récupérateur vide, estimation prudente attendue.",
            type(exc).__name__,
        )
        return RecuperateurVide()

    logger.info(
        "Corpus CECRL %s chargé : %d descripteurs.",
        corpus.version,
        len(corpus.descripteurs),
    )
    return RecuperateurLocal(corpus)
