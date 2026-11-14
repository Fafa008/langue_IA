# 04 — Le frontend (Next.js 14)

> Référence : `frontend/src/`, `frontend/e2e/`, `frontend/package.json`, `frontend/playwright.config.ts`.
> Constat du **14 novembre 2026**, branche `develop` (`95543db`).

---

## 1. À quoi sert le frontend

Le frontend est une **application Next.js 14 en App Router**, écrite en TypeScript, stylée avec Tailwind.
Il :

1. affiche les écrans (publics puis espace connecté par rôle) ;
2. garde la session (JWT) et protège les pages ;
3. appelle le backend **uniquement** via des services ;
4. peut fonctionner **sans backend** grâce à des données simulées (`NEXT_PUBLIC_API_MOCK=true`) ;
5. est testé par Jest (unitaire) et Playwright (bout en bout).

Règle structurante du dépôt :

```
composant  ──►  hook  ──►  service  ──►  api-client  ──►  backend
    ↑                                          │
    └──────────── données typées (camelCase) ───┘
```

**Aucun composant n'appelle `fetch`.** Le seul fichier qui connaît le format `snake_case` de l'API est le
service (via ses mappers).

---

## 2. Stack et organisation

| Élément | Choix | Rôle |
| --- | --- | --- |
| Framework | Next.js 14, App Router | routage par dossiers, layouts imbriqués |
| Langage | TypeScript strict | typage des DTO et des vues |
| Styles | Tailwind CSS | classes utilitaires, thème centralisé |
| État global | **Zustand** | session, préférences, test en cours |
| Données serveur | **React Query** (`@tanstack/react-query`) | cache, invalidation, erreurs |
| Icônes | `lucide-react` | cohérence visuelle |
| Tests unitaires | **Jest** + Testing Library | logique et composants |
| Tests E2E | **Playwright** | parcours réels, desktop + mobile |

```
frontend/src/
├── app/                 # routes (App Router)
│   ├── (auth)/          # login, register, forgot-password, reset-password
│   ├── espace/          # espace connecté (layout + sidebar)
│   │   ├── admin/       # tableau de bord, utilisateurs, formateurs, langues, niveaux
│   │   ├── apprenant/   # tableau de bord, test-diagnostic (démarrage/test/résultats)
│   │   ├── formateur/   # tableau de bord
│   │   └── profil/
│   └── providers.tsx    # React Query + configuration du client HTTP
├── components/          # UI par domaine (admin, auth, pedagogie, profil, ui…)
├── hooks/               # useAuth, useTestDiagnostic, useUtilisateurs…
├── services/            # SEUL endroit qui connaît l'API (endpoints, mappers)
├── mocks/               # données simulées
├── store/               # Zustand : auth, préférences, test
├── lib/                 # api-client, routes, navigation, jwt, référentiels
└── types/               # types métier (camelCase)
```

---

## 3. Les pages réellement livrées

### 3.1 Pages publiques

| Route | Écran | Fonctionne |
| --- | --- | --- |
| `/` | accueil public | ✅ |
| `/login` | connexion + comptes de démonstration | ✅ |
| `/register` | inscription (identité, langues, formule, conditions) | ✅ |
| `/forgot-password` | demande de lien | ✅ |
| `/reset-password?token=…` | nouveau mot de passe | ✅ |
| `/conditions`, `/confidentialite` | pages légales | ✅ (statiques) |

### 3.2 Espace connecté

