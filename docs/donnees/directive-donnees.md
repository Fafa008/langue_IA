# Directive de production et de gouvernance des données

> **Statut** : proposition à valider — version 1.0 — 13 novembre 2026
> **Public** : équipe pédagogique, développeurs backend et IA, administrateur
> **Portée** : tout le cycle de vie des données, du référentiel au jeu d'évaluation de l'IA
> **Documents liés** : [`README.md`](README.md) (état des données),
> [`modele-questions.csv`](modele-questions.csv), [`exemple-questions.jsonl`](exemple-questions.jsonl)

---

## 1. Objet

Cette directive fixe **qui produit quelle donnée, dans quel format, avec quelles règles de
qualité, et comment elle entre dans le système**. Elle s'appuie sur le code existant : chaque
règle est justifiée par une contrainte réelle (schéma, scoring, contrat IA), pas par une
intention.

Elle couvre six jeux de données :

| # | Jeu de données | Propriétaire | Emplacement cible |
| --- | --- | --- | --- |
| D1 | Référentiel (langues, niveaux, formules, rôles) | Administrateur | `backend/app/seed.py` |
| D2 | Banque de questions du diagnostic | Équipe pédagogique | `backend/data/questions/*.jsonl` (à créer) |
| D3 | Corpus documentaire RAG | Référent IA | `ia-service/corpus/` (hors Git pour les textes) |
| D4 | Jeu d'évaluation de l'agent Diagnostic | Référent IA + pédagogue | `ia-service/tests/data/diagnostic/jeu_cas.json` |
| D5 | Données de démonstration | Développeur | `backend/app/seed.py` + `frontend/src/mocks/` |
| D6 | Données personnelles des apprenants | Responsable de traitement | PostgreSQL + `media_data` |

---

## 2. Principes directeurs

1. **Le code est la loi, la donnée s'y conforme.** Une donnée qui ne respecte pas le schéma ou
   les contraintes est refusée, pas adaptée à la main.
2. **Une donnée = une source de vérité.** Pas de copie divergente entre le seed, les mocks et la
   base.
3. **Tout est traçable.** Chaque question a un code stable, un auteur, une date et un statut de
   revue.
4. **Les données de production ne servent jamais de données de test.** Tests et démos n'utilisent
   que des données fictives.
5. **Pas de données tierces sans droits clarifiés.** Le corpus CECRL reste hors dépôt.
6. **Toute donnée a une durée de vie.** Conservation, purge et sauvegarde sont définies, pas
   implicites.

---

## 3. Règles communes à tous les jeux

| Règle | Norme |
| --- | --- |
| Encodage | UTF-8 (BOM toléré pour les CSV ouverts dans Excel) |
| Langue des contenus | Français pour les libellés, langue cible pour les énoncés |
| Identifiants | Stables, jamais réutilisés, jamais modifiés après publication |
| Nommage des fichiers | `{jeu}-{version}.{ext}` — ex. `questions-en-2026.11.jsonl` |
| Versionnement | Semver `MAJEUR.MINEUR.CORRECTIF` ; tout changement = nouvelle version |
| Revue | Aucune donnée « validée » sans relecture pédagogique **et** contrôle technique |
| Sources | Toute donnée externe documente sa source, sa licence et son empreinte SHA256 |
| Données personnelles | Interdites dans les jeux D2, D3, D4, D5 |

---

## 4. D1 — Référentiel

**Contenu imposé** (déjà en place, ne pas diverger) :

- 5 langues : `fr`, `en`, `zh`, `it`, `de` ;
- 12 niveaux : 6 CECRL (`A1`→`C2`) + 6 HSK (`HSK 1`→`HSK 6`) ;
- association : `zh` → HSK, les autres → CECRL ;
- 3 formules : Simple, Luxe, Premium ;
- 3 rôles, 9 permissions.

**Règles** :

- Les codes d'énumération (`SMALLINT`) sont **figés** : on ajoute, on ne modifie jamais.
- Un niveau ne peut être supprimé s'il est utilisé par une question (`ON DELETE RESTRICT`).
- Toute évolution du référentiel passe par une migration Alembic, jamais par une modification
  manuelle en base.

---

## 5. D2 — Banque de questions du diagnostic

C'est le jeu critique : sans lui, le test est vide pour trois langues sur cinq.

### 5.1 Volume cible

Le test pose **toutes les questions à choix du niveau sélectionné** (le backend n'est pas
adaptatif). La durée annoncée est de 15 minutes.

| Paramètre | Valeur |
| --- | --- |
| Questions par niveau | **12** (minimum 8, maximum 15) |
| Niveaux par langue | 6 |
| Total par langue | 72 |
| Total pour 5 langues | **360** |

