# 07 — Les fonctionnalités par rôle

> Référence : `backend/app/models/enums.py`, `backend/app/models/roles.py`, `backend/app/api/deps.py`,
> `backend/app/api/routes/*.py`, `frontend/src/lib/navigation.ts`, `frontend/src/components/layout/RequireAuth.tsx`,
> `frontend/src/app/espace/**/layout.tsx`.
> Constat du **14 novembre 2026**, branche `develop` (`95543db`).

---

## 1. Le principe : trois rôles, deux contrôles

Le produit connaît **trois rôles**, stockés en base comme des entiers (`SMALLINT`) et exposés en texte par l'API :

| Rôle | Code en base | Texte API | Compte de démonstration |
| --- | :-: | --- | --- |
| Apprenant | `1` | `APPRENANT` | `apprenant@digitheque.mg` / `Demo2026` |
| Formateur | `2` | `FORMATEUR` | `formateur@digitheque.mg` / `Demo2026` |
| Administrateur | `3` | `ADMINISTRATEUR` | `admin@digitheque.mg` / `Demo2026` |

```python
# backend/app/models/enums.py
class Role(str, enum.Enum):
    APPRENANT = "APPRENANT"
    FORMATEUR = "FORMATEUR"
    ADMINISTRATEUR = "ADMINISTRATEUR"
```

**Règle absolue** : un code déjà enregistré ne change jamais, on ne fait qu'en ajouter. Changer `2` en autre
chose casserait tous les comptes formateurs existants.

### 1.1 Le contrôle réel : le RBAC côté backend

Le backend ne vérifie pas « le rôle » mais une **permission**. Neuf permissions existent :

| Permission | Sens | Apprenant | Formateur | Administrateur |
| --- | --- | :-: | :-: | :-: |
| `profile:read` | lire son propre profil | ✅ | ✅ | ✅ |
| `profile:write` | modifier son profil | ✅ | ✅ | ✅ |
| `users:read` | lister les utilisateurs | ⛔ | ⛔ | ✅ |
| `users:manage` | changer rôle / statut | ⛔ | ⛔ | ✅ |
| `trainers:read` | lister les formateurs | ⛔ | ⛔ | ✅ |
| `trainers:manage` | créer / modifier un formateur | ⛔ | ⛔ | ✅ |
| `pedagogy:manage` | gérer langues et niveaux | ⛔ | ⛔ | ✅ |
| `stats:read` | consulter les statistiques | ⛔ | ⛔ | ✅ |
| `roles:manage` | gérer les permissions des rôles | ⛔ | ⛔ | ✅ |

```python
# backend/app/models/roles.py — l'état initial, écrit par le seed
DROITS_PAR_ROLE = {
    "APPRENANT": ("profile:read", "profile:write"),
    "FORMATEUR": ("profile:read", "profile:write"),
    "ADMINISTRATEUR": tuple(code for code, _ in PERMISSIONS_INITIALES),
}
```

> **Nuance capitale** : ce tableau est un **état initial**, pas une vérité figée. Un administrateur peut le
> modifier via `PUT /roles/{id_role}/permissions`. La seule règle intangible est qu'**au moins un rôle doit
> conserver `roles:manage`** (sinon `409`). Donc « réservé à l'administrateur » signifie ici « réservé par défaut
> au rôle qui détient la permission ».

La vérification est une dépendance FastAPI :

```python
# backend/app/api/deps.py
def permission_requise(code_permission: str) -> Callable[..., Utilisateur]:
    def verifier_permission(db: DbSession, utilisateur: UtilisateurConnecte) -> Utilisateur:
        autorise = db.scalar(select(exists().where(
            RoleRBAC.code == utilisateur.role.value,
            role_permission.c.id_role == RoleRBAC.id_role,
            role_permission.c.id_permission == Permission.id_permission,
            Permission.code == code_permission,
        )))
        if not autorise:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Droits insuffisants.")
        return utilisateur
    return verifier_permission
```

Deux détails importants :

- le contrôle interroge **la base**, pas le jeton : retirer une permission prend effet immédiatement ;
- un compte `INACTIF` ou `SUSPENDU` est refusé **avant** le RBAC (`401`), même avec un jeton valide.

### 1.2 Le contrôle d'affichage : le frontend

Le frontend possède un garde de page, mais il ne protège rien : il évite seulement d'afficher un écran vide.

```tsx
// frontend/src/app/espace/admin/layout.tsx
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RequireAuth roles={["ADMINISTRATEUR"]}>{children}</RequireAuth>;
}
```

`RequireAuth` redirige vers `/login` si l'utilisateur n'est pas connecté, et affiche « Accès réservé » si son
rôle ne correspond pas. **La sécurité réelle est le `403` du backend** : un utilisateur qui force une URL ou
appelle l'API directement est arrêté par FastAPI, pas par React.

### 1.3 Une exception : le diagnostic vérifie le rôle en dur

Les routes du test de positionnement n'utilisent pas `permission_requise`. Elles comparent directement le rôle :

```python
# backend/app/api/routes/diagnostic.py
if utilisateur.role != Role.APPRENANT:
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Droits insuffisants.")
```

