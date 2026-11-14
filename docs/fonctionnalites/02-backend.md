# 02 — Le backend (FastAPI)

> Référence : `backend/app/` (routes, modèles, schémas, services), `backend/tests/`, `backend/pyproject.toml`.
> Constat du **14 novembre 2026**, branche `develop` (`95543db`).
> Toutes les routes sont sous le préfixe **`/api/v1`** (défini une seule fois dans `app/api/router.py`).

---

## 1. À quoi sert le backend

Le backend est le **seul propriétaire des règles métier**. Il :

1. authentifie les utilisateurs et délivre un jeton JWT ;
2. contrôle les droits (RBAC) avant chaque action ;
3. lit et écrit les 22 tables PostgreSQL via SQLAlchemy 2 ;
4. calcule le score du test de diagnostic (déterministe) ;
5. appelle le service IA pour l'analyse pédagogique, **sans jamais bloquer** la réponse si l'IA échoue ;
6. expose un contrat stable au frontend (`docs/api/contrat-frontend.md`).

Le frontend ne calcule **rien** d'important : il affiche ce que le backend renvoie.

---

## 2. Carte des fichiers

```
backend/app/
├── main.py                 # application FastAPI, CORS, /media, /health
├── api/
│   ├── router.py           # préfixe /api/v1 + branchement des routeurs
│   ├── deps.py             # JWT, permission_requise, pagination
│   └── routes/             # 9 fichiers de routes (32 routes)
├── core/
│   ├── config.py           # Settings (Pydantic) lues dans l'environnement
│   ├── database.py         # moteur, SessionLocal, Base, get_db
│   └── security.py         # bcrypt, création/lecture des JWT
├── models/                 # tables SQLAlchemy (utilisateurs, diagnostic, pédagogie…)
├── schemas/                # contrats Pydantic d'entrée/sortie
├── services/               # logique métier (diagnostic, scoring, IA, e-mails, photos)
├── seed.py                 # référentiel + comptes de démonstration
└── seed_diagnostic.py      # banque de 35 questions (EN/FR)
```

Règle de lecture : **route = contrôle d'accès + validation + appel d'un service**. Un routeur ne contient
pas de calcul métier long ; il traduit une erreur métier en code HTTP.

---

## 3. Démarrage de l'application

`app/main.py` fait quatre choses :

```python
app = FastAPI(title="Centre de langues IA — API", version="0.1.0")

app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, ...)
app.include_router(api_router)                 # tout /api/v1
app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "backend"}
```

| Élément | Conséquence |
| --- | --- |
| CORS | seules les origines de `BACKEND_CORS_ORIGINS` peuvent appeler l'API depuis un navigateur |
| `/media` | photos de profil servies **sans authentification** (le nom de fichier est imprévisible) |
| `/health` | utilisé par le healthcheck Docker et la supervision |
| `/docs` | Swagger généré automatiquement : c'est le contrat réel, à jour |

> **Piège** : `/health` est **hors** `/api/v1`. Un reverse proxy qui ne relaie que `/api` ne verra pas le
> healthcheck.

---

## 4. Authentification et jetons

### 4.1 Le cycle

```
POST /auth/register ──► crée Utilisateur + Apprenant + Abonnement (201)
POST /auth/login    ──► vérifie bcrypt, renvoie access_token + utilisateur (200)
       │
       ▼
Authorization: Bearer <JWT>   sur chaque appel protégé
       │
       ▼
utilisateur_connecte() ──► 401 si jeton absent/expiré/invalide ou compte inactif
```

### 4.2 Le mot de passe

```python
# app/core/security.py
def hacher_mot_de_passe(mot_de_passe: str) -> str:
    return bcrypt.hashpw(mot_de_passe.encode(), bcrypt.gensalt(rounds=settings.bcrypt_rounds)).decode()

def verifier_mot_de_passe(mot_de_passe: str, hache: str) -> bool:
    try:
        return bcrypt.checkpw(mot_de_passe.encode(), hache.encode())
    except ValueError:
        return False
```

Le mot de passe n'est **jamais** renvoyé par l'API : `UtilisateurOut` ne contient pas le champ.

### 4.3 Le JWT

