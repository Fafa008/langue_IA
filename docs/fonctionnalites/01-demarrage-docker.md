# 01 — Démarrage avec Docker

> Référence : `docker-compose.yml`, `docker-compose.dev.yml`, `Makefile`, `backend/docker-entrypoint.sh`,
> `backend/Dockerfile`, `frontend/Dockerfile`, `ia-service/Dockerfile`, `.github/workflows/ci.yml`.
> Constat du **14 novembre 2026**, branche `develop` (`95543db`) + branche de documentation.

---

## 1. Pourquoi Docker ici

Le projet réunit quatre technologies qui ont chacune leurs dépendances :

| Service | Technologie | Dépendances lourdes |
| --- | --- | --- |
| `frontend` | Next.js 14 / Node 22 | `node_modules`, build `.next` |
| `backend` | FastAPI / Python 3.11 | PostgreSQL, bibliothèques Python |
| `ia-service` | FastAPI / Python 3.11 | SDK LLM, corpus, modèles |
| `db` | PostgreSQL 16 | volume de données |
| `redis` | Redis 7 | volume de données |

Docker garantit que **tout le monde voit la même pile**, y compris sur Windows. C'est le mode de démarrage
recommandé par le `README.md` racine et par la CI.

---

## 2. Les deux modes

Le dépôt utilise **deux fichiers Compose** :

- `docker-compose.yml` : définition commune, images de **production** par défaut ;
- `docker-compose.dev.yml` : surcharge de **développement** (sources montées, rechargement à chaud).

### 2.1 Mode production locale (`make up`)

```powershell
# Depuis la racine du dépôt
docker compose up --build -d --wait
```

Effets :

- construit les cibles `prod` des trois Dockerfiles ;
- démarre `db`, `redis`, `backend`, `ia-service`, `frontend` ;
- attend que chaque healthcheck passe (`--wait`) ;
- publie uniquement `3000`, `8000`, `8001` sur la machine.

### 2.2 Mode développement (`make dev`)

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Effets supplémentaires :

- `./backend`, `./ia-service`, `./frontend` sont montés dans les conteneurs ;
- `uvicorn --reload` et `next dev` rechargent le code sans reconstruire ;
- PostgreSQL et Redis sont publiés sur `127.0.0.1:55432` et `127.0.0.1:56379` ;
- `restart: "no"` : les services ne redémarrent pas seuls après un reboot de la machine.

> **Sans `make` (Windows)** : `make` n'est pas fourni par défaut. Utilise les commandes `docker compose`
> ci-dessus. Le `Makefile` affiche d'ailleurs la commande brute en commentaire de chaque cible.

### 2.3 Différences à retenir

| Point | Prod (`docker-compose.yml`) | Dev (`+ docker-compose.dev.yml`) |
| --- | --- | --- |
| Code | copié dans l'image | monté depuis la machine |
| Rechargement | non | oui |
| PostgreSQL visible | non | `127.0.0.1:55432` |
| Redis visible | non | `127.0.0.1:56379` |
| `NEXT_PUBLIC_API_MOCK` | `false` par défaut | `false` par défaut (surchargeable) |
| Redémarrage auto | `unless-stopped` | `"no"` |
| Reconstruction | après tout changement | seulement après changement de dépendances |

---

## 3. Ports, volumes, réseau

### 3.1 Ports

| Service | Conteneur | Hôte (prod) | Hôte (dev) | Variable |
| --- | --- | --- | --- | --- |
| `frontend` | 3000 | 3000 | 3000 | `FRONTEND_PORT` |
| `backend` | 8000 | 8000 | 8000 | `BACKEND_PORT` |
| `ia-service` | 8001 | 8001 | 8001 | `IA_PORT` |
| `db` | 5432 | non publié | `127.0.0.1:55432` | `POSTGRES_HOST_PORT` |
| `redis` | 6379 | non publié | `127.0.0.1:56379` | `REDIS_HOST_PORT` |

Pourquoi 55432 et 56379 ? Pour ne pas entrer en conflit avec un PostgreSQL ou un Redis déjà installé sur la
machine.

### 3.2 Volumes nommés

| Volume | Monté dans | Contenu | Survit à `down` |
| --- | --- | --- | --- |
| `postgres_data` | `/var/lib/postgresql/data` | toutes les données métier | oui |
| `redis_data` | `/data` | persistance AOF Redis | oui |
| `media_data` | `/srv/media` | photos de profil | oui |