| Route | Rôle | Écran | Verdict |
| --- | --- | --- | --- |
| `/espace/profil` | tous | lecture/écriture du profil, photo, mot de passe | ✅ |
| `/espace/admin` | admin | tableau de bord (KPI, courbe, répartition) | ✅ |
| `/espace/admin/utilisateurs` | admin | liste, filtres, modification, (dés)activation | ✅ |
| `/espace/admin/formateurs` | admin | liste, création, modification | ✅ |
| `/espace/admin/langues` | admin | CRUD langues + niveaux ouverts | ✅ |
| `/espace/admin/niveaux` | admin | CRUD niveaux | ✅ |
| `/espace/apprenant` | apprenant | accueil par raccourcis | 🧪 simulé |
| `/espace/formateur` | formateur | accueil par raccourcis | 🧪 simulé |
| `/espace/apprenant/test-diagnostic` | apprenant | démarrage, choix de langue, reprise | 🟡 |
| `/espace/apprenant/test-diagnostic/test` | apprenant | déroulement (questions, oral, écrit) | 🟡 |
| `/espace/apprenant/test-diagnostic/resultats` | apprenant | score, niveau, compétences, points faibles | 🟡 |

### 3.3 Les entrées « Bientôt »

Le menu latéral affiche des entrées **sans lien** (`<span aria-disabled>`), marquées « Bientôt » :

| Rôle | Entrées « Bientôt » |
| --- | --- |
| Apprenant | Mes cours, Ateliers, Mes inscriptions, Paramètres |
| Formateur | Mes séances, Ateliers, Mes apprenants, Paramètres |
| Admin | Ateliers, Réservations, Formations, Rapports, Paramètres |

Ces routes **existent dans `routes.ts`** mais **aucun `page.tsx` ne les sert** : les visiter directement
donne une 404. Le choix est assumé : mieux vaut une entrée grisée qu'un lien mort.

---

## 4. Protection des pages

### 4.1 Deux niveaux

1. **`RequireAuth`** (client) : si pas de session → redirection vers `/login` ; si le rôle ne correspond pas
   → écran « Accès réservé » avec retour à l'espace du rôle.
2. **Layouts de rôle** : `espace/apprenant/layout.tsx` impose `roles={["APPRENANT"]}`, idem formateur et
   admin.

```tsx
// app/espace/apprenant/layout.tsx
export default function ApprenantLayout({ children }: { children: ReactNode }) {
  return <RequireAuth roles={["APPRENANT"]}>{children}</RequireAuth>;
}
```

### 4.2 Ce que cela protège… et ne protège pas

Le garde-frontière **réel** est le backend. `RequireAuth` améliore l'expérience (pas de page vide), mais un
utilisateur qui forge un JWT ou appelle l'API directement est arrêté par le RBAC serveur. **Ne jamais**
considérer une garde frontend comme une sécurité.

---

## 5. La chaîne composant → hook → service

### 5.1 Exemple complet : la liste des utilisateurs

```ts
// services/endpoints.ts — la plupart des routes au même endroit
export const ENDPOINTS = {
  users: `${API}/users`,
  user: (idUser: number) => `${API}/users/${idUser}`,
  ...
};

// services/utilisateurs.service.ts — connaît le snake_case
async lister(filtres) {
  const dto = await apiRequest<PageDto<UtilisateurDto>>(ENDPOINTS.users, { query: … });
  return { items: dto.items.map(toUtilisateur), total: dto.total, … };
}

// hooks/useUtilisateurs.ts — React Query
export function useUtilisateurs(filtres) {
  return useQuery({ queryKey: queryKeys.utilisateurs(filtres), queryFn: () => utilisateursService.lister(filtres) });
}

// components/admin/utilisateurs/UtilisateursView.tsx — affiche
const { data, isLoading, error } = useUtilisateurs(filtres);
```

### 5.2 Le client HTTP unique

`lib/api-client.ts` :

- préfixe l'URL (`API_URL`) ;
- ajoute `Authorization: Bearer <JWT>` si une session existe ;
- sérialise le JSON, gère `FormData` pour les photos ;
- applique un **timeout de 15 s** par défaut (surchargeable par requête) ;
- traduit toute erreur en `ApiError(status, message, detail, delaiDepasse)` ;
- sur **401**, appelle `onUnauthorized` : vide la session, réinitialise le test, vide le cache React Query.

