# Plan US — Gestion pédagogique (brouillon, non opérationnel)

> **Centre Langues IA · La Digithèque** · 23 novembre 2026
>
> **Statut : BROUILLON.** Ce document ne donne aucun ordre d'implémentation exécutable. D1 à D9 sont encore
> `EN ATTENTE` et aucun numéro US n'a été attribué. **Aucune branche `feature/US…` ne doit être créée tant que le
> Product Owner n'a pas attribué les numéros dans ClickUp et reporté la validation ici (D9).**
>
> Aucune tâche ClickUp n'a été modifiée pour produire ce brouillon. Les numéros sont des emplacements `US-??`, pas
> des identifiants. La colonne `P1…P14` est un ordre de lecture interne, pas un numéro de user story.

## Sources

- `docs/decisions/gestion_pedagogique_decisions.md` — D1 à D9, toutes `EN ATTENTE`.
- [`../audit/gestion_pedagogique_exec_audit.md`](../audit/gestion_pedagogique_exec_audit.md) — état réel du code.
- [`migration_banque_exercices.md`](migration_banque_exercices.md) — migration technique à valider.
- [`../fonctionnalites/09-gestion-pedagogique.md`](../fonctionnalites/09-gestion-pedagogique.md) — spécification fonctionnelle cible.
- `CONTRIBUTING.md` — branches, commits, PR, revues, CI.

---

## 1. Règles d'usage du plan