Deux usages distincts, vérifiés à la lecture (`lire_jeton`) :

| Usage | Créé par | Durée par défaut | Contenu |
| --- | --- | --- | --- |
| `USAGE_ACCES` | `creer_jeton_acces` | `ACCESS_TOKEN_EXPIRE_MINUTES` | `sub` = id utilisateur |
| `USAGE_REINITIALISATION` | `creer_jeton_reinitialisation` | `RESET_TOKEN_EXPIRE_MINUTES` | `sub` + `mdp` (12 derniers caractères du hash) |

Le claim `mdp` rend le lien de réinitialisation **à usage unique** : dès que le mot de passe change, le hash
change, donc le claim ne correspond plus.

### 4.4 401 ou 403 ?

| Situation | Code | Sens |
| --- | --- | --- |
| Pas de jeton, jeton expiré, compte `INACTIF` | **401** | « reconnecte-toi » |
| Jeton valide mais permission manquante | **403** | « tu es connecté, mais tu n'as pas le droit » |
| Mot de passe actuel faux dans `PATCH /users/me` | **400** | un 401 déconnecterait l'utilisateur |

Cette distinction est **volontaire** et documentée dans le code. Le frontend s'appuie dessus : un 401 vide la
session, un 403 affiche un message.

---

## 5. RBAC : rôles et permissions

### 5.1 Les trois rôles

`Role` est un entier en base (`SMALLINT`) et un texte dans l'API : `APPRENANT`, `FORMATEUR`,
`ADMINISTRATEUR`. **On ne change jamais un code existant, on en ajoute.**

Chaque rôle a sa table de spécialisation (`apprenant`, `formateur`, `administrateur`) reliée à `utilisateur`
par `id_user`. Un changement de rôle **crée** la nouvelle ligne et **conserve** les anciennes
(`_assurer_specialisation`).

### 5.2 Les neuf permissions

Définies dans `app/models/roles.py` :

| Code | Description | APPRENANT | FORMATEUR | ADMIN |
| --- | --- | :-: | :-: | :-: |
| `profile:read` | Lire son profil | ✅ | ✅ | ✅ |
| `profile:write` | Modifier son profil | ✅ | ✅ | ✅ |
| `users:read` | Lister les utilisateurs | | | ✅ |
| `users:manage` | Modifier rôle / statut | | | ✅ |
| `trainers:read` | Lister les formateurs | | | ✅ |
| `trainers:manage` | Créer / modifier un formateur | | | ✅ |
| `pedagogy:manage` | Gérer langues et niveaux | | | ✅ |
| `stats:read` | Statistiques d'administration | | | ✅ |
| `roles:manage` | Gérer les permissions des rôles | | | ✅ |

Le seed **n'écrase pas** les permissions d'un rôle déjà créé : `charger_roles_et_permissions` ne réassigne les
droits que pour les rôles **nouveaux**. C'est ce qui permet à l'écran d'administration des rôles d'être
utilisable sans être réinitialisé à chaque redémarrage.

### 5.3 Comment le contrôle est appliqué

```python
# app/api/deps.py
def permission_requise(code_permission: str):
    def verifier_permission(db: DbSession, utilisateur: UtilisateurConnecte) -> Utilisateur:
        autorise = db.scalar(
            select(exists().where(
                RoleRBAC.code == utilisateur.role.value,
                role_permission.c.id_role == RoleRBAC.id_role,
                role_permission.c.id_permission == Permission.id_permission,
                Permission.code == code_permission,
            ))
        )
        if not autorise:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Droits insuffisants.")
        return utilisateur
    return verifier_permission
```

Puis dans une route :

```python
_admin: Annotated[Utilisateur, Depends(permission_requise("users:read"))]
```

**Le contrôle est en base, pas dans le JWT.** Conséquence : retirer une permission à un rôle prend effet
immédiatement, sans attendre l'expiration des jetons.

### 5.4 Le cas particulier du diagnostic

Les routes du diagnostic ne passent pas par `permission_requise` mais par un test explicite :

```python
if utilisateur.role != Role.APPRENANT:
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Droits insuffisants.")
```

