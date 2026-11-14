# Chapitre 4 — Docker et CI/CD

> Fichiers : `docker-compose.yml`, `docker-compose.dev.yml`, `Makefile`,
> `backend/Dockerfile`, `frontend/Dockerfile`, `ia-service/Dockerfile`,
> `backend/docker-entrypoint.sh`, `.github/workflows/ci.yml`, `.github/workflows/cd.yml`.

---

## 1. Pourquoi Docker ici

Le projet a trois applications, deux langages (Python, Node) et deux services d'infrastructure
(PostgreSQL, Redis). Sans conteneurs, il faudrait installer et configurer chaque version sur
chaque poste. Docker apporte :

- **un environnement identique** en local et en CI ;
- **un démarrage ordonné** : la base est prête avant le backend, le backend avant le frontend ;
- **des images reproductibles** pour la livraison.

Le dépôt utilise **deux fichiers Compose** :

| Fichier | Usage | Commande |
| --- | --- | --- |
| `docker-compose.yml` | images de production | `docker compose up --build -d --wait` |
| `docker-compose.dev.yml` | surcouche de développement | `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` |

Le second **ne remplace pas** le premier : il le complète. C'est le principe des fichiers de
surcharge Compose.

---

## 2. La stack de production

```mermaid
graph TB
    subgraph Docker["réseau Docker « centre-langues »"]
        FE[frontend<br/>Next.js standalone :3000]
        BE[backend<br/>FastAPI :8000]
        IA[ia-service<br/>FastAPI :8001]
        DB[(postgres:16-alpine<br/>:5432 interne)]
        RD[(redis:7-alpine<br/>:6379 interne)]
        MV[(volume media_data)]
    end
    NAV[Navigateur] -->|localhost:3000| FE
    NAV -->|localhost:8000 + JWT| BE
    BE --> DB
    BE --> MV
    IA -.->|dépendance déclarée, non utilisée| RD
    BE -.->|dépendance déclarée, non utilisée| RD
    FE -->|healthcheck| BE
```

### 2.1 Services et dépendances

```yaml
services:
  db:
    image: postgres:16-alpine
    volumes: [postgres_data:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]

  redis:
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "yes"]
    volumes: [redis_data:/data]

  backend:
    build: { context: ./backend, target: prod }
    depends_on:
      db: { condition: service_healthy }
      redis: { condition: service_healthy }
    volumes: [media_data:/srv/media]
    ports: ["${BACKEND_PORT:-8000}:8000"]

  ia-service:
    build: { context: ./ia-service, target: prod }
    depends_on:
      redis: { condition: service_healthy }
    volumes:
      - ./ia-service/models:/app/models:ro
      - ./ia-service/corpus:/app/corpus:ro
    ports: ["${IA_PORT:-8001}:8001"]

  frontend:
    build:
      context: ./frontend
      target: prod
      args:
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:8000}
        NEXT_PUBLIC_API_MOCK: ${NEXT_PUBLIC_API_MOCK:-false}
    depends_on:
      backend: { condition: service_healthy }
    ports: ["${FRONTEND_PORT:-3000}:3000"]

volumes:
  postgres_data:
  redis_data:
  media_data:
```

Points importants :

- **`condition: service_healthy`** : Docker attend le healthcheck, pas seulement le démarrage
  du conteneur. C'est ce qui évite que le backend tente une migration avant que PostgreSQL
  accepte les connexions.
- **PostgreSQL et Redis ne publient aucun port** en production : ils ne sont joignables que par
  le réseau Docker. C'est une bonne pratique de sécurité.
- **`media_data`** est un volume nommé : les photos survivent à `docker compose down`, mais pas
  à `down --volumes`.
- **`ia-service/models` et `ia-service/corpus`** sont montés en lecture seule (`:ro`) : un
  conteneur ne peut pas modifier les modèles ni le corpus.
- **Les URLs internes** utilisent les noms de service (`db`, `redis`, `ia-service`), pas
  `localhost`. Un `localhost` dans un conteneur désigne le conteneur lui-même.

### 2.2 Variables d'environnement

Le bloc `x-python-env` est partagé par les services Python :

```yaml
x-python-env: &python-env
  POSTGRES_HOST: db
  POSTGRES_PORT: "5432"
  DATABASE_URL: postgresql://${POSTGRES_USER:-admin}:${POSTGRES_PASSWORD:-changeme}@db:5432/${POSTGRES_DB:-centre_langues}
  REDIS_HOST: redis
  REDIS_PORT: "6379"
  IA_SERVICE_URL: http://ia-service:8001
  BACKEND_CORS_ORIGINS: ${BACKEND_CORS_ORIGINS:-http://localhost:3000,http://localhost:8000}
```

