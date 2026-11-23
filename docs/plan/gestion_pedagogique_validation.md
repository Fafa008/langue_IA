# Dossier de validation — Gestion pédagogique

> **Centre Langues IA · La Digithèque** · 23 novembre 2026
>
> **Validations enregistrées le 23/11/2026** par **ANDRIAMIHAJA Ainanirina Fanantenana (Product Owner)** : les options
> recommandées pour D1–D9, T1–T5 et F1–F10 sont retenues et reportées ci-dessous. Le registre officiel reste
> `docs/decisions/gestion_pedagogique_decisions.md`, où D1–D9 portent désormais `VALIDÉE`.
>
> **Trois points restent ouverts** et bloquent la première branche `feature/US…` : les 15 numéros US à attribuer,
> les co-signatures des responsables autres que le PO, et la relecture du plan de migration par le backend et l'expert
> IA. Aucune tâche ClickUp n'a été modifiée.

## Sources

- `docs/decisions/gestion_pedagogique_decisions.md` — D1 à D9, validées le 23/11/2026.
- [`gestion_pedagogique_plan.md`](gestion_pedagogique_plan.md) — plan US encore `BROUILLON` (numéros à attribuer).
- [`migration_banque_exercices.md`](migration_banque_exercices.md) — plan technique, §7 « Validation attendue ».
- [`../fonctionnalites/09-gestion-pedagogique.md`](../fonctionnalites/09-gestion-pedagogique.md) — §10 « Questions ouvertes ».
- [`../audit/gestion_pedagogique_exec_audit.md`](../audit/gestion_pedagogique_exec_audit.md) — faits vérifiés dans le code.

---

## 1. Décisions D1–D9

| ID | Option retenue | Responsable | Validée par / date |
|---|---|---|---|
| **D1** | Banque unique `exercice` avec `usage` ; suppression de `question` après migration. | Product Owner | PO — 23/11/2026 |
| **D2** | Diagnostic = profil d'épreuve (langue, référentiel, règle de sélection, nombre d'items, durée). | PO + expert IA | PO — 23/11/2026 (co-signature IA à recueillir) |
| **D3** | `usage = diagnostic / parcours / les deux` ; le formateur peut exclure un exercice du diagnostic. | Product Owner | PO — 23/11/2026 |
| **D4** | MVP : réception, conceptualisation, actionnelle. Report : médiation, écriture/sinogrammes, préparation examen. | PO + référent | PO — 23/11/2026 (co-signature référent à recueillir) |
| **D5** | MVP : QCM, association, texte à trous, vrai/faux/non mentionné, remise en ordre, production libre corrigée par le formateur. | PO + référent | PO — 23/11/2026 (co-signature référent à recueillir) |
| **D6** | `framework`, `level`, `show_pinyin` en option ; `script` exclu du MVP. | Expert IA + référent | PO — 23/11/2026 (co-signatures IA et référent à recueillir) |
| **D7** | Droits vérifiés par fichier ; référence par `audio_ref` ; aucun audio dans le seed ni en base. | PO (droits) + dev IA | PO — 23/11/2026 (co-signature dev IA à recueillir) |
| **D8** | Seed conservé, `donnees_test = true`, sans audio ajouté. | Développeur backend | PO — 23/11/2026 (co-signature dev backend à recueillir) |
| **D9** | PO attribue les numéros dans ClickUp puis les reporte dans le plan US. | Product Owner | PO — 23/11/2026 (**numéros encore à fournir**) |

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
| F6 | Numéros US | Remplacer les 15 emplacements `US-??` du plan US par les numéros ClickUp. **Action encore à produire.** | Product Owner |
| F7 | Périmètre du profil d'épreuve | Durée et nombre d'items paramétrables ; valeurs par défaut identiques au seed (2 items) pour la démo. | PO + expert IA |
| F8 | Exclusion du diagnostic | Drapeau dédié sur l'exercice, distinct de `usage`, pour conserver l'information `les deux`. | PO + backend |
| F9 | Traçabilité de publication | Journal minimal `qui / quoi / quand / version`, sans copie du contenu pédagogique. | Backend + PO |
| F10 | Recette | `make check`, `npm run build`, `npm run test:e2e` et job Docker obligatoires avant chaque merge d'US. | QA + backend |

---

## 4. Plan US à compléter

| Ordre | US à attribuer | Fonctionnalité |
|---|---|---|
| P0 | `US-??` | Validation D1–D9 et attribution des numéros |
| P1 | `US-??` | Banque unique : migration `question` → `exercice` |
| P2 | `US-??` | Contrat IA atomique et identifiant d'exercice |
| P3 | `US-??` | Diagnostic comme profil d'épreuve |
| P4 | `US-??` | Schémas stricts des formats d'exercice du MVP |
| P5 | `US-??` | CRUD formateur des exercices + publication versionnée |
| P6 | `US-??` | Interface formateur : banque d'exercices |
| P7 | `US-??` | Cours, modules, leçons et types de leçon |
| P8 | `US-??` | Interface formateur : cours, modules, leçons |
| P9 | `US-??` | Champs HSK (`framework`, `level`, `show_pinyin`) |
| P10 | `US-??` | Référencement audio `audio_ref` et contrôle des droits |
| P11 | `US-??` | Seed de test marqué `donnees_test = true` |
| P12 | `US-??` | Correction des productions libres par le formateur |
| P13 | `US-??` | Administration des référentiels et validation/publication |
| P14 | `US-??` | Recette, réversibilité et non-régression complète |

---

## 5. Checklist de passage au code

- [x] D1 à D9 portent `VALIDÉE` dans le registre, avec nom et date.
- [x] Les 5 points T1–T5 sont tranchés et reportés dans le plan de migration.
- [x] Les 10 points F1–F10 sont tranchés et reportés dans le chapitre 09.
- [ ] Les 15 numéros `US-??` du plan US sont remplacés par les numéros ClickUp.
- [ ] Les co-signatures des responsables désignés (expert IA, référent, développeur IA, développeur backend) sont consignées.
- [ ] Le plan de migration est relu par le développeur backend et l'expert IA.
- [ ] La source officielle HSK demandée en F5 est fournie avant toute affirmation dans le mémoire.
- [x] `docs/api/contrat-frontend.md` et `frontend/src/services/endpoints.ts` sont identifiés comme source de vérité pour chaque changement de contrat.
- [x] Aucune fusion n'est prévue par l'auteur des PR.

---

## 6. Ce qui se passe après validation

Une fois la checklist complète, et seulement à ce moment-là :

1. chaque US du plan devient une branche `feature/US<numéro>-<nom-court>` depuis `origin/develop` ;
2. les commits suivent `type(scope): description` ;
3. chaque PR est titrée `[US-XX] ...`, vise `develop`, passe la CI et reçoit 1 reviewer (2 pour l'IA) ;
4. la migration P1 est déployée atomiquement avec le contrat IA P2 (T2 : `id_question` conservé).

**Les choix sont validés, mais les cases non cochées ci-dessus bloquent encore ce scénario. Aucun code n'est écrit aujourd'hui.**