Répartition recommandée par niveau : **5 grammaire, 4 lecture, 3 écoute** (toutes en `choix`).

Priorité de production : `en` et `fr` (déjà 35 questions), puis `zh`, puis `it` et `de`.

### 5.2 Modèle de données imposé

Chaque question doit remplir exactement les champs de la table `question` :

| Champ | Obligatoire | Règle |
| --- | --- | --- |
| `code` | **à créer** | unique, ex. `en-a1-gra-001` |
| `id_langue` | oui | code existant (`fr`, `en`, `zh`, `it`, `de`) |
| `id_niveau` | oui | niveau **ouvert** pour cette langue |
| `competence` | oui | parmi les 5 valeurs autorisées (voir 5.3) |
| `type_reponse` | oui | `choix` en phase 1 |
| `enonce` | oui | texte brut, sans HTML |
| `choix` | oui si `choix` | 2 à 4 propositions, **toutes différentes** |
| `reponse_correcte` | oui si `choix` | doit appartenir à `choix` |
| `support` | non | texte de lecture, ≤ 600 caractères |
| `audio_texte` | non | transcription pour la synthèse vocale, ≤ 600 caractères |
| `audio_url` | non | **interdit en phase 1** (pas de stockage audio) |

### 5.3 Compétences autorisées

Le contrat IA (`CompetenceIA`) et le frontend (`CompetenceTest`) n'acceptent que :

```text
grammaire | lecture | ecoute | ecrit | oral
```

**Interdiction** : ne pas utiliser `vocabulaire` comme compétence de question. Le code actuel ne
le reconnaît pas : `analyse_diagnostic._ALIAS_COMPETENCES` ignore ces réponses, et le frontend
les range par défaut dans l'étape « Grammaire et lexique ». Une question lexicale doit donc être
taguée `lecture` ou `grammaire`.

> Nuance : `vocabulaire` reste un **domaine de faiblesse en sortie** (`DomaineFaiblesseIA`) que
> le LLM peut produire. C'est une valeur de résultat, pas une valeur d'entrée.

### 5.4 Règles de rédaction

**Obligatoire**

- Un seul point testé par question.
- Une seule bonne réponse, sans ambiguïté.
- Propositions de longueur comparable, plausibles, sans indice grammatical.
- Pas de « toutes les réponses ci-dessus ».
- Accents et ponctuation corrects (français ou langue cible).
- Consigne explicite pour l'écoute : la réponse ne doit pas être lisible dans l'énoncé.

**Interdit**

- La bonne réponse dans l'énoncé ou dans `support`.
- Une proposition qui contient la réponse d'une autre question.
- Du contenu sensible (politique, religion, données personnelles).
- Un énoncé modifié « pour corriger une faute » : le seed déduplique sur
  `(langue, niveau, énoncé)`, donc une correction crée un **doublon**. Il faut passer par le
  `code`.

### 5.5 Format de livraison

**CSV pour l'équipe pédagogique** (une ligne = une question, index 1-based) :

```csv
code,langue,niveau,competence,type_reponse,enonce,choix_1,choix_2,choix_3,choix_4,bonne_reponse,support,audio_texte,source,auteur,date_revue,statut
en-a1-gra-001,en,A1,grammaire,choix,She ___ a student.,is,are,am,be,1,,,,2026-11-13,valide
```

Le modèle vierge est fourni dans [`modele-questions.csv`](modele-questions.csv).

**JSONL pour l'intégration** (une ligne = un objet, `bonne_reponse` = texte exact) :

```json
{"code":"en-a1-gra-001","langue":"en","niveau":"A1","competence":"grammaire","type_reponse":"choix","enonce":"She ___ a student.","choix":["is","are","am","be"],"bonne_reponse":"is","support":null,"audio_texte":null}
```

Un exemple complet est fourni dans [`exemple-questions.jsonl`](exemple-questions.jsonl).

Règle anti-erreur : en CSV l'index est **1-based** (pour les humains), en JSONL la réponse est
**le texte exact** (pour la machine). Ne jamais mélanger les deux conventions.

### 5.6 Procédure d'intégration

1. L'équipe pédagogique dépose le CSV dans [`livraisons/`](livraisons/README.md) (dossier
   versionné).
2. Le développeur convertit en JSONL avec un script de conversion.
3. Le script de validation vérifie toutes les règles ci-dessous ; en cas d'erreur, **rien n'est
   importé**.
4. Le JSONL est versionné dans `backend/data/questions/`.
5. L'import en base se fait par un script dédié (à créer) ou, en attendant, par extension de
   `seed_diagnostic.py`.
6. Les tests passent, la PR est ouverte, la livraison est datée dans le changelog.

