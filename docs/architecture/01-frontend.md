# Chapitre 1 — Le frontend (Next.js)

> Dossier : `frontend/`
> Stack : Next.js 14.2 (App Router), React 18, TypeScript 5.9, Tailwind 3.4,
> Zustand 5 (état global), TanStack React Query 5 (données serveur), lucide-react (icônes).
> Tests : Jest + Testing Library (unitaire), Playwright (E2E).

---

## 1. Rôle et position dans l'architecture

Le frontend est une **application Next.js autonome**. Il ne contient aucune logique métier
de scoring, aucune vérification de droits et aucune clé secrète. Il :

- affiche les écrans des trois rôles (apprenant, formateur, administrateur) ;
- appelle l'API FastAPI **directement depuis le navigateur** ;
- conserve le JWT et l'utilisateur courant dans le stockage du navigateur ;
- traduit les DTO `snake_case` de l'API en objets `camelCase` pour React.

Il n'y a **pas de middleware Next.js**, pas de route API interne (`app/api/`), pas de BFF.
Toute la protection d'accès visible est côté client ; la protection réelle est côté backend.

---

## 2. Structure des dossiers

```
frontend/
├── src/
│   ├── app/                 # routes (App Router)
│   │   ├── (auth)/          # login, register, forgot-password, reset-password
│   │   ├── espace/          # espace connecté
│   │   │   ├── apprenant/   # tableau de bord + test de positionnement
│   │   │   ├── formateur/
│   │   │   ├── admin/       # utilisateurs, formateurs, langues, niveaux
│   │   │   └── profil/
│   │   ├── layout.tsx       # <html>, police, Providers
│   │   └── providers.tsx    # React Query + configuration du client HTTP
│   ├── components/          # UI par domaine (admin, auth, layout, pedagogie, ui…)
│   ├── hooks/               # logique réutilisable (useTestDiagnostic, useForm…)
│   ├── lib/                 # utilitaires purs (jwt, dates, formats, routes…)
│   ├── mocks/               # données simulées
│   ├── services/            # appels HTTP + mappers + endpoints.ts
│   ├── store/               # Zustand (auth, préférences, test)
│   └── types/               # types métier TypeScript
├── e2e/                     # 13 specs Playwright
├── jest.config.js
├── playwright.config.ts
└── next.config.js
```

### Routes réelles

| URL | Écran |
| --- | --- |
| `/login`, `/register` | connexion, inscription |
| `/forgot-password`, `/reset-password` | mot de passe oublié |
| `/espace/apprenant` | tableau de bord apprenant |
| `/espace/apprenant/test-diagnostic` | accueil du test (choix langue, reprise) |
| `/espace/apprenant/test-diagnostic/test` | déroulement du test |
| `/espace/apprenant/test-diagnostic/resultats` | résultats |
| `/espace/formateur` | tableau de bord formateur |
| `/espace/admin` | tableau de bord administrateur |
| `/espace/admin/utilisateurs` | gestion des utilisateurs |
| `/espace/admin/formateurs` | gestion des formateurs |
| `/espace/admin/langues`, `/espace/admin/niveaux` | référentiel pédagogique |
| `/espace/profil` | profil et photo |

---

## 3. Rendu : serveur par défaut, client quand nécessaire

`src/app/layout.tsx` est un **composant serveur** : il pose `<html lang="fr">`, la police et
le fournisseur de contexte.

```tsx
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

`src/app/espace/layout.tsx` compose le gabarit connecté :

```tsx
<Header />
<div className="flex flex-1">
  <AppSidebar />
  <main className="min-w-0 flex-1 px-4 py-8 sm:px-8">
    <RequireAuth>{children}</RequireAuth>
  </main>
</div>
```

Les pages qui utilisent un état, un effet ou un événement commencent par `"use client"`.
C'est le cas de tous les écrans métier (formulaires, test, tableaux de bord).

**Conséquence** : le HTML initial ne contient pas les données de l'utilisateur. La session
est relue **après le montage** du composant, d'où le drapeau `ready` de `useSession()`.

---

## 4. La chaîne de données

Règle absolue du dépôt :

```
composant  →  hook  →  service  →  apiRequest  →  backend
```

### 4.1 `endpoints.ts` : toutes les URL au même endroit

```ts
const API = "/api/v1";

