# 09 — Gestion pédagogique : spécification de travail (non implémentée)

> **Centre Langues IA · La Digithèque** · 23 novembre 2026 · branche `docs/audit-gestion-pedagogique`
>
> **Attention : contrairement aux chapitres 01 à 08, ce chapitre n'est pas un constat d'implémentation.**
> Il décrit l'**état cible** attendu pour la gestion pédagogique. Rien de ce qui est décrit ici n'existe aujourd'hui
> en l'état, sauf mention explicite « aujourd'hui » dans le chapitre 6.
>
> Aucun code, schéma, seed, test ni configuration n'a été modifié pour produire ce document.
>
> Dépendances :
>
> - registre des décisions `docs/decisions/gestion_pedagogique_decisions.md` (D1 à D9, **`VALIDÉE` le 23/11/2026**) ;
> - audit factuel : [`../audit/gestion_pedagogique_exec_audit.md`](../audit/gestion_pedagogique_exec_audit.md) ;
> - plan technique : [`../plan/migration_banque_exercices.md`](../plan/migration_banque_exercices.md), dont les cinq
>   points ouverts sont tranchés ;
> - plan US [`../plan/gestion_pedagogique_plan.md`](../plan/gestion_pedagogique_plan.md) et dossier de validation
>   [`../plan/gestion_pedagogique_validation.md`](../plan/gestion_pedagogique_validation.md) ;
> - contrat frontend source de vérité : [`../api/contrat-frontend.md`](../api/contrat-frontend.md) et
>   `frontend/src/services/endpoints.ts`.

---

## 1. Périmètre

La gestion pédagogique couvre trois besoins liés :

1. **une banque unique d'exercices** partagée par le diagnostic, le parcours et les révisions (D1, D3) ;
2. **un diagnostic considéré comme un profil d'épreuve** qui sélectionne des exercices dans cette banque (D2) ;
3. **une création pédagogique par le formateur** : exercices, leçons, modules et cours, sans passer par le seed.

Sont **hors périmètre** de cette spécification : les ateliers et réservations, la facturation, la génération de
contenu par l'IA, la correction des productions libres par l'IA (D5), le script HSK « traditionnel » (D6), et
toute copie de fichiers audio dans la base (D7).

---

## 2. Acteurs et responsabilités

| Acteur | Aujourd'hui (code) | Rôle cible attendu | Condition de passage |
|---|---|---|---|
| **Apprenant** | Passe le diagnostic, consulte son parcours et ses leçons. Aucun droit d'écriture pédagogique. | Inchangé : il consomme le contenu publié. | Aucune ; seul le fournisseur des données change (banque unique). |
| **Formateur / équipe pédagogique** | Profil uniquement (`profile:read`, `profile:write`). Aucune permission pédagogique. | Crée et modifie exercices, leçons, modules et cours ; peut exclure un exercice du diagnostic ; corrige les productions libres. | Nouvelles permissions + routes CRUD + écrans dédiés. **Point à valider** : codes de permission et périmètre exact. |
| **Administrateur** | Détient `pedagogy:manage` sur langues et niveaux uniquement. | Gère les référentiels (langues, niveaux, `framework`, types) et la validation/publication du contenu. | Attribution explicite de la « validation » : administrateur ou référent formateur. **Point ouvert**. |
| **Service IA** | `POST /diagnostic/evaluer`, correction des réponses courtes, recommandations. Aucun accès base. | Consomme un contrat strict, ne décide pas de la publication, **n'écrit jamais en base**. | Bascule atomique du contrat si `id_question` devient `id_exercice`. |

> Le diagnostic continue d'exiger le rôle `APPRENANT` en dur (`backend/app/api/routes/diagnostic.py:105-107`).
> Un formateur ne passe donc pas le test ; il prépare le contenu.

---

## 3. Objets fonctionnels cibles

### 3.1 L'exercice de la banque unique (D1, D3, D7, D8)