C'est cohérent (seul un apprenant passe un test), mais **différent** du reste du code : une permission
`diagnostic:pass` serait plus homogène. À signaler en revue.

---

## 6. Tableau complet des routes (32)

Légende accès : **Public** = sans jeton ; **Connecté** = jeton valide ; **Rôle X** = jeton + rôle ;
**Perm X** = jeton + permission RBAC.

### 6.1 Authentification (public)

| Méthode | Chemin | Accès | Succès | Erreurs |
| --- | --- | --- | --- | --- |
| POST | `/auth/login` | Public | 200 `TokenOut` | 401 identifiants incorrects |
| POST | `/auth/register` | Public | 201 `ApprenantOut` | 409 e-mail pris, 422 formule/langue |
| POST | `/auth/forgot-password` | Public | 204 | toujours 204 (anti-énumération) |
| POST | `/auth/reset-password` | Public | 204 | 400 lien invalide/expiré |

`register` crée **en une transaction** : `Utilisateur`, `Apprenant` (avec ses langues) et `Abonnement`
(date de fin calculée par `_ajouter_mois`, qui gère le 31 janvier + 1 mois). Il **ne connecte pas** :
l'apprenant doit se connecter ensuite.

### 6.2 Profil

| Méthode | Chemin | Accès | Succès | Erreurs |
| --- | --- | --- | --- | --- |
| GET | `/users/me` | Perm `profile:read` | 200 | 401 |
| PATCH | `/users/me` | Perm `profile:write` | 200 | 400 mot de passe actuel faux, 409 e-mail pris, 422 |
| POST | `/users/me/photo` | Perm `profile:write` | 200 | 413 > 2 Mo, 415 format refusé |
| DELETE | `/users/me/photo` | Perm `profile:write` | 200 | 401 |

La photo est validée par **signature binaire** (JPEG, PNG, WebP), pas par le `Content-Type` annoncé par le
navigateur. Le nom est horodaté pour contourner le cache.

### 6.3 Administration

| Méthode | Chemin | Accès | Succès | Erreurs |
| --- | --- | --- | --- | --- |
| GET | `/users` | Perm `users:read` | 200 `PageUtilisateurs` | 422 `page_size` ≠ 10/20/50 |
| PATCH | `/users/{id_user}` | Perm `users:manage` | 200 | 403 auto-modification interdite, 404, 409 e-mail |
| GET | `/formateurs` | Perm `trainers:read` | 200 `PageFormateurs` | 401 |
| POST | `/formateurs` | Perm `trainers:manage` | 201 | 409 e-mail, 422 langue |
| PATCH | `/formateurs/{id_user}` | Perm `trainers:manage` | 200 | 404 |
| GET | `/roles` | Perm `roles:manage` | 200 | 401 |
| GET | `/roles/permissions` | Perm `roles:manage` | 200 | 401 |
| PUT | `/roles/{id_role}/permissions` | Perm `roles:manage` | 200 | 404 |
| GET | `/admin/statistiques` | Perm `stats:read` | 200 | 401 |
| GET | `/admin/statistiques/inscriptions?jours=30` | Perm `stats:read` | 200 | 422 `jours` ≠ 7/30/90 |

Deux garde-fous importants dans `PATCH /users/{id_user}` :

- un administrateur **ne peut pas changer son propre rôle** ni **se désactiver** (403) ;
- un changement de rôle crée la ligne de spécialisation manquante.

`POST /formateurs` crée un compte **sans mot de passe connu** : un mot de passe aléatoire est haché et
jamais communiqué, puis un lien d'invitation (3 jours) est envoyé — ou **écrit dans les journaux** si SMTP
n'est pas configuré.

### 6.4 Pédagogie

| Méthode | Chemin | Accès | Succès |
| --- | --- | --- | --- |
| GET | `/langues` | Perm `pedagogy:manage` | 200 `PageLangues` |
| POST | `/langues` | Perm `pedagogy:manage` | 201 |
| PATCH | `/langues/{id_langue}` | Perm `pedagogy:manage` | 200 |
| DELETE | `/langues/{id_langue}` | Perm `pedagogy:manage` | 204 (409 si utilisée) |
| GET | `/niveaux` | Perm `pedagogy:manage` | 200 |
| POST | `/niveaux` | Perm `pedagogy:manage` | 201 |
| PATCH | `/niveaux/{id_niveau}` | Perm `pedagogy:manage` | 200 |
| DELETE | `/niveaux/{id_niveau}` | Perm `pedagogy:manage` | 204 (409 si utilisé) |

