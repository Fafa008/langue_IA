"""Racine du dépôt protégée par les scripts d'ingestion : aucun corpus sous droits ne doit y être écrit.

Sur un poste de développement ou en CI, c'est le premier dossier parent qui contient ``.git`` (un worktree a un
fichier ``.git``). Dans l'image Docker, le service est copié seul dans ``/app`` sans ``.git`` : c'est alors le dossier
du service lui-même qui est protégé. Prendre ``parents[2]`` aveuglément donnait ``/`` dans le conteneur, et le
script refusait toute sortie.
"""

from __future__ import annotations

from pathlib import Path

DOSSIER_SERVICE = Path(__file__).resolve().parents[1]


def trouver_racine_depot(depart: Path = DOSSIER_SERVICE) -> Path:
    """Premier dossier contenant ``.git`` en remontant depuis ``depart``, sinon ``depart`` lui-même."""
    for dossier in (depart, *depart.parents):
        if (dossier / ".git").exists():
            return dossier
    return depart


RACINE_DEPOT = trouver_racine_depot()
