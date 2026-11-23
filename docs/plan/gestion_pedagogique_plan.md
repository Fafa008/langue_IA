# Plan US — Gestion pédagogique (validé, série locale `US-N`)

> **Centre Langues IA · La Digithèque** · 23 novembre 2026
>
> **Statut : VALIDÉ.** D1 à D9 sont `VALIDÉE` et les quinze numéros sont attribués : série locale officielle
> **`US-N00` à `US-N14`**, retenue par le Product Owner le 23/11/2026 faute de numéros ClickUp disponibles.
> **Déviation à D9 documentée** : ces identifiants ne sont pas des tickets ClickUp ; aucune tâche ClickUp n'a été
> modifiée. La colonne `P0…P14` reste un ordre technique proposé, réorganisable par le PO.
>
> Les branches `feature/US-Nxx-<nom-court>` et les PR `[US-Nxx] ...` suivent `CONTRIBUTING.md`.
> **Deux conditions bloquantes** restent à lever avant la première branche : co-signatures des responsables et
> relecture du plan de migration par le backend et l'expert IA. La source officielle HSK (F5) conditionne seulement
> les affirmations du mémoire.

## Sources

- `docs/decisions/gestion_pedagogique_decisions.md` — D1 à D9, validées le 23/11/2026.
- [`../audit/gestion_pedagogique_exec_audit.md`](../audit/gestion_pedagogique_exec_audit.md) — état réel du code.
- [`migration_banque_exercices.md`](migration_banque_exercices.md) — migration technique à valider.
- [`../fonctionnalites/09-gestion-pedagogique.md`](../fonctionnalites/09-gestion-pedagogique.md) — spécification fonctionnelle cible.
- `CONTRIBUTING.md` — branches, commits, PR, revues, CI.

---

## 1. Règles d'usage du plan

1. **Une ligne = une fonctionnalité = une US.** Les lots techniques sont regroupés avec la fonctionnalité qu'ils rendent possible.
2. Les numéros `US-N00`…`US-N14` ont été attribués par le PO le 23/11/2026 (série locale, hors ClickUp) ; chaque ligne
   est marquée `VALIDÉE` et porte son identifiant de branche.