> **Écart à connaître** : `GET /langues` et `GET /niveaux` sont réservés à l'administrateur. Un apprenant ne
> peut donc pas lire le catalogue des langues par l'API — il passe par `GET /diagnostic/langues`, qui renvoie
> une vue réduite. Le contrat d'API le précise, mais c'est une asymétrie surprenante.

`DELETE /langues/{id}` supprime les lignes `langue_niveau` en cascade, mais renvoie **409** si une formule ou
un parcours référence la langue.

### 6.5 Formules (public)

| Méthode | Chemin | Accès | Succès |
| --- | --- | --- | --- |
| GET | `/formules` | Public | 200 `list[FormuleOut]`, triées par prix |

C'est la seule route métier totalement publique : l'écran d'inscription doit afficher les formules **avant**
de créer un compte.

### 6.6 Diagnostic (rôle APPRENANT)

| Méthode | Chemin | Accès | Succès | Erreurs |
| --- | --- | --- | --- | --- |
| GET | `/diagnostic/langues` | Rôle APPRENANT | 200 | 403 |
| GET | `/diagnostic/questions?code_langue=en&code_niveau=A1` | Rôle APPRENANT | 200 | 403, 404 langue/niveau, 409 niveau non ouvert, 409 aucune question |
| POST | `/diagnostic/tentatives` | Rôle APPRENANT | 201 `TentativeOut` | 404 langue, 409 aucune question |
| POST | `/diagnostic/reponse` | Rôle APPRENANT | 201 `ReponseOut` | 404 tentative/question, 409 hors tentative, 422 choix invalide, 422 audio, 409 réponse différente |
| POST | `/diagnostic/tentatives/{id}/terminer` | Rôle APPRENANT | 200 `ScoreDiagnosticOut` | 404, 409 déjà terminée, 409 questions non configurées |

---

## 7. Le diagnostic en détail

C'est la fonctionnalité la plus riche du backend, et la plus fragile. Elle mérite d'être comprise ligne par
ligne.

### 7.1 Cycle de vie d'une tentative

```
GET /diagnostic/langues        → quelles langues, quel niveau de départ, combien de questions
GET /diagnostic/questions      → les questions du niveau
POST /diagnostic/tentatives    → crée TestDiagnostic (statut EN_COURS)
POST /diagnostic/reponse       → enregistre chaque réponse (non évaluée)
POST /diagnostic/tentatives/{id}/terminer → calcule le score, statut TERMINE, puis analyse IA
```

**Chaque appel à `POST /diagnostic/tentatives` crée une nouvelle tentative.** Il n'y a **aucune reprise** :
fermer l'onglet laisse une tentative `EN_COURS` orpheline, et la suivante en crée une autre. Les routes de
reprise (`GET /diagnostic/tentatives/en-cours`, `POST .../abandonner`) sont décrites dans le contrat mais
**absentes du backend** — le frontend les appelle quand même (voir chapitre 04).

### 7.2 Choix du niveau de départ

```python
def _niveau_de_depart(db, langue):
    questions = _questions_par_niveau(db, langue)   # compte par niveau, types "choix" et "texte"
    niveau = next((n for n in langue.niveaux if questions.get(n.id_niveau)), None)
    return niveau, questions.get(niveau.id_niveau, 0) if niveau else 0
```

C'est le **premier niveau ouvert qui contient au moins une question enregistrable**. Conséquences :

- le test **n'est pas adaptatif** : il ne monte ni ne descend selon les réponses ;
- avec le seed, le niveau de départ est **A1**, qui contient **2 questions par langue** (EN et FR) ;
- le « test » réel dure donc quelques secondes, pas 15 minutes ;
- `zh`, `it`, `de` n'ont **aucune question** → `disponible: false` dans la réponse.

