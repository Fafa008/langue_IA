# Dossier de validation — Gestion pédagogique

> **Centre Langues IA · La Digithèque** · 23 novembre 2026
>
> **Ce document ne valide rien.** Il rassemble les options recommandées et les points encore ouverts afin que les
> responsables désignés puissent signer rapidement. Les statuts officiels restent ceux du registre
> `docs/decisions/gestion_pedagogique_decisions.md` : **D1 à D9 = `EN ATTENTE`**. Aucune tâche ClickUp n'a été
> modifiée et aucun numéro US n'a été attribué.

## Sources

- `docs/decisions/gestion_pedagogique_decisions.md` — D1 à D9.
- [`gestion_pedagogique_plan.md`](gestion_pedagogique_plan.md) — plan US `BROUILLON`.
- [`migration_banque_exercices.md`](migration_banque_exercices.md) — plan technique, §7 « Validation attendue ».
- [`../fonctionnalites/09-gestion-pedagogique.md`](../fonctionnalites/09-gestion-pedagogique.md) — §10 « Questions ouvertes ».
- [`../audit/gestion_pedagogique_exec_audit.md`](../audit/gestion_pedagogique_exec_audit.md) — faits vérifiés dans le code.

---

## 1. Décisions D1–D9 à signer

Les options recommandées sont reprises telles quelles des documents de référence. Elles ne deviennent opposables
qu'après signature.

| ID | Option recommandée | Responsable | À préciser si refus | Validée par / date |
|---|---|---|---|---|
| **D1** | Banque unique `exercice` avec `usage` ; suppression de `question` après migration. | Product Owner | Conséquence : deux catalogues à maintenir si rejet. | ____________ / __________ |
| **D2** | Diagnostic = profil d'épreuve (langue, référentiel, règle de sélection, nombre d'items, durée). | PO + expert IA | Règle de sélection et valeurs par défaut à fournir si rejet. | ____________ / __________ |
| **D3** | `usage = diagnostic / parcours / les deux` ; le formateur peut exclure un exercice du diagnostic. | Product Owner | Modalité d'exclusion (champ dédié ou valeur d'usage) à trancher. | ____________ / __________ |
| **D4** | MVP : réception, conceptualisation, actionnelle. Report : médiation, écriture/sinogrammes, préparation examen. | PO + référent | Confirmer le libellé « préparation examen ». | ____________ / __________ |
| **D5** | MVP : QCM, association, texte à trous, vrai/faux/non mentionné, remise en ordre, production libre corrigée par le formateur. | PO + référent | Schémas `contenu` à valider format par format. | ____________ / __________ |
| **D6** | `framework`, `level`, `show_pinyin` en option ; `script` exclu du MVP. | Expert IA + référent | **Fournir les sources officielles** : niveaux HSK, pinyin, correspondance CECRL. | ____________ / __________ |
| **D7** | Droits vérifiés par fichier ; référence par `audio_ref` ; aucun audio dans le seed ni en base. | PO (droits) + dev IA | Procédure de vérification des droits à désigner. | ____________ / __________ |
| **D8** | Seed conservé, `donnees_test = true`, sans audio ajouté. | Développeur backend | Règle de rejeu sur base déjà peuplée (`make reset`) à confirmer. | ____________ / __________ |
| **D9** | PO attribue les numéros dans ClickUp puis les reporte dans le plan US. | Product Owner | **Aucune branche `feature/US…` ne peut être créée avant cela.** | ____________ / __________ |

> Signature = choix de l'option **et** nom + date. Une recommandation seule ne débloque rien.

---

## 2. Points techniques à trancher (plan de migration)