export const ENDPOINTS = {
  auth: { login: `${API}/auth/login`, /* … */ },
  me: `${API}/users/me`,
  diagnostic: {
    langues: `${API}/diagnostic/langues`,
    tentatives: `${API}/diagnostic/tentatives`,
    terminerTentative: (id: number) => `${API}/diagnostic/tentatives/${id}/terminer`,
    tentativeEnCours: `${API}/diagnostic/tentatives/en-cours`,
    abandonnerTentative: (id: number) => `${API}/diagnostic/tentatives/${id}/abandonner`,
    questions: `${API}/diagnostic/questions`,
    reponse: `${API}/diagnostic/reponse`,
  },
} as const;
```

Le contrat associé est `docs/api/contrat-frontend.md`. **Mais** : une URL peut exister ici
sans exister côté backend ; c'est le cas de `tentatives/en-cours` et `abandonner`
(voir chapitre 05).

### 4.2 `api-client.ts` : la porte HTTP unique

Tout passe par `apiRequest<T>()`. Ses responsabilités :

| Responsabilité | Détail |
| --- | --- |
| URL complète | `API_URL` + chemin + query string |
| Query string | les valeurs `null`, `undefined` et `""` sont **omises** |
| En-têtes | `Accept`, `Content-Type: application/json` (sauf `FormData`) |
| JWT | `Authorization: Bearer …` si `auth !== false` |
| Délai | 15 s par défaut, surchargeable par requête |
| 204 | retourne `undefined` |
| Erreurs | traduit en `ApiError(status, message, detail, delaiDepasse)` |
| 401 | déclenche `onUnauthorized()` **uniquement** sur une route authentifiée |

```ts
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeoutMs);

try {
  res = await fetch(buildUrl(path, query), { method, headers, body, signal: controller.signal });
} catch {
  throw controller.signal.aborted
    ? new ApiError(0, "Le serveur ne répond pas.", undefined, true)
    : new ApiError(0, "Impossible de joindre le serveur.");
}
```

Lecture des erreurs FastAPI :

```ts
if (typeof data?.detail === "string") return data.detail;       // HTTPException
if (Array.isArray(data?.detail) && data.detail[0]?.msg) return data.detail[0].msg; // 422 Pydantic
```

Conséquence : sur une erreur 422, on affiche le **premier** message Pydantic, en anglais, et
on perd le champ fautif (`loc`). C'est suffisant pour l'utilisateur, insuffisant pour déboguer.

### 4.3 Les services : seuls à connaître le `snake_case`

Exemple réel (`utilisateur.mapper.ts`) :

```ts
export interface UtilisateurDto {
  id_user: number;
  date_inscription: string;
  photo_url?: string | null;
}

export const toUtilisateur = (dto: UtilisateurDto): Utilisateur => ({
  idUser: dto.id_user,
  dateInscription: dto.date_inscription,
  photoUrl: resoudreUrlPhoto(dto.photo_url),
});
```

Un service pagine, mappe et parfois **valide** :

```ts
async lister({ recherche, role, page, taille }: UtilisateursFiltres): Promise<Paginated<Utilisateur>> {
  const dto = await apiRequest<PageDto<UtilisateurDto>>(ENDPOINTS.users, {
    query: { page, page_size: taille, search: recherche.trim(), role },
  });
  return { items: dto.items.map(toUtilisateur), total: dto.total, page: dto.page, taille: dto.page_size };
}
```

Limite importante : le mapper **ne valide pas les types**. Si le backend renvoie
`id_user: "12"` au lieu de `12`, TypeScript ne le verra pas à l'exécution. Il n'y a ni Zod
ni génération de types depuis OpenAPI.

---

## 5. Authentification côté navigateur

### 5.1 Le store Zustand

`src/store/auth.store.ts` persiste trois champs :

```ts
{
  name: "digitheque-auth",
  storage: createJSONStorage(() => rememberAwareStorage),
  partialize: ({ utilisateur, accessToken, remember }) => ({ utilisateur, accessToken, remember }),
  onRehydrateStorage: () => (state) => {
    if (state?.accessToken && isJwtExpired(state.accessToken)) state.clearSession();
  },
}
```

- `rememberAwareStorage` choisit `localStorage` si « se souvenir de moi » est coché, sinon
  `sessionStorage`.
- `isJwtExpired` **lit seulement** le champ `exp` du JWT. Aucune signature n'est vérifiée :
  le navigateur n'a pas la clé. La vérification réelle est faite par FastAPI.
- Au rechargement, un jeton expiré est effacé avant d'être utilisé.

### 5.2 `useSession` et l'hydratation

```ts
const [ready, setReady] = useState(false);
useEffect(() => setReady(true), []);
return { ready, utilisateur, accessToken, isAuthenticated: ready && isAuthenticated };
```

Sans `ready`, le premier rendu croirait l'utilisateur déconnecté et redirigerait à tort vers
`/login`. C'est un correctif classique de Next.js avec stockage local.

### 5.3 `RequireAuth` : confort, pas sécurité

```tsx
/**
 * Ce contrôle n'est qu'un confort d'affichage : l'API vérifie les droits.
 */
