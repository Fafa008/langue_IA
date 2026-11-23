# Plan de migration — Banque unique d'exercices

> **Centre Langues IA · La Digithèque** · 23 novembre 2026
> Document préparatoire, **aucune modification de schéma ni de code** à ce stade.
> L'audit factuel est dans [`../audit/gestion_pedagogique_exec_audit.md`](../audit/gestion_pedagogique_exec_audit.md).
> Décisions de référence : `docs/decisions/gestion_pedagogique_decisions.md` (D1 à D9, toutes `EN ATTENTE` sur la
> branche PR #103). Le plan doit être validé avant l'étape 3 ; la validation n'est pas encore acquise.

---

## 1. Objectif et périmètre

Remplacer les deux catalogues actuels — `question` (diagnostic) et `exercice` (parcours) — par une **banque
unique** `exercice`, avec un champ `usage` (`diagnostic`, `parcours`, `les deux`), conformément à D1 et D3.

**Garanties demandées**

1. Aucune donnée perdue, en particulier les réponses déjà enregistrées.
2. Chaque réponse reste rattachée à l'exercice d'origine (désormais `reponse.id_exercice`).
3. Migration Alembic réversible (`upgrade` et `downgrade`).
4. Le seed de test est conservé et marqué `donnees_test = true`, sans audio (D8).
5. Aucun audio copié en base ; référence par `audio_ref` (D7).

**Hors périmètre de ce plan** : création pédagogique (CRUD formateur), profil d'épreuve, types de leçon/exercice
reportés (D4, D5), génération IA de contenu, champs HSK détaillés (D6).

---

## 2. Correspondance `question` → `exercice`, champ par champ

Références source : `backend/app/models/diagnostic.py:19-49` et `backend/app/models/parcours.py:62-83`.

| `question` (source) | Destination dans `exercice` | Règle de transformation | Points d'attention |
|---|---|---|---|
| `id_question` (PK int) | nouvel `id_exercice` + `id_question_originel` (colonnes temporaires de migration) | Le PK n'est **pas** conservé tel quel : les identifiants `exercice` existants (seed parcours `backend/app/seed_parcours.py:258-282`) occupent déjà 1..N. Une table de correspondance `migration_question_exercice(id_question, id_exercice)` est créée et conservée jusqu'à validation. | Voir §3.2 : c'est le point de décision le plus risqué. |
| `enonce` | `contenu` JSON → clé `enonce` | Copie littérale. | `enonce` fait déjà partie de la liste blanche `CHAMPS_VISIBLES` (`backend/app/services/lecture_parcours.py:36`). |
| `competence` (`String(50)`, vocabulaire libre) | `contenu` JSON → clé `competence` + normalisation vers `domaine` | Les valeurs observées sont `grammaire`, `lecture`, `ecoute`, `ecrit`, `oral` ; elles rejoignent les domaines de `analyse_diagnostic.py:123-142`. | Valeurs inconnues : conserver la valeur brute, ne pas la rejeter pendant la migration. |
| `type_reponse` (`choix`/`texte`/`audio`) | `contenu` JSON → clé `format` | `choix` → `choix` ; `texte` → `texte` ; `audio` → `prononciation` **ou** `ecoute` selon le sens. À trancher : l'audio du diagnostic est une **production orale** de l'apprenant, donc `prononciation` est le format le plus proche. | D5 ne retient pas `audio` comme format d'exercice ; mapping explicite à valider par le référent. |
| `choix` (JSONB) | `contenu` JSON → clé `choix` | Copie littérale. | Les exercices `texte`/`audio` n'ont pas de `choix` : champ absent, pas `null`. |
| `reponse_correcte` (Text) | `contenu` JSON → clé `reponses: [valeur]` | Un seul élément. Présent uniquement pour `type_reponse = 'choix'`. | **Donnée la plus sensible** : lue par `scoring.py:98,111` et `analyse_diagnostic.py:101`, jamais exposée par `QuestionOut` (`schemas/diagnostic.py:10-21`). Le garde-fou doit être transféré à `lecture_parcours.py`. |
| `support` | `contenu` JSON → clé `support` | Copie littérale si non nul. | Champ déjà visible côté frontend (`types/test-diagnostic.ts:26`). |
| `audio_url` | `contenu` JSON → clé `audio_url` **ou** `audio_ref` | D7 impose `audio_ref` (chemin, jamais de contenu en base). **Le seed actuel ne renseigne jamais `audio_url`** (`seed_diagnostic.py:158-187`) : seules 3 valeurs `audio_texte` et 2 `support` existent. | Même sur des données vides, la migration doit échouer explicitement si une valeur est un `data:` URI ou un BLOB. |
| `audio_texte` | `contenu` JSON → clé `texte_audio` | Alignement sur le vocabulaire `exercice` (`seed_parcours.py:40-48`, `lecture_parcours.py:36`). | — |
| `id_langue` (FK RESTRICT) | `exercice.id_langue` | Copie de la FK. | Même table `langue`, aucun changement. |
| `id_niveau` (FK RESTRICT) | `exercice.id_niveau` | Copie de la FK. | Même table `niveau`, aucun changement. |
| — | `usage = 'diagnostic'` (ou `'les deux'` si l'exercice sert aussi au parcours) | Valeur fixée pour toutes les lignes migrées. | D3 : un exercice peut avoir les deux usages. |
| — | `statut = 'publié'` | Les questions en service sont publicables telles quelles. | Règle de publication à confirmer (D1–D9). |
| — | `difficulte` | Dérivée du `id_niveau` (à définir : 1 pour A1 … 6 pour C2), ou valeur neutre 3. | Champ NOT NULL avec contrainte 1..5 (`models/parcours.py:65`) : un niveau C2 doit être ramené dans 1..5. |
| — | `numero_lecon = NULL` | Une question de diagnostic n'appartient à aucune leçon. | Colonne nullable depuis `20261121_us48_exercice_lecon`. |
| — | `type` (EnumEntier `TypeExercice`) | Dérivé de `competence` : `ecoute` → `ECOUTE`, `oral` → `ORAL`, sinon `VOCABULAIRE`/`COMPREHENSION`/`GRAMMAIRE` selon la valeur. | Enum figé `enums.py:49-54` : ne pas ajouter de code (convention du projet). |
| — | `version = 1`, `origine = 'humain'`, `auteur`, `date_creation`, `donnees_test = false` | Valeurs initiales. | `auteur` : l'auteur historique n'est pas en base ; utiliser un auteur système documenté, pas un nom inventé. |
| — | `framework`/`level` | `framework` déduit de la langue (`zh` → HSK, sinon CECRL, `contrat-frontend.md:468-469`), `level` copié de `niveau.code`. | D6 : `show_pinyin` et `script` exclus du MVP. |
| — | `contenu` validé par schéma strict | Les champs autorisés sont ceux du format retenu ; `extra="forbid"` côté contrat IA (`ia-service/app/schemas/base.py:14`). | Si une question historique contient un champ non prévu, la migration doit le signaler, pas le supprimer silencieusement. |

**Règle de non-régression** : `reponse_correcte`, `reponses` et `explication` ne doivent jamais figurer dans la
liste blanche servie au navigateur. Le test
`backend/tests/test_diagnostic_questions.py:69` et `backend/tests/test_diagnostic_scoring.py:250-261` doit être
transposé sur la nouvelle route de lecture.

---

## 3. Migration Alembic

### 3.1 Position dans l'historique

Head actuel : **`dfbf0715302a`** (`backend/alembic/versions/20261122_dfbf0715302a_fusion_quota_historique_chatbot_et_.py:5-16`).
La nouvelle révision declare `down_revision = "dfbf0715302a"`.

### 3.2 Décision à trancher avant écriture : l'identifiant primaire

Deux options sont possibles :

| Option | Mécanisme | Avantage | Risque |
|---|---|---|---|
| **A (recommandée)** — nouveaux identifiants + table de correspondance | Insertion de chaque `question` comme nouvelle ligne `exercice` ; `migration_question_exercice(id_question, id_exercice)` conservée ; `reponse.id_question` remplacé par `reponse.id_exercice` via la table. | Aucune collision avec les exercices du seed ; History intacte ; `downgrade` exact. | Table technique supplémentaire, à conserver jusqu'à validation des données (puis suppression dans une migration ultérieure). |
| **B — conservation des identifiants** | Décalage des `id_exercice` existants puis réutilisation des `id_question` comme PK. | Pas de table de correspondance. | Modification des FK `parcours_exercice`, risque de collision avec des données de production, `downgrade` fragile. **Déconseillé.** |

Le plan retient **A** sous réserve de validation. La table de correspondance n'est **pas** une table de questions :
elle ne contient que deux identifiants et n'est lue par aucun service métier.

### 3.3 `upgrade()` — étapes ordonnées

1. Créer `migration_question_exercice(id_question INTEGER PRIMARY KEY, id_exercice INTEGER NOT NULL UNIQUE)`.
2. Étendre `exercice` des colonnes : `usage`, `statut`, `version`, `origine`, `auteur`, `date_creation`,
   `donnees_test`, `framework`, `level`, `audio_ref`, `id_question_originel` (temporaire, nullable). Les contraintes
   sont ajoutées **après** backfill.
3. Lire toutes les lignes de `question` (`backend/tests/test_modele_diagnostic.py:226-274` donne le détail des
   colonnes à chaque palier) ; pour chacune, construire le `contenu` JSON selon §2, insérer dans `exercice`,
   renseigner `id_question_originel` et la table de correspondance.
4. Ajouter `reponse.id_exercice` nullable + FK `exercice.id_exercice` ; backfill
   `UPDATE reponse SET id_exercice = m.id_exercice FROM migration_question_exercice m WHERE m.id_question = reponse.id_question`.
5. Vérifier `SELECT count(*) FROM reponse WHERE id_exercice IS NULL` = 0 ; sinon lever une exception et faire
   échouer la migration (aucune réponse perdue).
6. Poser `NOT NULL` sur `reponse.id_exercice`, supprimer l'ancienne FK et l'ancienne colonne `id_question`, recréer
   l'unicité `(id_tentative, id_exercice)` et l'index.
7. Ajouter les contraintes sur les nouvelles colonnes `exercice` (values autorisées, `donnees_test` non nul).
8. Supprimer la table `question` **uniquement après** les étapes 4–6.
9. Mettre à jour la séquence `exercice_id_exercice_seq` si la migration a inséré des identifiants explicites.

### 3.4 `downgrade()` — étapes inversées

1. Recréer `question` avec exactement le schéma issu des migrations 3, 4 et 5
   (`backend/alembic/versions/20261021_...py:24-34`, `20261023_...py:21-31`, `20261027_...py:16-21`).
2. Restaurer les lignes depuis `exercice` **uniquement celles dont `id_question_originel` est non nul** (les
   exercices du parcours ne sont pas des questions de diagnostic), en reconstruisant `enonce`, `competence`,
   `type_reponse`, `choix`, `reponse_correcte`, `support`, `audio_url`, `audio_texte` depuis le JSON.
3. Réintroduire `reponse.id_question` nullable, backfill via `migration_question_exercice`, poser `NOT NULL`,
   restaurer FK/unicité/index d'origine.
4. Supprimer `reponse.id_exercice` et les colonnes ajoutées à `exercice`.
5. Conserver puis supprimer `migration_question_exercice` **en dernier** (elle est nécessaire à l'étape 3).

**Test de réversibilité** : étendre `backend/tests/test_modele_diagnostic.py:184-306` d'un cycle
`upgrade head` → `downgrade dfbf0715302a` → `upgrade head`, avec contrôle du nombre de lignes et des réponses.

### 3.5 Comportement en cas d'échec

Alembic exécute la migration dans une transaction : toute erreur aux étapes 3–6 annule l'ensemble. Il n'y a donc
jamais d'état intermédiaire où des réponses seraient orphelines. La vérification de l'étape 5 est un **arrêt
explicite**, pas un avertissement.

---

## 4. Stratégie de données

| Principe | Mesure |
|---|---|
| Aucune donnée perdue | Copie intégrale des champs de `question` dans `contenu` avant suppression de la table. |
| Réponses rattachées | `reponse.id_exercice` backfillé via la table de correspondance, contrôle `IS NULL` = 0. |
| Clé de correction privée | Transférée dans `contenu.reponses` ; absente de la liste blanche de lecture. |
| Audio | Aucun octet déplacé ; seul le chemin est copié dans `audio_ref`. Échec si une valeur est un URI `data:`. |
| Seed conservé | `backend/app/seed_diagnostic.py` garde ses **35 questions** (18 `en`, 17 `fr`, toutes `choix`, niveaux A1→C2, `:33-155`) ; ajout de `donnees_test = true`, sans audio (aucun `audio_url` aujourd'hui). Le seed restant insert-only (`seed_diagnostic.py:162`), une base déjà peuplée n'est pas reconfigurée : documenter `make reset` pour rejouer le seed. Aucun fichier JSON/CSV n'est lu par le seed (`seed_diagnostic.py:10-15`) : `docs/donnees/exemple-questions.jsonl` et `modele-questions.csv` ne sont que des exemples documentaires. |
| Idempotence | La migration n'est jouée qu'une fois par Alembic ; le chargeur de seed reste idempotent par `(langue, niveau, enonce)` (`:162`) — pas de code stable, à améliorer dans une US ultérieure. |
| CI Docker | `.github/workflows/ci.yml:193-203` exige `en` et `fr` disponibles via `/diagnostic/langues` puis rejoue le seed : le nouveau filtre `usage`/`statut` doit maintenir ce résultat. |

---

## 5. Tests à modifier et à ajouter

### 5.1 Tests existants à modifier (justification)

| Test | Modification | Justification |
|---|---|---|
| `backend/tests/test_modele_diagnostic.py:184-306` | Ajouter le cycle de downgrade de la nouvelle migration. | Réversibilité exigée ; le test existe déjà pour les migrations historiques. |
| `backend/tests/test_seed.py:29,35,38,43-44,50,57-59,79-98` | Compter `Exercice` avec `usage`/`donnees_test` au lieu de `Question` ; vérifier `donnees_test = true`. | D8 et D1. |
| `backend/tests/test_diagnostic_questions.py:10-36,42-50,61,73-84,100-152` | Créer des `Exercice` `usage='diagnostic'`, `statut='publié'` ; conserver le test de non-exposition de la clé. | La route continue à servir des questions, mais depuis la banque. |
| `backend/tests/test_diagnostic_langues.py:12-23,63-67` | Helper `_ajouter_question` → création d'exercices publiés. | Le comptage par langue/niveau doit ignorer les brouillons. |
| `backend/tests/test_diagnostic_reponses.py:20-30,48-55` | Helper `_creer_question` → exercice ; payload `id_question` conservé ou renommé selon décision de contrat. | FK `reponse` migrée. |
| `backend/tests/test_diagnostic_scoring.py:27-45,250-261` | Helper avec `contenu.reponses` ; relire le test de non-exposition. | La clé de correction change de support. |
| `backend/tests/test_diagnostic_analyse.py:81-107,169` | Jointure `Reponse → Exercice` ; `id_question` transmis à l'IA conservé ou renommé. | Analyse IA et preuves. |
| `backend/tests/test_generation_parcours.py:30-43,125-332` | Helper `_question_scorable` → exercice diagnostic. | Le diagnostic alimente toujours la génération de parcours. |
| `backend/tests/test_smoke_generation_parcours.py`, `test_parcours_coherence.py:17,47` | Helpers mis à jour. | Chaîne complète diagnostic → parcours. |
| `backend/tests/test_ia_service.py:35,61`, `test_recommandation.py:22,28,236` | Alignement du contrat IA. | `id_question` circule jusqu'à la recommandation. |
| `backend/tests/fabriques_parcours.py:94-110,125-126` | Fabrique `creer_exercice_diagnostic`. | Point d'entrée unique de nombreux tests. |
| IA : `test_api_diagnostic.py`, `test_agent_diagnostic.py`, `test_diagnostic.py`, `test_jeu_cas_diagnostic.py`, `test_exemples_json.py`, `test_llm_demonstration.py`, `test_prompts.py`, `test_agent_recommandation.py`, `test_api_recommandation.py` | Rename de champ **si** D2/D3 imposent `id_exercice` ; sinon ajout de `usage_pedagogique` + nouveaux cas. | `extra="forbid"` (`base.py:14`), prompt versionné, parseur factice, contrats partagés. |
| `backend/tests/conftest.py:47-52` | `base_migree` rejoue toute la chaîne Alembic : insérer la nouvelle révision. | Le cycle de migration est validé à chaque test backend. |
| `backend/tests/test_modele_diagnostic.py:206,221,225,250,276,280` | Chaîne de downgrade **codée en dur** : ajouter la nouvelle révision. | Point le plus fragile identifié par l'audit. |
| Frontend : `test-diagnostic.mock.test.ts`, `test-diagnostic.store.test.ts`, `useTestDiagnostic` tests | Alignement du type `Question`/DTO si le contrat change. | `docs/api/contrat-frontend.md` est la source de vérité du contrat. |

**Volume** : 12 fichiers backend dépendent réellement de `Question` (10 modules de test + `fabriques_parcours.py` +
`conftest.py` indirect), 7 fabriques créent des questions, et 6 fichiers mentionnent `question` **sans dépendance
DB** (`test_ia_service.py:35,61`, `test_recommandation.py:22,28,236`, `test_modele_parcours.py:19-22,73`,
`test_parcours_correction.py:298`, `test_correction_automatique.py:146`, `test_chatbot.py:25`) : ces derniers ne
doivent pas être modifiés inutilement. Le fixture `base_vide` (`backend/tests/conftest.py:55-66`) TRUNCATE
dynamiquement toutes les tables sans nommer `question` : il survivra au renommage.

### 5.2 Tests à ajouter (obligatoires, avant ou avec le code)

| Test | Assertion | Justification |
|---|---|---|
| `test_brouillon_hors_parcours` | Un exercice `statut='brouillon'` n'entre ni dans un parcours ni dans un profil de diagnostic. | Condition de fin explicite de l'US schéma. |
| `test_exercice_publie_modifie_cree_version` | Modifier un exercice publié crée une nouvelle ligne/version ; l'ancienne reste liée aux réponses déjà enregistrées. | Règle métier « un exercice publié modifié crée une version ». |
| `test_diagnostic_selectionne_publies` | La sélection du diagnostic ne retourne que des exercices `statut='publié'` et dont `usage` contient `diagnostic`. | D2 + règle de publication. |
| `test_contenu_invalide_rejete` | Un `contenu` avec champ inconnu est rejeté (422) par le schéma strict `extra="forbid"`. | Règle métier « aucun champ inconnu accepté ». |
| `test_seed_sans_audio` | Le seed de test contient `donnees_test = true` et aucun champ `audio_ref`/`audio_url` renseigné. | D8 + interdiction de copier des audios. |
| `test_migration_sans_perte` | Après `upgrade`, chaque `reponse` pointe vers un `exercice` dont `id_question_originel` correspond à l'ancien `id_question`. | Stratégie de données. |
| `test_reversibilite_migration` | `upgrade` → `downgrade` → `upgrade` conserve les comptes et les réponses. | Migration réversible. |
| `test_contrat_diagnostic_partage` | Exemples `contrats/ia/diagnostic-evaluer/` validés des deux côtés. | Aucun contrat diagnostic n'existe aujourd'hui (`contrats/ia/README.md:24-29`). |

---

## 6. Risque de rupture pour le diagnostic en cours et maîtrise

### 6.1 Ce qui se casse

| Situation | Effet |
|---|---|
| Tentative `EN_COURS` au moment du `upgrade` | Ses réponses pointent vers d'anciens `id_question` ; la clôture (`POST /.../terminer`) lit `Question` via `scoring.py:88` et échoue si la table a disparu. |
| Frontend en cours de test | `GET /diagnostic/questions` renvoie un DTO dont l'identifiant peut changer ; l'E2E et le store local conservent `idQuestion`. |
| Appel `POST /diagnostic/evaluer` déjà parti | `extra="forbid"` (`ia-service/app/schemas/base.py:14`) rejette tout champ non déclaré : backend et IA doivent basculer **dans le même déploiement**. |
| Utilisateur en train de répondre | 409/404 si la question n'est plus trouvée. |

### 6.2 Moyens de contrôle

1. **Fenêtre de maintenance courte**, annoncée, avec arrêt du frontend pendant l'`alembic upgrade head` : c'est le
   contrôle le plus simple et le plus sûr pour une démo/mémoire.
2. **Déploiement atomique** : migrations + backend + IA + frontend publiés ensemble ; aucune bascule progressive
   tant que `extra="forbid"` est en vigueur.
3. **Double lecture transitoire** (si aucune interruption n'est acceptable) : garder `question` en lecture seule
   pendant une version, avec un service qui résout les deux identifiants. **Coût élevé** ; à n'utiliser que si la
   contrainte de disponibilité est réelle.
4. **Critère d'arrêt** : avant suppression de `question`, requête de contrôle
   `SELECT count(*) FROM test_diagnostic WHERE statut = 1` (EN_COURS). Si > 0, soit attendre la clôture, soit
   appliquer l'option 3. Ce critère doit être exécuté dans la migration et dans la procédure de déploiement.

---

## 7. Validation attendue avant étape 3

Ce document doit être validé par les responsables désignés dans `docs/decisions/gestion_pedagogique_decisions.md` :
Product Owner (D1, D2, D3, D9), référent pédagogique (D4, D5, D6), expert IA (D2, D6), développeur IA (D7),
développeur backend (D8). **Aucune implémentation ne doit démarrer tant que la validation n'est pas consignée.**

Points explicitement à trancher :

1. Option A ou B pour l'identifiant primaire (§3.2) — recommandation : **A**.
2. Rename de `id_question` vers `id_exercice` ou conservation du nom + ajout de `usage_pedagogique` (§2, §5.1) —
   recommandation : **conserver `id_question` dans le contrat IA** pendant la migration de schéma, pour limiter la
   rupture, puis évolution distincte si le PO le souhaite.
3. Mapping `audio` → `prononciation` ou `ecoute` (§2).
4. Valeur de `difficulte` pour un niveau C2 (contrainte 1..5).
5. Fenêtre de maintenance ou double lecture (§6.2).
