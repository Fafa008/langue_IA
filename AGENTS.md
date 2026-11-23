# AGENTS.md — Centre de Langues IA (La Digithèque)

Monorepo Docker : la racine ne contient que Compose, Makefile, docs et `contrats/` (exemples partagés backend↔IA, montés en lecture seule en dev) ; le code est dans `backend/` (FastAPI), `frontend/` (Next.js) et `ia-service/` (FastAPI interne).

## Frontières et sources de vérité

- `backend/` est le seul propriétaire de l'auth/JWT, du scoring et de PostgreSQL (Alembic). Il appelle le service IA, valide la réponse Pydantic et enregistre ; `ia-service/` n'accède pas à la DB, ne persiste rien et ne prend pas la décision métier (le Harness valide entrées/sorties). `frontend/` consomme uniquement le backend (pas de `NEXT_PUBLIC_IA_URL`, garde Jest `garde-service-ia.test.ts`). Le JWT ne porte que `sub`/`usage` : rôle et statut sont relus en DB à chaque requête, donc une suspension prend effet immédiatement.
- `ia-service` est sur `back-tier` uniquement, sans port hôte (le README et `IA_PORT` dans `.env.example` sont obsolètes sur ce point). Pour l'appeler : `docker compose exec -T backend python -c "import urllib.request; urllib.request.urlopen('http://ia-service:8001/health', timeout=3)"`.
- Routes IA : `ia-service/app/main.py` + `app/api/*.py` (`GET /health`, `POST /chatbot/message`, `POST /diagnostic/evaluer`, `POST /correction/reponse-libre`), pas la prose des README. Une configuration LLM invalide empêche le démarrage (lifespan) ; une configuration RAG invalide, non.
- Contrat frontend source de vérité : `docs/api/contrat-frontend.md` + `frontend/src/services/endpoints.ts`. Un changement de route ou de champ met à jour les deux et le service concerné dans la même PR. Les routes `parcours` sont maintenant dans `backend/app/api/routes/parcours.py` ; `chatbot/message`, `diagnostic/tentatives/en-cours` et `.../abandonner` restent absentes du backend (les commentaires de `endpoints.ts` peuvent être périmés) : vérifier les modules routes avant de les traiter comme opérationnelles.
  - ⚠️ Correctif de l'audit du 22/11/2026 (ajout sans effacer la note ci-dessus) : `POST /chatbot/message` et `DELETE /chatbot/session/{id}` sont présents dans `backend/app/api/routes/chatbot.py:47,58`, enregistrés dans `api/router.py:31`. Seules `diagnostic/tentatives/en-cours` et `.../abandonner` restent effectivement absentes. Le code des modules routes fait foi.

## Commandes (depuis la racine)

- `make dev` : stack de dev (sources montées, rechargement à chaud) ; `make up` : images de production. Reconstruire après un changement de `requirements*.txt` ou `package.json` ; les `NEXT_PUBLIC_*` sont figés dans les images de production (`make build`), mais relus au démarrage du conteneur en dev.
- `make check` avant PR = ruff + pytest (`--cov-fail-under=70`) pour backend et IA + `npm run check` (typecheck, lint, Jest). La CI fait **aussi** `npm run build`, `npm run test:e2e` et un job docker (healthchecks, contrat IA via `scripts.verifier_contrat_ia`, seed idempotent, images dev) : reproduire localement.
- `make test` : pytest backend sur une vraie PostgreSQL de test `<DATABASE_URL>_test`, créée/migrée/vidée par `backend/tests/conftest.py` — qui pose `DATABASE_URL`, `MEDIA_DIR` et `SECRET_KEY` avant d'importer l'app : ne pas réordonner. À chaque session, le schéma `public` est supprimé puis `alembic upgrade head` : on valide une migration neuve, pas les upgrades incrémentaux. `make test-ia` : pytest sans DB ni clé API (`FakeLLMClient`).
- Tests ciblés (quand `make test` / `make test-ia` sont trop larges) :
  - backend : `docker compose -f docker-compose.yml -f docker-compose.dev.yml run --build --rm --user "$(id -u):$(id -g)" backend pytest tests/xxx/test_y.py::test_z`
  - IA : `docker compose -f docker-compose.yml -f docker-compose.dev.yml run --build --rm --no-deps --user "$(id -u):$(id -g)" ia-service pytest -p no:cacheprovider tests/xxx/test_y.py::test_z`
  - Jest : `cd frontend && npm test -- src/services/__tests__/services.test.ts` (ou `npx jest -t "nom du test"`)
  - E2E : `cd frontend && npm run test:e2e -- e2e/login.spec.ts --project=desktop`
- `make migration m="description"` : Alembic autogenerate ; relire `backend/alembic/versions/`. Nouveau modèle = penser à l'importer dans `app/models/__init__.py`. Au démarrage du conteneur backend : `alembic upgrade head` puis `python -m app.seed` (idempotent = insert-only : modifier `PERMISSIONS_INITIALES`/`DROITS_PAR_ROLE` ne reconfigure pas une base déjà peuplée).
- `make seed` recharge le référentiel ; `make reset` supprime les volumes. Les conteneurs dev ont `restart: "no"` : relancer `make dev` après un redémarrage de la machine.
- Les cibles `make` appellent `sh -c` et `id -u` : sous Windows, les lancer depuis Git Bash/WSL, pas depuis PowerShell natif.

## Pièges d'environnement