`docker compose down` **conserve** les volumes. `docker compose down --volumes` (`make reset`) les supprime.

### 3.3 Montages de développement et de lecture seule

| Montage | Service | Mode |
| --- | --- | --- |
| `./backend:/app` | backend dev | lecture/écriture |
| `./ia-service:/app` | ia-service dev | lecture/écriture |
| `./frontend:/app` | frontend dev | lecture/écriture |
| `/app/node_modules`, `/app/.next` | frontend dev | volumes anonymes (versions Linux) |
| `./ia-service/models:/app/models:ro` | ia-service | lecture seule |
| `./ia-service/corpus:/app/corpus:ro` | ia-service | lecture seule |

> Le montage `node_modules` anonyme est essentiel sur Windows : sans lui, les binaires natifs installés sur l'hôte
> écraseraient ceux de l'image Linux.

### 3.4 Réseau

Compose crée un réseau interne. **Dans les conteneurs, on utilise les noms de service** :

```
postgresql://admin:changeme@db:5432/centre_langues
redis://redis:6379
http://ia-service:8001
http://backend:8000
```

Les URLs `localhost` du `.env` racine ne valent que **hors Docker**. Compose les remplace explicitement
(`x-python-env`, `IA_SERVICE_URL`).

---

## 4. Séquence de démarrage

```
db (healthcheck pg_isready)
 │
 ├── redis (healthcheck redis-cli ping)
 │
 ├── backend (dépend de db + redis "healthy")
 │     ├── alembic upgrade head
 │     ├── python -m app.seed
 │     └── uvicorn app.main:app :8000
 │
 ├── ia-service (dépend de redis "healthy")
 │     └── uvicorn app.main:app :8001 --workers 2
 │
 └── frontend (dépend de backend "healthy")
       └── node server.js :3000
```

### 4.1 Ce que fait le backend à chaque démarrage

`backend/docker-entrypoint.sh` :

```sh
#!/bin/sh
set -e

alembic upgrade head
python -m app.seed

exec "$@"
```

Conséquences :

- **les migrations sont appliquées automatiquement** à chaque démarrage ;
- **le seed est rejoué** à chaque démarrage (il est idempotent) ;
- si `SEED_DEMO=true`, les comptes de démonstration et les 35 questions sont (re)chargés ;
- si une migration échoue, le conteneur s'arrête : `docker compose logs backend`.

### 4.2 Healthchecks

| Service | Test | Intervalle / essais |
| --- | --- | --- |
| `db` | `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB` | 5 s / 10 |
| `redis` | `redis-cli ping` | 5 s / 10 |
| `backend` | `urllib.request.urlopen('http://127.0.0.1:8000/health')` | 10 s / 10 |
| `ia-service` | `urllib.request.urlopen('http://127.0.0.1:8001/health')` | 10 s / 10 |
| `frontend` | `wget -qO- http://127.0.0.1:3000/` | 10 s / 10, `start_period` 30 s |

Le `start_period` de 15 s (30 s pour le frontend) évite de déclarer un service en échec pendant son démarrage à
froid.

---

## 5. Variables d'environnement utiles

Aucun `.env` n'est obligatoire en local : les valeurs par défaut de Compose suffisent. Pour personnaliser :

```powershell
Copy-Item .env.example .env
```

### 5.1 Valeurs par défaut de Compose

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `POSTGRES_DB` | `centre_langues` | nom de la base |
| `POSTGRES_USER` | `admin` | utilisateur PostgreSQL |
| `POSTGRES_PASSWORD` | `changeme` | mot de passe **local uniquement** |
| `SEED_DEMO` | `true` | charge les comptes et questions de démonstration |
| `NEXT_PUBLIC_API_MOCK` | `false` | `true` = données simulées, `false` = backend réel |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | URL du backend vue par le navigateur |
| `ENVIRONNEMENT` | `dev` | `dev`, `test` ou `prod` pour le service IA |
| `LLM_FOURNISSEUR` | `factice` | `factice`, `compatible-openai` ou `gemini` |
| `IA_SERVICE_URL` | `http://ia-service:8001` | URL interne du service IA |
| `IA_SERVICE_TIMEOUT_S` | `55` | attente maximale du backend |
| `RAG_CORPUS_ACTIF` | `false` | active le corpus CECRL |
| `BACKEND_CORS_ORIGINS` | `http://localhost:3000,http://localhost:8000` | origines autorisées |