| Champ | Règle fonctionnelle | Décision |
|---|---|---|
| `id` | Identifiant stable de l'exercice. Les réponses déjà enregistrées restent rattachées à l'exercice d'origine. | D1 ; option de migration A recommandée dans le plan technique. |
| `langue` | FK vers la langue ; une question de diagnostic n'est proposée que pour une langue ouverte. | Référentiel existant. |
| `framework` | `CECRL` ou `HSK`, déduit de la langue (mandarin → HSK). | D6 |
| `level` | Niveau du référentiel (`A1`…`C2`, `HSK 1`…), distinct de la difficulté pédagogique. | D6 |
| `type` |.Type d'exercice (voir §3.4), enum figé : ne jamais modifier un code existant. | D5 ; `backend/app/models/enums.py:49-54`. |
| `usage` | `diagnostic`, `parcours` ou `les deux`. Le formateur peut exclure un exercice du diagnostic. | D3 |
| `statut` | `brouillon` ou `publié`. Un brouillon n'entre **jamais** dans un parcours ni dans une sélection de diagnostic. | Règle métier ; à confirmer avec D1–D3. |
| `contenu` | JSON strict : seules les clés autorisées par le format sont acceptées ; clé de correction **jamais exposée** au navigateur. | Règle métier ; `extra="forbid"` côté IA. |
| `origine` | `humain` pour le contenu créé par le formateur ; valeur système documentée pour le contenu migré du seed. | Traçabilité ; non encore arbitré. |
| `auteur` | Utilisateur créateur, ou auteur système pour les 35 questions historiques (aucun auteur n'est en base aujourd'hui). | Traçabilité ; ne pas inventer un nom. |
| `date` | Date de création et, si applicable, date de publication. | Traçabilité. |
| `version` | **Un exercice publié modifié crée une nouvelle version** ; l'ancienne reste liée aux réponses existantes. | Règle métier. |
| `donnees_test` | `true` pour le seed de démonstration, `false` pour le contenu pédagogique réel. | D8 |
| `audio_ref` | Chemin de référence uniquement, jamais d'octets audio ni d'URI `data:` en base. Les droits d'usage doivent être vérifiés avant diffusion. | D7 |
| `numero_lecon` | Rattachement optionnel à une leçon ; `NULL` pour un exercice de diagnostic sans leçon fixée. | US48 existant, `backend/app/models/parcours.py:76`. |

**Garde-fou de lecture** : la liste blanche actuelle (`backend/app/services/lecture_parcours.py:31-44`) doit rester
le seul point de sortie du `contenu` vers le frontend. `reponse_correcte`, `reponses` et `explication` n'en font pas
partie.

### 3.2 Cours, modules et leçons (D4)

Hiérarchie proposée, à valider :

```text
Cours (langue + référentiel + public cible)
 └── Module (regroupement de leçons, numérotation stable)
      └── Leçon (unité de travail, un type, une séquence d'exercices)
```

| Type de leçon | MVP proposé | Reporté |
|---|---|---|
| Réception | ✅ | — |
| Conceptualisation | ✅ | — |
| Actionnelle | ✅ | — |
| Médiation | — | ✅ |
| Écriture et sinogrammes | — | ✅ |
| Préparation examen | — | ✅ |

> Le libellé « préparation examen » remplace « atelier certification » pour éviter la confusion avec les ateliers
> animés par un formateur (D4). Le parcours actuel ne connaît que des numéros de leçon et une phase ; il n'existe
> ni table `cours` ni table `module`.

### 3.3 Le diagnostic comme profil d'épreuve (D2)

| Propriété du profil | Fonction attendue |
|---|---|
| `langue` | Langue cible du test. |
| `framework` / référentiel | Détermine la grille de niveaux (CECRL ou HSK). |
| Règle de sélection | Tirer les exercices `publiés`, dont `usage` contient `diagnostic`, non exclus par le formateur. |
| Nombre d'items | Paramétrable par profil (le seed actuel fournit 2 questions par langue). |
| Durée | Paramétrable par profil ; non implémentée aujourd'hui. |
| Version du profil | Toute modification du profil crée une nouvelle version, comme pour un exercice publié. |

Le diagnostic reste réservé à l'apprenant et continue d'enregistrer une tentative, des réponses, un score
déterministe et une analyse IA best-effort. Le choix du nom de l'identifiant transmis à l'IA (`id_question` conservé
ou `id_exercice`) est **une décision ouverte** du plan de migration : `extra="forbid"` impose une bascule atomique
backend + IA + prompts versionnés.

### 3.4 Types d'exercice et correction (D5)

| Format MVP | Mode de correction | Remarque |
|---|---|---|
| QCM | Règle déterministe | Format déjà utilisé par les 35 questions du seed. |
| Association | Règle déterministe | À définir dans le schéma `contenu`. |
| Texte à trous | Règle déterministe | À distinguer du `type_reponse="texte"` actuel, non corrigé. |
| Vrai / faux / non mentionné | Règle déterministe | La modalité « non mentionné » doit être une valeur explicite. |
| Remise en ordre | Règle déterministe | L'ordre de référence est une clé privée, non exposée. |
| Production libre | **Formateur**, pas IA | Le backend stocke la réponse ; aucun score automatique. |

Reportés : discrimination des tons, reconnaissance des traits, description d'image.