- Deux environnements distincts : le `.env` racine sert Docker ; Next.js lit `frontend/.env.development` (versionné, `NEXT_PUBLIC_API_MOCK=true`) puis `frontend/.env.local` (local, non versionné). Compose force `NEXT_PUBLIC_API_MOCK=false` par défaut ; avec `true`, les services renvoient `src/mocks` et aucun `fetch` n'est effectué. `NEXT_PUBLIC_PARCOURS_MOCK=true` simule uniquement le parcours ; Compose le transmet (défaut `false`) et le scénario se règle avec `NEXT_PUBLIC_PARCOURS_MOCK_SCENARIO`. Playwright force les deux à `false`.
- `SEED_DEMO=true` par défaut en Compose crée les comptes `apprenant@` / `formateur@` / `admin@digitheque.mg` (mot de passe `Demo2026`) ; à passer à `false` en prod. PostgreSQL et Redis ne sont exposés qu'en dev (`55432` / `56379`) ; les ports applicatifs se surchargent via `FRONTEND_PORT` / `BACKEND_PORT`.
- IA : fournisseur `factice` par défaut ; `LLM_FACTICE_SCENARIO=demonstration` (analyse déterministe) vient des défauts Compose/`.env` — le code seul vaut `aucun` et échoue au premier appel. Groq via `compatible-openai`, Gemini en alternative. `ENVIRONNEMENT=prod` (variable de l'IA, pas `ENVIRONMENT` du backend) interdit `factice`. `IA_SERVICE_URL` vide ou service IA en panne = diagnostic partiel (HTTP 200, champs IA omis), sans erreur pour l'apprenant.
- Scripts `python -m scripts.verifier_groq` / `verifier_gemini` (depuis `ia-service/`) lisent le `.env` racine sans afficher les clés ; tests réels opt-in (`TEST_GEMINI_INTEGRATION=1`, `TEST_GROQ_INTEGRATION=1`), collectés puis skippés par défaut (quota).
- `RAG_CORPUS_ACTIF=false` par défaut ; le corpus officiel exige aussi `RAG_CORPUS_OFFICIEL_AUTORISE=true` et un `descripteurs.jsonl` non versionné. Sinon repli sur `RecuperateurVide` puis indices synthétiques étiquetés `synthetique_fallback` / `A_VERIFIER` (journalisé, invisible pour l'apprenant) : vérifier ces flags avant de chercher un bug de récupération.
- Ne jamais versionner : `.env`, `.env.local`, `ia-service/models/*` (ignore par extension : un nouveau format comme `.safetensors` passerait), `corpus/**/descripteurs.jsonl` ni xlsx/zip/pdf/audio et dérivés. Les datasets JSON QA/MCQ et les manifestes du corpus sont au contraire versionnés. `scripts/ingestion_cecrl.py --sortie` refuse un dossier de sortie dans le dépôt (droits non clarifiés).
- Windows : `.gitattributes` impose LF. Un `backend/docker-entrypoint.sh` en CRLF bloque le backend ; corriger avec `del backend\docker-entrypoint.sh` puis `git checkout -- backend/docker-entrypoint.sh`.

## Conventions de code

- Frontend : un composant n'appelle jamais `fetch` directement — hook puis `src/services/*` ; `src/lib/api-client.ts` est le seul endroit qui appelle `fetch` (JWT, timeout, `ApiError`). Le `snake_case` et les DTO vivent dans `src/services/*` et `*mapper.ts`, pas dans api-client. Les dossiers entre parenthèses (`(pedagogie)`) sont des groupes de routes absents de l'URL ; ne pas modifier `src/lib/routes.ts` en réorganisant les pages (aucun test ne lie ce fichier aux dossiers). `next.config.js` remplace `@/mocks/test-diagnostic.mock` par un stub dès que `NEXT_PUBLIC_API_MOCK !== "true"` (aucune donnée de démo dans un build réel/E2E).
- Frontend : état serveur via React Query (`src/hooks/`, clés dans `queryKeys.ts`), état client/session via Zustand (`src/store/`) ; retry automatique une seule fois si `ApiError.isRetryable` (4xx non retryables).
- Backend : rôles et statuts stockés en SMALLINT, exposés en texte ; les codes de `app/models/enums.py` ne se changent jamais, on ajoute seulement. Chaque rôle a sa table de spécialisation : un changement de rôle crée la nouvelle ligne et conserve les anciennes. Dans `app/api/router.py`, garder le routeur `profil` (`/users/me`) inclus avant `utilisateurs` (`/users/{id_user}`), sinon la route dynamique l'éclipse.
- `ruff==0.8.4` est épinglé dans les deux `requirements-dev.txt` pour rester aligné sur la CI (`ruff format --check` varie selon les versions). `make check` passe `RUFF_NO_CACHE=true` pour le backend et `-p no:cacheprovider` pour l'IA afin de ne pas écrire de cache.
- E2E : Playwright démarre son propre serveur sur le port 3100 (`.next-e2e`), intercepte l'API et teste desktop + mobile ; installer le navigateur une fois avec `npx playwright install chromium`. Traces sur échec CI dans `frontend/test-results`.

## Process

- Voir `CONTRIBUTING.md` : base de PR `develop`, titre `[US-XX] ...`, commits `type(scope): ...`, 1 reviewer (2 pour l'IA), CI verte avant merge. Release : un tag `vX.Y.Z` publie les images sur GHCR ; le déploiement serveur n'est pas automatisé.