```ts
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly detail?: string,
    public readonly delaiDepasse = false,
  ) { super(message); }
}
```

### 5.3 Les mappers

Les DTO sont en `snake_case` (`id_user`, `date_inscription`, `photo_url`) ; les types de vue sont en
`camelCase` (`idUser`, `dateInscription`, `photoUrl`). Chaque service a son `*.mapper.ts`. **C'est le seul
endroit où le format de l'API est traduit** : changer un champ backend se répercute dans le mapper, pas dans
les composants.

> **Écart à la règle du dépôt** : `services/formule.service.ts` déclare sa route en local
> (`"/api/v1/formules"`) au lieu d'utiliser `endpoints.ts`. C'est le seul service dans ce cas. La conséquence
> est faible aujourd'hui, mais un changement de route ne serait pas vu au même endroit que les autres.

---

## 6. Session et stockage du jeton

`store/auth.store.ts` (Zustand + `persist`) :

| Option | Stockage | Effet |
| --- | --- | --- |
| « Se souvenir de moi » coché | `localStorage` | session conservée après fermeture du navigateur |
| non coché | `sessionStorage` | session perdue à la fermeture de l'onglet |

Au rechargement, `onRehydrateStorage` **efface** une session dont le JWT est expiré (`isJwtExpired`).
`selectIsAuthenticated` combine présence du jeton et validité.

La déconnexion (`useLogout`) vide la session, le cache React Query et l'état du test. **Il n'y a pas d'appel
serveur** : le backend n'a pas de route de déconnexion, donc le jeton reste valide jusqu'à expiration si
quelqu'un l'a copié.

---

## 7. Mode simulé : le point le plus piégeux

### 7.1 Le drapeau

```ts
// lib/env.ts
export const API_MOCK = process.env.NEXT_PUBLIC_API_MOCK === "true";
```

Chaque service choisit son implémentation :

```ts
export const languesService = API_MOCK ? languesMock : httpLanguesService;
```

### 7.2 Deux sources de vérité

| Lancement | Fichier lu | Valeur par défaut |
| --- | --- | --- |
| `cd frontend && npm run dev` | `frontend/.env.development` | **`true`** |
| Docker (prod ou dev) | variables Compose | **`false`** |

Conséquence : **le même code affiche des données simulées ou réelles selon le mode de lancement**. C'est la
première chose à vérifier quand « les données ne changent pas ».

### 7.3 Ce que contiennent les mocks

| Fichier | Contenu |
| --- | --- |
| `comptes-demo.ts` | 3 comptes (Rova, Hery, Fanja), mot de passe `Demo2026` |
| `auth.mock.ts` | connexion, inscription, reset |
| `langues.mock.ts`, `niveaux.mock.ts` | référentiel |
| `formules.mock.ts` | 3 formules |
| `utilisateurs.mock.ts`, `formateurs.mock.ts` | listes paginées |
| `tableau-de-bord.mock.ts` | KPI, courbe, répartition |
| `profil.mock.ts` | profil modifiable |
| `questions-test.mock.ts` | **50 questions** (25 EN + 25 FR), dont audio/oral/écrit |
| `test-diagnostic.mock.ts` | moteur complet du test (plan 15 min, scoring, reprise) |
| `referentiel-rag.mock.ts` | sources de justification |

> **Divergence à connaître** : les mocks contiennent **50 questions**, le seed backend **35**. Les 12 sujets
> d'expression orale/écrite des mocks **n'existent pas en base**. Une démonstration en mode mock peut donc
> montrer des écrans que le backend réel ne produira jamais.

---

## 8. Le test de positionnement côté écrans

### 8.1 Trois pages, un seul store

```
/espace/apprenant/test-diagnostic            démarrage (langue, personnalisation, reprise)
/espace/apprenant/test-diagnostic/test       déroulement
/espace/apprenant/test-diagnostic/resultats  résultats
```

