# Dossier de validation — Gestion pédagogique

> **Centre Langues IA · La Digithèque** · 23 novembre 2026
>
> **Validations enregistrées le 23/11/2026** par **ANDRIAMIHAJA Ainanirina Fanantenana (Product Owner)** : les options
> recommandées pour D1–D9, T1–T5 et F1–F10 sont retenues et reportées ci-dessous. Le registre officiel reste
> `docs/decisions/gestion_pedagogique_decisions.md`, où D1–D9 portent désormais `VALIDÉE`.
>
> **Numéros attribués** : série locale officielle **`US-N00`…`US-N14`** retenue par le PO le 23/11/2026 (déviation à
> D9 consignée, aucun ticket ClickUp créé ni modifié). Le plan US est désormais `VALIDÉ`.
>
> **Garde-fous levés le 23/11/2026** : ANDRIAMIHAJA Ainanirina Fanantenana a consigné, en qualité de **chef de projet**,
> les co-signatures requises par D2, D4, D5, D6, D7 et D8 et la relecture du plan de migration. Les noms des autres
> responsables n'ont pas été inventés : la consignation est faite sous l'autorité du chef de projet. Seule la source
> HSK (F5) reste à produire, pour le mémoire.

## Sources

- `docs/decisions/gestion_pedagogique_decisions.md` — D1 à D9, validées le 23/11/2026.
- [`gestion_pedagogique_plan.md`](gestion_pedagogique_plan.md) — plan US `VALIDÉ` (série locale `US-N00`…`US-N14`).
- [`migration_banque_exercices.md`](migration_banque_exercices.md) — plan technique, §7 « Validation attendue ».
- [`../fonctionnalites/09-gestion-pedagogique.md`](../fonctionnalites/09-gestion-pedagogique.md) — §10 « Questions ouvertes ».
- [`../audit/gestion_pedagogique_exec_audit.md`](../audit/gestion_pedagogique_exec_audit.md) — faits vérifiés dans le code.

---

## 1. Décisions D1–D9

| ID | Option retenue | Responsable | Validée par / date |
|---|---|---|---|
| **D1** | Banque unique `exercice` avec `usage` ; suppression de `question` après migration. | Product Owner | PO — 23/11/2026 |
| **D2** | Diagnostic = profil d'épreuve (langue, référentiel, règle de sélection, nombre d'items, durée). | PO + expert IA | PO — 23/11/2026 (co-signature consignée par le chef de projet) |
| **D3** | `usage = diagnostic / parcours / les deux` ; le formateur peut exclure un exercice du diagnostic. | Product Owner | PO — 23/11/2026 |
| **D4** | MVP : réception, conceptualisation, actionnelle. Report : médiation, écriture/sinogrammes, préparation examen. | PO + référent | PO — 23/11/2026 (co-signature consignée par le chef de projet) |
| **D5** | MVP : QCM, association, texte à trous, vrai/faux/non mentionné, remise en ordre, production libre corrigée par le formateur. | PO + référent | PO — 23/11/2026 (co-signature consignée par le chef de projet) |
| **D6** | `framework`, `level`, `show_pinyin` en option ; `script` exclu du MVP. | Expert IA + référent | PO — 23/11/2026 (co-signatures consignées par le chef de projet) |
| **D7** | Droits vérifiés par fichier ; référence par `audio_ref` ; aucun audio dans le seed ni en base. | PO (droits) + dev IA | PO — 23/11/2026 (co-signature consignée par le chef de projet) |
| **D8** | Seed conservé, `donnees_test = true`, sans audio ajouté. | Développeur backend | PO — 23/11/2026 (co-signature consignée par le chef de projet) |
| **D9** | PO attribue les numéros puis les reporte dans le plan US. | Product Owner | PO — 23/11/2026 (**série locale `US-N00`…`US-N14`**, hors ClickUp) |

---

## 2. Points techniques tranchés (plan de migration)

| # | Point | Décision retenue | Responsable |
|---|---|---|---|
| T1 | Identifiant primaire de la banque | **Option A** : nouveaux `id_exercice` + table de correspondance conservée jusqu'à validation des données. | Développeur backend |
| T2 | Identifiant transmis à l'IA | **Conserver `id_question`** pendant la migration de schéma ; évolution ultérieure distincte si le PO la souhaite. | Expert IA + backend |
| T3 | Mapping de l'audio historique | **`prononciation`** (production orale de l'apprenant). | Référent pédagogique |
| T4 | Valeur de `difficulte` pour C2 | **3 (neutre)** pour toutes les questions migrées ; `level` porte le niveau réel. Contrainte DB inchangée `1..5`. | Référent + backend |
| T5 | Diagnostic en cours | **Fenêtre de maintenance courte + déploiement atomique** backend/IA/frontend ; double lecture uniquement si la disponibilité est exigée. | PO + DevOps |

> Ces cinq choix sont consignés dans le [plan de migration](migration_banque_exercices.md) §7. Le plan lui-même reste à
> relire par le développeur backend et l'expert IA avant l'écriture de la révision Alembic.