### 5.7 Critères d'acceptation (bloquants)

- [ ] `code` unique sur tout le jeu
- [ ] langue et niveau existants, niveau ouvert pour la langue
- [ ] compétence parmi les 5 autorisées
- [ ] `type_reponse = choix`, 2 à 4 propositions non vides et distinctes
- [ ] `reponse_correcte` présente dans `choix`
- [ ] aucun doublon `(langue, niveau, enonce)`
- [ ] au moins 8 questions par niveau, 12 recommandé
- [ ] aucune fuite de la réponse dans l'énoncé ou le support
- [ ] tests existants verts : `test_chaque_niveau_cecrl_a_au_moins_deux_questions`,
      `test_les_questions_sont_corrigeables_par_le_scoring`
- [ ] nouveau test : `test_competences_dans_le_referentiel_ia`
- [ ] seed relancé deux fois : aucun doublon (idempotence)

---

## 6. D3 — Corpus documentaire RAG

**Règles**

- Les textes officiels du Conseil de l'Europe ne sont **jamais** commités, ni dans une image
  Docker, ni dans un artefact de build.
- Seul `manifeste.json` est versionné : version, source, licence, langues, niveaux, comptages,
  empreintes SHA256.
- Le corpus se génère hors dépôt avec `scripts/ingestion_cecrl.py`, qui refuse toute sortie dans
  le dépôt.
- Le RAG reste **désactivé par défaut** (`RAG_CORPUS_ACTIF=false`) ; un corpus absent ou
  incohérent ne bloque pas le démarrage.
- Toute nouvelle version du corpus met à jour le manifeste et son empreinte.

**Extension recommandée** : le corpus actuel ne couvre que l'anglais (`A1`→`B2`, 325
descripteurs). La plateforme étant francophone, produire le corpus `fr` depuis la feuille
française du classeur officiel, avec la même procédure et la même vérification d'empreinte.

**Interdit** : utiliser un corpus réel dans les tests. Les tests n'utilisent que
`ia-service/tests/donnees_corpus.py`, un corpus synthétique.

---

## 7. D4 — Jeu d'évaluation de l'agent Diagnostic

Un jeu existe déjà : `ia-service/tests/data/diagnostic/jeu_cas.json`, version 1.0.0, **12 cas**.

**Cible : 30 à 50 cas**, couvrant :

| Axe | Cas à couvrir |
| --- | --- |
| Niveaux | débutant, intermédiaire, avancé |
| Langues | `fr`, `en`, `it`, `zh` (HSK) |
| Qualité des réponses | insuffisantes, incohérentes, hors sujet |
| Erreurs techniques | JSON LLM invalide, LLM indisponible, timeout, 429, 503 |
| Écart | estimation proche et écart important avec le niveau préliminaire |

**Règles**

- Chaque cas contient : entrée, simulation LLM, résultat attendu, critères déterministes et
  critères de revue humaine.
- Les sorties attendues sont **relues par un référent pédagogique** : un test ne prouve pas
  qu'un niveau est juste, il prouve que le contrat est respecté.
- Aucune donnée d'apprenant réel.
- Toute évolution du prompt ou du schéma de sortie impose une révision du jeu et une montée de
  version.

---

## 8. D5 — Données de démonstration

- 3 comptes, mot de passe `Demo2026`, un par rôle.
- Chargées **uniquement** si `SEED_DEMO=true`.
- **Interdit en production** : `SEED_DEMO=false` obligatoire, et la CI doit le vérifier.
- Les questions de démo restent un sous-ensemble minimal (anglais, français), jamais un jeu
  réel.
- Les mocks frontend ne doivent pas être présentés comme la vérité : ils contiennent 50
  questions, le seed 35. Toute divergence doit être documentée.
- Le seed doit rester idempotent : relancer `make seed` ne crée aucun doublon.

---

## 9. D6 — Données personnelles et exploitation

**Données collectées** : e-mail, prénom, nom, date de naissance, ville, photo, réponses au test,
analyse IA.

**Règles minimales**

1. **Minimisation** : ne collecter que ce qui est nécessaire au service.
2. **Accès** : un apprenant ne voit que ses données ; un formateur ne voit pas les données d'un
   autre ; l'admin voit ce que sa permission autorise.
3. **Photos** : elles sont aujourd'hui servies par un `StaticFiles` sur `/media`, **sans
   authentification**. À corriger : accès authentifié ou URL signée.
4. **Journaux** : jamais de contenu d'apprenant, jamais de prompt, jamais de clé. Le code le fait
   déjà pour l'appel IA — la règle s'applique partout.
5. **Conservation** (proposition à valider avec le client) :