1. **Une ligne = une fonctionnalité = une US.** Les lots techniques sont regroupés avec la fonctionnalité qu'ils rendent possible.
2. Le PO remplace chaque `US-??` par le numéro attribué dans ClickUp, puis marque la ligne `VALIDÉE`.
3. Tant qu'une ligne porte `BROUILLON`, le code correspondant ne doit pas être écrit.
4. Le plan de migration doit être validé avant P1 ; la bascule IA doit être atomique avant P3.
5. Chaque US suit `CONTRIBUTING.md` : branche `feature/US<numéro>-<nom-court>` depuis `origin/develop`, commits
   `type(scope): description`, PR titrée `[US-XX] ...`, CI verte, 1 reviewer (2 pour l'IA), **aucune fusion par l'auteur**.
6. Les noms de champs, codes d'erreur et routes publics sont ceux de
   [`../api/contrat-frontend.md`](../api/contrat-frontend.md) ; tout changement met à jour le contrat et
   `frontend/src/services/endpoints.ts` dans la même PR.

---

## 2. Vue d'ensemble

| Ordre | US à attribuer | Fonctionnalité | Décisions | Couches | Dépendances | Statut |
|---|---|---|---|---|---|---|
| **P0** | `US-??` | Validation D1–D9 et attribution des numéros US | D1–D9 | Gouvernance | — | `BROUILLON` |
| **P1** | `US-??` | Banque unique : migration `question` → `exercice` | D1, D3, D8 | Backend, Alembic | P0 + plan de migration validé | `BROUILLON` |
| **P2** | `US-??` | Contrat IA atomique et identifiant d'exercice | D2, D3 | Backend, IA, prompts, contrats | P0 | `BROUILLON` |
| **P3** | `US-??` | Diagnostic comme profil d'épreuve | D2 | Backend, frontend, contrat | P1, P2 | `BROUILLON` |
| **P4** | `US-??` | Schémas stricts des formats d'exercice du MVP | D5 | Backend, IA | P0 | `BROUILLON` |
| **P5** | `US-??` | CRUD formateur des exercices + publication versionnée | D1, D3, D8 | Backend, RBAC | P1, P4 | `BROUILLON` |
| **P6** | `US-??` | Interface formateur : banque d'exercices | D1, D3 | Frontend | P5 | `BROUILLON` |
| **P7** | `US-??` | Cours, modules, leçons et types de leçon | D4 | Backend, base | P1 | `BROUILLON` |
| **P8** | `US-??` | Interface formateur : cours, modules, leçons | D4 | Frontend | P7 | `BROUILLON` |
| **P9** | `US-??` | Champs HSK (`framework`, `level`, `show_pinyin`) | D6 | Backend, frontend, docs | P0 + sources officielles | `BROUILLON` |
| **P10** | `US-??` | Référencement audio `audio_ref` et contrôle des droits | D7 | Backend, IA, exploitation | P0 | `BROUILLON` |
| **P11** | `US-??` | Seed de test marqué `donnees_test = true` | D8 | Backend, seed, CI | P1 | `BROUILLON` |
| **P12** | `US-??` | Correction des productions libres par le formateur | D5 | Backend, frontend | P5, P6 | `BROUILLON` |
| **P13** | `US-??` | Administration des référentiels et validation/publication | D1, D4, D6 | Backend, RBAC, frontend | P5, P7, P9 | `BROUILLON` |
| **P14** | `US-??` | Recette, réversibilité et non-régression complète | D1–D9 | Tous | P1–P13 | `BROUILLON` |

> P0 n'est pas une US de code : c'est la condition d'existence de toutes les autres. Elle peut être suivie dans le
> registre de décisions sans PR dédiée.

---

## 3. Détail des US

### P0 — Validation D1–D9 et attribution des numéros

- **US** : `US-??` — à attribuer si le PO souhaite une traçabilité dédiée.
- **Responsables** : Product Owner (D1, D2, D3, D4, D5, D9), expert IA (D2, D6), référent pédagogique (D4, D5, D6),
  développeur IA (D7), développeur backend (D8).
- **Livrable** : D1–D9 passent en `VALIDÉE` avec nom et date ; les `US-??` ci-dessus sont remplacés ; ce document passe
  de `BROUILLON` à `VALIDÉ`.
- **Critère d'arrêt** : tant que la synthèse du registre contient `EN ATTENTE`, aucune branche n'est créée.

### P1 — Banque unique : migration `question` → `exercice`

- **US** : `US-??` — `feature/US<numéro>-banque-unique`
- **Objectif** : supprimer la table `question` en conservant toutes les données et les réponses rattachées.
- **Livrables** : révision Alembic avec `down_revision = "dfbf0715302a"`, table de correspondance, `upgrade`/`downgrade`
  réversibles, modèles et `app/models/__init__.py` mis à jour.
- **Critères de fin** : 0 réponse orpheline ; cycle `upgrade` → `downgrade` → `upgrade` conserve les comptes ;
  aucun exercice `brouillon` n'est sélectionnable.
- **Risque maîtrisé** : tentative `EN_COURS` → arrêt explicite ou fenêtre de maintenance (plan de migration §6).

### P2 — Contrat IA atomique et identifiant d'exercice

- **US** : `US-??` — `feature/US<numéro>-contrat-ia-exercice`
- **Objectif** : choisir et appliquer en une seule livraison le nom de l'identifiant transmis à l'IA.
- **Livrables** : décision `id_question` conservé **ou** `id_exercice` ; schémas Pydantic backend/IA, prompts versionnés,
  `VERSION_AGENT`, contrats partagés, parseur du fournisseur factice.
- **Critère de fin** : exemples `contrats/ia/diagnostic-evaluer/` validés des deux côtés ; `extra="forbid"` ne rejette
  aucune requête après déploiement.
- **Décision ouverte** : recommandation du plan de migration = conserver `id_question` pendant la transition.

### P3 — Diagnostic comme profil d'épreuve

- **US** : `US-??` — `feature/US<numéro>-profil-epreuve`
- **Objectif** : remplacer la liste fixe de questions par une sélection paramétrée dans la banque.
- **Livrables** : modèle de profil (`langue`, `framework`, règle de sélection, nombre d'items, durée), service de
  sélection, routes diagnostic adaptées, écran apprenant et contrat frontend.
- **Critères de fin** : seuls les exercices `publiés`, d'usage `diagnostic` et non exclus sont tirés ; la clé de
  correction reste absente de `QuestionOut`/du DTO de lecture.
- **Dépendances** : P1 et P2 (déploiement atomique).

### P4 — Schémas stricts des formats d'exercice du MVP

- **US** : `US-??` — `feature/US<numéro>-formats-exercices`
- **Objectif** : figer le `contenu` JSON accepté pour les six formats retenus.
- **Livrables** : schémas Pydantic avec clés autorisées et `extra="forbid"`, mapping des types historiques
  (`choix`, `texte`, `audio`), documentation des clés privées.
- **Critères de fin** : une clé inconnue est rejetée en `422` ; `reponse_correcte`, `reponses` et `explication` ne
  sont jamais sérialisés vers le navigateur.
- **Reportés** : discrimination des tons, reconnaissance des traits, description d'image.

### P5 — CRUD formateur des exercices + publication versionnée

- **US** : `US-??` — `feature/US<numéro>-crud-exercices`
- **Objectif** : permettre au formateur de créer, modifier, exclure du diagnostic et publier un exercice.
- **Livrables** : permissions dédiées, routes CRUD, `statut`, `origine`, `auteur`, `date`, `version`, `usage`,
  `donnees_test`, traçabilité des versions.
- **Critères de fin** : un brouillon est invisible du parcours et du diagnostic ; modifier un exercice publié crée
  une nouvelle version ; les anciennes réponses restent rattachées à l'ancienne version.
- **Point à valider** : codes de permission et identité du validateur (admin ou référent formateur).

### P6 — Interface formateur : banque d'exercices

- **US** : `US-??` — `feature/US<numéro>-ui-exercices`
- **Objectif** : exposer le CRUD P5 dans l'espace formateur, aujourd'hui limité au profil.
- **Livrables** : liste filtrable (langue, niveau, type, usage, statut), formulaire par type, aperçu du `contenu`,
  actions publier / exclure du diagnostic / nouvelle version.
- **Critères de fin** : hook → service → `api-client` uniquement ; aucun `fetch` dans un composant ; `snake_case`
  cantonné aux services et mappers ; E2E desktop + mobile.

### P7 — Cours, modules, leçons et types de leçon

- **US** : `US-??` — `feature/US<numéro>-cours-modules-lecons`
- **Objectif** : structurer le contenu au-delà du simple `numero_lecon`.
- **Livrables** : modèles `cours`, `module`, `leçon`, types `réception`, `conceptualisation`, `actionnelle` ;
  rattachement des exercices ; migrations associées.
- **Critères de fin** : la hiérarchie est complète, immuable pour les codes existants, et le parcours existant continue
  de fonctionner avec ses numéros de leçon.
- **Reportés** : médiation, écriture et sinogrammes, préparation examen.

### P8 — Interface formateur : cours, modules, leçons

- **US** : `US-??` — `feature/US<numéro>-ui-cours-modules`
- **Objectif** : permettre la création et l'ordonnancement des objets P7.
- **Livrables** : arborescence cours → module → leçon, éditeur de séquence d'exercices, contrôle de publication.
- **Critères de fin** : une leçon publiée ne peut pas être supprimée si des exercices ou des parcours la référencent ;
  l'interface reflète exactement les permissions backend.

### P9 — Champs HSK (`framework`, `level`, `show_pinyin`)

- **US** : `US-??` — `feature/US<numéro>-champs-hsk`
- **Objectif** : porter les champs spécifiques au mandarin sans figer des règles non sourcées.
- **Livrables** : `framework`, `level`, option `show_pinyin` dans le schéma d'exercice et les écrans ; documentation
  sourcée (nombre de niveaux, règle d'affichage, correspondance CECRL).
- **Critères de fin** : `script` n'apparaît ni dans le schéma ni dans l'interface ; les affirmations du mémoire
  renvoient à une source officielle.

### P10 — Référencement audio `audio_ref` et contrôle des droits

- **US** : `US-??` — `feature/US<numéro>-audio-ref`
- **Objectif** : permettre un exercice audio sans stocker d'octets en base ni dans le seed.
- **Livrables** : champ `audio_ref`, validation « chemin uniquement, pas de `data:` URI », contrôle de droits avant
  diffusion, documentation d'exploitation.
- **Critères de fin** : aucun audio n'est copié en base ; le seed reste sans audio ; une valeur interdite fait échouer
  l'enregistrement.

### P11 — Seed de test marqué `donnees_test = true`

- **US** : `US-??` — `feature/US<numéro>-seed-donnees-test`
- **Objectif** : distinguer le contenu de démonstration du contenu pédagogique réel.
- **Livrables** : `donnees_test = true` sur les 35 questions migrées (18 `en`, 17 `fr`), garde-fou CI, documentation
  `make reset` pour rejouer un seed insert-only.
- **Critères de fin** : `/diagnostic/langues` continue d'exposer `en` et `fr` disponibles dans le job Docker ; aucun
  audio ajouté ; le seed reste idempotent par `(langue, niveau, enonce)`.

### P12 — Correction des productions libres par le formateur

- **US** : `US-??` — `feature/US<numéro>-correction-production`
- **Objectif** : corriger les réponses `texte`/production libre sans IA, conformément à D5.
- **Livrables** : file de réponses à corriger, écran formateur, persistance de la note et du commentaire, notification.
- **Critères de fin** : aucune note n'est produite automatiquement pour ce format ; le score de l'apprenant n'est mis
  à jour qu'après correction humaine.
- **Point à valider** : circuit de notification et traçabilité de la note (question ouverte 9 du chapitre 09).

### P13 — Administration des référentiels et validation/publication

- **US** : `US-??` — `feature/US<numéro>-validation-publication`
- **Objectif** : donner à l'administrateur la gestion des référentiels et la validation du contenu créé par le formateur.
- **Livrables** : permissions et routes d'administration étendues, écran de validation, journal minimal « qui publie quoi ».
- **Critères de fin** : un formateur peut proposer mais pas publier seul ; un exercice exclu du diagnostic reste publié
  pour le parcours ; les codes de rôles existants ne changent jamais.

### P14 — Recette, réversibilité et non-régression

- **US** : `US-??` — `feature/US<numéro>-recette-pedagogie`
- **Objectif** : prouver que la chaîne complète fonctionne avant toute mise en production.
- **Livrables** : tests de migration `upgrade`/`downgrade`, contrat IA partagé, tests de non-exposition de la clé de
  correction, E2E formateur + apprenant, `make check`, `npm run build`, `npm run test:e2e`, job Docker CI.
- **Critères de fin** : CI verte sur tous les jobs ; seed idempotent rejoué ; diagnostic en cours sans réponse orpheline ;
  aucune régression sur le parcours existant.

---

## 4. Contrôles avant création de la première branche

Le [`gestion_pedagogique_validation.md`](gestion_pedagogique_validation.md) regroupe les options recommandées et les
points à signer ; il ne modifie aucun statut.

- [ ] D1 à D9 portent `VALIDÉE` avec nom et date dans le registre des décisions.
- [ ] Chaque `US-??` ci-dessus est remplacé par un numéro attribué dans ClickUp, sans modification de ClickUp par l'agent.
- [ ] Le plan de migration `migration_banque_exercices.md` est validé, avec ses cinq points ouverts tranchés.
- [ ] La recommandation IA (`id_question` conservé pendant la transition) est confirmée ou remplacée.
- [ ] Les codes de permission du formateur et le validateur de publication sont désignés.
- [ ] Le chapitre 09 est relu comme spécification de référence ; `docs/api/contrat-frontend.md` est à jour.
- [ ] Aucune fusion n'est prévue par l'auteur des PR.

---

## 5. Limites actuelles

Ce brouillon **ne** fournit **ni** numéros US exécutables, **ni** branches, **ni** ordre de priorité business validé.
La colonne `Ordre` est une proposition technique fondée sur les dépendances du code ; le Product Owner peut la
réorganiser librement lorsqu'il attribue les numéros.
