#!/bin/sh
# Démarrage du backend : migrations, données de référence, puis la commande du conteneur (uvicorn).
set -e

alembic upgrade head
# Référentiel (langues, niveaux, formules) toujours ; comptes de démonstration si SEED_DEMO=true
python -m app.seed

exec "$@"
