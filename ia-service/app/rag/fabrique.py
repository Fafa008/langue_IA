"""Fabrique du récupérateur documentaire.

Un seul point d'assemblage : le Harness reçoit le récupérateur construit ici. Tant que ``RAG_CORPUS_ACTIF`` est
faux, que le corpus est absent ou incohérent, ou que le corpus officiel n'est pas autorisé, le service conserve
``RecuperateurVide`` et le diagnostic continue de fonctionner — la règle de prudence du prompt s'applique alors,
sans blocage du parcours apprenant.

Trois provenances restent distinctes :

- ``officiel`` : descripteurs du référentiel (classeur), uniquement avec autorisation explicite ;
- ``pdf`` : descripteurs extraits des PDF du volume complémentaire (US150-C), avec la même autorisation ;
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
from app.rag.corpus_pdf import CorpusPdf
from app.rag.experimental import RecuperateurExperimental
from app.rag.local import RecuperateurLocal
from app.rag.pdf import RecuperateurPdf
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
            "Corpus CECRL %s non autorisé (RAG_CORPUS_OFFICIEL_AUTORISE=false) : "
            "récupérateur vide, estimation prudente attendue.",
            parametres.corpus_type,
        )
        return RecuperateurVide()

    if parametres.corpus_type == "pdf":
        try:
            corpus_pdf = CorpusPdf.charger(parametres.dossier, verifier_empreinte=parametres.verifier_empreinte)
        except (ErreurServiceIA, OSError, ValueError) as exc:
            logger.error(
                "Corpus CECRL PDF indisponible (%s) : récupérateur vide, estimation prudente attendue.",
                type(exc).__name__,
            )
            return RecuperateurVide()
        logger.info(
            "Corpus CECRL PDF %s chargé : %d descripteurs, %d document(s), éditions %s.",
            corpus_pdf.version,
            len(corpus_pdf.descripteurs),
            len(corpus_pdf.manifeste.documents),
            ",".join(corpus_pdf.manifeste.langues),
        )
        return RecuperateurPdf(corpus_pdf)

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