if (roles && !roles.includes(utilisateur.role)) {
  return <Accès réservé … />;
}
```

Un utilisateur qui modifierait le store verrait l'écran, mais chaque appel API serait refusé
par le backend (401/403). C'est le bon modèle mental.

### 5.4 La réaction au 401

`src/app/providers.tsx` branche le client HTTP sur le store :

```ts
configureApiClient({
  getToken: () => useAuthStore.getState().accessToken,
  onUnauthorized: () => {
    useAuthStore.getState().clearSession();
    useTestDiagnosticStore.getState().reinitialiser();
    queryClient.clear();
  },
});
```

Puis `RequireAuth` observe `isAuthenticated` et redirige. Un 401 sur `/auth/login` **ne**
déclenche pas cette purge, car la requête est envoyée avec `auth: false`.

---

## 6. React Query : données serveur

Configuration globale (`providers.tsx`) :

```ts
queries: {
  retry: (failureCount, error) => failureCount < 1 && isRetryable(error),
}
```

- une seule nouvelle tentative ;
- uniquement pour une panne réseau ou un 5xx (`isRetryable` exclut les 4xx) ;
- les **mutations ne sont pas retentées** par défaut.

Aucun `staleTime` global n'est défini : la valeur par défaut est `0`. Les requêtes sont donc
considérées périmées immédiatement et React Query peut recharger au focus de la fenêtre ou à
la reconnexion. Acceptable pour un profil ou une liste, à surveiller pour un appel coûteux.

Les clés sont centralisées dans `src/hooks/queryKeys.ts`, avec des préfixes pour invalider
toute une famille :

```ts
utilisateursTous: ["utilisateurs"] as const,
utilisateurs: (filtres) => ["utilisateurs", filtres] as const,
```

Après une mutation, le hook appelle généralement `invalidateQueries({ queryKey: … })` pour
rafraîchir la liste concernée.

---

## 7. Formulaires et UI

`useForm` est un hook maison minimal :

```ts
const { values, errors, setField, handleSubmit, reset } = useForm({
  initialValues,
  validate,
  onSubmit,
});
```

Comportements notables :

- les erreurs n'apparaissent qu'après la **première** soumission ;
- elles sont recalculées à chaque frappe ensuite ;
- le premier champ `aria-invalid` reçoit le focus ;
- un `fieldset` en erreur cible sa première case.

Le style repose sur Tailwind et des classes utilitaires maison (`btn-primary`, `rounded-card`,
`text-content-secondary`…). Les composants sont accessibles par défaut (`aria-*`, `role`,
libellés), mais il n'y a pas d'audit systématique en dehors des tests E2E `axe`.

---

## 8. Le test de positionnement : une machine à états

C'est la partie frontend la plus complexe. Elle ne vit **pas** dans React Query mais dans un
store Zustand, car il s'agit d'une séquence avec minuteur, retour arrière et réponses en
attente.

### 8.1 Déroulement

- durée : `DUREE_TEST_MINUTES = 15` ;
- les questions sont triées par étape (`planDepuisQuestions`) ;
- à `0`, le test se termine automatiquement **une seule fois** (`finAutomatiqueLancee`) ;
- quitter la page demande confirmation, mais les réponses déjà validées sont conservées ;
- quitter le test le marque comme abandonné côté UI (`recommencer`), ce qui devrait appeler
  `abandonner()` — route absente côté backend.

### 8.2 Réponses

```ts
if (reponse.type === "audio") {
  throw new Error("L'enregistrement des réponses audio sera disponible après la mise en place du stockage des médias.");
}
```

Les questions audio sont même **filtrées** au chargement :

```ts
const questions = trierParEtape(questionDtos.filter((q) => q.type_reponse !== "audio").map(toQuestion));
```

Le backend, lui, n'accepte que `choix` et `texte` (`TYPES_ENREGISTRABLES`). La fonctionnalité
audio est donc annoncée par le contrat mais **inatteignable des deux côtés**.

Pour une réponse écrite, le délai passe à **60 s** (`TIMEOUT_ANALYSE_MS`), et la clôture du
test utilise le même délai. C'est nécessaire depuis PRE-05 : le backend peut appeler le
service IA, dont le budget est de **55 s** (`IA_SERVICE_TIMEOUT_S`).

### 8.3 Résultat

Le frontend gère un cas `202 {statut: "en_attente"}` et un écran `ResultatEnAttente`, avec
une revérification automatique toutes les 10 s, plafonnée à 30 essais :

```ts
const VERIFICATION_RESULTAT_SECONDES = 10;
const VERIFICATIONS_AUTOMATIQUES_MAX = 30;
```

Or le backend ne renvoie **jamais** 202 : `terminer` est synchrone. Cette branche est testée
avec les mocks mais **inatteignable en production**.

Le backend renvoie désormais `competences`, `points_faibles` et `phase_assimil` **si** le
service IA répond (ou si une analyse est déjà persistée). En cas d'absence de
`IA_SERVICE_URL`, de panne ou de timeout, ces champs sont omis : l'écran `TestResult` affiche
alors **« Résultat partiel »** et liste les informations manquantes. `justification` reste
toujours absent du backend : il n'existe pas de champ correspondant dans `ScoreDiagnosticOut`.

### 8.4 Validation stricte du score

```ts
if (dto.score !== dto.percentage || dto.max_score !== 100) {
  throw new Error("Le résultat de scoring renvoyé par le serveur est invalide.");
}
```

Aujourd'hui, le backend renvoie `percentage = float(score)` et `max_score = 100`, donc ça
passe. Mais si le barème évolue (score brut sur 20, pourcentage arrondi différemment), le
frontend **rejettera un résultat valide**. C'est un couplage fragile.

---

## 9. Mode mock : travailler sans backend

Trois mécanismes :

1. **Le drapeau** `NEXT_PUBLIC_API_MOCK` (`src/lib/env.ts`).
2. **L'aiguillage** dans chaque service :
   ```ts
   langues: () => API_MOCK ? testDiagnosticMockService.langues() : httpTestDiagnosticService.langues(),
   ```
3. **Le remplacement webpack** (`next.config.js`) : en build sans mock, le module
   `@/mocks/test-diagnostic.mock` est remplacé par un stub qui lève une erreur.

```js
if (process.env.NEXT_PUBLIC_API_MOCK !== "true") {
  config.plugins.push(new webpack.NormalModuleReplacementPlugin(
    /^@\/mocks\/test-diagnostic\.mock$/,
    path.resolve(__dirname, "src/mocks/test-diagnostic.mock.stub.ts"),
  ));
}
```

Attention : ce filet ne concerne **que** le mock du diagnostic. Les autres mocks
(`auth.mock`, `utilisateurs.mock`, `langues.mock`…) restent dans le bundle.

`frontend/.env.development` met `NEXT_PUBLIC_API_MOCK=true` ; Docker et la CD forcent
`false`. Comme `NEXT_PUBLIC_*` est **inliné au build**, changer la valeur impose de
reconstruire l'image.

---

## 10. Tests

### Unitaires (Jest)

- environnement `jsdom`, transformation `ts-jest`, alias `@/` ;
- `jest.setup.ts` ajoute `@testing-library/jest-dom` et un polyfill pour `<dialog>` ;
- tests colocalisés dans six dossiers `__tests__` : `components/pedagogie/testDiagnostic`,
  `hooks`, `lib`, `mocks`, `services`, `store`.

Ils couvrent notamment : les mappers, les services (avec `fetch` simulé), les erreurs du
client HTTP, le store d'auth, la machine à états du test et les composants de résultat.

### E2E (Playwright)

- 13 specs : login, register, mot de passe oublié, profil, rôles, administration
  (utilisateurs, formateurs, langues, niveaux, dashboard), test de positionnement, reprise,
  accessibilité ;
- deux projets : `Desktop Chrome` et `Pixel 5` ;
- serveur propre sur le port `3100`, dossier `.next-e2e`, `NEXT_PUBLIC_API_MOCK=false` ;
- **les tests interceptent eux-mêmes les appels HTTP** : aucun backend n'est requis ;
- traces conservées en cas d'échec, `retries: 1` en CI.

---

## 11. Limites et dettes techniques

1. **Sécurité uniquement côté backend** : aucune route Next protégée, aucun middleware.
   Un utilisateur peut afficher un écran, pas obtenir les données.
2. **JWT dans `localStorage`/`sessionStorage`** : vulnérable en cas de XSS. Un cookie
   `HttpOnly` serait plus robuste, au prix d'un vrai BFF.
3. **Aucune validation runtime des réponses** : pas de Zod, pas de types générés depuis
   `/openapi.json`. Une dérive de contrat n'est détectée qu'à l'usage.
4. **Dérive de contrat réelle** : appels vers `tentatives/en-cours` et `abandonner` qui
   répondent 404.
5. **Validation du score trop rigide** (`score === percentage`, `max_score === 100`).
6. **Fonctionnalité audio morte** : UI et types existent, service et backend la refusent.
7. **État dupliqué** : le test vit dans Zustand et sur le serveur, sans route de
   resynchronisation (`en-cours` manquante).
8. **Branche 202 inatteignable** : polling testé mais jamais déclenché en production.
9. **Mocks partiellement embarqués** : seul le mock du diagnostic est remplacé en prod.
10. **Pas de `error.tsx` ni de `loading.tsx`** : les erreurs non gérées remontent au boundary
    par défaut de Next.js.
11. **Pas d'internationalisation** : le français est codé en dur.
12. **Dépendance au build** : toute variable `NEXT_PUBLIC_*` impose une reconstruction.

---

## 12. Commandes utiles

```powershell
cd frontend

