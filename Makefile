# Raccourcis Docker du monorepo (sans make : copier la commande affichée à droite de chaque cible).
COMPOSE = docker compose
DEV = $(COMPOSE) -f docker-compose.yml -f docker-compose.dev.yml
# Si id n'existe pas (Windows natif), Docker Desktop gère les permissions des fichiers montés.
MOI = $(shell if command -v id >/dev/null 2>&1 && id -u >/dev/null 2>&1 && id -g >/dev/null 2>&1; then printf '%s' "--user $$(id -u):$$(id -g)"; fi)

.PHONY: help up dev down logs ps build reset seed test test-ia check check-backend check-ia check-front doctor migration

help: ## Affiche cette aide
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  make %-10s %s\n", $$1, $$2}'

up: ## Stack complète, images de production (en arrière-plan)
	$(COMPOSE) up --build -d --wait

dev: ## Stack de développement : sources montées, rechargement à chaud (reconstruit les images si besoin)
	$(DEV) up --build

down: ## Arrête la stack (les données de la base sont conservées)
	$(COMPOSE) down

logs: ## Suit les journaux de tous les services
	$(COMPOSE) logs -f

ps: ## État des conteneurs
	$(COMPOSE) ps

build: ## Reconstruit les images (après un changement de dépendances ou de NEXT_PUBLIC_*)
	$(COMPOSE) build

reset: ## Arrête la stack ET supprime les données (base PostgreSQL, Redis, photos)
	$(COMPOSE) down --volumes

seed: ## Recharge les données de départ dans la stack lancée (référentiel, comptes et questions de démo)
	$(COMPOSE) exec backend python -m app.seed

test: ## Tests du backend (pytest, base PostgreSQL de test créée à côté de la base principale)
	$(DEV) run --build --rm $(MOI) backend pytest

test-ia: ## Tests du service IA (pytest, sans base ni clé LLM)
	$(DEV) run --build --rm --no-deps $(MOI) ia-service pytest -p no:cacheprovider

check-backend: ## Ruff, formatage et pytest avec couverture (backend)
	$(DEV) run --build --rm $(MOI) -e RUFF_NO_CACHE=true backend sh -c \
		"ruff check . && ruff format --check . && pytest -q --cov=app --cov-fail-under=70"

check-ia: ## Ruff, formatage et pytest avec couverture (service IA)
	$(DEV) run --build --rm --no-deps $(MOI) -e RUFF_NO_CACHE=true ia-service sh -c \
		"ruff check . && ruff format --check . && pytest -q -p no:cacheprovider --cov=app --cov-fail-under=70"

check-front: ## Typage, lint et Jest (frontend)
	$(DEV) run --build --rm --no-deps frontend npm run check

check: check-backend check-ia check-front ## Mêmes contrôles que la CI : backend, service IA et frontend

doctor: ## Vérifie Docker, .env, les ports et les versions locales facultatives
	@if command -v python3 >/dev/null 2>&1; then python3 scripts/doctor.py; \
	elif command -v python >/dev/null 2>&1; then python scripts/doctor.py; \
	else echo "Python absent : exécutez scripts/dev.ps1 doctor sous Windows."; exit 1; fi

migration: ## Crée une migration depuis les modèles : make migration m="ajout table atelier"
	$(DEV) run --build --rm $(MOI) --entrypoint alembic backend revision --autogenerate -m "$(m)"