Conséquence : **même un administrateur ne peut pas passer le test** (`403`). Ce n'est pas configurable par le
RBAC. C'est cohérent avec le métier — le diagnostic est réservé à l'apprenant — mais c'est un piège en
démonstration : ne pas se connecter en admin pour montrer le test.

---

## 2. Vue d'ensemble : qui peut faire quoi

| Domaine | Visiteur | Apprenant | Formateur | Administrateur |
| --- | :-: | :-: | :-: | :-: |
| Créer un compte apprenant | ✅ | — | — | — |
| Se connecter / se déconnecter | ✅ | ✅ | ✅ | ✅ |
| Mot de passe oublié / réinitialisé | ✅ | ✅ | ✅ | ✅ |
| Consulter le catalogue des formules | ✅ | ✅ | ✅ | ✅ |
| Voir son tableau de bord | ⛔ | ✅ | ✅ | ✅ |
| Modifier son profil + photo | ⛔ | ✅ | ✅ | ✅ |
| Passer le test de positionnement | ⛔ | ✅ | ⛔ | ⛔ |
| Voir ses résultats et son analyse | ⛔ | ✅ | ⛔ | ⛔ |
| Gérer les utilisateurs | ⛔ | ⛔ | ⛔ | ✅ |
| Gérer les formateurs | ⛔ | ⛔ | ⛔ | ✅ |
| Gérer langues et niveaux | ⛔ | ⛔ | ⛔ | ✅ |
| Voir les statistiques du centre | ⛔ | ⛔ | ⛔ | ✅ |
| Gérer les permissions des rôles | ⛔ | ⛔ | ⛔ | ✅ (API seulement) |
| Enseigner, suivre des apprenants | ⛔ | ⛔ | ⛔ | ⛔ |
| Gérer ateliers, formations, parcours | ⛔ | ⛔ | ⛔ | ⛔ |
| Payer, facturer | ⛔ | ⛔ | ⛔ | ⛔ |

Les trois dernières lignes sont volontairement à `⛔` pour **tous** les rôles : ce sont des fonctionnalités
absentes du code, pas des droits manquants.

---

## 3. Le visiteur (non connecté)

### 3.1 Les pages réellement accessibles

| Page | Adresse | Ce qu'elle fait |
| --- | --- | --- |
| Accueil | `/` | Vitrine : héros, approche, langues, « comment ça marche » |
| Connexion | `/login` | Formulaire e-mail + mot de passe |
| Inscription | `/register` | Création d'un compte **apprenant** |
| Mot de passe oublié | `/forgot-password` | Demande d'un lien de réinitialisation |
| Réinitialisation | `/reset-password` | Saisie du nouveau mot de passe via le jeton du lien |

L'en-tête change selon la session : un visiteur voit les liens du site et les boutons « Se connecter » /
« S'inscrire » ; un utilisateur connecté ne voit que le sélecteur de langue et son menu de compte.

### 3.2 Les routes publiques du backend

```text
POST /api/v1/auth/login
POST /api/v1/auth/register
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
GET  /api/v1/formules
```

Aucune de ces routes ne demande de jeton. C'est volontaire : on ne peut pas exiger une authentification pour
s'authentifier.

### 3.3 Ce que fait vraiment l'inscription

```python
# backend/app/api/routes/auth.py (extrait)
utilisateur = Utilisateur(..., role=Role.APPRENANT, statut=StatutUtilisateur.ACTIF)
utilisateur.apprenant = Apprenant(date_naissance=donnees.date_naissance, langues=list(langues))
utilisateur.apprenant.abonnements.append(Abonnement(
    formule=formule,
    date_debut=debut,
    date_fin=_ajouter_mois(debut, formule.duree_mois),
    statut=StatutAbonnement.ACTIF,
    quota_heures=formule.quota_heures,      # copiés, pas référencés
    quota_ateliers=formule.quota_ateliers,
))
```

Trois règles à retenir :

1. **le rôle est forcé** à `APPRENANT` : aucun visiteur ne peut s'inscrire comme formateur ou administrateur ;
2. la formule choisie doit **couvrir les langues demandées** (`422` sinon) ; une formule sans langue couvre tout ;
3. les quotas sont **copiés** dans l'abonnement : modifier la formule plus tard ne change pas les abonnements
   existants.

### 3.4 Mot de passe oublié : la réponse est toujours `204`

