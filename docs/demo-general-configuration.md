# Configuration de la démonstration générale

## Deux environnements distincts

| Contexte | Fichier | `NEXT_PUBLIC_MODE` | Effet |
| --- | --- | --- | --- |
| `npm run dev` local | `frontend/.env.development` (versionné) | `demo` (défaut) | Test, parcours et écrans simulés ; chat et reco réels |
| Docker / CI | `docker-compose.yml` | `reel` (forcé par défaut) | Les services appellent le backend réel |
| Playwright | `playwright.config.ts` | `reel` (forcé) | L'API est interceptée par les scénarios |

Il n'y a que ces deux presets. En `demo`, `src/lib/env.ts` expose `API_MOCK=true` (test et écrans simulés) et
`PARCOURS_MOCK=true` (parcours affiché simulé), mais `parcoursPersonnaliseService` délègue le chat et les
recommandations au service HTTP : le navigateur ne parle toujours qu'au backend, jamais au service IA.
`app/providers.tsx` obtient automatiquement un JWT pour le compte apprenant du seed. Le test simulé affiche son
résultat en fin de parcours (les exercices « Passer » sont comptés comme réussis) ; le store de session garde sa
langue, qui pilote alors le contenu du parcours simulé (`frontend/src/mocks/parcours-langues.ts`) : test anglais →
mock anglais (`fr`, `en`, `it`, `de`, `zh` / HSK). Sans test terminé, la langue vient du `code_langue` du parcours
backend ; sans backend ni test, le mock reste en français.

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
