# syntax=docker/dockerfile:1
# Service IA FastAPI (Python 3.11) — image multi-étapes.
#   cible « dev »  : uvicorn --reload (docker-compose.dev.yml monte les sources)
#   cible « prod » : uvicorn avec plusieurs workers, utilisateur non-root

FROM python:3.11-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app
# Dépendances seules : cette couche n'est reconstruite que si requirements.txt change
COPY requirements.txt .
RUN pip install -r requirements.txt

FROM base AS dev
COPY . .
EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--reload"]

FROM base AS prod
RUN useradd --create-home --uid 1001 app
COPY --chown=app:app . .
USER app
EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]
