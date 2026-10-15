# syntax=docker/dockerfile:1
# Backend FastAPI (Python 3.11) — image multi-étapes.
#   cible « dev »  : uvicorn --reload et outils de test (docker-compose.dev.yml monte les sources)
#   cible « prod » : uvicorn avec plusieurs workers, utilisateur non-root
# Au démarrage, docker-entrypoint.sh applique les migrations et charge les données de référence.

FROM python:3.11-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    MEDIA_DIR=/srv/media
WORKDIR /app
# Dépendances seules : cette couche n'est reconstruite que si requirements.txt change
COPY requirements.txt .
RUN pip install -r requirements.txt

FROM base AS dev
COPY requirements-dev.txt .
RUN pip install -r requirements-dev.txt
COPY . .
EXPOSE 8000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

FROM base AS prod
RUN useradd --create-home --uid 1001 app
COPY --chown=app:app . .
# Dossier des photos (hors de /app, monté en dev) créé avec le bon propriétaire : le volume en hérite
RUN mkdir -p /srv/media/photos && chown -R app:app /srv/media
USER app
EXPOSE 8000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