Les formats audio du diagnostic actuel (`type_reponse="audio"`) sont refusés en `422`. Le mapping vers un format
de production orale (`prononciation`) ou d'écoute reste à trancher (§10).

### 3.5 Référentiels, HSK, audio et seed (D6–D8)

- **HSK** : `framework` et `level` sont conservés ; `show_pinyin` est une option possible ; `script` est exclu du
  MVP. Le nombre de niveaux, la règle d'affichage du pinyin et la correspondance CECRL ↔ HSK doivent être **sourcés**
  avant toute affirmation dans le mémoire (D6).
- **Audio** : vérification des droits par fichier, référence par `audio_ref`, aucun fichier copié dans le seed ni
  dans la base (D7).
- **Seed** : les 35 questions historiques (18 `en`, 17 `fr`, toutes `choix`) sont conservées et marquées
  `donnees_test = true`. Aucun audio n'est ajouté. Le seed reste insert-only : une base déjà peuplée nécessite
  `make reset` pour rejouer le contenu de test (D8).

---

## 4. Règles de gestion

| # | Règle | Effet attendu |
|---|---|---|
| R1 | Une seule banque `exercice`. Aucune table `question` ne subsiste après migration. | Plus deux catalogues à maintenir. |
| R2 | Un exercice `brouillon` est invisible du parcours **et** du diagnostic. | Aucun contenu non validé n'atteint l'apprenant. |
| R3 | Modifier un exercice publié crée une nouvelle version. | Les réponses anciennes restent cohérentes avec la version vue par l'apprenant. |
| R4 | Le formateur peut exclure un exercice du diagnostic sans le supprimer. | `usage` et/ou un drapeau d'exclusion portent la règle. |
| R5 | Le `contenu` est strict : clé inconnue rejetée, clé de correction jamais servie. | Cohérence avec `extra="forbid"` côté service IA. |
| R6 | Aucun audio en base ; seule une référence `audio_ref` est stockée. | Droits et empreinte mémoire maîtrisés. |
| R7 | Le seed est conservé et marqué `donnees_test = true`. | La démo reste reproductible sans être confondue avec du contenu réel. |
| R8 | Le service IA ne lit ni n'écrit la base. | Frontière de responsabilité conservée. |
| R9 | Une tentative `EN_COURS` bloque la suppression de `question` ou impose une fenêtre de maintenance. | Aucune réponse orpheline pendant la migration. |

---

## 5. Parcours utilisateurs cibles

### 5.1 Le formateur crée un exercice

1. Le formateur s'authentifie ; le backend vérifie la permission pédagogique dédiée (à créer).
2. Il choisit la langue, le référentiel, le niveau, le type et l'usage (`diagnostic`, `parcours`, `les deux`).
3. Il saisit le `contenu` dans un formulaire déterminé par le type ; le backend valide le schéma strict.
4. Il enregistre : l'exercice est `brouillon`, `version = 1`, `auteur = formateur connecté`, `donnees_test = false`.
5. Il soumet à validation ; l'administrateur (ou le référent désigné) publie l'exercice.
6. Toute modification après publication crée une **nouvelle version** ; l'ancienne reste intacte.
7. S'il décoche l'usage `diagnostic`, l'exercice reste disponible pour le parcours uniquement.
8. Un audio, s'il est autorisé, est référencé par `audio_ref` ; aucun fichier n'est téléversé en base.

### 5.2 L'apprenant passe un diagnostic

1. Le backend résout le profil d'épreuve actif pour la langue demandée.
2. Il sélectionne les exercices publiés, dont l'usage inclut `diagnostic`, non exclus par le formateur.
3. Il crée une tentative, sert un `contenu` filtré (sans clé de correction), enregistre les réponses.
4. À la clôture, le scoring détermine le niveau ; l'analyse IA reste best-effort et ne persiste pas de décision.
5. La génération de parcours consomme le résultat, exactement comme aujourd'hui
   (`backend/app/services/parcours.py:260-322`).

### 5.3 Le parcours généré (existant, à ne pas casser)

- Les phases sont `PASSIVE` avant la leçon 50 et `ACTIVE` à partir de 50
  (`backend/app/services/phase_parcours.py:11-17`) ; en phase active, les leçons multiples de 7 sont des révisions
  (`:20-22`).
- Les routes `/parcours/*` et l'interface apprenant existent déjà (voir §6) : la banque unique doit nourrir ce
  flux sans changer son contrat public.

---

## 6. Écart avec l'existant (constat code, 23 novembre 2026)