Le frontend, lui, simule un plan de 15 minutes (8 QCM + 2 orales + 1 orale + 1 écrite) en mode mock. En
mode réel, il affiche ce que le backend envoie.

### 7.3 Enregistrement d'une réponse

Règles vérifiées par `enregistrer_reponse` :

1. la tentative appartient à l'apprenant connecté ;
2. la tentative est `EN_COURS` ;
3. la question existe et appartient **à la même langue et au même niveau** que la tentative ;
4. si la question est à choix, la réponse doit être **l'une des propositions** ;
5. une question `audio` est refusée (**422** `audio_non_disponible`) : le stockage des médias n'existe pas ;
6. une deuxième réponse **identique** est idempotente (on renvoie la précédente) ;
7. une deuxième réponse **différente** est refusée (**409** `reponse_differente`).

Le type `texte` est accepté et stocké, mais **n'est pas corrigé** par le scoring.

### 7.4 Scoring : déterministe, en pourcentage

```python
questions = [q for q in niveau if q.type_reponse == "choix"]   # TOUTES les questions à choix du niveau
nb_correctes = sum(reponse == q.reponse_correcte for q in questions)
pourcentage = (nb_correctes * 100 / len(questions)).quantize(Decimal("0.01"))
```

Points essentiels :

- **toutes** les questions à choix du niveau sont corrigées, pas seulement celles auxquelles l'apprenant a
  répondu : une question sans réponse compte **fausse** ;
- si une question à choix n'a pas de clé de correction valide → **409** `questions_non_configurees` ;
- le score est un pourcentage arrondi au centième (`ROUND_HALF_UP`), pas un nombre de points brut.

### 7.5 Seuils de niveau

| Pourcentage | CECRL | HSK |
| --- | --- | --- |
| < 20 | A1 | HSK 1 |
| 20 – 39,99 | A2 | HSK 2 |
| 40 – 59,99 | B1 | HSK 3 |
| 60 – 74,99 | B2 | HSK 4 |
| 75 – 89,99 | C1 | HSK 5 |
| ≥ 90 | C2 | HSK 6 |

Le cadre dépend de la langue : `zh` → HSK, toutes les autres → CECRL (`cadre_de_langue`).

### 7.6 L'analyse IA, facultative par construction

Après le scoring, le routeur **ferme la session PostgreSQL** puis appelle le service IA :

```python
db.close()                       # ne pas immobiliser une connexion pendant 55 s
analyse = analyser_tentative(id_test)   # retourne None si l'IA échoue
```

`analyser_tentative` :

1. relit la tentative et ses réponses dans une **nouvelle** session ;
2. si `analyse_ia` est déjà en base, la renvoie telle quelle (**idempotent**) ;
3. sinon prépare une requête **sans donnée identifiante** (langue, niveau, réponses, score) ;
4. appelle `POST /diagnostic/evaluer` du service IA ;
5. en cas d'échec (`ErreurServiceIA`), journalise un avertissement et renvoie `None`.

Le résultat public (`ScoreDiagnosticOut`) contient alors :

| Champ | Source | Si IA indisponible |
| --- | --- | --- |
| `score`, `max_score`, `percentage`, `level`, `framework` | scoring déterministe | toujours présents |
| `competences` | calcul déterministe sur les réponses | `None` |
| `points_faibles` | analyse IA | `None` |
| `phase_assimil` | analyse IA | `None` |
| `justification` | **jamais produit** | absent |

C'est pour cela que le frontend affiche **« Résultat partiel »** par défaut : avec
`LLM_FOURNISSEUR=factice` sans scénario, l'appel IA échoue en `LLM_CONFIGURATION` (500), le backend dégrade
proprement.

> **Nuance importante** : `competences` n'est pas produit par l'IA, il est calculé par le backend à partir des
> réponses. Le commentaire du schéma le dit : « Score déterministe sur les questions à choix d'une compétence ».

---

## 8. Les services métier