La syntaxe `${VAR:-défaut}` fournit une valeur si la variable n'est pas définie. Le fichier
`.env` à la racine est **facultatif** : Compose l'utilise pour l'interpolation, et le service
`backend` le déclare explicitement avec `env_file: { path: .env, required: false }`.

Attention : `IA_SERVICE_URL` est bien injectée au backend **et lue** depuis PRE-05
(`app/core/config.py`, `app/services/ia.py`) pour l'analyse du diagnostic. En revanche
`REDIS_HOST`/`REDIS_PORT` sont fournies sans être utilisées.

### 2.3 Healthchecks

| Service | Sonde |
| --- | --- |
| `db` | `pg_isready -U … -d …` |
| `redis` | `redis-cli ping` |
| `backend` | `urllib.request.urlopen('http://127.0.0.1:8000/health')` |
| `ia-service` | idem sur `:8001` |
| `frontend` | `wget -qO- http://127.0.0.1:3000/` |

Un healthcheck ne prouve pas que l'application fonctionne : `/health` du backend ne touche pas
la base. Il prouve que le processus HTTP répond.

---

## 3. La surcouche de développement

```yaml
services:
  db:
    ports: ["127.0.0.1:${POSTGRES_HOST_PORT:-55432}:5432"]
  redis:
    ports: ["127.0.0.1:${REDIS_HOST_PORT:-56379}:6379"]

  backend:
    build: { target: dev }
    restart: "no"
    volumes: ["./backend:/app"]

  ia-service:
    build: { target: dev }
    restart: "no"
    volumes: ["./ia-service:/app"]

  frontend:
    build: { target: dev }
    restart: "no"
    environment:
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:8000}
      NEXT_PUBLIC_API_MOCK: ${NEXT_PUBLIC_API_MOCK:-false}
      WATCHPACK_POLLING: "true"
    volumes:
      - ./frontend:/app
      - /app/node_modules
      - /app/.next
```

Ce qui change :

1. **les sources sont montées** : une modification est vue sans reconstruire l'image ;
2. **la cible `dev`** contient les outils de test et `--reload` ;
3. **les ports de la base et de Redis sont publiés** sur `127.0.0.1` uniquement, avec des ports
   peu courants (`55432`, `56379`) pour ne pas gêner un PostgreSQL local ;
4. **`restart: "no"`** : un conteneur de développement ne redémarre pas tout seul après un
   reboot, car il monterait les sources du jour sur une image aux dépendances périmées ;
5. **volumes anonymes** pour `node_modules` et `.next` : on garde les modules Linux de l'image,
   pas ceux de la machine hôte (Windows/macOS).

Reconstruire après un changement de dépendances :

```powershell
make dev
# ou
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

`WATCHPACK_POLLING=true` est nécessaire pour que Next.js détecte les modifications à travers
le montage Docker sur Windows/WSL.

---

## 4. Les Dockerfiles multi-étapes

### 4.1 Backend

```dockerfile
FROM python:3.11-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 ...
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

FROM base AS dev
COPY requirements-dev.txt .
RUN pip install -r requirements-dev.txt
COPY . .
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

FROM base AS prod
RUN useradd --create-home --uid 1001 app
COPY --chown=app:app . .
RUN mkdir -p /srv/media/photos && chown -R app:app /srv/media
USER app
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

Pourquoi cette structure :

- **la couche des dépendances est séparée** : elle n'est reconstruite que si
  `requirements.txt` change ;
- **la cible `dev`** ajoute les outils et le rechargement ;
- **la cible `prod`** crée un utilisateur non-root (`uid 1001`) et prépare `/srv/media` avec le
  bon propriétaire, pour que le volume hérite des droits ;
- **`PYTHONDONTWRITEBYTECODE=1`** évite d'écrire des `.pyc` dans l'image.

### 4.2 Frontend

```dockerfile
FROM node:22-alpine AS base
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]

FROM base AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_API_MOCK=false
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_API_MOCK=$NEXT_PUBLIC_API_MOCK
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS prod
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
CMD ["node", "server.js"]
```

