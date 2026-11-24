"""Vérifie les prérequis Docker et les ports configurés, sans afficher de secrets."""

from __future__ import annotations

import os
import re
import shutil
import socket
import subprocess
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
VERSIONS_DOCKER_MIN = (24, 0, 0)
VERSIONS_COMPOSE_MIN = (2, 20, 0)
PORTS_PAR_DEFAUT = {
    "FRONTEND_PORT": 3000,
    "BACKEND_PORT": 8000,
    "POSTGRES_HOST_PORT": 55432,
    "REDIS_HOST_PORT": 56379,
}


def _variables_env(chemin: Path) -> dict[str, str]:
    """Lire les variables simples de l'exemple .env sans interpréter ni afficher leur contenu."""
    variables: dict[str, str] = {}
    if not chemin.is_file():
        return variables
    for ligne in chemin.read_text(encoding="utf-8").splitlines():
        ligne = ligne.strip()
        if not ligne or ligne.startswith("#") or "=" not in ligne:
            continue
        nom, valeur = ligne.split("=", 1)
        variables[nom.strip()] = valeur.strip().strip("\"'")
    return variables


def _version(commande: list[str]) -> tuple[int, ...] | None:
    """Exécuter une commande de version et en extraire les composantes numériques."""
    resultat = subprocess.run(commande, capture_output=True, text=True, check=False)
    if resultat.returncode:
        return None
    correspondance = re.search(r"v?(\d+(?:\.\d+)+)", resultat.stdout + resultat.stderr)
    if not correspondance:
        return None
    composantes = tuple(int(partie) for partie in correspondance.group(1).split("."))
    return composantes + (0,) * max(0, 3 - len(composantes))


def _port_libre(port: int) -> bool:
    """Tester la disponibilité d'un port IPv4 local."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as serveur:
        try:
            serveur.bind(("127.0.0.1", port))
        except OSError:
            return False
    return True


def main() -> int:
    """Afficher les prérequis vérifiés et retourner un code non nul en cas de blocage."""
    erreurs = 0
    docker = shutil.which("docker")
    if docker is None:
        print("ERREUR : Docker est introuvable. Installez Docker Desktop ou Docker Engine.")
        return 1
    docker_version = _version([docker, "--version"])
    if docker_version is None:
        print("ERREUR : impossible de lire la version de Docker.")
        erreurs += 1
    elif docker_version < VERSIONS_DOCKER_MIN:
        print("ERREUR : Docker Engine/Desktop 24.0+ est requis.")
        erreurs += 1
    else:
        print(f"OK : Docker {'.'.join(map(str, docker_version))}.")

    compose_version = _version([docker, "compose", "version", "--short"])
    if compose_version is None:
        print("ERREUR : le plugin Docker Compose est introuvable ou ne répond pas.")
        erreurs += 1
    elif compose_version < VERSIONS_COMPOSE_MIN:
        print("ERREUR : Docker Compose 2.20+ est requis.")
        erreurs += 1
    else:
        print(f"OK : Docker Compose {'.'.join(map(str, compose_version))}.")

    daemon = subprocess.run([docker, "info", "--format", "{{.ServerVersion}}"], capture_output=True, text=True)
    if daemon.returncode:
        print("ERREUR : Docker ne répond pas. Démarrez Docker Desktop ou vérifiez vos permissions Docker.")
        erreurs += 1
    else:
        print("OK : le moteur Docker est accessible.")

    chemin_env = RACINE / ".env"
    if chemin_env.is_file():
        print("OK : .env est présent.")
    else:
        print("ERREUR : .env est absent. Créez-le avec : cp .env.example .env")
        erreurs += 1

    variables = _variables_env(chemin_env)
    for nom, defaut in PORTS_PAR_DEFAUT.items():
        valeur = os.environ.get(nom) or variables.get(nom) or str(defaut)
        try:
            port = int(valeur)
        except ValueError:
            print(f"ERREUR : {nom} doit être un numéro de port.")
            erreurs += 1
            continue
        if not 1 <= port <= 65535:
            print(f"ERREUR : {nom} doit être compris entre 1 et 65535.")
            erreurs += 1
        elif _port_libre(port):
            print(f"OK : port {port} ({nom}) disponible.")
        else:
            print(f"ERREUR : port {port} ({nom}) déjà occupé ; changez {nom} dans .env.")
            erreurs += 1

    version_python = sys.version_info[:2]
    if version_python == (3, 11):
        print("OK : Python local 3.11.")
    else:
        print(
            f"INFO : Python local {version_python[0]}.{version_python[1]} ; "
            "optionnel, utilisez Docker ou un environnement Python 3.11."
        )

    node = shutil.which("node")
    if node is None:
        print("INFO : Node.js local absent ; optionnel, le frontend tourne dans Docker.")
    else:
        version_node = _version([node, "--version"])
        if version_node and version_node[0] == 22:
            print(f"OK : Node.js {'.'.join(map(str, version_node))}.")
        else:
            version = ".".join(map(str, version_node)) if version_node else "inconnue"
            print(f"INFO : Node.js local {version} ; optionnel, utilisez la version 22 (`.nvmrc`) ou Docker.")

    if erreurs:
        print(f"Diagnostic terminé : {erreurs} prérequis à corriger.")
        return 1
    print("Diagnostic terminé : prérequis Docker satisfaits.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
