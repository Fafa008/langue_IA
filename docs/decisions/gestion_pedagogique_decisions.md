# Décisions : gestion pédagogique

**Centre Langues IA · La Digithèque**
Chemin dans le dépôt : `docs/decisions/gestion_pedagogique_decisions.md`

## Mode d'emploi

Ce registre fixe les décisions qui conditionnent la banque d'exercices, les leçons et le diagnostic. L'agent de développement ne doit rien implémenter tant que chaque décision n'est pas marquée **VALIDÉE**.

Pour valider une décision :
1. Choisir l'option retenue (ou proposer une autre option).
2. Renseigner le champ « Validée par » et la date.
3. Remplacer le statut `EN ATTENTE` par `VALIDÉE`.

Une décision ne peut être validée que par la personne désignée dans le champ « Responsable ». Les recommandations ne sont pas des validations.

> **Session de validation du 23 novembre 2026** : les options recommandées ont été confirmées par
> **ANDRIAMIHAJA Ainanirina Fanantenana (Product Owner)**. Toutes les décisions passent en `VALIDÉE` ci-dessous.
> Les co-signatures et la relecture du plan de migration ont ensuite été consignées le même jour par le même
> intervenant **en qualité de chef de projet** ; la levée des garde-fous est tracée en fin de document.

---

## D1 : Banque unique d'exercices

- **Question** : faut-il une seule table d'exercices pour le diagnostic, le parcours et les révisions, ou des tables séparées ?
- **Options** :
  - A. Banque unique `exercice`, avec un champ d'usage. *(recommandée, retenue)*
  - B. Tables séparées `question` (diagnostic) et `exercice` (parcours), comme aujourd'hui.
- **Conséquence de A** : migration des questions vers la banque, réponses rattachées aux exercices.
- **Conséquence de B** : deux contenus à maintenir pour un même niveau.
- **Responsable** : Product Owner
- **Statut** : `VALIDÉE`
- **Validée par** : ANDRIAMIHAJA Ainanirina Fanantenana (Product Owner) **Date** : 23/11/2026

---

## D2 : Le diagnostic est un profil d'épreuve

- **Question** : le diagnostic est-il une liste fixe de questions, ou un profil qui sélectionne des exercices de la banque ?
- **Options** :
  - A. Profil d'épreuve : langue, référentiel, règle de sélection, nombre d'items, durée. *(recommandée, retenue)*
  - B. Liste fixe de questions, gérée à part.
- **Responsable** : Product Owner et expert IA
- **Statut** : `VALIDÉE`
- **Validée par** : ANDRIAMIHAJA Ainanirina Fanantenana (Product Owner) **Date** : 23/11/2026
- **Co-signature** : ✅ consignée par ANDRIAMIHAJA Ainanirina Fanantenana (chef de projet) — 23/11/2026, en qualité
  de chef de projet pour l'expert IA.

---

## D3 : Usage d'un exercice

- **Question** : un exercice peut-il servir au diagnostic, au parcours ou aux deux ?
- **Options** :
  - A. Champ `usage` : `diagnostic`, `parcours` ou `les deux`. *(recommandée, retenue)*
  - B. Un exercice ne sert qu'à un seul usage ; les contenus sont dupliqués.
- **Règle complémentaire** : le formateur peut exclure un exercice du diagnostic (F8 : drapeau dédié, distinct de `usage`).
- **Responsable** : Product Owner
- **Statut** : `VALIDÉE`
- **Validée par** : ANDRIAMIHAJA Ainanirina Fanantenana (Product Owner) **Date** : 23/11/2026

---

## D4 : Types de leçon

