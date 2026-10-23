# Contrat d'API attendu par le frontend

Ce document liste les routes que le frontend appelle déjà, avec le format exact des requêtes et des réponses.
Tant qu'une route n'existe pas côté backend, le frontend utilise des données simulées (`NEXT_PUBLIC_API_MOCK=true`).

- Côté frontend, les routes sont déclarées dans [`frontend/src/services/endpoints.ts`](../../frontend/src/services/endpoints.ts)
  et les conversions de format dans `frontend/src/services/*.service.ts`.
- Ces conversions sont vérifiées par les tests unitaires [`services.test.ts`](../../frontend/src/services/__tests__/services.test.ts).
- **Si une route ou un champ change, mettez à jour ce document, `endpoints.ts` et le service concerné dans la même PR.**

## Règles générales

| Sujet | Règle |
| --- | --- |
| Préfixe | Toutes les routes commencent par `/api/v1` |
| Format | JSON, champs en `snake_case` ; dates en ISO 8601 (`2025-01-12T10:00:00Z`, ou `AAAA-MM-JJ` pour une date seule) |
| Authentification | En-tête `Authorization: Bearer <access_token>` sur toutes les routes, sauf celles marquées **publique** |
| JWT | Le frontend lit seulement le champ `exp` (date d'expiration) ; il ne vérifie pas la signature |
| CORS | Autoriser l'origine du frontend (`http://localhost:3000` en développement), les en-têtes `Content-Type` et `Authorization`, et les méthodes `GET, POST, PUT, PATCH, DELETE, OPTIONS` |
| Erreurs | Format FastAPI : `{ "detail": "message" }`, ou la liste de validation par défaut (422) |

### Codes d'erreur interprétés par le frontend

| Code | Signification attendue | Réaction du frontend |
| --- | --- | --- |
| 401 | Route publique : identifiants incorrects. Route protégée : JWT absent, expiré ou révoqué | Message d'erreur. Sur une route protégée : session effacée et retour à la connexion |
| 403 | Compte inactif/suspendu (connexion) ou droits insuffisants | Message dédié |
| 409 | Ressource déjà existante (e-mail déjà utilisé) | Message dédié sur le champ e-mail |
| 422 | Données refusées | Affiche `detail` (premier message s'il s'agit d'une liste) |
| 5xx | Panne | « Le serveur rencontre un problème », une seule nouvelle tentative pour les lectures |

## Objet `Utilisateur`

Renvoyé par la connexion, le profil et la liste d'administration. Il reprend les colonnes de la table `Utilisateur`.

```json
{
  "id_user": 7,
  "nom": "RAKOTO",
  "prenom": "Rova",
  "email": "rova@exemple.com",
  "telephone": "034 12 345 67",
  "role": "APPRENANT",
  "statut": "ACTIF",
  "date_inscription": "2025-01-12T10:00:00Z",
  "photo_url": "/media/photos/7.jpg"
}
```

- `id_user` : colonne `Utilisateur.Id_user`.
- `role` : `APPRENANT` | `FORMATEUR` | `ADMINISTRATEUR`, et `statut` : `ACTIF` | `INACTIF` | `SUSPENDU`.
  Ces colonnes sont des entiers en base : l'API les renvoie et les reçoit **en texte**.
- `telephone` peut être `null`. Le frontend l'envoie au **format malgache local** `034 12 345 67`
  (10 chiffres commençant par 0, groupés 3-2-3-2). Un numéro reçu au format international (`+261 34 12 345 67`)
  est affiché au format local.
- `photo_url` : nouvelle colonne `Utilisateur.photo_url` (texte, `null` sans photo). Elle contient le **chemin** du
  fichier, servi par le backend (le frontend le préfixe par `NEXT_PUBLIC_API_URL`), ou une URL complète
  (stockage externe). L'image elle-même n'est **pas** stockée en base.
- `mot_de_passe` ne doit jamais figurer dans une réponse.

## Authentification

### `POST /auth/login` — publique

```json
{ "email": "rova@exemple.com", "mot_de_passe": "Langue2026" }
```

**200** :

```json
{ "access_token": "<jwt>", "token_type": "bearer", "utilisateur": { /* Utilisateur */ } }
```

Erreurs : **401** identifiants incorrects, **403** compte `INACTIF` ou `SUSPENDU`.

### `POST /auth/register` — publique

Crée un apprenant et son abonnement à la formule choisie. L'apprenant doit ensuite se connecter.

```json
{
  "prenom": "Rova",
  "nom": "RAKOTO",
  "email": "rova@exemple.com",
  "mot_de_passe": "Langue2026",
  "date_naissance": "2000-05-01",
  "langues": ["en", "zh"],
  "id_formule": 2
}
```

**201** : `Utilisateur` + `date_naissance`, `pays`, `ville`, `objectif` (nullables).
Erreur : **409** e-mail déjà utilisé.
Codes de langue : `fr`, `en`, `zh`, `it`, `de`.

## Rôles et permissions

Ces routes sont réservées aux utilisateurs dont le rôle possède la permission `roles:manage`.

### `GET /roles`

**200** : liste des trois rôles configurés avec leurs permissions effectives.

```json
[
  {
    "id_role": 1,
    "code": "APPRENANT",
    "libelle": "Apprenant",
    "permissions": ["profile:read", "profile:write"]
  }
]
```

### `GET /roles/permissions`

**200** : catalogue des permissions que le backend applique aux routes. Chaque élément contient `code` et
`description`.

### `PUT /roles/{id_role}/permissions`

Remplace la liste complète des permissions d'un rôle. Exemple :

```json
{ "permissions": ["profile:read", "profile:write", "users:read"] }
```

**200** : rôle mis à jour, avec sa liste de permissions. Erreurs : **404** rôle inconnu, **409** si la modification
retire la dernière permission `roles:manage`, **422** si une permission est inconnue ou répétée. Au moins un rôle
doit conserver `roles:manage`.

Les rôles existants et leurs codes (`APPRENANT`, `FORMATEUR`, `ADMINISTRATEUR`) restent stables. Les permissions
effectivement contrôlées sont `profile:read`, `profile:write`, `users:read`, `users:manage`, `trainers:read`,
`trainers:manage`, `pedagogy:manage`, `stats:read` et `roles:manage`.

### `POST /auth/forgot-password` — publique

```json
{ "email": "rova@exemple.com" }
```

**204** (ou 200), même si l'adresse est inconnue : la réponse ne doit pas révéler si un compte existe.

### `POST /auth/reset-password` — publique

```json
{ "token": "<jeton reçu par e-mail>", "nouveau_mot_de_passe": "Nouveau2026" }
```

**204** (ou 200). Le lien envoyé par e-mail doit pointer vers `<frontend>/reset-password?token=<jeton>`.

## Formules

### `GET /formules` — publique

**200** :

```json
[
  {
    "id_formule": 1,
    "libelle": "Simple",
    "prix_mensuel": 60000,
    "duree_mois": 1,
    "quota_heures": 6,
    "quota_ateliers": 1,
    "langues": [{ "code": "en", "libelle": "Anglais" }]
  }
]
```

Une liste `langues` vide signifie que la formule couvre toutes les langues.

## Profil de l'utilisateur connecté

### `GET /users/me`

**200** : `Utilisateur`.

### `PATCH /users/me`

```json
{
  "prenom": "Rova",
  "nom": "RAKOTO",
  "email": "rova@exemple.com",
  "telephone": "034 12 345 67",
  "mot_de_passe": "Nouveau2026",
  "mot_de_passe_actuel": "Actuel2026"
}
```

- `mot_de_passe` et `mot_de_passe_actuel` ne sont envoyés que si l'utilisateur change de mot de passe.
  Le backend **vérifie `mot_de_passe_actuel`** avant d'accepter le changement : une session restée ouverte
  ne doit pas suffire à s'approprier le compte.
- `telephone` est facultatif : `null` si l'utilisateur l'a vidé (le numéro est alors retiré).
- Le rôle et le statut ne sont jamais envoyés et ne doivent pas être modifiables par cette route.

**200** : `Utilisateur` à jour. Erreurs :
- **400** mot de passe actuel incorrect (surtout **pas 401**, qui signifie « session expirée » et déconnecterait l'utilisateur) ;
- **409** e-mail déjà utilisé par un autre compte.

Aucune modification n'est enregistrée si une vérification échoue.

### `POST /users/me/photo`

Envoi de la photo de profil en `multipart/form-data`, champ **`photo`**.

- Le frontend accepte JPEG, PNG ou WebP de 2 Mo au plus, puis **réduit l'image à 512 px** (côté le plus long) et
  l'envoie en **JPEG** (`photo.jpg`, quelques dizaines de Ko).
- Le backend revérifie le type et la taille, enregistre le fichier (ex. `media/photos/<id_user>.jpg`, en remplaçant
  l'ancienne photo), met à jour `photo_url` et sert le fichier en lecture publique (ex. `GET /media/photos/7.jpg`).
- Conseil : ajouter un suffixe de version au nom (`7-<horodatage>.jpg`) pour que le navigateur ne garde pas
  l'ancienne image en cache.

**200** : `Utilisateur` à jour, avec `photo_url`. Erreurs : **413** fichier trop lourd, **415** format refusé.

### `DELETE /users/me/photo`

Supprime le fichier et remet `photo_url` à `null` : les initiales sont de nouveau affichées.

**200** : `Utilisateur` à jour.

## Administration — rôle `ADMINISTRATEUR`

### `GET /users`

| Paramètre | Type | Défaut | Rôle |
| --- | --- | --- | --- |
| `page` | entier ≥ 1 | 1 | Numéro de page |
| `page_size` | 10, 20 ou 50 | 10 | Taille de page |
| `search` | texte | — | Recherche dans le nom, le prénom et l'e-mail (insensible à la casse et, si possible, aux accents) |
| `role` | `APPRENANT` \| `FORMATEUR` \| `ADMINISTRATEUR` | — | Filtre par rôle |

Les paramètres vides ne sont pas envoyés.

**200** :

```json
{ "items": [ /* Utilisateur */ ], "total": 47, "page": 2, "page_size": 10 }
```

`total` est le nombre de résultats correspondant au filtre, toutes pages confondues.
Erreur : **403** si l'utilisateur connecté n'est pas administrateur.

### `PATCH /users/{id_user}`

Modification partielle d'un utilisateur par un administrateur : seuls les champs envoyés sont modifiés.

Modifier les informations (bouton Modifier) :

```json
{ "prenom": "Jean", "nom": "RAKOTO", "email": "jean@exemple.com", "telephone": null, "role": "FORMATEUR" }
```

Désactiver ou réactiver un compte (boutons Désactiver / Réactiver, après confirmation) :

```json
{ "statut": "INACTIF" }
```

**200** : `Utilisateur` à jour.

Erreurs :
- **409** : e-mail déjà utilisé par un autre compte ;
- **404** : utilisateur inconnu ;
- **403** : l'utilisateur connecté n'est pas administrateur.

Règles à appliquer aussi côté backend (le frontend les impose déjà dans l'interface) :
- un administrateur ne peut ni désactiver son propre compte, ni changer son propre rôle ;
- un compte `INACTIF` est refusé à la connexion (**403**).

### `GET /admin/statistiques`

`Administrateur.consulterStatistiques()` : vue calculée, sans table propre. Elle ne contient **que des objets du
diagramme de classes, au même format que les autres routes** (`Utilisateur`/Apprenant, `Langue`, Abonnement, `Formule`) :
quand une classe évolue, on la change une seule fois pour toutes les routes.

**200** :

```json
{
  "totaux": { "utilisateurs": 248, "apprenants": 186, "formateurs": 42, "ateliers_programmes": 18 },
  "apprenants_par_langue": [
    { "langue": { /* Langue */ }, "apprenants": 71 }
  ],
  "dernieres_inscriptions": [
    {
      "apprenant": { /* Utilisateur + date_naissance, pays, ville, objectif */ },
      "langues": [ /* Langue */ ],
      "abonnement": {
        "id_abonnement": 12,
        "date_debut": "2026-10-01",
        "date_fin": "2027-01-01",
        "statut": "ACTIF",
        "quota_heures": 12,
        "quota_ateliers": 3,
        "formule": { /* Formule, comme GET /formules */ }
      }
    }
  ]
}
```

- `totaux.utilisateurs` : toutes les lignes `Utilisateur`, quel que soit le statut ; `apprenants` / `formateurs` :
  par `role` ; `ateliers_programmes` : `Atelier` dont `date_heure` est à venir et `statut` ≠ `ANNULE` (`StatutAtelier`).
- `apprenants_par_langue` : nombre d'apprenants **distincts** par `Langue` suivie.
  Un apprenant peut suivre plusieurs langues : la somme peut dépasser `totaux.apprenants`.
  Le frontend calcule la part de chaque langue sur `totaux.apprenants` et trie par nombre décroissant.
- `dernieres_inscriptions` : les **5** derniers **apprenants** (`date_inscription` décroissante), avec les `langues`
  choisies à l'inscription (`langues` de `POST /auth/register`) et leur `Abonnement` (`statut` : `StatutAbonnement`
  `ACTIF` | `EXPIRE` | `SUSPENDU`) avec sa `Formule`. `abonnement` vaut `null` si aucun abonnement n'existe.

Erreur : **403** si l'utilisateur connecté n'est pas administrateur.

### `GET /admin/statistiques/inscriptions`

| Paramètre | Type | Défaut | Rôle |
| --- | --- | --- | --- |
| `jours` | 7, 30 ou 90 | 30 | Période, aujourd'hui compris |

**200** : un élément **par jour** de la période, du plus ancien au plus récent, y compris les jours sans inscription
(`nombre: 0`) :

```json
[{ "date": "2026-10-13", "nombre": 6 }, { "date": "2026-10-14", "nombre": 4 }]
```

## Langues — rôle `ADMINISTRATEUR`

### Objet `Langue`

Colonnes de la table `Langue`, et ses niveaux ouverts : association **`Langue 0..* — 0..* Niveau`**, table
`LangueNiveau(id_langue, id_niveau)` (voir [`docs/uml/evolutions.md`](../uml/evolutions.md)). Tous les niveaux ne
sont pas ouverts pour toutes les langues (ex. HSK pour le mandarin, A1–C2 pour l'anglais).

```json
{
  "id_langue": 3,
  "code": "zh",
  "libelle": "Mandarin",
  "niveaux": [{ "id_niveau": 7, "code": "HSK 1", "libelle": "Mandarin – débutant" }]
}
```

- `code` : code ISO 639 en minuscules (2 ou 3 lettres), unique. Le frontend l'affiche en majuscules.
- `niveaux` : objets `Niveau` (dans n'importe quel ordre : le frontend les trie par code). Renvoyé par les routes
  `/langues` ci-dessous ; les autres routes qui contiennent une langue (formules, tableau de bord) peuvent l'omettre.

### `GET /langues`

Mêmes paramètres de pagination que `GET /users` (`page`, `page_size`, `search`).
`search` porte sur la désignation et le code.

**200** :

```json
{ "items": [ /* Langue, avec niveaux */ ], "total": 12, "page": 1, "page_size": 10 }
```

### `POST /langues`

```json
{ "libelle": "Swahili", "code": "sw", "id_niveaux": [1, 2, 3] }
```

`id_niveaux` : niveaux ouverts, **au moins un** (le frontend l'impose). Le backend crée les lignes `LangueNiveau`.

**201** : `Langue` avec `niveaux`. Erreurs : **409** code déjà utilisé, **422** niveau inconnu ou liste vide.

### `PATCH /langues/{id_langue}`

Modification partielle : seuls les champs envoyés (`libelle`, `code`, `id_niveaux`) sont changés.
`id_niveaux` **remplace** entièrement la liste des niveaux ouverts (lignes `LangueNiveau` ajoutées ou supprimées).

**200** : `Langue` à jour, avec `niveaux`. Erreurs : **409** code déjà utilisé, **404** langue inconnue,
**422** niveau inconnu ou liste vide.

À vérifier côté backend : retirer un niveau d'une langue ne doit pas rendre incohérents les `Parcours`, `Exercice`
ou `TestDiagnostic` existants de cette langue à ce niveau (refuser avec **409**, ou les conserver : à décider).

### `DELETE /langues/{id_langue}`

**204** (les lignes `LangueNiveau` de la langue sont supprimées avec elle).
Erreur : **409** si la langue est utilisée (`FormuleLangue`, `Parcours`).

## Niveaux — rôle `ADMINISTRATEUR`

### Objet `Niveau`

Colonnes de la table `Niveau`. Un niveau est créé une fois, puis ouvert pour une ou plusieurs langues
(`LangueNiveau`, depuis l'écran des langues).

```json
{ "id_niveau": 1, "code": "A1", "libelle": "Débutant" }
```

- `code` : 20 caractères au maximum, unique (« A1 », « HSK 3 »). Le frontend le met en majuscules.
- `libelle` : obligatoire.

### `GET /niveaux`

**200** : liste complète, sans pagination : `[ /* Niveau */ ]`. Le frontend la trie par code.

### `POST /niveaux`

```json
{ "code": "HSK 3", "libelle": "Mandarin – intermédiaire" }
```

**201** : `Niveau`. Erreur : **409** code déjà utilisé.

### `PATCH /niveaux/{id_niveau}`

Même corps que `POST` (code et libellé).

**200** : `Niveau` à jour. Erreurs : **409** code déjà utilisé, **404** niveau inconnu.

### `DELETE /niveaux/{id_niveau}`

**204** : les lignes `LangueNiveau` du niveau sont supprimées avec lui (il disparaît des langues où il était ouvert).
Erreur : **409** si le niveau est utilisé (`TestDiagnostic`, `Parcours`, `Exercice`).

## Test de positionnement adaptatif

Le flux actuel crée une tentative persistée, charge les questions de son niveau initial et enregistre les réponses.
L'évaluation IA et l'adaptation du niveau ne sont pas encore disponibles. Le frontend indique explicitement que le
résultat est en attente ; aucune correction ni résultat simulé n'est renvoyé par le backend. Les réponses restent
enregistrées en base avec `evaluation = null` jusqu'à leur prise en charge par le flux d'évaluation ; aucune suppression
automatique n'est actuellement configurée.

### `POST /diagnostic/tentatives` — rôle `APPRENANT`

Crée une tentative pour la langue demandée. Le backend choisit le premier niveau ouvert qui possède au moins une
question à choix ou à réponse textuelle.

```json
{ "code_langue": "en" }
```

**201** :

```json
{ "id_tentative": 42, "code_langue": "en", "code_niveau": "A1" }
```

Erreurs : **401** session absente ou invalide, **403** rôle autre qu'`APPRENANT`, **404** langue inconnue ou aucune
question enregistrable n'est disponible.

### `GET /diagnostic/questions` — rôle `APPRENANT`

Les paramètres de requête sont obligatoires :

```text
GET /api/v1/diagnostic/questions?code_langue=en&code_niveau=A1
```

**200** : liste des questions correspondant exactement à la langue et au niveau demandés. La liste est vide si aucune
question n'a encore été enregistrée pour cette combinaison.

```json
[
  {
    "id_question": "12",
    "niveau": "A1",
    "competence": "grammaire",
    "type_reponse": "choix",
    "enonce": "She ___ a student.",
    "choix": ["is", "are", "am", "be"]
  }
]
```

Une question peut également contenir `support`, `audio_url` ou `audio_texte`. Les champs sans valeur sont omis.
La route ne renvoie aucune correction ni bonne réponse. Erreurs : **401** session absente ou invalide, **403** rôle
autre qu'`APPRENANT`, **404** langue ou niveau inconnu, **422** niveau connu mais non ouvert pour cette langue.

### `POST /diagnostic/reponse` — rôle `APPRENANT`

Enregistre une réponse dans une tentative appartenant à l'apprenant et encore en cours. Pour une question à choix,
`reponse_fournie` contient le texte de l'option sélectionnée ; pour une question textuelle, il contient le texte saisi.
Cette route ne corrige pas la réponse.

```json
{
  "id_tentative": 42,
  "id_question": "12",
  "reponse_fournie": "is"
}
```

La question doit appartenir à la même langue et au même niveau initial que la tentative. Pour une question à choix, la
valeur fournie doit correspondre à l'une des options. Une même réponse renvoyée après une erreur réseau est idempotente ;
une réponse différente pour la même question est refusée.

**201** :

```json
{
  "id_reponse": 81,
  "id_tentative": 42,
  "id_question": "12",
  "reponse_fournie": "is"
}
```

Erreurs : **401** session absente ou invalide, **403** rôle autre qu'`APPRENANT`, **404** tentative non accessible ou
question inconnue, **409** tentative terminée/annulée ou réponse différente déjà enregistrée, **422** réponse vide,
identifiant invalide ou question ne correspondant pas à la tentative. La colonne d'évaluation reste `null` en attente
de l'intégration IA. Les réponses audio ne sont pas acceptées tant qu'un stockage de médias n'est pas disponible.

Le frontend affiche ensuite les autres questions du niveau dans l'ordre reçu et termine sur un écran « évaluation en
attente ». Cette progression fixe est provisoire ; elle sera remplacée par la sélection adaptative fournie par le
service IA. Les champs de personnalisation `objectif` et `creneaux` ne sont pas encore persistés.

## Formateurs — rôle `ADMINISTRATEUR`

> Routes implémentées dans `backend/app/api/routes/formateurs.py`.

### Objet `Formateur`

Un `Utilisateur` de rôle `FORMATEUR` (mêmes champs, voir plus haut), avec les colonnes de la table `Formateur` et
ses langues enseignées (table `formateur_langue`) :

```json
{
  "id_user": 2,
  "prenom": "Hery",
  "nom": "RANDRIA",
  "email": "formateur@digitheque.mg",
  "telephone": "034 12 345 67",
  "role": "FORMATEUR",
  "statut": "ACTIF",
  "date_inscription": "2025-01-12T10:00:00Z",
  "photo_url": null,
  "type_contrat": "CDI",
  "certifications": "DALF C2, habilitation examinateur DELF",
  "langues_enseignees": [{ "id_langue": 1, "code": "fr", "libelle": "Français" }]
}
```

- `type_contrat` : `CDI` | `CDD` | `VACATAIRE` | `PRESTATAIRE`, ou `null`. La colonne est un texte libre (50
  caractères) : le frontend affiche « Non renseigné » pour toute autre valeur. À valider par l'équipe.
- `certifications` : texte libre, 500 caractères au plus, ou `null`.
- `langues_enseignees` : objets `Langue` **sans** `niveaux`, dans n'importe quel ordre (le frontend les trie).

### `GET /formateurs`

Mêmes paramètres que `GET /users` (`page`, `page_size`, `search`), plus :

| Paramètre | Type | Défaut | Rôle |
| --- | --- | --- | --- |
| `statut` | `ACTIF` \| `INACTIF` \| `SUSPENDU` | — | Filtre par statut |

Seuls les utilisateurs de rôle `FORMATEUR` sont renvoyés, triés par nom puis prénom.

**200** :

```json
{ "items": [ /* Formateur */ ], "total": 12, "page": 1, "page_size": 10 }
```

### `POST /formateurs`

```json
{
  "prenom": "Lova",
  "nom": "RABE",
  "email": "lova.rabe@digitheque.mg",
  "telephone": null,
  "type_contrat": "CDD",
  "certifications": null,
  "id_langues": [3]
}
```

Le backend crée l'`Utilisateur` (rôle `FORMATEUR`, statut `ACTIF`, **sans mot de passe utilisable**), la ligne
`Formateur` et les lignes `formateur_langue`, puis envoie au formateur un e-mail avec un lien pour choisir son mot
de passe (même jeton que `POST /auth/forgot-password`, page `/reset-password`), valable 3 jours
(`INVITATION_TOKEN_EXPIRE_MINUTES`, 4320 par défaut). Le lien ne sert qu'une fois.

`id_langues` : **au moins une** langue (le frontend l'impose) ; `type_contrat` obligatoire.

**201** : `Formateur`. Erreurs : **409** e-mail déjà utilisé, **422** langue inconnue ou liste vide.

### `PATCH /formateurs/{id_user}`

Modification partielle : seuls les champs envoyés sont changés (mêmes champs que `POST`).
`id_langues` **remplace** entièrement la liste des langues enseignées.

Désactiver ou réactiver le formateur (après confirmation) :

```json
{ "statut": "INACTIF" }
```

**200** : `Formateur` à jour. Erreurs : **409** e-mail déjà utilisé, **404** formateur inconnu (ou utilisateur
d'un autre rôle), **422** langue inconnue ou liste vide.

Pas de `DELETE` : un formateur est lié à ses ateliers (`Atelier.id_formateur`, `ON DELETE RESTRICT`), il est donc
désactivé plutôt que supprimé. Un compte `INACTIF` est refusé à la connexion (**403**), comme pour tout utilisateur.