| Fichier | Rôle | Point d'attention |
| --- | --- | --- |
| `services/diagnostic.py` | langues disponibles, questions, création de tentative, réponses | aucune reprise de tentative |
| `services/scoring.py` | correction, seuils, niveau final | toutes les questions à choix du niveau |
| `services/analyse_diagnostic.py` | orchestration de l'appel IA et persistance | ne bloque jamais la réponse |
| `services/ia.py` | client HTTP du service IA | timeout 55 s, validation stricte de la réponse |
| `services/photos.py` | validation et stockage des photos | signature binaire, 2 Mo |
| `services/email.py` | envoi SMTP ou journal | sans SMTP, le lien part dans les logs |
| `services/recherche.py` | filtre `ILIKE` insensible à la casse | utilisé par les listes |

### 8.1 La frontière de confiance avec l'IA

`app/schemas/ia.py` **redéfinit** les modèles du service IA au lieu de les importer :

```python
CodeLangueIA = Literal["fr", "en", "zh", "it", "de"]
ReferentielIA = Literal["CECRL", "HSK"]
CompetenceIA = Literal["grammaire", "lecture", "ecoute", "ecrit", "oral"]
```

Pourquoi dupliquer ? Pour que le backend **refuse** une réponse hors contrat au lieu de la relayer au
frontend, et pour qu'il ne dépende pas du paquet `ia-service`. Le score et le niveau publics restent calculés
par le backend, jamais par l'IA.

---

## 9. Erreurs : un catalogue explicite

Les services lèvent des erreurs typées (`ErreurDiagnostic`, `ErreurScoring`, `ErreurServiceIA`), et les
routeurs les traduisent via des dictionnaires :

```python
_ERREURS_HTTP = {
    CodeErreurDiagnostic.AUCUNE_QUESTION: (409, "Aucune question n'est disponible pour ce niveau."),
    CodeErreurDiagnostic.AUDIO_NON_DISPONIBLE: (422, "Le stockage des réponses audio n'est pas disponible."),
    ...
}
```

| Code HTTP | Signification dans ce backend |
| --- | --- |
| 400 | requête compréhensible mais refusée (mot de passe actuel faux, lien invalide) |
| 401 | session absente/expirée |
| 403 | rôle ou permission insuffisants |
| 404 | ressource inconnue |
| 409 | conflit d'état (e-mail pris, tentative terminée, langue utilisée) |
| 413 / 415 | photo trop lourde / format non supporté |
| 422 | validation Pydantic ou valeur hors référentiel |
| 500 | bug ou service IA en erreur de configuration |

Le corps d'erreur est toujours `{"detail": "..."}` (convention FastAPI). Le frontend le mappe en message
utilisateur.

---

## 10. Tests et couverture

```
backend/tests/
├── conftest.py                    # base <db>_test + migrations + truncate par test
├── test_auth.py
├── test_diagnostic_analyse.py
├── test_diagnostic_langues.py
├── test_diagnostic_questions.py
├── test_diagnostic_reponses.py
├── test_diagnostic_scoring.py
├── test_formateurs.py
├── test_formules_statistiques.py
├── test_ia_service.py
├── test_modele_diagnostic.py
├── test_modele_parcours.py
├── test_modele_utilisateurs.py
├── test_pedagogie.py
├── test_phase_parcours.py
├── test_profil.py
├── test_rbac.py
├── test_roles.py
├── test_seed.py
├── test_utilisateurs.py
```

### 10.1 Contrainte forte

`conftest.py` **crée une vraie base PostgreSQL** `<nom>_test`, applique Alembic, puis vide les tables avant
chaque test. Donc :