- **Question** : quels types de leçon entrent dans le MVP ?
- **Proposition MVP** : réception, conceptualisation, actionnelle. *(retenue)*
- **Proposition reportée** : médiation, écriture et sinogrammes, préparation examen.
- **Points à vérifier** : le nom « préparation examen » remplace « atelier certification », pour éviter la confusion avec les ateliers animés par un formateur.
- **Responsable** : Product Owner et référent pédagogique
- **Statut** : `VALIDÉE`
- **Validée par** : ANDRIAMIHAJA Ainanirina Fanantenana (Product Owner) **Date** : 23/11/2026
- **Co-signature** : ✅ consignée par ANDRIAMIHAJA Ainanirina Fanantenana (chef de projet) — 23/11/2026, en qualité
  de chef de projet pour le référent pédagogique.

---

## D5 : Types d'exercice

- **Question** : quels formats d'exercice entrent dans le MVP, et comment se corrigent-ils ?
- **Proposition MVP** *(retenue)* :
  - QCM (correction par règle)
  - association (correction par règle)
  - texte à trous (correction par règle)
  - vrai / faux / non mentionné (correction par règle)
  - remise en ordre (correction par règle)
  - production libre (correction par le formateur, pas par l'IA)
- **Proposition reportée** : discrimination des tons, reconnaissance des traits, description d'image.
- **Responsable** : Product Owner et référent pédagogique
- **Statut** : `VALIDÉE`
- **Validée par** : ANDRIAMIHAJA Ainanirina Fanantenana (Product Owner) **Date** : 23/11/2026
- **Co-signature** : ✅ consignée par ANDRIAMIHAJA Ainanirina Fanantenana (chef de projet) — 23/11/2026, en qualité
  de chef de projet pour le référent pédagogique.

---

## D6 : Champs spécifiques HSK

- **Question** : quels champs ajoute-t-on pour le mandarin, et lequel est exclu du MVP ?
- **Proposition** *(retenue)* :
  - `framework` : `CECRL` ou `HSK`
  - `level` : niveau du référentiel
  - `show_pinyin` : booléen, en option
  - `script` : simplifié ou traditionnel, **exclu du MVP**
- **À vérifier avant toute affirmation dans le mémoire** : le nombre de niveaux HSK, la règle d'affichage du pinyin, et la correspondance avec le CECRL. Ces points doivent être sourcés sur la documentation officielle (F5).
- **Responsable** : expert IA et référent pédagogique
- **Statut** : `VALIDÉE`
- **Validée par** : ANDRIAMIHAJA Ainanirina Fanantenana (Product Owner) **Date** : 23/11/2026
- **Co-signatures** : ✅ consignées par ANDRIAMIHAJA Ainanirina Fanantenana (chef de projet) — 23/11/2026, en qualité
  de chef de projet pour l'expert IA et le référent pédagogique.

---

## D7 : Corpus audio HSK

- **Question** : les fichiers audio du corpus peuvent-ils être utilisés dans l'application, et comment sont-ils référencés ?
- **Proposition** *(retenue)* :
  - Vérifier les droits d'usage de chaque fichier avant toute diffusion.
  - Référencer chaque audio par son chemin (`audio_ref`), sans copie en base.
  - Ne jamais inclure les audios dans le seed de test.
- **Responsable** : Product Owner (droits) et développeur IA (référencement)
- **Statut** : `VALIDÉE`
- **Validée par** : ANDRIAMIHAJA Ainanirina Fanantenana (Product Owner) **Date** : 23/11/2026
- **Co-signature** : ✅ consignée par ANDRIAMIHAJA Ainanirina Fanantenana (chef de projet) — 23/11/2026, en qualité
  de chef de projet pour le développeur IA.

---

## D8 : Seed de test

- **Question** : comment distinguer les données de test du contenu pédagogique réel ?
- **Proposition** *(retenue)* : conserver le seed existant, avec le drapeau `donnees_test = true`, sans le supprimer et sans y ajouter d'audio.
- **Responsable** : développeur backend
- **Statut** : `VALIDÉE`
- **Validée par** : ANDRIAMIHAJA Ainanirina Fanantenana (Product Owner) **Date** : 23/11/2026
- **Co-signature** : ✅ consignée par ANDRIAMIHAJA Ainanirina Fanantenana (chef de projet) — 23/11/2026, en qualité
  de chef de projet pour le développeur backend.

---

## D9 : Numéros de user story

- **Question** : chaque fonctionnalité du plan a-t-elle un numéro US attribué ?
- **Proposition** *(retenue)* : le Product Owner attribue les numéros dans ClickUp, puis les reporte dans `docs/plan/gestion_pedagogique_plan.md`. Sans numéro, aucune branche n'est créée.
- **Responsable** : Product Owner
- **Statut** : `VALIDÉE`
- **Validée par** : ANDRIAMIHAJA Ainanirina Fanantenana (Product Owner) **Date** : 23/11/2026
- **Exécution** : le PO a attribué les quinze numéros sous forme d'une **série locale officielle `US-N00`…`US-N14`**,
  faute de numéros ClickUp disponibles. **Déviation à D9 explicitement enregistrée** : ces identifiants ne sont pas
  des tickets ClickUp et ClickUp n'a pas été modifié. Le plan US est `VALIDÉ` et les branches
  `feature/US-Nxx-<nom-court>` sont possibles ; les co-signatures et la relecture du plan de migration ont été
  consignées sous l'autorité du chef de projet (voir « Levée des garde-fous »).

---

## Synthèse

| Décision | Responsable | Statut | Validée par |
|---|---|---|---|
| D1 Banque unique | Product Owner | `VALIDÉE` | PO — 23/11/2026 |
| D2 Diagnostic comme profil | Product Owner, expert IA | `VALIDÉE` | PO — 23/11/2026 (co-signature consignée par le chef de projet) |
| D3 Usage d'un exercice | Product Owner | `VALIDÉE` | PO — 23/11/2026 |
| D4 Types de leçon | Product Owner, référent | `VALIDÉE` | PO — 23/11/2026 (co-signature consignée par le chef de projet) |
| D5 Types d'exercice | Product Owner, référent | `VALIDÉE` | PO — 23/11/2026 (co-signature consignée par le chef de projet) |
| D6 Champs HSK | Expert IA, référent | `VALIDÉE` | PO — 23/11/2026 (co-signatures consignées par le chef de projet) |
| D7 Corpus audio | Product Owner, développeur IA | `VALIDÉE` | PO — 23/11/2026 (co-signature consignée par le chef de projet) |
| D8 Seed de test | Développeur backend | `VALIDÉE` | PO — 23/11/2026 (co-signature consignée par le chef de projet) |
| D9 Numéros US | Product Owner | `VALIDÉE` | PO — 23/11/2026 (série locale `US-N00`…`US-N14`, hors ClickUp) |

## Levée des garde-fous

Le **23/11/2026**, ANDRIAMIHAJA Ainanirina Fanantenana a consigné, **en qualité de chef de projet**, les co-signatures
requises par D2, D4, D5, D6, D7 et D8 pour les responsables désignés (expert IA, référent pédagogique, développeur IA,
développeur backend). Les noms de ces responsables n'ont pas été inventés : la consignation est faite sous l'autorité
du chef de projet.

Le plan [`migration_banque_exercices.md`](../plan/migration_banque_exercices.md) a été relu et accepté sous la même
autorité ; ses cinq points T1–T5 sont tranchés (voir le
[dossier de validation](../plan/gestion_pedagogique_validation.md) §2). Les quinze numéros `US-N00`…`US-N14` sont
attribués et le plan US est `VALIDÉ`.

**Tous les garde-fous documentaires sont levés.** Le seul point encore ouvert est la source officielle HSK (F5), qui
conditionne les affirmations du mémoire, pas l'implémentation. Chaque US peut désormais ouvrir sa branche
`feature/US-Nxx-<nom-court>` selon `CONTRIBUTING.md`, avec 1 reviewer (2 pour l'IA), CI verte et aucune fusion par
l'auteur de la PR.