| Sujet | Aujourd'hui | Cible |
|---|---|---|
| Stockage | Deux tables : `question` (`models/diagnostic.py:19-49`) et `exercice` (`models/parcours.py:62-83`). | Une table `exercice`. |
| Champs de gestion | Ni `usage`, ni `statut`, ni `version`, ni `origine`, ni `auteur`, ni `donnees_test` sur `exercice`. | Tous présents, avec contraintes. |
| Seed diagnostic | 35 questions en dur (`app/seed_diagnostic.py:33-155`), aucun fichier lu. | Même catalogue, marqué `donnees_test = true`. |
| Seed parcours | 21 exercices en dur (`app/seed_parcours.py:67-252`), `json.dumps` en mémoire. | Même banque, usage `parcours`. |
| Formateur | Aucune permission pédagogique ; seulement profil et tableau de bord. | CRUD pédagogique + correction des productions libres. |
| Diagnostic | Liste fixe de questions ; 5 routes, niveau de départ figé. | Profil d'épreuve paramétrable. |
| Parcours | **5 routes réelles** (`routes/parcours.py:76-155`) incluses dans `router.py:30`, service et écrans branchés. | Inchangé dans son contrat ; alimenté par la banque unique. |
| Chatbot | **Route backend présente** (`router.py:31`), contrairement à une note ancienne de `AGENTS.md`. | Hors périmètre de cette spécification. |
| Reprise / abandon du diagnostic | Routes absentes du backend alors que `endpoints.ts:36-37` les déclare. | Hors périmètre ; ne pas les traiter comme opérationnelles. |
| Contrat IA | `id_question`, `extra="forbid"`, prompt `diagnostic/evaluation@1.1.0` à empreinte figée. | Bascule atomique si renommage retenu. |

> La matrice [`06-matrice-fonctionnalites.md`](06-matrice-fonctionnalites.md) annonçait encore « aucune route » pour
> le parcours (lignes 124-125) : cette affirmation était périmée et a été corrigée dans le même lot documentaire.

---

## 7. Traçabilité des décisions

| Décision | Traitée au § | Statut | Bloque quoi |
|---|---|---|---|
| D1 Banque unique | 3.1, 4 R1 | `VALIDÉE` | — (T1 tranché, plan de migration relu) |
| D2 Profil d'épreuve | 3.3, 5.2 | `VALIDÉE` | — (co-signature consignée par le chef de projet) |
| D3 Usage d'un exercice | 3.1, 4 R4 | `VALIDÉE` | — (F8 : drapeau d'exclusion retenu) |
| D4 Types de leçon | 3.2 | `VALIDÉE` | — (co-signature consignée par le chef de projet) |
| D5 Types d'exercice | 3.4 | `VALIDÉE` | — (co-signature consignée par le chef de projet) |
| D6 Champs HSK | 3.1, 3.5 | `VALIDÉE` | Source officielle HSK (F5) à produire pour le mémoire |
| D7 Corpus audio | 3.1, 3.5, 4 R6 | `VALIDÉE` | Droits par fichier à vérifier avant diffusion |
| D8 Seed de test | 3.5, 4 R7 | `VALIDÉE` | — (co-signature consignée par le chef de projet) |
| D9 Numéros US | 9 | `VALIDÉE` | Série locale `US-N00`…`US-N14` attribuée (hors ClickUp) ; branches `feature/US-Nxx-…` |

---

## 8. Critères d'acceptation fonctionnels

D1–D9 sont validées, les numéros `US-N00`…`US-N14` attribués et tous les garde-fous levés le 23/11/2026 sous
l'autorité du chef de projet. Ces critères sont actifs dès l'ouverture de chaque branche US.

| ID | Étant donné… | Quand… | Alors… |
|---|---|---|---|
| CA1 | Une banque unique et deux exercices, l'un `publié`, l'autre `brouillon`. | Le backend sélectionne un diagnostic et un parcours. | Seul le `publié` dont l'usage inclut le contexte est retourné. |
| CA2 | Un exercice publié possédant déjà des réponses. | Le formateur modifie son contenu. | Une nouvelle version est créée ; les réponses anciennes pointent toujours l'ancienne version. |
| CA3 | Un `contenu` avec une clé inconnue. | Le formateur enregistre l'exercice. | La requête est rejetée (`422`), sans suppression silencieuse de la clé. |
| CA4 | Une réponse à choix correcte stockée dans `contenu`. | Le frontend lit la leçon. | La clé de correction n'apparaît nulle part dans la réponse JSON. |
| CA5 | Une question historique du seed. | La migration est jouée. | Elle devient un exercice `usage='diagnostic'`, `donnees_test=true`, sans audio. |
| CA6 | Une réponse existante liée à une question. | La migration est jouée puis défaite puis rejouée. | La réponse reste rattachée au même exercice ; les comptes sont identiques. |
| CA7 | Une tentative `EN_COURS`. | L'équipe tente de supprimer la table `question`. | La migration s'arrête ou attend la clôture : aucune réponse n'est orpheline. |
| CA8 | Un audio référencé par `audio_ref`. | Le service IA et le frontend consomment l'exercice. | Aucun octet audio n'est transmis ni stocké ; les droits ont été vérifiés en amont. |

