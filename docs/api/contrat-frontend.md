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
| CORS | Autoriser l'origine du frontend (`http://localhost:3000` en développement), les en-têtes `Content-Type` et `Authorization`, et les méthodes `GET, POST, PATCH, DELETE, OPTIONS` |
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

**200** : `Utilisateur` à jour.

Erreurs :
- **409** : e-mail déjà utilisé par un autre compte ;
- **404** : utilisateur inconnu ;
- **403** : l'utilisateur connecté n'est pas administrateur.

Règles à appliquer aussi côté backend (le frontend les impose déjà dans l'interface) :
- un administrateur ne peut pas changer son propre rôle.