### 5.2 Le piège `NEXT_PUBLIC_*`

`NEXT_PUBLIC_*` est **intégré au JavaScript au moment du build**. En mode production :

```powershell
# Changer NEXT_PUBLIC_API_URL ou NEXT_PUBLIC_API_MOCK ne suffit pas : il faut reconstruire
docker compose up --build -d
```

En mode développement, `next dev` lit ces variables au démarrage : un simple redémarrage du conteneur suffit.

### 5.3 Le piège du fichier `frontend/.env.development`

- En local, `cd frontend && npm run dev` lit `frontend/.env.development` : `NEXT_PUBLIC_API_MOCK=true` par défaut.
- Avec **Docker dev**, Compose impose `NEXT_PUBLIC_API_MOCK=false` sauf si tu le surcharges.

Autrement dit : le même code peut afficher des données simulées ou réelles selon le mode de lancement. C'est la
première chose à vérifier quand « les données ne changent pas ».

### 5.4 Clés LLM

Les clés ne doivent **jamais** être dans le dépôt. Elles se mettent dans le `.env` racine (non versionné) :

```dotenv
LLM_FOURNISSEUR=compatible-openai
LLM_MODELE=openai/gpt-oss-20b
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=...
```

Compose transmet ces variables **uniquement au service IA**. Le backend reçoit `LLM_API_KEY=""` et
`GEMINI_API_KEY=""` : il n'a pas besoin de les connaître.

---

## 6. Comptes et données de démonstration

Si `SEED_DEMO=true` (défaut local) :

| Rôle | E-mail | Mot de passe |
| --- | --- | --- |
| Apprenant | `apprenant@digitheque.mg` | `Demo2026` |
| Formateur | `formateur@digitheque.mg` | `Demo2026` |
| Administrateur | `admin@digitheque.mg` | `Demo2026` |

Le référentiel est **toujours** chargé, même avec `SEED_DEMO=false` :

- 5 langues : `fr`, `en`, `zh`, `it`, `de` ;
- niveaux CECRL A1 → C2 et HSK 1 → HSK 6 ;
- 3 formules : Simple, Luxe, Premium.

Les 35 questions de diagnostic (18 anglais, 17 français) ne sont chargées que si `SEED_DEMO=true`.

> **Production** : `SEED_DEMO` doit être `false`, et `SECRET_KEY` doit être changée. Le backend refuse de démarrer
> en `ENVIRONMENT=production` avec la clé d'exemple.

---

## 7. Commandes du quotidien

### 7.1 Avec le `Makefile`

| Besoin | Commande | Commande brute équivalente |
| --- | --- | --- |
| Démarrer en prod locale | `make up` | `docker compose up --build -d --wait` |
| Démarrer en dev | `make dev` | `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build` |
| Arrêter | `make down` | `docker compose down` |
| Tout supprimer | `make reset` | `docker compose down --volumes` |
| Journaux | `make logs` | `docker compose logs -f` |
| État | `make ps` | `docker compose ps` |
| Recharger le seed | `make seed` | `docker compose exec backend python -m app.seed` |
| Tests backend | `make test` | voir §8 |
| Tests IA | `make test-ia` | voir §8 |
| Nouvelle migration | `make migration m="description"` | voir §7.3 |

### 7.2 Inspecter la base

```powershell
# Ouvrir psql dans le conteneur
docker compose exec db psql -U admin -d centre_langues

# Depuis psql
\dt
SELECT count(*) FROM utilisateur;
SELECT code, libelle FROM langue;
\q
```

En dev, un client graphique peut se connecter à `127.0.0.1:55432` avec `admin` / `changeme`.

### 7.3 Créer une migration

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm backend `
  alembic revision --autogenerate -m "description"
```

Puis **relire le fichier généré** dans `backend/alembic/versions/` : l'autogénération rate parfois les
contraintes, les index ou les valeurs par défaut.

### 7.4 Suivre un service précis

```powershell
docker compose logs -f backend
docker compose logs -f ia-service
docker compose logs -f frontend
```

Les e-mails sans SMTP y apparaissent : `docker compose logs backend | Select-String "lien"`.

---

## 8. Tests