---

## 3. Points fonctionnels tranchés (chapitre 09)

| # | Point | Décision retenue | Responsable |
|---|---|---|---|
| F1 | Permissions du formateur | Créer `pedagogy:content:write` (créer/modifier) et `pedagogy:content:publish` (publier). Codes de rôles existants inchangés. | PO + backend |
| F2 | Qui valide la publication | **Administrateur** pour les référentiels **et** la publication ; le formateur crée et propose. | PO |
| F3 | Hiérarchie cours / module / leçon | `Cours (langue + référentiel) → Module (numérotation stable) → Leçon (type + séquence d'exercices)`. | Référent + PO |
| F4 | Circuit de correction libre | File de réponses à corriger dans l'espace formateur, note + commentaire persistés, notification minimale, **aucune note IA**. | Référent + frontend |
| F5 | Sources HSK | Lien officiel à fournir avant toute affirmation dans le mémoire ; sans source, le point reste « à vérifier ». **Action encore à produire.** | Expert IA |
| F6 | Numéros US | ✅ Série locale officielle `US-N00`…`US-N14` attribuée le 23/11/2026 ; déviation à D9 consignée, ClickUp intact. | Product Owner |
| F7 | Périmètre du profil d'épreuve | Durée et nombre d'items paramétrables ; valeurs par défaut identiques au seed (2 items) pour la démo. | PO + expert IA |
| F8 | Exclusion du diagnostic | Drapeau dédié sur l'exercice, distinct de `usage`, pour conserver l'information `les deux`. | PO + backend |
| F9 | Traçabilité de publication | Journal minimal `qui / quoi / quand / version`, sans copie du contenu pédagogique. | Backend + PO |
| F10 | Recette | `make check`, `npm run build`, `npm run test:e2e` et job Docker obligatoires avant chaque merge d'US. | QA + backend |

---

## 4. Plan US à compléter

| Ordre | US à attribuer | Fonctionnalité |
|---|---|---|
| P0 | `US-N00` | Validation D1–D9 et attribution des numéros |
| P1 | `US-N01` | Banque unique : migration `question` → `exercice` |
| P2 | `US-N02` | Contrat IA atomique et identifiant d'exercice |
| P3 | `US-N03` | Diagnostic comme profil d'épreuve |
| P4 | `US-N04` | Schémas stricts des formats d'exercice du MVP |
| P5 | `US-N05` | CRUD formateur des exercices + publication versionnée |
| P6 | `US-N06` | Interface formateur : banque d'exercices |
| P7 | `US-N07` | Cours, modules, leçons et types de leçon |
| P8 | `US-N08` | Interface formateur : cours, modules, leçons |
| P9 | `US-N09` | Champs HSK (`framework`, `level`, `show_pinyin`) |
| P10 | `US-N10` | Référencement audio `audio_ref` et contrôle des droits |
| P11 | `US-N11` | Seed de test marqué `donnees_test = true` |
| P12 | `US-N12` | Correction des productions libres par le formateur |
| P13 | `US-N13` | Administration des référentiels et validation/publication |
| P14 | `US-N14` | Recette, réversibilité et non-régression complète |

---

## 5. Checklist de passage au code

- [x] D1 à D9 portent `VALIDÉE` dans le registre, avec nom et date.
- [x] Les 5 points T1–T5 sont tranchés et reportés dans le plan de migration.
- [x] Les 10 points F1–F10 sont tranchés et reportés dans le chapitre 09.
- [x] Les 15 lignes du plan US portent les numéros de la série locale officielle `US-N00`…`US-N14` (déviation à D9
  consignée ; ClickUp non modifié).
- [x] Les co-signatures des responsables désignés (expert IA, référent, développeur IA, développeur backend) sont
  consignées par le chef de projet — 23/11/2026.
- [x] Le plan de migration est relu et accepté sous la même autorité — 23/11/2026.
- [ ] La source officielle HSK demandée en F5 est fournie avant toute affirmation dans le mémoire.
- [x] `docs/api/contrat-frontend.md` et `frontend/src/services/endpoints.ts` sont identifiés comme source de vérité pour chaque changement de contrat.
- [x] Aucune fusion n'est prévue par l'auteur des PR.

---

## 6. Ce qui se passe après validation

Une fois la checklist complète, et seulement à ce moment-là :

1. chaque US du plan devient une branche `feature/US-Nxx-<nom-court>` depuis `origin/develop` ;
2. les commits suivent `type(scope): description` ;
3. chaque PR est titrée `[US-Nxx] ...`, vise `develop`, passe la CI et reçoit 1 reviewer (2 pour l'IA) ;
4. la migration P1 est déployée atomiquement avec le contrat IA P2 (T2 : `id_question` conservé).

**Toutes les cases bloquantes sont cochées : le scénario est autorisé.** La source HSK (F5) reste à produire avant
toute affirmation dans le mémoire, mais ne bloque pas l'implémentation. Aucun code n'a été écrit lors de la production
de ces documents ; l'ouverture des branches US relève de la décision suivante du chef de projet.
