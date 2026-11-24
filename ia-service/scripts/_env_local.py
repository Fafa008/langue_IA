"""Chargement local du fichier ``.env`` racine pour les scripts de vérification.

L'application ne lit jamais ``.env`` : en production, les variables viennent de l'environnement (Compose ou
l'orchestrateur). Ce module sert uniquement aux scripts lancés depuis le dépôt, pour éviter de recopier les valeurs
à la main. Il ne remplace jamais une variable déjà définie et n'affiche ni ne journalise aucune valeur.
"""

from __future__ import annotations

import os
import re
from pathlib import Path

RACINE_DEPOT = Path(__file__).resolve().parents[2]
CHEMIN_ENV = RACINE_DEPOT / ".env"
_NOM_VARIABLE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _valeur_sans_commentaire(brut: str) -> str:
    """Retirer les guillemets ou un commentaire inline, sans jamais interpréter la valeur."""
    valeur = brut.strip()
    if len(valeur) >= 2 and valeur[0] == valeur[-1] and valeur[0] in {'"', "'"}:
        return valeur[1:-1]
    return valeur.split(" #", 1)[0].strip()


def charger_env_local() -> None:
    """Copier dans le processus les variables manquantes du ``.env`` racine."""
    if not CHEMIN_ENV.is_file():
        return

    for ligne in CHEMIN_ENV.read_text(encoding="utf-8").splitlines():
        contenu = ligne.strip()
        if not contenu or contenu.startswith("#"):
            continue
        if contenu.startswith("export "):
            contenu = contenu.removeprefix("export ").strip()

        cle, separateur, valeur = contenu.partition("=")
        cle = cle.strip()
        if not separateur or not _NOM_VARIABLE.fullmatch(cle):
            continue

        os.environ.setdefault(cle, _valeur_sans_commentaire(valeur))