---

## 9. Séquence avant implémentation

1. ✅ **D1 à D9 validées le 23/11/2026** par le Product Owner ; co-signatures et relecture du plan de migration
   consignées le même jour sous l'autorité du chef de projet.
2. ✅ **Numéros attribués** : série locale officielle `US-N00`…`US-N14` renseignée dans
   [`../plan/gestion_pedagogique_plan.md`](../plan/gestion_pedagogique_plan.md) le 23/11/2026 (D9). Déviation à D9
   consignée : aucun ticket ClickUp n'a été créé ni modifié.
3. **Valider le plan de migration** `docs/plan/migration_banque_exercices.md`, notamment ses cinq points ouverts.
4. **Ensuite seulement** : ouvrir les branches `feature/US-Nxx-<nom-court>` depuis `origin/develop`, commits
   `type(scope): ...`, PR titulées `[US-Nxx] ...` vers `develop`, CI verte, 1 reviewer (2 pour l'IA), sans fusion par
   l'auteur.

---

## 10. Questions ouvertes — état au 23/11/2026

Les dix points ci-dessous ont été tranchés le 23/11/2026 (voir le
[dossier de validation](../plan/gestion_pedagogique_validation.md) §2 et §3). Ils sont conservés à titre de traçabilité.

1. ✅ Identifiant primaire : **nouveaux ids + table de correspondance** (T1, option A).
2. ✅ Contrat IA : **`id_question` conservé** pendant la migration ; évolution ultérieure distincte (T2).
3. ✅ Mapping de l'audio historique : **`prononciation`** (T3).
4. ✅ Valeur de `difficulte` pour C2 : **3 (neutre)**, `level` portant le niveau réel (T4).
5. ✅ Diagnostic en cours : **fenêtre de maintenance courte + déploiement atomique** (T5).
6. ✅ Permissions du formateur : **`pedagogy:content:write`** et **`pedagogy:content:publish`** (F1).
7. ✅ Validation de la publication : **administrateur** pour les référentiels et la publication (F2).
8. ✅ Hiérarchie : **cours → module → leçon**, numérotation stable, séquence d'exercices (F3).
9. ✅ Correction libre : **file formateur, note + commentaire persistés, aucune note IA** (F4).
10. ⏳ Sources officielles HSK : **action encore à produire** par l'expert IA avant toute affirmation dans le mémoire (F5).

**Plus aucun point bloquant** : numérotation (F6/D9), co-signatures et relecture du plan de migration sont réglés.
Reste à produire, sans blocage du code : la source officielle HSK (F5) pour le mémoire, et la vérification des droits
audio par fichier (D7) avant toute diffusion.

---

## 11. Sources consultées

- `docs/decisions/gestion_pedagogique_decisions.md` (branche PR #103) — D1 à D9.
- `docs/audit/gestion_pedagogique_exec_audit.md` — modèles, routes, IA, seed, tests, occurrences.
- `docs/plan/migration_banque_exercices.md` — mapping champs, réversibilité, données, risques.
- `docs/plan/gestion_pedagogique_validation.md` — options recommandées et points à signer (sans changement de statut).
- `backend/app/models/diagnostic.py`, `backend/app/models/parcours.py`, `backend/app/models/enums.py`.
- `backend/app/api/router.py`, `backend/app/api/routes/diagnostic.py`, `backend/app/api/routes/parcours.py`.
- `backend/app/services/diagnostic.py`, `scoring.py`, `analyse_diagnostic.py`, `parcours.py`, `lecture_parcours.py`,
  `phase_parcours.py`.
- `backend/app/seed_diagnostic.py`, `backend/app/seed_parcours.py`, `backend/app/seed.py`.
- `ia-service/app/schemas/diagnostic.py`, `ia-service/app/schemas/base.py`, `ia-service/app/prompts/variables.py`.
- `frontend/src/services/endpoints.ts`, `frontend/src/types/test-diagnostic.ts`, `docs/api/contrat-frontend.md`.
- `CONTRIBUTING.md` — workflow, branches, commits, PR.
