# Raccourcis Docker du monorepo (sans make : copier la commande affichée à droite de chaque cible).
COMPOSE = docker compose
DEV = $(COMPOSE) -f docker-compose.yml -f docker-compose.dev.yml
# Conteneurs de test lancés avec l'utilisateur courant : fichiers créés (cache, couverture) à votre nom
# run --build : reconstruit l'image dev si requirements*.txt ou package.json ont changé depuis la dernière fois
MOI = --user "$$(id -u):$$(id -g)"

.PHONY: help up dev down logs ps build reset seed test test-ia check migration

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

check: ## Mêmes contrôles que la CI, avant d'ouvrir une PR : ruff, pytest + couverture, typage, lint, Jest
	$(DEV) run --build --rm $(MOI) -e HOME=/tmp -e RUFF_NO_CACHE=true backend sh -c \
		"ruff check . && ruff format --check . && pytest -q --cov=app --cov-fail-under=70"
	$(DEV) run --build --rm --no-deps $(MOI) -e RUFF_NO_CACHE=true ia-service sh -c \
		"ruff check . && ruff format --check . && pytest -q -p no:cacheprovider --cov=app --cov-fail-under=70"
	$(DEV) run --build --rm --no-deps frontend npm run check

migration: ## Crée une migration depuis les modèles : make migration m="ajout table atelier"
	$(DEV) run --build --rm $(MOI) --entrypoint alembic backend revision --autogenerate -m "$(m)"