L'état vit dans `store/test-diagnostic.store.ts`, **persisté en `sessionStorage`** (survit à un rechargement
d'onglet, pas à sa fermeture). Le réducteur pur est dans `lib/testAdaptatif.ts` : toutes les transitions
passent par `dispatch`, ce qui rend la logique testable sans React.

### 8.2 Le déroulement

- **Compte à rebours de 15 minutes** (`DUREE_TEST_MINUTES = 15`) démarré au lancement ; à 0, le test se
  termine automatiquement avec les réponses déjà enregistrées.
- **Étapes** : QCM (grammaire/lecture), compréhension orale, expression orale, expression écrite.
- **Écoute** : `ListeningAudio` utilise la **synthèse vocale du navigateur** (`speechSynthesis`) sur
  `audio_texte`. Aucun fichier audio n'est stocké.
- **Oral** : `SpeechRecorder` enregistre via `MediaRecorder`. Le Blob **n'est pas sérialisable** : il n'est
  pas persisté, et le backend refuse de toute façon l'audio (422).
- **Sortie** : quitter la page demande une confirmation (`useConfirmationSortie`).

### 8.3 Le résultat

| Bloc | Source | Affiché si |
| --- | --- | --- |
| Score et niveau | backend déterministe | toujours |
| Compétences | backend (calcul sur les réponses) | toujours |
| Points faibles | analyse IA | `points_faibles` non nul |
| Phase d'assimilation | analyse IA | `phase_assimil` non nul |
| Justification + sources | **jamais renvoyée** | jamais en réel |

D'où le bandeau **« Résultat partiel »** quand l'IA n'a pas répondu. `JustificationNiveau` affiche alors :
« La justification détaillée […] sera disponible après l'analyse complète. »

### 8.4 La reprise d'un test interrompu

Le frontend appelle **deux routes qui n'existent pas encore côté backend** :

| Appel frontend | Route backend | État |
| --- | --- | --- |
| `testEnCours()` | `GET /diagnostic/tentatives/en-cours` | 🔌 absente |
| `abandonner(id)` | `POST /diagnostic/tentatives/{id}/abandonner` | 🔌 absente |

En réel, l'appel renvoie 404/405. En **E2E**, il fonctionne parce que Playwright **simule lui-même** ces
routes (`e2e/support/test-diagnostic-api.ts`). C'est un faux positif de test à garder en tête : le scénario
« reprise » est vert, mais la fonctionnalité n'est pas livrée.

---

## 9. Les écrans d'administration

| Écran | Composants | Particularités |
| --- | --- | --- |
| Tableau de bord | `TableauDeBordAdmin`, `ChiffresCles`, `CourbeInscriptions`, `RepartitionLangues`, `DernieresInscriptions` | courbe sur 30 jours par défaut (`jours=7/30/90`) |
| Utilisateurs | `UtilisateursView/Table/Filters`, `ModifierUtilisateurDialog`, `ChangerStatutDialog` | filtres dans l'URL (`useFiltresUrl`), recherche temporisée (`useDebouncedValue`) |
| Formateurs | `FormateursView/Table/Filters`, `FormateurPanel` | création → invitation par e-mail |
| Langues / Niveaux | `OngletsLanguesNiveaux`, `LanguesView`, `NiveauxView`, panneaux | un seul écran à onglets, deux routes |

Les filtres sont **dans l'URL** : partager un lien conserve la recherche et la page. La pagination accepte
10, 20 ou 50, comme le backend.

---

## 10. Tests

### 10.1 Jest (unitaire et composants)

```powershell
cd frontend
npm test
npx jest src/lib/__tests__/jwt.test.ts   # un seul fichier
```

Les tests couvrent la logique pure (JWT, validation, pagination, référentiels, réducteur du test), les
services (contrat, mappers), les stores et plusieurs composants du diagnostic.

### 10.2 Playwright (bout en bout)

