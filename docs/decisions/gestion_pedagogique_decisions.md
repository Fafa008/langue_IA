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
> Les conditions résiduelles qui bloquent encore l'implémentation sont listées en fin de document : elles ne remettent
> pas en cause les choix, mais doivent être levées avant la création de la première branche `feature/US…`.

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
- **Co-signature** : expert IA — non recueillie à ce jour ; à consigner dans le dossier
  [`gestion_pedagogique_validation.md`](../plan/gestion_pedagogique_validation.md).

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
- **Co-signature** : référent pédagogique — non recueillie à ce jour ; à consigner dans le dossier de validation.

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
- **Co-signature** : référent pédagogique — non recueillie à ce jour ; à consigner dans le dossier de validation.

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
- **Co-signatures** : expert IA et référent pédagogique — non recueillies à ce jour ; à consigner dans le dossier de validation.

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
- **Co-signature** : développeur IA — non recueillie à ce jour ; à consigner dans le dossier de validation.

---

## D8 : Seed de test

- **Question** : comment distinguer les données de test du contenu pédagogique réel ?
- **Proposition** *(retenue)* : conserver le seed existant, avec le drapeau `donnees_test = true`, sans le supprimer et sans y ajouter d'audio.
- **Responsable** : développeur backend
- **Statut** : `VALIDÉE`
- **Validée par** : ANDRIAMIHAJA Ainanirina Fanantenana (Product Owner) **Date** : 23/11/2026
- **Co-signature** : développeur backend — non recueillie à ce jour ; à consigner dans le dossier de validation.

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
  `feature/US-Nxx-<nom-court>` sont possibles, sous réserve des deux autres conditions résiduelles ci-dessous.

---

## Synthèse

| Décision | Responsable | Statut | Validée par |
|---|---|---|---|
| D1 Banque unique | Product Owner | `VALIDÉE` | PO — 23/11/2026 |
| D2 Diagnostic comme profil | Product Owner, expert IA | `VALIDÉE` | PO — 23/11/2026 (co-signature IA à recueillir) |
| D3 Usage d'un exercice | Product Owner | `VALIDÉE` | PO — 23/11/2026 |
| D4 Types de leçon | Product Owner, référent | `VALIDÉE` | PO — 23/11/2026 (co-signature référent à recueillir) |
| D5 Types d'exercice | Product Owner, référent | `VALIDÉE` | PO — 23/11/2026 (co-signature référent à recueillir) |
| D6 Champs HSK | Expert IA, référent | `VALIDÉE` | PO — 23/11/2026 (co-signatures IA et référent à recueillir) |
| D7 Corpus audio | Product Owner, développeur IA | `VALIDÉE` | PO — 23/11/2026 (co-signature dev IA à recueillir) |
| D8 Seed de test | Développeur backend | `VALIDÉE` | PO — 23/11/2026 (co-signature dev backend à recueillir) |
| D9 Numéros US | Product Owner | `VALIDÉE` | PO — 23/11/2026 (série locale `US-N00`…`US-N14`, hors ClickUp) |

## Conditions résiduelles avant implémentation

Les choix sont faits et les numéros attribués. **Deux points restent ouverts** et bloquent encore la première branche :

1. **Co-signatures** : D2, D4, D5, D6, D7 et D8 désignent plusieurs responsables. Le PO a confirmé les recommandations
   en son nom ; les co-signatures des autres responsables ne sont pas encore consignées.
2. **Plan de migration** : les cinq points T1–T5 ont été tranchés dans le
   [dossier de validation](../plan/gestion_pedagogique_validation.md), mais le plan
   [`migration_banque_exercices.md`](../plan/migration_banque_exercices.md) doit encore être relu par le développeur
   backend et l'expert IA avant la révision Alembic.

Le point « source officielle HSK » (F5) n'est pas bloquant pour le code : il conditionne seulement les affirmations
du mémoire. Tant que les deux points ci-dessus ne sont pas levés, aucun code n'est écrit.