| Donnée | Durée proposée |
| --- | --- |
| Tentatives et réponses | 12 mois après la dernière activité |
| `analyse_ia` | même durée que la tentative |
| Photos | jusqu'à la suppression du compte |
| Journaux applicatifs | 30 jours |
| Sauvegardes | 30 jours glissants |

6. **Droits** : accès, rectification et suppression doivent être possibles (aujourd'hui : pas de
   route de suppression de compte).
7. **Sauvegarde** : les variables `BACKUP_*` existent mais aucun code ne les lit. Mettre en
   place un `pg_dump` quotidien avec rétention, et tester une restauration.
8. **Tests** : uniquement des données fictives, jamais un dump de production.

---

## 10. Gouvernance

### Rôles

| Rôle | Responsabilité |
| --- | --- |
| Propriétaire des données | Responsable pédagogique : valide le contenu et les volumes |
| Producteur | Enseignant de langue : rédige les questions |
| Validateur | Référent qualité + développeur : applique la checklist |
| Intégrateur | Développeur backend : convertit, importe, teste |
| Référent IA | Développeur IA : corpus et jeu d'évaluation |

### Cycle de vie d'une livraison

```text
Production → Revue pédagogique → Validation technique → Intégration → Tests → PR → Merge
```

### Règles de changement

- Toute modification du **contrat** (route, champ, valeur) impose, dans la même PR : le contrat,
  `frontend/src/services/endpoints.ts`, le service concerné et les tests.
- Toute modification d'une **question publiée** passe par son `code`, jamais par l'énoncé.
- Toute livraison est datée et versionnée dans un changelog.

---

## 11. Évolutions techniques nécessaires avant de passer à l'échelle

Ces points ne sont pas des données, mais sans eux la directive ne peut pas être appliquée :

1. **Colonnes `code` (unique), `version`, `auteur`, `statut`** sur `question` — aujourd'hui la
   déduplication se fait sur l'énoncé.
2. **Script d'import JSONL** avec validation bloquante — aujourd'hui l'ajout se fait dans le code
   Python.
3. **Colonnes `mots_minimum` et `duree_minimale_secondes`** si l'on veut les questions `texte` et
   `audio` (le frontend les attend, le backend ne les envoie pas).
4. **Stockage des fichiers audio** dans le volume `media`, et acceptation du type `audio` dans
   `TYPES_ENREGISTRABLES`.
5. **Correction des réponses `texte`** : elles sont acceptées mais jamais notées, donc une
   question texte ne compte pas dans le score.
6. **Ajout de `vocabulaire`** à `CompetenceIA` si l'on veut une compétence lexicale de première
   classe.

---

## 12. Checklist finale (à copier dans chaque PR de données)

```text
[ ] Fichier en UTF-8, nommé et versionné
[ ] Codes uniques, stables
[ ] Langues et niveaux valides
[ ] Compétences parmi les 5 autorisées
[ ] Choix distincts, bonne réponse incluse
[ ] Aucune fuite de réponse
[ ] Aucun doublon (langue, niveau, énoncé)
[ ] Volume minimal par niveau atteint
[ ] Source et auteur renseignés
[ ] Revue pédagogique faite
[ ] Tests backend verts
[ ] Seed relancé deux fois sans doublon
[ ] Aucune donnée personnelle
[ ] Changelog mis à jour
```

---

## 13. Anti-patterns à proscrire

1. Corriger un énoncé déjà publié sans passer par son `code` → doublon en base.
2. Tagger une question `vocabulaire` → réponse ignorée par l'analyse IA.
3. Ajouter des questions `audio` avant le stockage des médias → 422 `audio_non_disponible`.
4. Compter sur les questions `texte` pour le score → elles ne sont pas corrigées.
5. Commiter le corpus CECRL → problème de droits.
6. Charger les comptes de démo en production → `SEED_DEMO` doit être `false`.
7. Utiliser un dump de production dans les tests.
8. Modifier les mocks frontend sans mettre à jour le seed (ou l'inverse) sans documenter
   l'écart.

---

## Questions de compréhension

1. Pourquoi une question taguée `vocabulaire` est-elle comptée dans le score mais ignorée par
   l'analyse IA ?
2. Pourquoi le seed déduplique-t-il sur `(langue, niveau, énoncé)`, et quel problème cela
   pose-t-il pour corriger une faute de frappe ?
3. Combien de questions faut-il produire pour couvrir les 5 langues au volume cible, et pourquoi
   ce nombre dépend-il de la durée du test ?
4. Quelles données le projet conserve-t-il, et quelles protections manquent aujourd'hui ?
5. Pourquoi le corpus CECRL ne peut-il pas être versionné, alors que la banque de questions peut
   l'être ?