3. Toutes les lignes portent `VALIDÉ` ; le code reste subordonné aux deux conditions bloquantes rappelées en tête.
4. Le plan de migration doit être validé avant P1 ; la bascule IA doit être atomique avant P3.
5. Chaque US suit `CONTRIBUTING.md` : branche `feature/US-Nxx-<nom-court>` depuis `origin/develop`, commits
   `type(scope): description`, PR titrée `[US-Nxx] ...`, CI verte, 1 reviewer (2 pour l'IA), **aucune fusion par l'auteur**.
6. Les noms de champs, codes d'erreur et routes publics sont ceux de
   [`../api/contrat-frontend.md`](../api/contrat-frontend.md) ; tout changement met à jour le contrat et
   `frontend/src/services/endpoints.ts` dans la même PR.

---

## 2. Vue d'ensemble

| Ordre | US à attribuer | Fonctionnalité | Décisions | Couches | Dépendances | Statut |
|---|---|---|---|---|---|---|
| **P0** | `US-N00` | Validation D1–D9 et attribution des numéros US | D1–D9 | Gouvernance | — | `VALIDÉ` |
| **P1** | `US-N01` | Banque unique : migration `question` → `exercice` | D1, D3, D8 | Backend, Alembic | P0 + plan de migration validé | `VALIDÉ` |
| **P2** | `US-N02` | Contrat IA atomique et identifiant d'exercice | D2, D3 | Backend, IA, prompts, contrats | P0 | `VALIDÉ` |
| **P3** | `US-N03` | Diagnostic comme profil d'épreuve | D2 | Backend, frontend, contrat | P1, P2 | `VALIDÉ` |
| **P4** | `US-N04` | Schémas stricts des formats d'exercice du MVP | D5 | Backend, IA | P0 | `VALIDÉ` |
| **P5** | `US-N05` | CRUD formateur des exercices + publication versionnée | D1, D3, D8 | Backend, RBAC | P1, P4 | `VALIDÉ` |
| **P6** | `US-N06` | Interface formateur : banque d'exercices | D1, D3 | Frontend | P5 | `VALIDÉ` |
| **P7** | `US-N07` | Cours, modules, leçons et types de leçon | D4 | Backend, base | P1 | `VALIDÉ` |
| **P8** | `US-N08` | Interface formateur : cours, modules, leçons | D4 | Frontend | P7 | `VALIDÉ` |
| **P9** | `US-N09` | Champs HSK (`framework`, `level`, `show_pinyin`) | D6 | Backend, frontend, docs | P0 + sources officielles | `VALIDÉ` |
| **P10** | `US-N10` | Référencement audio `audio_ref` et contrôle des droits | D7 | Backend, IA, exploitation | P0 | `VALIDÉ` |
| **P11** | `US-N11` | Seed de test marqué `donnees_test = true` | D8 | Backend, seed, CI | P1 | `VALIDÉ` |
| **P12** | `US-N12` | Correction des productions libres par le formateur | D5 | Backend, frontend | P5, P6 | `VALIDÉ` |
| **P13** | `US-N13` | Administration des référentiels et validation/publication | D1, D4, D6 | Backend, RBAC, frontend | P5, P7, P9 | `VALIDÉ` |
| **P14** | `US-N14` | Recette, réversibilité et non-régression complète | D1–D9 | Tous | P1–P13 | `VALIDÉ` |

> P0 n'est pas une US de code : c'est la condition d'existence de toutes les autres. Elle peut être suivie dans le
> registre de décisions sans PR dédiée.

---

## 3. Détail des US

### P0 — Validation D1–D9 et attribution des numéros

- **US** : `US-N00` — série locale officielle retenue par le PO le 23/11/2026 (déviation à D9 documentée).
- **Responsables** : Product Owner (D1, D2, D3, D4, D5, D9), expert IA (D2, D6), référent pédagogique (D4, D5, D6),
  développeur IA (D7), développeur backend (D8).
- **Livrable** : ✅ D1–D9 passées en `VALIDÉE` avec nom et date le 23/11/2026 ; ✅ quinze numéros `US-N00`…`US-N14`
  attribués et branches renseignées ; ce document passe de `BROUILLON` à `VALIDÉ`.
- **Critère d'arrêt** : la numérotation ne bloque plus. Restent requis avant la première branche : co-signatures des
  responsables désignés et relecture du plan de migration par le backend et l'expert IA (voir le dossier de validation).

### P1 — Banque unique : migration `question` → `exercice`

- **US** : `US-N01` — `feature/US-N01-banque-unique`
- **Objectif** : supprimer la table `question` en conservant toutes les données et les réponses rattachées.
- **Livrables** : révision Alembic avec `down_revision = "dfbf0715302a"`, table de correspondance, `upgrade`/`downgrade`
  réversibles, modèles et `app/models/__init__.py` mis à jour.
- **Critères de fin** : 0 réponse orpheline ; cycle `upgrade` → `downgrade` → `upgrade` conserve les comptes ;
  aucun exercice `brouillon` n'est sélectionnable.
- **Risque maîtrisé** : tentative `EN_COURS` → arrêt explicite ou fenêtre de maintenance (plan de migration §6).

### P2 — Contrat IA atomique et identifiant d'exercice

- **US** : `US-N02` — `feature/US-N02-contrat-ia-exercice`
- **Objectif** : choisir et appliquer en une seule livraison le nom de l'identifiant transmis à l'IA.
- **Livrables** : décision `id_question` conservé **ou** `id_exercice` ; schémas Pydantic backend/IA, prompts versionnés,
  `VERSION_AGENT`, contrats partagés, parseur du fournisseur factice.
- **Critère de fin** : exemples `contrats/ia/diagnostic-evaluer/` validés des deux côtés ; `extra="forbid"` ne rejette
  aucune requête après déploiement.
- **Décision ouverte** : recommandation du plan de migration = conserver `id_question` pendant la transition.

### P3 — Diagnostic comme profil d'épreuve

- **US** : `US-N03` — `feature/US-N03-profil-epreuve`
- **Objectif** : remplacer la liste fixe de questions par une sélection paramétrée dans la banque.
- **Livrables** : modèle de profil (`langue`, `framework`, règle de sélection, nombre d'items, durée), service de
  sélection, routes diagnostic adaptées, écran apprenant et contrat frontend.
- **Critères de fin** : seuls les exercices `publiés`, d'usage `diagnostic` et non exclus sont tirés ; la clé de
  correction reste absente de `QuestionOut`/du DTO de lecture.
- **Dépendances** : P1 et P2 (déploiement atomique).

### P4 — Schémas stricts des formats d'exercice du MVP

- **US** : `US-N04` — `feature/US-N04-formats-exercices`
- **Objectif** : figer le `contenu` JSON accepté pour les six formats retenus.
- **Livrables** : schémas Pydantic avec clés autorisées et `extra="forbid"`, mapping des types historiques
  (`choix`, `texte`, `audio`), documentation des clés privées.
- **Critères de fin** : une clé inconnue est rejetée en `422` ; `reponse_correcte`, `reponses` et `explication` ne
  sont jamais sérialisés vers le navigateur.
- **Reportés** : discrimination des tons, reconnaissance des traits, description d'image.

### P5 — CRUD formateur des exercices + publication versionnée

- **US** : `US-N05` — `feature/US-N05-crud-exercices`
- **Objectif** : permettre au formateur de créer, modifier, exclure du diagnostic et publier un exercice.
- **Livrables** : permissions dédiées, routes CRUD, `statut`, `origine`, `auteur`, `date`, `version`, `usage`,
  `donnees_test`, traçabilité des versions.
- **Critères de fin** : un brouillon est invisible du parcours et du diagnostic ; modifier un exercice publié crée
  une nouvelle version ; les anciennes réponses restent rattachées à l'ancienne version.
- **Point à valider** : codes de permission et identité du validateur (admin ou référent formateur).

### P6 — Interface formateur : banque d'exercices

- **US** : `US-N06` — `feature/US-N06-ui-exercices`
- **Objectif** : exposer le CRUD P5 dans l'espace formateur, aujourd'hui limité au profil.
- **Livrables** : liste filtrable (langue, niveau, type, usage, statut), formulaire par type, aperçu du `contenu`,
  actions publier / exclure du diagnostic / nouvelle version.
- **Critères de fin** : hook → service → `api-client` uniquement ; aucun `fetch` dans un composant ; `snake_case`
  cantonné aux services et mappers ; E2E desktop + mobile.

### P7 — Cours, modules, leçons et types de leçon

- **US** : `US-N07` — `feature/US-N07-cours-modules-lecons`
- **Objectif** : structurer le contenu au-delà du simple `numero_lecon`.
- **Livrables** : modèles `cours`, `module`, `leçon`, types `réception`, `conceptualisation`, `actionnelle` ;
  rattachement des exercices ; migrations associées.
- **Critères de fin** : la hiérarchie est complète, immuable pour les codes existants, et le parcours existant continue
  de fonctionner avec ses numéros de leçon.
- **Reportés** : médiation, écriture et sinogrammes, préparation examen.

### P8 — Interface formateur : cours, modules, leçons

- **US** : `US-N08` — `feature/US-N08-ui-cours-modules`
- **Objectif** : permettre la création et l'ordonnancement des objets P7.
- **Livrables** : arborescence cours → module → leçon, éditeur de séquence d'exercices, contrôle de publication.
- **Critères de fin** : une leçon publiée ne peut pas être supprimée si des exercices ou des parcours la référencent ;
  l'interface reflète exactement les permissions backend.

### P9 — Champs HSK (`framework`, `level`, `show_pinyin`)

- **US** : `US-N09` — `feature/US-N09-champs-hsk`
- **Objectif** : porter les champs spécifiques au mandarin sans figer des règles non sourcées.
- **Livrables** : `framework`, `level`, option `show_pinyin` dans le schéma d'exercice et les écrans ; documentation
  sourcée (nombre de niveaux, règle d'affichage, correspondance CECRL).
- **Critères de fin** : `script` n'apparaît ni dans le schéma ni dans l'interface ; les affirmations du mémoire
  renvoient à une source officielle.

### P10 — Référencement audio `audio_ref` et contrôle des droits

- **US** : `US-N10` — `feature/US-N10-audio-ref`
- **Objectif** : permettre un exercice audio sans stocker d'octets en base ni dans le seed.
- **Livrables** : champ `audio_ref`, validation « chemin uniquement, pas de `data:` URI », contrôle de droits avant
  diffusion, documentation d'exploitation.
- **Critères de fin** : aucun audio n'est copié en base ; le seed reste sans audio ; une valeur interdite fait échouer
  l'enregistrement.

### P11 — Seed de test marqué `donnees_test = true`

- **US** : `US-N11` — `feature/US-N11-seed-donnees-test`
- **Objectif** : distinguer le contenu de démonstration du contenu pédagogique réel.
- **Livrables** : `donnees_test = true` sur les 35 questions migrées (18 `en`, 17 `fr`), garde-fou CI, documentation
  `make reset` pour rejouer un seed insert-only.
- **Critères de fin** : `/diagnostic/langues` continue d'exposer `en` et `fr` disponibles dans le job Docker ; aucun
  audio ajouté ; le seed reste idempotent par `(langue, niveau, enonce)`.

### P12 — Correction des productions libres par le formateur

- **US** : `US-N12` — `feature/US-N12-correction-production`
- **Objectif** : corriger les réponses `texte`/production libre sans IA, conformément à D5.
- **Livrables** : file de réponses à corriger, écran formateur, persistance de la note et du commentaire, notification.
- **Critères de fin** : aucune note n'est produite automatiquement pour ce format ; le score de l'apprenant n'est mis
  à jour qu'après correction humaine.
- **Point à valider** : circuit de notification et traçabilité de la note (question ouverte 9 du chapitre 09).

### P13 — Administration des référentiels et validation/publication

- **US** : `US-N13` — `feature/US-N13-validation-publication`
- **Objectif** : donner à l'administrateur la gestion des référentiels et la validation du contenu créé par le formateur.
- **Livrables** : permissions et routes d'administration étendues, écran de validation, journal minimal « qui publie quoi ».
- **Critères de fin** : un formateur peut proposer mais pas publier seul ; un exercice exclu du diagnostic reste publié
  pour le parcours ; les codes de rôles existants ne changent jamais.

### P14 — Recette, réversibilité et non-régression

- **US** : `US-N14` — `feature/US-N14-recette-pedagogie`
- **Objectif** : prouver que la chaîne complète fonctionne avant toute mise en production.
- **Livrables** : tests de migration `upgrade`/`downgrade`, contrat IA partagé, tests de non-exposition de la clé de
  correction, E2E formateur + apprenant, `make check`, `npm run build`, `npm run test:e2e`, job Docker CI.
- **Critères de fin** : CI verte sur tous les jobs ; seed idempotent rejoué ; diagnostic en cours sans réponse orpheline ;
  aucune régression sur le parcours existant.

---

## 4. Contrôles avant création de la première branche

Le [`gestion_pedagogique_validation.md`](gestion_pedagogique_validation.md) consigne les validations du 23/11/2026 et
les points encore ouverts.

- [x] D1 à D9 portent `VALIDÉE` avec nom et date dans le registre des décisions.
- [x] Chaque ligne porte un numéro : série locale officielle `US-N00`…`US-N14` retenue par le PO le 23/11/2026
  (déviation à D9 consignée ; ClickUp non modifié).
- [x] Les cinq points ouverts du plan de migration sont tranchés (T1–T5 : option A, `id_question` conservé,
  `prononciation`, `difficulte = 3`, maintenance atomique).
- [ ] Le plan de migration `migration_banque_exercices.md` est relu par le développeur backend et l'expert IA.
- [x] La recommandation IA (`id_question` conservé pendant la transition) est confirmée.
- [x] Les codes de permission du formateur (`pedagogy:content:write`, `pedagogy:content:publish`) et le validateur
  de publication (administrateur) sont désignés.
- [ ] Les co-signatures des responsables désignés sont consignées.
- [ ] Le chapitre 09 est relu comme spécification de référence ; `docs/api/contrat-frontend.md` est à jour.
- [ ] Aucune fusion n'est prévue par l'auteur des PR.

---

## 5. Limites actuelles

Ce plan fournit des **numéros de série locale** (`US-N00`…`US-N14`) et des noms de branches, mais **aucun ticket
ClickUp** : la déviation à D9 est explicite et ClickUp n'a pas été modifié. L'ordre `P0…P14` reste une proposition
technique fondée sur les dépendances du code ; le Product Owner peut le réorganiser librement. Le plan est `VALIDÉ`,
mais les co-signatures, la relecture du plan de migration et la source HSK (F5) ne sont pas encore consignées.