| # | Point ouvert | Recommandation | Responsable | Décision retenue |
|---|---|---|---|---|
| T1 | Identifiant primaire de la banque | **Option A** : nouveaux `id_exercice` + table de correspondance conservée jusqu'à validation des données. | Développeur backend | ____________ |
| T2 | Identifiant transmis à l'IA | Conserver `id_question` pendant la migration de schéma ; évolution ultérieure distincte si le PO la souhaite. | Expert IA + backend | ____________ |
| T3 | Mapping de l'audio historique | `prononciation` (production orale de l'apprenant), à confirmer par le référent. | Référent pédagogique | ____________ |
| T4 | Valeur de `difficulte` pour C2 | **3 (neutre)** pour toutes les questions migrées ; `level` porte déjà le niveau réel. La contrainte DB reste `1..5`. | Référent + backend | ____________ |
| T5 | Diagnostic en cours | Fenêtre de maintenance courte + déploiement atomique backend/IA/frontend ; double lecture uniquement si la disponibilité est exigée. | PO + DevOps | ____________ |

---

## 3. Points fonctionnels à trancher (chapitre 09)

| # | Point ouvert | Recommandation | Responsable | Décision retenue |
|---|---|---|---|---|
| F1 | Permissions du formateur | Créer `pedagogy:content:write` pour créer/modifier ; `pedagogy:content:publish` pour publier. Ne jamais modifier les codes de rôles existants. | PO + backend | ____________ |
| F2 | Qui valide la publication | Administrateur pour les référentiels **et** la publication ; le formateur crée et propose. | PO | ____________ |
| F3 | Hiérarchie cours / module / leçon | `Cours (langue + référentiel) → Module (numérotation stable) → Leçon (type + séquence d'exercices)`. | Référent + PO | ____________ |
| F4 | Circuit de correction libre | File de réponses à corriger dans l'espace formateur, note + commentaire persistés, notification minimale, aucune note IA. | Référent + frontend | ____________ |
| F5 | Sources HSK | Lien officiel à fournir avant toute affirmation dans le mémoire ; sans source, le chapitre reste « à vérifier ». | Expert IA | ____________ |
| F6 | Numéros US | Remplacer les 15 emplacements `US-??` du plan US par les numéros ClickUp. | Product Owner | ____________ |
| F7 | Périmètre du profil d'épreuve | Durée et nombre d'items paramétrables, mais valeurs par défaut identiques au seed (2 items) pour la démo. | PO + expert IA | ____________ |
| F8 | Exclusion du diagnostic | Un simple drapeau sur l'exercice, distinct de `usage`, pour ne pas perdre l'information d'usage `les deux`. | PO + backend | ____________ |
| F9 | Traçabilité de publication | Journal minimal `qui / quoi / quand / version`, sans contenu pédagogique copié. | Backend + PO | ____________ |
| F10 | Recette | `make check`, `npm run build`, `npm run test:e2e` et job Docker obligatoires avant chaque merge d'US. | QA + backend | ____________ |

---

## 4. Plan US à compléter

Le plan contient déjà une US par fonctionnalité. Il reste à remplacer chaque `US-??` par le numéro attribué.

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

Toutes les cases doivent être cochées avant la première branche `feature/US…`.

- [ ] D1 à D9 portent `VALIDÉE` dans le registre, avec nom et date.
- [ ] Les 5 points T1–T5 sont tranchés et reportés dans le plan de migration.
- [ ] Les 10 points F1–F10 sont tranchés et reportés dans le chapitre 09.
- [ ] Les 15 numéros `US-??` du plan US sont remplacés par les numéros ClickUp.
- [ ] Le plan de migration est validé par le développeur backend et l'expert IA.
- [ ] `docs/api/contrat-frontend.md` et `frontend/src/services/endpoints.ts` sont identifiés comme source de vérité pour chaque changement de contrat.
- [ ] Aucune fusion n'est prévue par l'auteur des PR.

---

## 6. Ce qui se passe après validation

Une fois la checklist complète, et seulement à ce moment-là :

1. chaque US du plan devient une branche `feature/US<numéro>-<nom-court>` depuis `origin/develop` ;
2. les commits suivent `type(scope): description` ;
3. chaque PR est titrée `[US-XX] ...`, vise `develop`, passe la CI et reçoit 1 reviewer (2 pour l'IA) ;
4. la migration P1 est déployée atomiquement avec le contrat IA P2.

**Rien de cela n'est autorisé aujourd'hui.**
