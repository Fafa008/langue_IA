"""Vérifie que les commandes Python locales utilisent la version supportée."""

import sys

VERSION_ATTENDUE = (3, 11)


def main() -> int:
    """Afficher un diagnostic explicite lorsque Python n'est pas en version 3.11."""
    version = sys.version_info[:2]
    if version != VERSION_ATTENDUE:
        print(
            f"Python {VERSION_ATTENDUE[0]}.{VERSION_ATTENDUE[1]} est requis "
            f"(version détectée : {version[0]}.{version[1]}). "
            "Utilisez uv --python 3.11, pyenv ou l'environnement Docker du projet.",
            file=sys.stderr,
        )
        return 1
    print("Python 3.11 détecté.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
