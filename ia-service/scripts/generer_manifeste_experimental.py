"""Régénérer le manifeste du corpus expérimental CARCL.

Le manifeste est un petit fichier JSON versionné qui enregistre l'empreinte des 24 fichiers d'exercices de niveau.
Les trois agrégats ``*cefr*`` et le manifeste officiel sont exclus. Aucun PDF, aucun descripteur officiel et aucun
artefact lourd n'est écrit : ce script ne lit que les JSON déjà suivis par Git.

Usage (depuis ``ia-service/``) ::

    python -m scripts.generer_manifeste_experimental [--date 2026-11-20]
"""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from datetime import date, datetime
from pathlib import Path

from app.rag.config import CHEMIN_CORPUS_PAR_DEFAUT
from app.rag.corpus_experimental import (
    FICHIER_MANIFESTE_EXPERIMENTAL,
    TYPE_MANIFESTE,
    VERSION_CORPUS_EXPERIMENTAL,
    ComptagesExperimental,
    FichierSourceExperimental,
    ManifesteExperimental,
    _fichiers_sources,
    charger_corpus_experimental,
    empreinte_fichiers,
)


def _jour(valeur: str) -> date:
    """Parser la date du manifeste au format ISO."""
    return datetime.strptime(valeur, "%Y-%m-%d").date()


def _generer(dossier: Path, jour: date) -> ManifesteExperimental:
    corpus = charger_corpus_experimental(dossier, verifier_empreinte=False)
    sources = []
    for chemin in _fichiers_sources(dossier):
        donnees = chemin.read_bytes()
        sources.append(
            FichierSourceExperimental(
                chemin=chemin.relative_to(dossier).as_posix(),
                octets=len(donnees),
                sha256=hashlib.sha256(donnees).hexdigest(),
            )
        )
    return ManifesteExperimental(
        type=TYPE_MANIFESTE,
        version=VERSION_CORPUS_EXPERIMENTAL,
        genere_le=jour,
        description=(
            "Exercices pédagogiques originaux alignés sur le CECRL, non officiels. "
            "Aucun PDF officiel, aucune licence et aucun auteur déclaré."
        ),
        fichiers=tuple(sources),
        comptages=ComptagesExperimental(
            total=len(corpus.exercices),
            par_langue=dict(Counter(exercice.code_langue for exercice in corpus.exercices)),
            par_niveau=dict(Counter(exercice.niveau for exercice in corpus.exercices)),
            par_nature=dict(Counter(exercice.nature for exercice in corpus.exercices)),
        ),
        empreinte_corpus_sha256=empreinte_fichiers(sources),
    )


def main() -> None:
    analyse = argparse.ArgumentParser(description="Régénérer le manifeste du corpus expérimental CARCL.")
    analyse.add_argument("--dossier", type=Path, default=CHEMIN_CORPUS_PAR_DEFAUT)
    analyse.add_argument("--date", type=_jour, default=date.today(), metavar="AAAA-MM-JJ")
    arguments = analyse.parse_args()

    manifeste = _generer(arguments.dossier, arguments.date)
    chemin_sortie = arguments.dossier / FICHIER_MANIFESTE_EXPERIMENTAL
    payload = json.dumps(manifeste.model_dump(mode="json"), ensure_ascii=False, indent=2) + "\n"
    chemin_sortie.write_bytes(payload.encode("utf-8"))
    print(f"Manifeste écrit : {chemin_sortie} ({manifeste.comptages.total} exercices)")


if __name__ == "__main__":
    main()