### 8.1 Backend (PostgreSQL réel obligatoire)

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm backend pytest
```

Avec couverture, comme en CI :

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm backend `
  pytest --cov=app --cov-fail-under=70
```

Le `Makefile` ajoute `--user "$(id -u):$(id -g)"` : cette option est **POSIX uniquement**, à retirer sous
Windows.

`tests/conftest.py` crée une base `<nom>_test` à côté de `DATABASE_URL`, applique les migrations Alembic, puis
vide les tables avant chaque test. Un `pytest` lancé hors Docker échouera faute de PostgreSQL.

### 8.2 Service IA (aucune clé, aucun réseau)

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm ia-service pytest
```

### 8.3 Frontend

```powershell
cd frontend
npm ci
npm run check      # typecheck → lint → Jest
npm run build      # build de production
npm run test:e2e   # Playwright, serveur dédié port 3100, HTTP simulé
```

`npm run test:e2e` nécessite une fois : `npx playwright install chromium`.

---

## 9. Dépannage

| Symptôme | Cause probable | Solution |
| --- | --- | --- |
| `make : commande introuvable` | `make` absent sous Windows | utiliser les commandes `docker compose` |
| `port is already allocated` | port 3000/8000/8001 occupé | changer `FRONTEND_PORT`, `BACKEND_PORT`, `IA_PORT` dans `.env` |
| Le backend redémarre en boucle | migration en échec ou base non prête | `docker compose logs backend` |
| `No module named 'pydantic_settings'` en dev | image aux dépendances périmées après un reboot | relancer `make dev` (reconstruit) |
| Les données ne changent pas | `NEXT_PUBLIC_API_MOCK=true` ou build non reconstruit | vérifier `.env`, puis `docker compose up --build` |
| Les modifications frontend ne s'affichent pas | build prod figé | passer en mode dev ou reconstruire |
| Le test de diagnostic renvoie « Résultat partiel » | service IA en `LLM_FOURNISSEUR=factice` sans scénario | configurer un vrai fournisseur LLM |
| Aucune question pour le mandarin | aucune question `zh` dans le seed | comportement attendu : `disponible: false` |
| La base est vide après `make reset` | volumes supprimés | redémarrer : le seed se recharge |
| `--user "$(id -u):$(id -g)"` échoue | syntaxe POSIX sous PowerShell | retirer l'option |

### 9.1 Vérifier que tout est prêt

```powershell
docker compose ps
```

Attendu : `db`, `redis`, `backend`, `ia-service`, `frontend` en `healthy` (ou `running` pour les services sans
healthcheck).

```powershell
Invoke-RestMethod http://localhost:8000/health
Invoke-RestMethod http://localhost:8001/health
```

---

## 10. Ce qui fonctionne, ce qui ne fonctionne pas

| Élément | Verdict | Remarque |
| --- | --- | --- |
| Stack complète en prod locale | ✅ | `docker compose up --build -d --wait` |
| Stack dev avec hot reload | ✅ | sources montées |
| Migrations automatiques | ✅ | `alembic upgrade head` à chaque démarrage |
| Seed idempotent | ✅ | testé par `tests/test_seed.py` |
| Healthchecks | ✅ | `depends_on: service_healthy` |
| Redis | 🔌 | démarré et sain, mais **aucun code ne l'utilise** |
| Rate limiting | ⛔ | variable absente du code backend |
| Sauvegardes | ⛔ | aucun script, aucun volume de backup |
| HTTPS / reverse proxy | ⛔ | non fourni ; uniquement HTTP local |
| Secrets de production | 🟡 | `SECRET_KEY` contrôlée, mais mots de passe Compose par défaut |

---

## Questions de compréhension

1. Quelle est la différence exacte entre `make up` et `make dev` ? Cite trois conséquences concrètes.
2. Pourquoi faut-il reconstruire l'image après avoir changé `NEXT_PUBLIC_API_MOCK`, alors qu'un simple
   redémarrage suffit en mode dev ?
3. Que fait `backend/docker-entrypoint.sh` avant de lancer `uvicorn`, et pourquoi est-ce important pour une base
   neuve ?
4. Un développeur lance `pytest` directement sur sa machine et tous les tests échouent. Explique pourquoi et donne
   la commande correcte.
5. Pourquoi Redis est-il démarré alors qu'aucune fonctionnalité ne l'utilise ? Quel risque cela crée-t-il ?