```python
# backend/app/api/routes/auth.py
@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
def forgot_password(donnees: ForgotPasswordIn, db: DbSession) -> Response:
    utilisateur = db.scalar(select(Utilisateur).where(Utilisateur.email == donnees.email))
    if utilisateur is not None and utilisateur.statut == StatutUtilisateur.ACTIF:
        jeton = creer_jeton_reinitialisation(utilisateur.id_user, utilisateur.mot_de_passe)
        envoyer_lien_reinitialisation(utilisateur.email, utilisateur.prenom, jeton)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

Le même statut est renvoyé que l'adresse existe ou non : impossible d'énumérer les comptes. Le jeton dépend du
mot de passe actuel (`claim mdp`) : après utilisation, le mot de passe change et **le lien ne marche plus**.

> **Sans SMTP configuré**, l'e-mail n'est pas envoyé : il est écrit dans les journaux du backend. C'est le
> comportement prévu pour le développement, et la seule façon de récupérer un lien en démonstration :
>
> ```powershell
> docker compose logs backend | Select-String "reinitialisation|reset|http"
> ```

### 3.5 Ce que le visiteur ne peut pas faire

Tout le reste renvoie `401` :

```powershell
Invoke-RestMethod http://localhost:8000/api/v1/users/me
# 401 : Session expirée ou invalide
```

---

## 4. L'apprenant

C'est le rôle qui possède **le plus de fonctionnalités réellement utilisables**.

### 4.1 Ce qui fonctionne de bout en bout

| Fonctionnalité | Où | Preuve |
| --- | --- | --- |
| Tableau de bord | `/espace/apprenant` | raccourcis vers ses rubriques |
| Test de positionnement complet | `/espace/apprenant/test-diagnostic` | 5 routes backend |
| Résultats détaillés | `/espace/apprenant/test-diagnostic/resultats` | score, niveau, compétences |
| Profil (infos + mot de passe) | `/espace/profil` | `GET`/`PATCH /users/me` |
| Photo de profil | `/espace/profil` | `POST`/`DELETE /users/me/photo` |

### 4.2 Le menu latéral réel

```ts
// frontend/src/lib/navigation.ts
const APPRENANT: NavItem[] = [
  { label: "Tableau de bord",        href: ROUTES.apprenant.dashboard },
  { label: "Test de positionnement", href: ROUTES.apprenant.testDiagnostic.demarrage },
  { label: "Mes cours",              href: ROUTES.apprenant.mesCours, bientot: true },
  { label: "Ateliers",               href: ROUTES.apprenant.ateliers, bientot: true },
  { label: "Mon profil",             href: ROUTES.profil },
  { label: "Mes inscriptions",       href: ROUTES.apprenant.mesInscriptions, bientot: true },
  { label: "Paramètres",             href: ROUTES.apprenant.parametres, bientot: true },
];
```

Quatre entrées sur sept sont marquées `bientot: true` : elles s'affichent **grisées, sans lien**, et ne
produisent donc pas de `404`. Seules trois mènent à un écran : tableau de bord, test, profil.

> **Le tableau de bord n'appelle aucune API** : c'est une grille de raccourcis construite à partir de ce même
> tableau `NAVIGATION`. Il est donc identique en mode réel et en mode simulé.

### 4.3 Le cycle du diagnostic, étape par étape

| Étape | Route backend | Accès | Remarque |
| --- | --- | --- | --- |
| 1. Choisir la langue | `GET /diagnostic/langues` | apprenant | renvoie `disponible: false` si aucune question |
| 2. Charger les questions | `GET /diagnostic/questions?code_langue=&code_niveau=` | apprenant | questions du **niveau de départ** |
| 3. Créer une tentative | `POST /diagnostic/tentatives` | apprenant | **nouvelle tentative à chaque appel** |
| 4. Enregistrer une réponse | `POST /diagnostic/reponse` | apprenant | unicité `(tentative, question)` |
| 5. Terminer | `POST /diagnostic/tentatives/{id}/terminer` | apprenant | scoring déterministe + analyse IA |

Détails qui comptent pour une démonstration :

- **le niveau de départ** est le premier niveau ouvert qui possède des questions enregistrables ;
- avec le seed, l'anglais et le français ont **2 questions A1** chacun ; `zh`, `it`, `de` ont **0 question**
  et sont donc indisponibles ;
- une réponse à choix envoie le **libellé** choisi ; une réponse `texte` est stockée mais **jamais corrigée** ;
- une réponse `audio` est refusée en `422` (`AUDIO_NON_DISPONIBLE`) ;
- une question sans réponse compte comme fausse dans le score.

### 4.4 Ce que l'apprenant voit dans ses résultats

| Bloc | Source réelle | État |
| --- | --- | --- |
| Score et pourcentage | scoring backend | ✅ |
| Niveau et cadre (CECRL / HSK) | scoring backend | ✅ |
| Échelle des niveaux | référentiel frontend | ✅ |
| Détail par compétence | **calcul backend** sur les QCM | ✅ |
| Points faibles | analyse IA (ou déduction locale) | 🟡 |
| Phase Assimil | analyse IA | 🟡 |
| « Pourquoi ce niveau ? » | `justification` attendue du backend | 🔌 jamais envoyée |

Le bandeau « **Résultat partiel** » n'est pas une erreur : il liste explicitement ce qui manque.

```tsx
// frontend/src/components/pedagogie/testDiagnostic/TestResult.tsx
<span className="font-semibold">Résultat partiel.</span> Votre niveau est établi. Encore à venir dès que
l&apos;analyse sera complète : {manquantes.map((m) => LIBELLES_MANQUANTS[m]).join(", ")}.
```

Il apparaît par défaut, parce que Compose lance le service IA avec `LLM_FOURNISSEUR=factice` et **aucun
scénario** : l'appel échoue en `LLM_CONFIGURATION` (500), le backend dégrade proprement, et les champs IA
(`points_faibles`, `phase_assimil`, `competences` IA) sont omis.

### 4.5 Ce qui est partiel ou absent pour l'apprenant

| Fonctionnalité | Verdict | Explication |
| --- | --- | --- |
| Test long (8 QCM + oral + écrit, 15 min) | 🧪 | existe seulement en mode simulé (`NEXT_PUBLIC_API_MOCK=true`) |
| Réponse orale | 🔌 | l'enregistreur navigateur fonctionne, le backend refuse l'audio |
| Reprise d'un test interrompu | 🔌 | le frontend appelle `GET /diagnostic/tentatives/en-cours`, route **absente** |
| Abandon d'une tentative | 🔌 | le frontend appelle `POST /diagnostic/tentatives/{id}/abandonner`, route **absente** |
| Justification du niveau | 🔌 | le backend n'envoie jamais `justification` |
| Historique des tentatives | ⛔ | les données existent en base, aucune route de liste |
| Mes cours / ateliers / inscriptions / paramètres | ⛔ | entrées « Bientôt » |
| Chatbot | ⛔ | aucune route backend, aucun écran |
| Paiement / facture | ⛔ | aucun code |

> **Conséquence pratique** : un apprenant qui ferme l'onglet pendant le test ne peut pas reprendre. L'écran
> `reprise-test.spec.ts` passe en E2E uniquement parce que Playwright **simule** les deux routes manquantes.

### 4.6 Les routes auxquelles l'apprenant a droit

```text
✅ GET    /api/v1/users/me
✅ PATCH  /api/v1/users/me
✅ POST   /api/v1/users/me/photo
✅ DELETE /api/v1/users/me/photo
✅ GET    /api/v1/diagnostic/langues
✅ GET    /api/v1/diagnostic/questions
✅ POST   /api/v1/diagnostic/tentatives
✅ POST   /api/v1/diagnostic/reponse
✅ POST   /api/v1/diagnostic/tentatives/{id}/terminer

