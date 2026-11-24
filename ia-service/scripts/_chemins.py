"""Résolution des racines du dépôt et du service dans les scripts IA."""

from pathlib import Path


def trouver_racine_depot(chemin_script: Path) -> Path:
    """Trouver la racine monorepo sur l'hôte ou celle du service dans son conteneur."""
    parents = tuple(parent for parent in chemin_script.resolve().parents if parent != parent.parent)

    for parent in parents:
        if (parent / ".git").exists() or (
            (parent / "backend" / "pyproject.toml").is_file() and (parent / "ia-service" / "pyproject.toml").is_file()
        ):
            return parent

    for parent in parents:
        if (parent / "pyproject.toml").is_file():
            return parent

    return parents[0]
