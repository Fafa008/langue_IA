# Raccourcis Docker du monorepo (sans make : copier la commande affichée à droite de chaque cible).
COMPOSE = docker compose
DEV = $(COMPOSE) -f docker-compose.yml -f docker-compose.dev.yml

.PHONY: help up dev down logs ps build reset test migration

help: ## Affiche cette aide
	@grep -E '^[a-z]+:.*## ' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  make %-10s %s\n", $$1, $$2}'

up: ## Stack complète, images de production (en arrière-plan)
	$(COMPOSE) up --build -d --wait

dev: ## Stack de développement : sources montées, rechargement à chaud
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

test: ## Tests du backend (pytest, base PostgreSQL de test créée à côté de la base principale)
	$(DEV) run --rm --user "$$(id -u):$$(id -g)" backend pytest

migration: ## Crée une migration depuis les modèles : make migration m="ajout table atelier"
	$(DEV) run --rm --user "$$(id -u):$$(id -g)" --entrypoint alembic backend revision --autogenerate -m "$(m)"