⛔ GET    /api/v1/users                     → 403 (users:read)
⛔ GET    /api/v1/formateurs                → 403 (trainers:read)
⛔ GET    /api/v1/langues                   → 403 (pedagogy:manage)
⛔ GET    /api/v1/admin/statistiques        → 403 (stats:read)
⛔ GET    /api/v1/roles                     → 403 (roles:manage)
```

À noter : `GET /langues` est **interdit à l'apprenant**, alors que l'inscription lui a fait choisir des langues.
L'écran de diagnostic ne peut donc pas utiliser cette route : il passe par `GET /diagnostic/langues`, qui
renvoie un format différent (avec `disponible` et `nombre_questions`).

---

## 5. Le formateur

### 5.1 Ce qui fonctionne réellement

| Fonctionnalité | Où | Preuve |
| --- | --- | --- |
| Connexion | `/login` | `POST /auth/login` |
| Tableau de bord | `/espace/formateur` | raccourcis, aucune donnée |
| Profil (infos, mot de passe) | `/espace/profil` | `GET`/`PATCH /users/me` |
| Photo de profil | `/espace/profil` | `POST`/`DELETE /users/me/photo` |

C'est tout. Le rôle `FORMATEUR` existe, il est correctement authentifié et protégé, mais **il n'a aucune
fonctionnalité métier**.

### 5.2 Le menu latéral du formateur

```ts
const FORMATEUR: NavItem[] = [
  { label: "Tableau de bord", href: ROUTES.formateur.dashboard },
  { label: "Mes séances",     href: ROUTES.formateur.seances, bientot: true },
  { label: "Ateliers",        href: ROUTES.formateur.ateliers, bientot: true },
  { label: "Mes apprenants",  href: ROUTES.formateur.apprenants, bientot: true },
  { label: "Mon profil",      href: ROUTES.profil },
  { label: "Paramètres",      href: ROUTES.formateur.parametres, bientot: true },
];
```

Trois entrées sur six sont des promesses : **Mes séances**, **Ateliers**, **Mes apprenants**. Aucune page
correspondante n'existe dans `frontend/src/app/espace/formateur/` — le dossier ne contient que `page.tsx`
(le tableau de bord).

### 5.3 Pourquoi il n'y a rien : aucune route backend

Le routeur `/formateurs` **n'est pas** l'espace du formateur. C'est l'**administration des formateurs** par
l'administrateur :

```text
GET   /formateurs        → lister les formateurs   (trainers:read   → admin)
POST  /formateurs        → créer un formateur      (trainers:manage → admin)
PATCH /formateurs/{id}   → modifier un formateur   (trainers:manage → admin)
```

Il n'existe **aucune** route du type `/mes-seances`, `/mes-apprenants` ou `/mes-ateliers`. Le backend n'a donc
rien à afficher à un formateur, et le frontend ne peut rien lui montrer d'autre que son profil.

### 5.4 Ce qui est absent pour le formateur

| Fonctionnalité attendue | Verdict | Pourquoi |
| --- | --- | --- |
| Voir ses apprenants | ⛔ | aucune route, aucune page |
| Voir / animer ses séances | ⛔ | table `atelier` vide, aucune route |
| Créer un atelier | ⛔ | aucune route, aucun écran |
| Corriger des productions | ⛔ | les réponses `texte` ne sont jamais corrigées |
| Suivre la progression | ⛔ | tables `parcours` / `exercice` inertes |
| Consulter le diagnostic d'un apprenant | ⛔ | aucune route ne l'expose au formateur |

### 5.5 Les routes auxquelles le formateur a droit

```text
✅ GET    /api/v1/users/me
✅ PATCH  /api/v1/users/me
✅ POST   /api/v1/users/me/photo
✅ DELETE /api/v1/users/me/photo