npm run dev            # serveur de développement (lit .env.development)
npm run typecheck      # tsc --noEmit
npm run lint           # next lint
npm test               # Jest
npm run check          # typecheck + lint + Jest (l'ordre de la CI)
npm run build          # build de production
npm run test:e2e       # Playwright (installe Chromium au premier lancement)
```

Un seul test :

```powershell
npx jest src/lib/__tests__/jwt.test.ts
npx playwright test e2e/login.spec.ts --project=desktop
```

---

## 13. Ce que tu dois maîtriser

- Le sens unique de la chaîne `composant → hook → service → apiRequest`.
- La différence entre **état serveur** (React Query) et **état local/global** (Zustand).
- Pourquoi `RequireAuth` n'est pas une sécurité.
- Pourquoi `exp` est lu mais pas vérifié dans le navigateur.
- Le comportement de `apiRequest` sur 204, 401, 422, timeout et panne réseau.
- La raison d'être des mappers et leur limite (aucune validation de type).
- Le cycle de vie d'une session : persistance, réhydratation, expiration, 401, purge.
- La différence entre mock de développement et comportement de production.

---

## Questions de compréhension

1. Un utilisateur modifie `localStorage` pour se donner le rôle `ADMINISTRATEUR`. Que se
   passe-t-il à l'écran ? Que se passe-t-il à l'appel de `GET /users` ? Pourquoi ?
2. Pourquoi `useSession` renvoie-t-il `isAuthenticated: ready && isAuthenticated` plutôt que
   seulement `isAuthenticated` ? Quel bug cela évite-t-il ?
3. Le backend renvoie `422` avec `detail: [{loc: ["body","email"], msg: "value is not a valid email address"}]`.
   Quel message l'utilisateur voit-il ? Quelle information est perdue pour le développeur ?
4. Le frontend exige `score === percentage`. Le backend décide un jour de renvoyer un score
   brut sur 20 et un pourcentage arrondi. Que se passe-t-il côté UI ? Est-ce un bug backend
   ou frontend ?
5. Un test E2E passe alors que le backend est éteint. Que prouve-t-il exactement ? Que ne
   prouve-t-il pas ?