Le point crucial : **`NEXT_PUBLIC_*` est inliné au build**. Ces variables ne sont pas lues à
l'exécution, elles sont écrites dans le JavaScript. Changer `NEXT_PUBLIC_API_URL` impose donc
de **reconstruire l'image**, pas seulement de redémarrer le conteneur.

`output: "standalone"` (dans `next.config.js`) produit un serveur Node autonome ; l'image finale
ne contient que le strict nécessaire, pas tout `node_modules`.

### 4.3 Service IA

```dockerfile
FROM python:3.11-slim AS base
COPY requirements.txt .
RUN pip install -r requirements.txt

FROM base AS dev
COPY requirements-dev.txt .
RUN pip install -r requirements-dev.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--reload"]

FROM base AS prod
RUN useradd --create-home --uid 1001 app
COPY --chown=app:app . .
RUN python -m compileall -q "$(python -c 'import sysconfig; print(sysconfig.get_paths()[\"stdlib\"])')" app
USER app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]
```

La ligne `compileall` mérite une explication : avec `--workers`, Uvicorn surveille ses workers
et tue celui qui ne répond pas en 5 s. Au premier démarrage à froid, l'import de l'application
peut dépasser ce délai sur une machine lente. Précompiler les `.pyc` au build rend le démarrage
déterministe.

---

## 5. Le point d'entrée du backend

```sh
#!/bin/sh
set -e

alembic upgrade head
python -m app.seed

exec "$@"
```

- `set -e` : si une migration échoue, le conteneur s'arrête au lieu de servir une API sur un
  schéma incohérent ;
- `alembic upgrade head` applique les migrations en attente ;
- `python -m app.seed` recharge le référentiel (et les comptes de démo si `SEED_DEMO=true`) ;
- `exec "$@"` remplace le shell par la commande `CMD` (uvicorn), pour que les signaux d'arrêt
  arrivent au bon processus.

Conséquence : **le seed s'exécute à chaque démarrage**, pas seulement au premier. Il doit donc
être idempotent, et il l'est.

---

## 6. Configuration et secrets

| Variable | Où | Remarque |
| --- | --- | --- |
| `SECRET_KEY` | `.env` / environnement | clé de signature JWT ; le garde-fou production existe |
| `DATABASE_URL` | compose | remplacée par `db:5432` dans les conteneurs |
| `BACKEND_CORS_ORIGINS` | compose | doit contenir l'origine du frontend |
| `SEED_DEMO` | compose | `true` par défaut — à passer à `false` en production |
| `NEXT_PUBLIC_*` | build frontend | intégrées au JavaScript |
| `LLM_*`, `GEMINI_*` | compose `ia-service` | clés réservées au service IA |
| `ENVIRONNEMENT` | compose `ia-service` | `dev` par défaut |

Deux failles de configuration à connaître :

1. **Le backend ne reçoit jamais `ENVIRONMENT=production`** dans `docker-compose.yml`. Le
   validateur `secret_obligatoire_en_production` de `config.py` ne se déclenche donc pas : la
   stack « production » peut démarrer avec `changeme_super_secret_key_here`.
2. **`SEED_DEMO` vaut `true` par défaut**. Les comptes `apprenant@`, `formateur@`,
   `admin@digitheque.mg` / `Demo2026` existent si personne ne pense à le désactiver.

De plus, `docker-compose.yml` fixe explicitement `LLM_API_KEY: ""` et `GEMINI_API_KEY: ""` pour
le backend : c'est volontaire, les clés ne doivent pas fuiter dans un service qui n'appelle pas
le LLM.

---

## 7. La CI (`.github/workflows/ci.yml`)

Déclencheurs : push sur `main` et `develop`, toutes les pull requests, lancement manuel.
`concurrency` annule l'exécution précédente d'une même branche.

| Job | Ce qu'il fait | Durée max |
| --- | --- | --- |
| `frontend` | `npm ci` → `npm run check` (typage, lint, Jest) → `npm run build` | 15 min |
| `e2e` | `npm ci` → Chromium → `npm run test:e2e` → traces en artefact si échec | 30 min |
| `backend` | PostgreSQL de service → `ruff check` + `ruff format --check` → `pytest --cov-fail-under=70` | 15 min |
| `ia-service` | `ruff` → import de l'app → `pytest --cov-fail-under=70` | 10 min |
| `docker` | `docker compose up --build --wait` → healthchecks → seed idempotent → build des images dev | 25 min |

### 7.1 Le job backend

