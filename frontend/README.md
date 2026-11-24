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

| Variable                            | Défaut (dev)            | Rôle                                                    |
| ----------------------------------- | ----------------------- | ------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`               | `http://localhost:8000` | URL du backend FastAPI                                  |
| `NEXT_PUBLIC_MODE`                  | `demo`                  | `reel` : backend partout ; `demo` : voir ci-dessous     |
| `NEXT_PUBLIC_PARCOURS_MOCK_SCENARIO`| `passif`                | Scénario du parcours simulé en mode `demo`              |

En mode `demo`, la langue des contenus simulés (modules, exercices, recommandations) est celle du parcours de
l'apprenant côté backend : `fr`, `en`, `it`, `de` ou `zh` (HSK). Sans backend, le mock reste en français.

Pour travailler avec le vrai backend :

```bash
echo "NEXT_PUBLIC_MODE=reel" >> .env.local
```

Les variables `NEXT_PUBLIC_*` sont intégrées au moment du build : redémarrer `npm run dev` après un changement.

### Preset « demo »

```bash
NEXT_PUBLIC_MODE=demo npm run build
```

- Test de positionnement simulé (20 exercices, bouton « Passer »), parcours affiché et autres écrans issus de
  `src/mocks`.
- Connexion automatique au compte apprenant du seed (`SEED_DEMO=true`) pour obtenir un JWT : le navigateur ne parle
  qu'au backend, jamais au service IA.
- Le chat et les recommandations passent par le backend puis le service IA réel (Groq ou `factice` selon la config).
- Le test simulé donne bien son résultat, mais les exercices « Passer » sont des abandons comptés **0 point**
  (aucune bonne réponse n'est inventée) ; sa langue pilote le parcours simulé : un test d'anglais terminé affiche
  le parcours en anglais (`fr`, `en`, `it`, `de`, `zh` / HSK).
  Sans test terminé, la langue vient du parcours backend de l'apprenant.
- Le backend doit être démarré pour le chat et les recommandations ; sans lui, le résultat du test et le parcours
  simulé restent utilisables (en français si aucun test n'a été terminé).

### Règle : le navigateur ne parle jamais au service IA

Le frontend n'appelle que le **backend** (`NEXT_PUBLIC_API_URL`). Il n'existe pas de variable `NEXT_PUBLIC_IA_URL` :
toute valeur `NEXT_PUBLIC_*` est publique (elle se retrouve dans le bundle), le service IA n'a aucune
authentification et son port n'est pas publié. Brancher le navigateur directement sur le service IA contournerait le
scoring, la validation et la persistance du backend. Un test de garde (`src/lib/__tests__/garde-service-ia.test.ts`)
échoue si cette variable réapparaît.

## Organisation du code

```
src/
├── app/            # Pages (App Router) ; (auth)/ = écrans d'authentification
│   └── espace/     # Espace connecté : un dossier par rôle (admin, formateur, apprenant)
│       └── apprenant/(pedagogie)/test-diagnostic/
├── components/
│   ├── ui/         # Composants génériques (Input, Button, FormField…)
│   ├── auth/       # Composants des écrans d'authentification
│   └── pedagogie/  # Domaine Pédagogie, un dossier par module (testDiagnostic…)
├── hooks/          # Hooks React (formulaires, appels API via React Query)
├── services/       # Appels HTTP ; seul endroit qui connaît le format de l'API (snake_case)
├── mocks/          # Données simulées utilisées quand NEXT_PUBLIC_API_MOCK=true
├── store/          # État global (session) avec Zustand
├── lib/            # Fonctions utilitaires pures (validation, mise en forme, routes…)
└── types/          # Types métier, nommés d'après le diagramme de classes
e2e/                # Tests Playwright
```

### Rangement par domaine

Les modules sont regroupés par domaine, d'après les paquetages du diagramme de classes (Pédagogie, Ateliers,
Facturation, Intelligence Artificielle…). Dans `src/app`, un domaine est un **groupe de routes** entre parenthèses :
il range le code sans apparaître dans l'URL. Par exemple, `app/espace/apprenant/(pedagogie)/test-diagnostic` est servi
à `/espace/apprenant/test-diagnostic`. Les composants du module vont dans `components/<domaine>/<module>`.

Les modules sont déplacés un à un, quand on les traite. À ce jour, seul le test diagnostic est rangé dans
`(pedagogie)`. Pour ranger un module :

1. déplacer ses pages avec `git mv` dans le groupe du domaine, sous le dossier du rôle ;
2. déplacer ses composants dans `components/<domaine>/<module>` et mettre à jour les imports `@/components/…` ;
3. laisser les URL de `lib/routes.ts` inchangées : seul le commentaire qui indique le dossier change.

Règle : les composants n'appellent jamais `fetch` directement. Ils passent par un hook, qui utilise un service.