⛔ tout le reste                           → 403 (sauf les routes publiques)
```

### 5.6 Le piège de démonstration

Un formateur peut se connecter, mais son espace est **vide** : le tableau de bord n'affiche que des cartes
« Bientôt ». Si un jury demande « montrez ce que fait un formateur », la réponse honnête est : « le rôle est
créé, l'espace est prévu, les fonctionnalités pédagogiques ne sont pas encore développées ».

Créer un formateur, en revanche, est une action **d'administrateur** — et elle fonctionne (voir §6.3).

---

## 6. L'administrateur

C'est le rôle qui dispose du **plus grand nombre d'écrans et de routes**, et le seul à pouvoir modifier les
données de référence.

### 6.1 Le tableau de bord

| Élément | Source | État |
| --- | --- | --- |
| Nombre d'utilisateurs | `GET /admin/statistiques` | ✅ |
| Nombre d'apprenants | idem | ✅ |
| Nombre de formateurs | idem | ✅ |
| Ateliers programmés | idem | 🟡 toujours `0` (table vide) |
| Courbe des inscriptions (7 / 30 / 90 jours) | `GET /admin/statistiques/inscriptions` | ✅ |
| Répartition des apprenants par langue | `GET /admin/statistiques` | ✅ |
| Dernières inscriptions | `GET /admin/statistiques` | ✅ |

Le compteur d'ateliers est un `COUNT` réel sur la table `atelier`, filtré sur les ateliers futurs non annulés.
Il vaut `0` parce qu'aucun atelier n'existe — pas parce que le calcul est faux.

### 6.2 Gestion des utilisateurs

Page `/espace/admin/utilisateurs`, routes `GET /users` et `PATCH /users/{id_user}`.

| Action | Détail |
| --- | --- |
| Lister | pagination 10 / 20 / 50, total, page |
| Rechercher | nom, prénom ou e-mail (filtre `search`) |
| Filtrer par rôle | `APPRENANT`, `FORMATEUR`, `ADMINISTRATEUR` |
| Modifier les informations | prénom, nom, e-mail, téléphone |
| Changer le rôle | crée la spécialisation manquante, **conserve les anciennes** |
| Désactiver / réactiver | `ACTIF` ↔ `INACTIF` |
| Se modifier soi-même | interdit de changer **son propre rôle** ou de **se désactiver** (`403`) |

```python
# backend/app/api/routes/utilisateurs.py
if utilisateur.id_user == admin.id_user:
    if champs.get("role") not in (None, admin.role):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Vous ne pouvez pas modifier votre propre rôle.")
    if champs.get("statut") not in (None, StatutUtilisateur.ACTIF):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Vous ne pouvez pas désactiver votre propre compte.")
