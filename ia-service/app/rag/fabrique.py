"""Fabrique du récupérateur documentaire.

Un seul point d'assemblage : le Harness reçoit le récupérateur construit ici. Tant que ``RAG_CORPUS_ACTIF`` est
faux, que le corpus est absent ou incohérent, ou que le corpus officiel n'est pas autorisé, le service conserve
``RecuperateurVide`` et le diagnostic continue de fonctionner — la règle de prudence du prompt s'applique alors,
sans blocage du parcours apprenant.

Trois provenances restent distinctes :

- ``officiel`` : descripteurs du référentiel, uniquement avec autorisation explicite ;
- ``experimental`` : exercices pédagogiques CARCL, jamais présentés comme officiels ;
- ``vide`` : aucun corpus, le repli synthétique US150-B prenant le relais.
"""

from __future__ import annotations

import logging

from app.core.erreurs import ErreurServiceIA
from app.rag.base import RecuperateurRAG
from app.rag.config import ConfigRAG
from app.rag.corpus import CorpusCecrl
from app.rag.corpus_experimental import charger_corpus_experimental
from app.rag.experimental import RecuperateurExperimental
from app.rag.local import RecuperateurLocal
from app.rag.vide import RecuperateurVide

logger = logging.getLogger(__name__)


def construire_recuperateur(config: ConfigRAG | None = None) -> RecuperateurRAG:
    """Charger le corpus sélectionné, sinon retourner le récupérateur vide.

    Une erreur de corpus est journalisée puis absorbée : un actif documentaire cassé ne doit pas empêcher le
    service de démarrer ni le diagnostic de répondre.
    """
    parametres = config or ConfigRAG()
    if not parametres.corpus_actif:
        return RecuperateurVide()

    if parametres.corpus_type == "experimental":
        try:
            corpus_experimental = charger_corpus_experimental(
                parametres.dossier,
                verifier_empreinte=parametres.verifier_empreinte,
            )
        except (ErreurServiceIA, OSError, ValueError) as exc:
            logger.error(
                "Corpus experimental indisponible (%s) : récupérateur vide, estimation prudente attendue.",
                type(exc).__name__,
            )
            return RecuperateurVide()
        logger.info(
            "Corpus experimental %s chargé : %d exercices non officiels.",
            corpus_experimental.version,
            len(corpus_experimental.exercices),
        )
        return RecuperateurExperimental(corpus_experimental)

    if not parametres.corpus_officiel_autorise:
        logger.error(
            "Corpus CECRL officiel non autorisé (RAG_CORPUS_OFFICIEL_AUTORISE=false) : "
            "récupérateur vide, estimation prudente attendue."
        )
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