```yaml
services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_DB: centre_langues
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: changeme
    ports: ["5432:5432"]
    options: >-
      --health-cmd "pg_isready -U admin -d centre_langues"
      --health-interval 5s --health-timeout 5s --health-retries 10
env:
  DATABASE_URL: postgresql://admin:changeme@localhost:5432/centre_langues
steps:
  - run: pip install -r requirements-dev.txt
  - run: ruff check . && ruff format --check .
  - run: pytest --cov=app --cov-report=term-missing:skip-covered --cov-fail-under=70
```

Les tests créent et migrent `centre_langues_test` à côté de la base fournie. C'est pour cela
qu'un `pytest` lancé hors Docker sans PostgreSQL échoue.

### 7.2 Le job docker

```yaml
- run: docker compose up --build --detach --wait --wait-timeout 300
- run: |
    curl --fail --silent http://localhost:8000/health
    curl --fail --silent http://localhost:8001/health
    curl --fail --silent --output /dev/null http://localhost:3000/login
    curl --fail --silent http://localhost:8000/api/v1/formules | grep -q '"libelle":"Simple"'
- run: |
    jeton=$(curl ... /auth/login ... | jq -r .access_token)
    curl ... /diagnostic/langues | jq -e '[.[] | select(.disponible)] | map(.code) | contains(["en", "fr"])'
- run: docker compose exec -T backend python -m app.seed
- if: failure()
  run: docker compose logs --no-color
- if: always()
  run: docker compose down --volumes
- run: |
    docker compose -f docker-compose.yml -f docker-compose.dev.yml config --quiet
    docker compose -f docker-compose.yml -f docker-compose.dev.yml build
```

Ce job est le plus proche de la réalité : il vérifie que la stack **démarre**, que les services
**répondent**, que le seed permet de **passer le diagnostic**, et que le seed est **idempotent**.
Il construit aussi les images de développement, sans les démarrer.

`needs: [frontend, backend, ia-service]` : le job docker ne démarre que si les trois autres
passent. Le job `e2e` n'est pas dans `needs` : il tourne en parallèle.

### 7.3 Ce que la CI ne couvre pas

- pas de test de charge ;
- pas d'analyse de sécurité (dépendances, image, secrets) ;
- pas de scan de vulnérabilités ;
- pas de vérification que le service IA et le backend se parlent (l'appel est best-effort, donc
  une régression passerait inaperçue) ;
- pas de test du vrai parcours navigateur contre le vrai backend : les E2E simulent HTTP.

---

## 8. La CD (`.github/workflows/cd.yml`)

Déclencheurs : push sur `main`, tag `v*.*.*`, lancement manuel.

```yaml
strategy:
  matrix:
    service: [frontend, backend, ia-service]
steps:
  - nom de l'image en minuscules
  - docker/setup-buildx-action
  - docker/login-action vers ghcr.io avec GITHUB_TOKEN
  - docker/metadata-action (tags latest, sha-, semver)
  - docker/build-push-action (target prod, push: true, build-args NEXT_PUBLIC_*)
```

Images publiées :

```
ghcr.io/<propriétaire>/<dépôt>-frontend
ghcr.io/<propriétaire>/<dépôt>-backend
ghcr.io/<propriétaire>/<dépôt>-ia-service
```

Tags :

- `latest` sur la branche par défaut ;
- `sha-<commit>` à chaque push ;
- `X.Y.Z` et `X.Y` pour un tag de version.

**Ce que la CD ne fait pas** :

- elle **ne déploie pas** : aucun `docker pull` sur un serveur, aucun `kubectl`, aucun SSH ;
- elle **ne dépend pas de la CI** : un push sur `main` peut publier une image même si les tests
  ont échoué (les deux workflows sont indépendants) ;
- elle ne signe pas les images et ne produit pas de SBOM.

L'URL de l'API est lue dans la variable de dépôt `NEXT_PUBLIC_API_URL`, avec un repli sur
`http://localhost:8000`. Si la variable n'est pas définie, l'image publiée pointera vers
`localhost` — inutilisable pour un vrai déploiement.

---

## 9. Pièges et limites

1. **`NEXT_PUBLIC_*` figé au build** : un changement impose `--build`, pas un simple restart.
2. **Le frontend ne lit pas le `.env` racine** : il lit `frontend/.env.development` puis
   `frontend/.env.local`.
3. **Pas de `ENVIRONMENT=production`** pour le backend dans Compose : le garde-fou `SECRET_KEY`
   est inopérant.