```

Deux limites à connaître :

- **aucune suppression** : un utilisateur est désactivé, jamais supprimé (les tables liées le référencent) ;
- l'interface ne propose que `ACTIF` / `INACTIF`, alors que l'API accepte aussi `SUSPENDU`. Le statut
  `SUSPENDU` est donc atteignable par API, mais pas par l'écran.

### 6.3 Gestion des formateurs

Page `/espace/admin/formateurs`, routes `GET`, `POST`, `PATCH /formateurs`.

| Action | Détail |
| --- | --- |
| Lister / rechercher / filtrer | par nom ou e-mail, par statut |
| Créer | prénom, nom, e-mail, téléphone, type de contrat, certifications, **au moins une langue** |
| Modifier | mêmes champs + `id_langues` remplace toute la liste |
| Désactiver / réactiver | via `statut` |

```python
# backend/app/api/routes/formateurs.py
"""Le compte est créé sans mot de passe connu : le formateur reçoit un lien pour choisir le sien."""
```

La création génère un mot de passe aléatoire et envoie une **invitation par e-mail**. Sans SMTP, le lien part
dans les journaux du backend. Aucune route `DELETE` n'existe : un formateur est lié à ses ateliers
(`ON DELETE RESTRICT`), il est désactivé à la place.

Types de contrat acceptés : `CDI`, `CDD`, `VACATAIRE`, `PRESTATAIRE`.

### 6.4 Gestion des langues et des niveaux

Deux onglets d'une même page : `/espace/admin/langues` et `/espace/admin/niveaux`, protégés par
`pedagogy:manage`.

| Action | Langue | Niveau |
| --- | :-: | :-: |
| Lister | ✅ | ✅ |
| Créer | ✅ (libellé, code, **au moins un niveau ouvert**) | ✅ (code, libellé) |
| Modifier | ✅ | ✅ |
| Supprimer | ✅ `204`, **`409` si utilisée** | ✅ `204`, **`409` si utilisée** |
| Code en doublon | `409` | `409` |

La suppression d'une langue supprime en cascade ses lignes `langue_niveau`, mais échoue si des apprenants,
formateurs ou formules la référencent. La suppression d'un niveau échoue s'il est utilisé ailleurs.

> C'est le seul domaine où l'administrateur modifie des **données pédagogiques de référence**. Il ne peut pas
> créer de questions : la banque de questions n'a **aucune route d'administration**.

### 6.5 Gestion des rôles et des permissions

Trois routes existent, toutes en `roles:manage` :

```text
GET /api/v1/roles
GET /api/v1/roles/permissions
PUT /api/v1/roles/{id_role}/permissions
```

Elles fonctionnent, mais **aucun écran ne les consomme**. Un administrateur ne peut donc changer les
permissions que par API ou via `/docs` :

```powershell
$jeton = (Invoke-RestMethod -Method Post http://localhost:8000/api/v1/auth/login `
  -ContentType "application/json" `
  -Body (@{ email = "admin@digitheque.mg"; mot_de_passe = "Demo2026" } | ConvertTo-Json)).access_token

$entetes = @{ Authorization = "Bearer $jeton" }
Invoke-RestMethod http://localhost:8000/api/v1/roles -Headers $entetes | ConvertTo-Json -Depth 5
```

Garde-fou : retirer `roles:manage` au **dernier** rôle qui le possède renvoie `409`.

### 6.6 Le catalogue des formules

`GET /formules` est **public** et alimente le sélecteur d'inscription. Il n'existe **aucune** route
d'administration des formules : les formules viennent du seed et ne peuvent pas être créées ni modifiées par
l'interface. L'administrateur n'a donc pas de page « Formules ».

### 6.7 Ce qui est partiel ou absent pour l'administrateur

| Fonctionnalité | Verdict | Explication |
| --- | --- | --- |
| Compteur d'ateliers | 🟡 | réel, mais toujours `0` |
| Écran de gestion des rôles | 🔌 | API prête, aucun écran |
| Écran de gestion des formules | ⛔ | aucune route, aucune page |
| Ateliers | ⛔ | entrée « Bientôt », table vide |
| Réservations | ⛔ | entrée « Bientôt », aucune table |
| Formations | ⛔ | entrée « Bientôt », aucune table |
| Rapports | ⛔ | entrée « Bientôt » |
| Paramètres | ⛔ | entrée « Bientôt » |
| Suppression d'un utilisateur / formateur | ⛔ | désactivation seulement |
| Passer le test de positionnement | ⛔ | `403` : le diagnostic est réservé à l'apprenant |

### 6.8 Les routes auxquelles l'administrateur a droit

```text
✅ GET    /api/v1/users                                  users:read
✅ PATCH  /api/v1/users/{id_user}                        users:manage
✅ GET    /api/v1/formateurs                             trainers:read
✅ POST   /api/v1/formateurs                             trainers:manage
✅ PATCH  /api/v1/formateurs/{id_user}                   trainers:manage
✅ GET    /api/v1/langues                                pedagogy:manage
✅ POST   /api/v1/langues                                pedagogy:manage
✅ PATCH  /api/v1/langues/{id_langue}                    pedagogy:manage
✅ DELETE /api/v1/langues/{id_langue}                    pedagogy:manage
✅ GET    /api/v1/niveaux                                pedagogy:manage
✅ POST   /api/v1/niveaux                                pedagogy:manage
✅ PATCH  /api/v1/niveaux/{id_niveau}                    pedagogy:manage
✅ DELETE /api/v1/niveaux/{id_niveau}                    pedagogy:manage
✅ GET    /api/v1/admin/statistiques                     stats:read
✅ GET    /api/v1/admin/statistiques/inscriptions        stats:read
✅ GET    /api/v1/roles                                  roles:manage
✅ GET    /api/v1/roles/permissions                      roles:manage
✅ PUT    /api/v1/roles/{id_role}/permissions            roles:manage
✅ GET/PATCH/DELETE /api/v1/users/me…                    profile:read / profile:write

⛔ GET/POST /api/v1/diagnostic/*                        403 (rôle APPRENANT exigé)
```

### 6.9 Le menu latéral de l'administrateur

```ts
const ADMINISTRATEUR: NavItem[] = [
  { label: "Tableau de bord",    href: ROUTES.admin.dashboard },
  { label: "Utilisateurs",       href: ROUTES.admin.utilisateurs },
  { label: "Formateurs",         href: ROUTES.admin.formateurs },
  { label: "Ateliers",           href: ROUTES.admin.ateliers, bientot: true },
  { label: "Réservations",       href: ROUTES.admin.reservations, bientot: true },
  { label: "Formations",         href: ROUTES.admin.formations, bientot: true },
  { label: "Langues et niveaux", href: ROUTES.admin.langues, aussiActifSur: [ROUTES.admin.niveaux] },
  { label: "Rapports",           href: ROUTES.admin.rapports, bientot: true },
  { label: "Paramètres",         href: ROUTES.admin.parametres, bientot: true },
];
```

Cinq entrées sur neuf sont des promesses. Les quatre écrans réels sont : tableau de bord, utilisateurs,
formateurs, langues/niveaux — plus le profil, commun aux trois rôles.

---

## 7. Matrice complète des 32 routes

Lecture : ✅ autorisé, ⛔ refusé (`403`), 🌐 public (aucun jeton).

| # | Méthode | Route | Visiteur | Apprenant | Formateur | Admin | Contrôle |
| :-: | --- | --- | :-: | :-: | :-: | :-: | --- |
| 1 | POST | `/auth/login` | 🌐 | 🌐 | 🌐 | 🌐 | public |
| 2 | POST | `/auth/register` | 🌐 | 🌐 | 🌐 | 🌐 | public |
| 3 | POST | `/auth/forgot-password` | 🌐 | 🌐 | 🌐 | 🌐 | public |
| 4 | POST | `/auth/reset-password` | 🌐 | 🌐 | 🌐 | 🌐 | public |
| 5 | GET | `/formules` | 🌐 | 🌐 | 🌐 | 🌐 | public |
| 6 | GET | `/users/me` | ⛔ | ✅ | ✅ | ✅ | `profile:read` |
| 7 | PATCH | `/users/me` | ⛔ | ✅ | ✅ | ✅ | `profile:write` |
| 8 | POST | `/users/me/photo` | ⛔ | ✅ | ✅ | ✅ | `profile:write` |
| 9 | DELETE | `/users/me/photo` | ⛔ | ✅ | ✅ | ✅ | `profile:write` |
| 10 | GET | `/diagnostic/langues` | ⛔ | ✅ | ⛔ | ⛔ | rôle `APPRENANT` |
| 11 | GET | `/diagnostic/questions` | ⛔ | ✅ | ⛔ | ⛔ | rôle `APPRENANT` |
| 12 | POST | `/diagnostic/tentatives` | ⛔ | ✅ | ⛔ | ⛔ | rôle `APPRENANT` |
| 13 | POST | `/diagnostic/reponse` | ⛔ | ✅ | ⛔ | ⛔ | rôle `APPRENANT` |
| 14 | POST | `/diagnostic/tentatives/{id_tentative}/terminer` | ⛔ | ✅ | ⛔ | ⛔ | rôle `APPRENANT` |
| 15 | GET | `/users` | ⛔ | ⛔ | ⛔ | ✅ | `users:read` |
| 16 | PATCH | `/users/{id_user}` | ⛔ | ⛔ | ⛔ | ✅ | `users:manage` |
| 17 | GET | `/formateurs` | ⛔ | ⛔ | ⛔ | ✅ | `trainers:read` |
| 18 | POST | `/formateurs` | ⛔ | ⛔ | ⛔ | ✅ | `trainers:manage` |
| 19 | PATCH | `/formateurs/{id_user}` | ⛔ | ⛔ | ⛔ | ✅ | `trainers:manage` |
| 20 | GET | `/langues` | ⛔ | ⛔ | ⛔ | ✅ | `pedagogy:manage` |
| 21 | POST | `/langues` | ⛔ | ⛔ | ⛔ | ✅ | `pedagogy:manage` |
| 22 | PATCH | `/langues/{id_langue}` | ⛔ | ⛔ | ⛔ | ✅ | `pedagogy:manage` |
| 23 | DELETE | `/langues/{id_langue}` | ⛔ | ⛔ | ⛔ | ✅ | `pedagogy:manage` |
| 24 | GET | `/niveaux` | ⛔ | ⛔ | ⛔ | ✅ | `pedagogy:manage` |
| 25 | POST | `/niveaux` | ⛔ | ⛔ | ⛔ | ✅ | `pedagogy:manage` |
| 26 | PATCH | `/niveaux/{id_niveau}` | ⛔ | ⛔ | ⛔ | ✅ | `pedagogy:manage` |
| 27 | DELETE | `/niveaux/{id_niveau}` | ⛔ | ⛔ | ⛔ | ✅ | `pedagogy:manage` |
| 28 | GET | `/admin/statistiques` | ⛔ | ⛔ | ⛔ | ✅ | `stats:read` |
| 29 | GET | `/admin/statistiques/inscriptions` | ⛔ | ⛔ | ⛔ | ✅ | `stats:read` |
| 30 | GET | `/roles` | ⛔ | ⛔ | ⛔ | ✅ | `roles:manage` |
| 31 | GET | `/roles/permissions` | ⛔ | ⛔ | ⛔ | ✅ | `roles:manage` |
| 32 | PUT | `/roles/{id_role}/permissions` | ⛔ | ⛔ | ⛔ | ✅ | `roles:manage` |

> Les colonnes « Apprenant / Formateur / Admin » reflètent le **seed**. Comme les permissions sont modifiables,
> seul le diagnostic (contrôle de rôle en dur) est réellement figé.

---

## 8. Démonstration par rôle (10 minutes)

### 8.1 Visiteur (1 min)

1. <http://localhost:3000> → page d'accueil.
2. « S'inscrire » : montrer le choix des langues et de la formule (catalogue chargé depuis `GET /formules`).
3. Ne pas valider : l'inscription crée un vrai compte et un abonnement.

### 8.2 Administrateur (4 min)

1. Connexion `admin@digitheque.mg` / `Demo2026`.
2. Tableau de bord : compteurs, courbe 30 jours, répartition par langue.
3. Utilisateurs : filtrer par rôle, ouvrir une fiche, changer un rôle, désactiver un compte.
4. Formateurs : créer un formateur → annoncer que l'invitation part **dans les logs**.
5. Langues et niveaux : montrer les 5 langues / 12 niveaux ; tenter de supprimer une langue utilisée → `409`.
6. **Ne pas promettre** : ateliers, réservations, formations, rapports.

### 8.3 Apprenant (4 min)

1. Connexion `apprenant@digitheque.mg` / `Demo2026`.
2. Test de positionnement → anglais → **2 questions** A1.
3. Répondre, terminer : score, niveau, compétences.
4. Montrer le bandeau « Résultat partiel » et expliquer pourquoi.
5. Profil : modifier le téléphone, changer la photo.
6. **Ne pas promettre** : reprise du test, oral, justification détaillée, historique.

### 8.4 Formateur (1 min)

1. Connexion `formateur@digitheque.mg` / `Demo2026`.
2. Montrer le tableau de bord : uniquement des cartes « Bientôt ».
3. Ouvrir le profil : c'est la seule fonctionnalité réelle du rôle.
4. **Message honnête** : le rôle et ses gardes existent, les fonctionnalités pédagogiques sont à venir.

---

## 9. Sécurité et limites transverses aux rôles

| Point | État | Conséquence |
| --- | --- | --- |
| Contrôle backend | ✅ | `403` systématique hors permission |
| Garde frontend | 🟡 | confort d'affichage, contournable |
| Jeton JWT | 🟡 | 24 h, aucun rafraîchissement |
| Déconnexion | 🟡 | côté client seulement : le jeton reste valide |
| Compte inactif | ✅ | refusé à chaque requête (`401`) |
| Limitation de débit | ⛔ | bruteforce possible sur `/auth/login` |
| Écran de gestion des permissions | 🔌 | API prête, aucun écran |
| Journal d'audit | ⛔ | aucune trace de « qui a changé quel rôle » |
| Suppression d'un compte | ⛔ | désactivation uniquement |

Deux règles de conception à retenir :

1. **le rôle décide de l'écran, la permission décide de l'action** : le frontend utilise `utilisateur.role`
   pour choisir le menu, le backend utilise les permissions pour autoriser la route ;
2. **changer de rôle ne détruit rien** : la ligne `Apprenant`, `Formateur` ou `Administrateur` manquante est
   créée, les anciennes sont conservées. Un utilisateur qui redevient apprenant retrouve donc son historique.

---

## 10. Ce que le développeur doit maîtriser

1. **Le rôle est un code entier immuable** : on ajoute, on ne modifie jamais.
2. **Le RBAC est en base** : une permission retirée s'applique à la requête suivante, sans redéploiement.
3. **Le diagnostic échappe au RBAC** : il compare `utilisateur.role`, donc l'admin est refusé.
4. **`RequireAuth` n'est pas une sécurité** : toute route doit être protégée côté FastAPI.
5. **Les entrées « Bientôt » ne sont pas des fonctionnalités** : elles n'ont ni page, ni route, ni table utile.
6. **Le formateur est un rôle sans métier** : ne pas confondre `/formateurs` (administration) avec un espace
   formateur qui n'existe pas.
7. **Les permissions par défaut ne sont pas des permissions garanties** : seul le seed les fixe.

---

## Questions de compréhension

1. Un apprenant appelle `GET /api/v1/users` avec un jeton valide. Que renvoie le backend, et quel mécanisme
   exact produit cette réponse ? Que se passerait-il si l'on retirait `RequireAuth` du frontend ?
2. Pourquoi un administrateur ne peut-il pas passer le test de positionnement, alors qu'il possède toutes les
   permissions ? Quelle ligne de code en est la cause, et comment le rendrait-on configurable ?
3. Le rôle `FORMATEUR` a un tableau de bord et un profil, mais aucune fonctionnalité pédagogique. Cite les
   trois couches qui manquent pour « voir ses apprenants » et explique ce que chacune devrait contenir.
4. Un administrateur retire `users:read` au rôle `ADMINISTRATEUR`. Que se passe-t-il immédiatement pour les
   administrateurs connectés ? Et que se passe-t-il s'il retire `roles:manage` au dernier rôle qui le détient ?
5. L'interface ne propose que `ACTIF` et `INACTIF`, mais l'API accepte `SUSPENDU`. Décris le comportement d'un
   compte `SUSPENDU` côté connexion et côté jeton, puis explique pourquoi cette différence est un risque de
   démonstration.