- `pytest` lancé sur la machine hôte **échoue** sans PostgreSQL ;
- la commande correcte passe par Docker :

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm backend pytest
```

### 10.2 Ce qui est réellement testé

| Sujet | Fichier(s) | Preuve |
| --- | --- | --- |
| Inscription, connexion, reset | `test_auth.py` | parcours complets |
| RBAC et rôles | `test_rbac.py`, `test_roles.py` | 403 par permission |
| Diagnostic complet | `test_diagnostic_*` | langues, questions, réponses, scoring |
| Dégradation IA | `test_diagnostic_analyse.py`, `test_ia_service.py` | `analyse = None` |
| Seed idempotent | `test_seed.py` | deux exécutions = mêmes données |
| Profil et photo | `test_profil.py` | validation binaire |
| Modèles et parcours | `test_modele_*`, `test_phase_parcours.py` | contraintes SQL |

La CI impose **`pytest --cov=app --cov-fail-under=70`** : en dessous de 70 % de couverture, le pipeline
échoue.

---

## 11. Limites et points à maîtriser

### 11.1 Limites fonctionnelles

| Limite | Effet concret |
| --- | --- |
| Aucune reprise de tentative | fermer l'onglet perd le test en cours |
| Test non adaptatif | le niveau de départ est toujours le premier niveau ouvert |
| 2 questions par langue dans le seed | le test réel est très court |
| `texte` stocké mais non corrigé | une réponse écrite ne compte jamais |
| `audio` refusé (422) | pas de test oral côté backend |
| `justification` jamais renvoyée | le frontend a un composant qui reste vide |
| IA facultative | sans fournisseur LLM, résultat partiel |
| Photos publiques sous `/media` | toute personne connaissant l'URL lit l'image |
| Pas de déconnexion serveur | un JWT volé reste valide jusqu'à expiration |
| Pas de rafraîchissement de jeton | l'utilisateur est déconnecté à expiration |
| Pas de limitation de débit | aucune protection contre le bruteforce |
| Redis inutilisé | démarré pour rien |
| Aucune route DELETE utilisateur | on désactive, on ne supprime pas |

### 11.2 Ce que le développeur doit maîtriser

1. **La dépendance FastAPI** : `Depends(permission_requise(...))` est le point d'entrée de tout contrôle
   d'accès. Oublier une dépendance = route ouverte.
2. **La session SQLAlchemy** : `get_db` fournit une session par requête ; la fermer avant un appel HTTP long
   évite d'épuiser le pool.
3. **Les codes d'énumération** : ce sont des entiers en base. Un code réutilisé corrompt les données.
4. **La frontière backend/IA** : le backend ne fait jamais confiance à la réponse IA ; il la valide.
5. **La distinction 400/401/403/409/422** : elle pilote le comportement du frontend.
6. **Les migrations** : tout changement de modèle exige `make migration`, relu à la main.

---

## 12. Vérifier le backend en 5 minutes

```powershell
# 1. Santé
Invoke-RestMethod http://localhost:8000/health

# 2. Contrat réel
Start-Process http://localhost:8000/docs

# 3. Connexion administrateur
$body = @{ email = "admin@digitheque.mg"; mot_de_passe = "Demo2026" } | ConvertTo-Json
$token = (Invoke-RestMethod -Method Post http://localhost:8000/api/v1/auth/login `
  -ContentType "application/json" -Body $body).access_token

# 4. Liste des utilisateurs
Invoke-RestMethod http://localhost:8000/api/v1/users `
  -Headers @{ Authorization = "Bearer $token" }

# 5. Un 403 attendu : appel apprenant avec un jeton administrateur
$body2 = @{ email = "apprenant@digitheque.mg"; mot_de_passe = "Demo2026" } | ConvertTo-Json
$token2 = (Invoke-RestMethod -Method Post http://localhost:8000/api/v1/auth/login `
  -ContentType "application/json" -Body $body2).access_token
Invoke-RestMethod http://localhost:8000/api/v1/users -Headers @{ Authorization = "Bearer $token2" }
# → 403 Droits insuffisants.
```

---

## Questions de compréhension

1. Pourquoi le backend renvoie-t-il **403** et non **401** quand un apprenant appelle `GET /users` ?
   Qu'est-ce que cela change côté frontend ?
2. Explique pourquoi `POST /diagnostic/tentatives` crée toujours une nouvelle tentative, et quelle
   fonctionnalité manque pour reprendre un test interrompu.
3. Le scoring corrige **toutes** les questions à choix du niveau, y compris celles sans réponse. Quel est
   l'effet sur un apprenant qui répond à une seule question sur deux et qui a juste ?
4. Pourquoi le routeur ferme-t-il la session PostgreSQL **avant** d'appeler le service IA ? Que se passerait-il
   sinon avec plusieurs apprenants simultanés ?
5. Le backend duplique les modèles du service IA dans `app/schemas/ia.py` au lieu de les importer. Donne deux
   raisons de ce choix et un risque qu'il introduit.