4. **`SEED_DEMO=true` par défaut** : comptes de démonstration en production si oubli.
5. **Pas de TLS ni de reverse proxy** : le trafic est en HTTP clair. En production réelle, il
   faut un proxy (Caddy, Nginx, Traefik) et des certificats.
6. **La CD ne déploie pas** : publier une image n'est pas livrer.
7. **La CD ne dépend pas de la CI** : une image peut être publiée alors que les tests échouent.
8. **Redis est fourni mais inutilisé** ; `IA_SERVICE_URL` est lu, mais l'appel reste
   best-effort et non testé de bout en bout par la CI.
9. **Le Makefile n'est pas portable sous Windows** : `--user "$(id -u):$(id -g)"` est POSIX.
   Utiliser les commandes `docker compose` équivalentes.
10. **`/health` ne teste pas la base** : un conteneur peut être « healthy » et l'API en erreur.
11. **Les modèles IA ne sont pas versionnés** : `ia-service/models/` est ignoré ; un modèle
    absent n'est pas détecté au démarrage.
12. **Pas de limite de ressources** dans Compose (`mem_limit`, `cpus`) : un agent ou un build
    peut consommer toute la machine.
13. **Pas de politique de rotation des journaux** : les logs Docker peuvent grossir.
14. **Un seul fichier `.env`** partagé par tous les services : une clé mal placée peut être
    exposée à un service qui n'en a pas besoin (même si Compose limite ici les clés LLM du
    backend).

---

## 10. Commandes utiles

```powershell
# Production
docker compose up --build -d --wait
docker compose ps
docker compose logs -f backend
docker compose down

# Développement
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
docker compose -f docker-compose.yml -f docker-compose.dev.yml down

# Tout effacer (base, Redis, photos)
docker compose down --volumes

# Tests backend
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm backend pytest

# Tests service IA
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm --no-deps ia-service pytest

# Migration
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm backend `
  alembic revision --autogenerate -m "description"

# Seed manuel
docker compose exec backend python -m app.seed

# Console SQL
docker compose exec db psql -U admin -d centre_langues

# Vérifier la configuration Compose sans démarrer
docker compose -f docker-compose.yml -f docker-compose.dev.yml config --quiet

# Reconstruire une seule image
docker compose build backend
```

Sous Windows, remplacer les `\` de continuation par des backticks PowerShell (`` ` ``) et
supprimer `--user "$(id -u):$(id -g)"`.

---

## 11. Ce que tu dois maîtriser

- La différence entre **image** (modèle figé) et **conteneur** (instance en cours).
- Le rôle d'un **Dockerfile multi-étapes** et pourquoi la couche de dépendances est séparée.
- La différence entre **`COPY`** et **volume monté**, et l'effet sur le rechargement à chaud.
- Le rôle d'un **healthcheck** et la différence entre « démarré » et « prêt ».
- Pourquoi `localhost` dans un conteneur ne désigne pas la machine hôte.
- Pourquoi `NEXT_PUBLIC_*` doit être présent au **build**.
- Le rôle de `depends_on: condition: service_healthy`.
- Ce que fait `docker-entrypoint.sh` et pourquoi `exec "$@"`.
- La structure d'un workflow GitHub Actions : `on`, `jobs`, `steps`, `needs`, `services`,
  `matrix`.
- La différence entre **CI** (tester) et **CD** (publier / déployer), et pourquoi publier n'est
  pas déployer.
- Les secrets : `GITHUB_TOKEN`, variables de dépôt, `.env` non commité.

---

## Questions de compréhension

1. Tu changes `NEXT_PUBLIC_API_URL` dans le `.env`, puis tu fais `docker compose restart
   frontend`. Pourquoi l'interface continue-t-elle d'appeler l'ancienne URL ? Quelle commande
   faut-il lancer ?
2. Le backend démarre avant que PostgreSQL soit prêt. Quel mécanisme de Compose l'empêche, et
   que se passerait-il sans lui ?
3. `docker compose down` puis `docker compose up` : les photos de profil et les données de la
   base sont-elles conservées ? Et après `docker compose down --volumes` ?
4. La CD publie une image sur `main` alors que le job `backend` de la CI a échoué. Est-ce
   possible ? Pourquoi ? Quelle correction proposerais-tu ?
5. La stack de production démarre avec `SECRET_KEY=changeme_super_secret_key_here`. Le
   validateur censé l'interdire ne se déclenche pas. Explique pourquoi et propose un correctif
   dans `docker-compose.yml`.
