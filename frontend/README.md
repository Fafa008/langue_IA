# Frontend — Digithèque

Application Next.js 14 (App Router) + TypeScript + Tailwind CSS.

## Démarrer

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

Par défaut, le frontend fonctionne **sans backend** : il utilise les données simulées de `src/mocks`
(voir [Variables d'environnement](#variables-denvironnement)).

Pour l'inscription en mode simulé, l'adresse `deja@exemple.com` simule un compte déjà existant.

## Scripts

| Commande             | Rôle                                                       |
| -------------------- | ---------------------------------------------------------- |
| `npm run dev`        | Serveur de développement                                   |
| `npm run build`      | Build de production                                        |
| `npm run typecheck`  | Vérification TypeScript                                    |
| `npm run lint`       | ESLint (règles Next.js)                                    |
| `npm test`           | Tests unitaires (Jest)                                     |
| `npm run test:e2e`   | Tests de bout en bout (Playwright, desktop + mobile)       |
| `npm run check`      | typecheck + lint + tests unitaires (à lancer avant une PR) |

Avant le premier `npm run test:e2e`, installer le navigateur une seule fois :

```bash
npx playwright install chromium
```

Les tests E2E démarrent leur propre serveur (port 3100, dossier `.next-e2e`) et simulent l'API :
ils ne dépendent ni du backend ni du serveur `npm run dev`.

## Variables d'environnement

Next.js lit les fichiers du dossier `frontend/` (pas le `.env` de la racine) :

| Fichier            | Versionné | Rôle                                               |
| ------------------ | --------- | -------------------------------------------------- |
| `.env.development` | oui       | Valeurs par défaut de `npm run dev` (aucun secret) |
| `.env.local`       | non       | Surcharges propres à votre poste                   |

| Variable               | Défaut (dev)            | Rôle                                                   |
| ---------------------- | ----------------------- | ------------------------------------------------------ |
| `NEXT_PUBLIC_API_URL`  | `http://localhost:8000` | URL du backend FastAPI                                 |
| `NEXT_PUBLIC_API_MOCK` | `true`                  | `true` : données simulées ; `false` : appels au backend |

Pour travailler avec le vrai backend :

```bash
echo "NEXT_PUBLIC_API_MOCK=false" >> .env.local
```

Les variables `NEXT_PUBLIC_*` sont intégrées au moment du build : redémarrer `npm run dev` après un changement.

## Organisation du code

```
src/
├── app/            # Pages (App Router) ; (auth)/ = écrans d'authentification
├── components/
│   ├── ui/         # Composants génériques (Input, Button, FormField…)
│   └── auth/       # Composants des écrans d'authentification
├── hooks/          # Hooks React (formulaires, appels API via React Query)
├── services/       # Appels HTTP ; seul endroit qui connaît le format de l'API (snake_case)
├── mocks/          # Données simulées utilisées quand NEXT_PUBLIC_API_MOCK=true
├── store/          # État global (session) avec Zustand
├── lib/            # Fonctions utilitaires pures (validation, mise en forme, routes…)
└── types/          # Types métier, nommés d'après le diagramme de classes
e2e/                # Tests Playwright
```

Règle : les composants n'appellent jamais `fetch` directement. Ils passent par un hook, qui utilise un service.
