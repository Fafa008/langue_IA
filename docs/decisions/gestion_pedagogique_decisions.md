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

---

## D1 : Banque unique d'exercices

- **Question** : faut-il une seule table d'exercices pour le diagnostic, le parcours et les révisions, ou des tables séparées ?
- **Options** :
  - A. Banque unique `exercice`, avec un champ d'usage. *(recommandée)*
  - B. Tables séparées `question` (diagnostic) et `exercice` (parcours), comme aujourd'hui.
- **Conséquence de A** : migration des questions vers la banque, réponses rattachées aux exercices.
- **Conséquence de B** : deux contenus à maintenir pour un même niveau.
- **Responsable** : Product Owner
- **Statut** : `EN ATTENTE`
- **Validée par** : ____________ **Date** : ____________

---

## D2 : Le diagnostic est un profil d'épreuve

- **Question** : le diagnostic est-il une liste fixe de questions, ou un profil qui sélectionne des exercices de la banque ?
- **Options** :
  - A. Profil d'épreuve : langue, référentiel, règle de sélection, nombre d'items, durée. *(recommandée)*
  - B. Liste fixe de questions, gérée à part.
- **Responsable** : Product Owner et expert IA
- **Statut** : `EN ATTENTE`
- **Validée par** : ____________ **Date** : ____________

---

## D3 : Usage d'un exercice

- **Question** : un exercice peut-il servir au diagnostic, au parcours ou aux deux ?
- **Options** :
  - A. Champ `usage` : `diagnostic`, `parcours` ou `les deux`. *(recommandée)*
  - B. Un exercice ne sert qu'à un seul usage ; les contenus sont dupliqués.
- **Règle complémentaire** : le formateur peut exclure un exercice du diagnostic.
- **Responsable** : Product Owner
- **Statut** : `EN ATTENTE`
- **Validée par** : ____________ **Date** : ____________

---

## D4 : Types de leçon

- **Question** : quels types de leçon entrent dans le MVP ?
- **Proposition MVP** : réception, conceptualisation, actionnelle.
- **Proposition reportée** : médiation, écriture et sinogrammes, préparation examen.
- **Points à vérifier** : le nom « préparation examen » remplace « atelier certification », pour éviter la confusion avec les ateliers animés par un formateur.
- **Responsable** : Product Owner et référent pédagogique
- **Statut** : `EN ATTENTE`
- **Validée par** : ____________ **Date** : ____________

---

## D5 : Types d'exercice

- **Question** : quels formats d'exercice entrent dans le MVP, et comment se corrigent-ils ?
- **Proposition MVP** :
  - QCM (correction par règle)
  - association (correction par règle)
  - texte à trous (correction par règle)
  - vrai / faux / non mentionné (correction par règle)
  - remise en ordre (correction par règle)
  - production libre (correction par le formateur, pas par l'IA)
- **Proposition reportée** : discrimination des tons, reconnaissance des traits, description d'image.
- **Responsable** : Product Owner et référent pédagogique
- **Statut** : `EN ATTENTE`
- **Validée par** : ____________ **Date** : ____________

---

## D6 : Champs spécifiques HSK

- **Question** : quels champs ajoute-t-on pour le mandarin, et lequel est exclu du MVP ?
- **Proposition** :
  - `framework` : `CECRL` ou `HSK`
  - `level` : niveau du référentiel
  - `show_pinyin` : booléen, en option
  - `script` : simplifié ou traditionnel, **exclu du MVP**
- **À vérifier avant toute affirmation dans le mémoire** : le nombre de niveaux HSK, la règle d'affichage du pinyin, et la correspondance avec le CECRL. Ces points doivent être sourcés sur la documentation officielle.
- **Responsable** : expert IA et référent pédagogique
- **Statut** : `EN ATTENTE`
- **Validée par** : ____________ **Date** : ____________

---

## D7 : Corpus audio HSK

- **Question** : les fichiers audio du corpus peuvent-ils être utilisés dans l'application, et comment sont-ils référencés ?
- **Proposition** :
  - Vérifier les droits d'usage de chaque fichier avant toute diffusion.
  - Référencer chaque audio par son chemin (`audio_ref`), sans copie en base.
  - Ne jamais inclure les audios dans le seed de test.
- **Responsable** : Product Owner (droits) et développeur IA (référencement)
- **Statut** : `EN ATTENTE`
- **Validée par** : ____________ **Date** : ____________

---

## D8 : Seed de test

- **Question** : comment distinguer les données de test du contenu pédagogique réel ?
- **Proposition** : conserver le seed existant, avec le drapeau `donnees_test = true`, sans le supprimer et sans y ajouter d'audio.
- **Responsable** : développeur backend
- **Statut** : `EN ATTENTE`
- **Validée par** : ____________ **Date** : ____________

---

## D9 : Numéros de user story

- **Question** : chaque fonctionnalité du plan a-t-elle un numéro US attribué ?
- **Proposition** : le Product Owner attribue les numéros dans ClickUp, puis les reporte dans `docs/plan/gestion_pedagogique_plan.md`. Sans numéro, aucune branche n'est créée.
- **Responsable** : Product Owner
- **Statut** : `EN ATTENTE`
- **Validée par** : ____________ **Date** : ____________

---

## Synthèse

| Décision | Responsable | Statut |
|---|---|---|
| D1 Banque unique | Product Owner | EN ATTENTE |
| D2 Diagnostic comme profil | Product Owner, expert IA | EN ATTENTE |
| D3 Usage d'un exercice | Product Owner | EN ATTENTE |
| D4 Types de leçon | Product Owner, référent | EN ATTENTE |
| D5 Types d'exercice | Product Owner, référent | EN ATTENTE |
| D6 Champs HSK | Expert IA, référent | EN ATTENTE |
| D7 Corpus audio | Product Owner, développeur IA | EN ATTENTE |
| D8 Seed de test | Développeur backend | EN ATTENTE |
| D9 Numéros US | Product Owner | EN ATTENTE |

Tant que la synthèse ne contient que `EN ATTENTE`, aucune implémentation n'est autorisée.
