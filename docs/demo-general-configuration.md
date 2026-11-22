# Configuration de la démonstration générale

## Deux environnements distincts

| Contexte | Fichier | `NEXT_PUBLIC_API_MOCK` | Effet |
| --- | --- | --- | --- |
| `npm run dev` local | `frontend/.env.development` (versionné) | `true` | Les services renvoient `src/mocks`, aucun `fetch` |
| Docker / CI | `docker-compose.yml` | `false` (forcé) | Les services appellent le backend réel |
| Playwright | `playwright.config.ts` | `false` (forcé) | L'API est interceptée par les scénarios |

Le parcours a son propre interrupteur : `PARCOURS_MOCK = API_MOCK || NEXT_PUBLIC_PARCOURS_MOCK === "true"`
(`frontend/src/lib/env.ts:9-14`). Il pilote aussi le chat. Pour la démo, il doit rester `false`.

## Valeurs recommandées pour la démo du mémoire

Dans le `.env` racine (non versionné, ne jamais committer) :

```dotenv
SEED_DEMO=true
LLM_FOURNISSEUR=factice
LLM_FACTICE_SCENARIO=demonstration
RAG_CORPUS_ACTIF=false
```

`ENVIRONNEMENT=prod` (variable de l'IA) interdit le fournisseur `factice`. Le scénario
`demonstration` valide le contrat et le comportement, pas la qualité linguistique : l'annoncer
pendant la démonstration.

## Comptes de démonstration

| Rôle | E-mail | Mot de passe |
| --- | --- | --- |
| Apprenant | `apprenant@digitheque.mg` | `Demo2026` |
| Formateur | `formateur@digitheque.mg` | `Demo2026` |
| Administrateur | `admin@digitheque.mg` | `Demo2026` |

Le seed est idempotent (insert-only) : modifier `PERMISSIONS_INITIALES` ou `DROITS_PAR_ROLE`
ne reconfigure pas une base déjà peuplée. Utiliser `make seed` ou `make reset` si nécessaire.

## Vérification rapide

```bash
make dev
curl --fail --silent http://localhost:8000/health
docker compose exec -T backend python -c \
  "import urllib.request; urllib.request.urlopen('http://ia-service:8001/health', timeout=3)"
curl --fail --silent http://localhost:8000/api/v1/formules
```

L'apprenant doit pouvoir se connecter et obtenir un parcours : le job Docker de CI reproduit
exactement ce contrôle (seed, healthchecks, contrat IA).