```powershell
npx playwright install chromium   # une seule fois
npm run test:e2e
```

| Point | Valeur |
| --- | --- |
| Serveur | `next dev` sur le port **3100**, dist `.next-e2e` |
| Backend requis | **non** : les tests interceptent les appels HTTP |
| Projets | `desktop` (Chrome) et `mobile` (Pixel 5) |
| Specs | login, register, mot de passe oublié, profil, rôles, admin (dashboard, utilisateurs, formateurs, langues, niveaux), diagnostic, accessibilité, reprise |

Le `webServer` force `NEXT_PUBLIC_API_MOCK=false` : les tests **simulent l'API** au lieu d'utiliser les mocks
applicatifs. C'est plus proche du réel… sauf pour les routes absentes, simulées elles aussi.

### 10.3 Avant une PR

```powershell
cd frontend
npm run check     # typecheck → lint → Jest
npm run build     # build de production
```

Les deux tournent en CI. Un `npm run check` vert ne garantit pas que le backend répond : il garantit que le
frontend est cohérent avec ses propres types et ses mocks.

---

## 11. Limites et pièges

| Limite | Effet |
| --- | --- |
| Deux routes de reprise absentes | l'écran « test interrompu » échoue en réel |
| `justification` jamais renvoyée | bloc de justification vide |
| Mocks ≠ seed (50 vs 35 questions) | une démo en mock peut ne pas être reproductible en réel |
| `NEXT_PUBLIC_*` figé au build | changer l'URL ou le mode mock exige une reconstruction en prod |
| Timer 15 min côté client seulement | le backend ne connaît pas la durée ; un appel direct peut dépasser |
| Audio non persisté | l'oral n'est ni stocké ni corrigé |
| Pas de déconnexion serveur | jeton valide jusqu'à expiration |
| Entrées « Bientôt » | 404 si l'on force l'URL |
| Pas de rafraîchissement de jeton | expiration = reconnexion |
| Accessibilité partielle | tests dédiés, mais pas d'audit complet |

### Ce que le développeur doit maîtriser

1. **La règle « pas de `fetch` dans un composant »** : elle garde le format API confiné aux services.
2. **Le double mode mock/réel** : savoir lequel tourne, et comment le changer.
3. **React Query** : clés de requête, invalidation après mutation, `retry` seulement sur 5xx.
4. **Zustand + `persist`** : ce qui est sérialisé (pas les Blobs), et où (local vs session).
5. **Les gardes de rôle** : utiles pour l'UX, jamais pour la sécurité.
6. **Playwright** : un test vert peut simuler une route qui n'existe pas.

---

## 12. Vérifier le frontend en 5 minutes

```powershell
# 1. Mode réel (Docker)
docker compose up --build -d --wait
Start-Process http://localhost:3000

# 2. Se connecter
#    admin@digitheque.mg / Demo2026
#    apprenant@digitheque.mg / Demo2026

# 3. Vérifier que le mode mock est bien désactivé
docker compose exec frontend printenv NEXT_PUBLIC_API_MOCK
# → false

# 4. Tests locaux
cd frontend
npm run check
```

---

## Questions de compréhension

1. Un composant a besoin de la liste des langues. Pourquoi ne peut-il pas appeler `fetch` directement, et
   quelle chaîne de fichiers doit-il traverser ?
2. Le même code affiche des données simulées en local et des données réelles dans Docker. Explique pourquoi,
   et comment vérifier le mode actif.
3. Le test E2E « reprise d'un test interrompu » passe alors que le backend n'a pas les routes. Comment est-ce
   possible, et que faut-il en conclure ?
4. Pourquoi le Blob audio n'est-il pas conservé dans le store persisté ? Quelle conséquence pour
   l'utilisateur qui recharge la page en pleine expression orale ?
5. `RequireAuth` empêche-t-il un utilisateur malveillant d'accéder aux données d'un autre rôle ? Justifie en
   citant le composant qui protège réellement.
