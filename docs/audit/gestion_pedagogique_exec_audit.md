# Audit exécutif — Gestion pédagogique : migration `question` → `exercice`

> **Centre Langues IA · La Digithèque**
> Date : 23 novembre 2026 · Branche : `docs/audit-gestion-pedagogique` (depuis `origin/develop`, `f903d62`).
> Document **lecture seule** : aucun code, schéma, seed ni test n'a été modifié.
> Exception de périmètre : à sa rédaction, le garde-fou des décisions (D1–D9 `EN ATTENTE`, plan US absent) avait été
> levé par l'utilisateur **uniquement pour la production des documents d'audit et de plan**.
> **Mise à jour du 23/11/2026** : D1–D9 sont désormais `VALIDÉE` et les cinq points du plan de migration sont tranchés,
> mais les numéros US, les co-signatures et la relecture finale du plan manquent encore. **Aucune implémentation
> n'est autorisée.** Voir [`../plan/gestion_pedagogique_validation.md`](../plan/gestion_pedagogique_validation.md).

---

## 1. Périmètre et méthode

L'audit répond aux cinq points demandés :

1. modèles `question`, `test_diagnostic`, `reponse`, `exercice`, `parcours`, `parcours_exercice` et migrations ;
2. routes diagnostic et leurs dépendances ;
3. seed et tests dépendant des questions du diagnostic ;
4. schémas de l'agent Diagnostic (service IA) qui consomment les questions ;
5. liste exhaustive des appels à la table `question`.

Sources consultées : `backend/app/`, `backend/alembic/`, `backend/tests/`, `ia-service/app/`,
`ia-service/tests/`, `ia-service/docs/`, `contrats/`, `docs/api/contrat-frontend.md`, `docker-compose.yml`.

Toutes les références sont données en `chemin:ligne` relatives à la racine du dépôt.

---

## 2. Modèles et migrations backend

### 2.1 Les six tables

| Table | Définition | Champs et contraintes essentiels |
|---|---|---|
| `question` | `backend/app/models/diagnostic.py:19-49` | `id_question` PK (`:30`), `enonce` Text NOT NULL (`:31`), `competence` String(50) vocabulaire libre (`:34`), `type_reponse` String(10) défaut Python `"choix"` (`:35`), `choix` JSONB (`:36`), `reponse_correcte` Text nullable = clé privée du scoring (`:38`), `support`/`audio_url`/`audio_texte` (`:39-41`), FK `id_langue` RESTRICT (`:42`), FK `id_niveau` RESTRICT (`:44`), index `(id_langue, id_niveau)` (`:27`). Contraintes `ck_question_type_reponse` (`:22`) et `ck_question_reponse_correcte_choix` (`:23-26`). Relations `:48-49`, **aucune relation inverse**. |
| `test_diagnostic` | `backend/app/models/diagnostic.py:52-79` | `id_test` PK (`:58`), FK `id_apprenant` CASCADE indexée (`:59`), FK `id_langue`/`id_niveau`/`id_niveau_final` RESTRICT (`:60,61,68`), `statut` `EnumEntier(StatutDiagnostic)` défaut `EN_COURS` (`:62`), `date_debut` tz `now()` (`:63`), `date_fin` (`:64`), `score` Numeric(5,2) (`:66`), `analyse_ia` JSONB (`:70`), relation `reponses` cascade delete-orphan (`:72-79`). Contrainte `ck_test_diagnostic_score` (`:55`). Enum `StatutDiagnostic` `backend/app/models/enums.py:37-40`, codes SMALLINT `:62`, `EnumEntier` `:74-92`. |
| `reponse` | `backend/app/models/diagnostic.py:82-97` | `id_reponse` PK (`:88`), FK `id_tentative` CASCADE (`:89`), FK `id_question` RESTRICT indexée (`:91`), `reponse_fournie` Text NOT NULL (`:92`), `evaluation` JSONB nullable (`:94`), unicité `(id_tentative, id_question)` (`:86`), relations `:96-97`. |
| `parcours` | `backend/app/models/parcours.py:18-59` | PK `:25`, FK `id_test` (`:26-28`), FK langue/niveau (`:29-32`), `statut` `EnumEntier(StatutParcours)` (`:34-38`), `lecon_atteinte` défaut 1 (`:39`), `recommandation_ia` JSONB (`:42`), propriétés `phase`/`est_lecon_de_revision` (`:53-59`). `UNIQUE(id_test)` (`:22`). Enum `backend/app/models/enums.py:43-46`, codes `:63`. |
| `exercice` | `backend/app/models/parcours.py:62-83` | `id_exercice` PK (`:69`), `type` `EnumEntier(TypeExercice)` (`:70`), `contenu` Text = JSON sérialisé (`:71`), `difficulte` Integer (`:72`), FK langue/niveau (`:73-74`), `numero_lecon` nullable (`:76`), contraintes `:65-66`. Enum `TypeExercice` `backend/app/models/enums.py:49-54` (GRAMMAIRE, VOCABULAIRE, COMPREHENSION, ECOUTE, ORAL), codes `:64-70`. |
| `parcours_exercice` | `backend/app/models/parcours.py:86-117` | PK `:102`, FK parcours CASCADE (`:103-105`), FK exercice RESTRICT (`:106-108`), `numero_lecon` (`:109`), `score_obtenu` (`:110`), `reponse_apprenant` (`:112`), `feedback_ia` JSONB (`:113`), `date_reponse` (`:114`), unicité `(id_parcours, numero_lecon, id_exercice)` (`:88-100`). Table liée `progression_lecon` `:120-145`. |

Registre global : `backend/app/models/__init__.py:5` importe `Question, Reponse, TestDiagnostic`, `:16` importe
`Exercice, Parcours, ParcoursExercice, ProgressionLecon`, exports `:39-46,54`.

### 2.2 Migrations Alembic — ordre et head

Préfixe : `backend/alembic/versions/`.

| # | Révision / fichier | down_revision | Effet sur les tables cibles |
|---|---|---|---|
| 1 | `bcf9fe169c84` — `20261015_bcf9fe169c84_schema_initial.py:16` | `None` (`:17`) | Crée `langue`, `niveau`, `apprenant` (FK cibles) `:35-50,75-84`. |
| 2 | `20261020_rbac` — `20261020_rbac.py:13` | `bcf9fe169c84` (`:14`) | Aucune table cible. |
| 3 | `bd6763f7f861` — `20261021_bd6763f7f861_tables_du_diagnostic.py:17` | `20261020_rbac` (`:18`) | **Création** `question` `:24-34`, `test_diagnostic` `:35-51`, `reponse` `:52-64`. Down `:67-72`. |
| 4 | `20261023_diag_qpayload` — `20261023_diagnostic_question_payload.py:14` | `bd6763f7f861` (`:15`) | `question` : `type_reponse` `:21-25`, `choix`/`support`/`audio_url`/`audio_texte` `:26-29`, contrainte `:30`, index `:31`. Down `:34-41`. |
| 5 | `20261027_diag_scoring` — `20261027_diagnostic_scoring.py:9` | `20261023_diag_qpayload` (`:10`) | `question.reponse_correcte` `:16` + contrainte `:17-21` ; `test_diagnostic.score` `:22-27`. Down `:30-34`. |
| 6 | `20261110_us45_parcours` — `20261110_us45_parcours.py:9` | `20261027_diag_scoring` (`:10`) | **Création** `parcours` `:16-31`, `exercice` `:32-44`, `parcours_exercice` `:45-76`. Down `:79-82`. |
| 7 | `20261110_diag_analyse_ia` — `20261110_diagnostic_analyse_ia.py:10` | `20261110_us45_parcours` (`:12`) | `test_diagnostic.analyse_ia` JSONB `:18`. Down `:21-22`. |
| 8 | `20261119_us157_feedback` — `20261119_us157_feedback_reponse_libre.py:10` | `20261110_diag_analyse_ia` (`:11`) | `parcours_exercice` : `reponse_apprenant`, `feedback_ia`, `date_reponse` `:17-19`. Down `:22-25`. |
| 9 | `20261120_us48_progression` — `20261120_us48_progression_lecon.py:9` | `20261119_us157_feedback` (`:10`) | Création `progression_lecon` `:16-38`. Down `:41-42`. |
| 10 | `20261121_us48_exercice_lecon` — `20261121_us48_exercice_numero_lecon.py:9` | `20261120_us48_progression` (`:10`) | `exercice.numero_lecon` `:16` + contrainte `:17-19`. Down `:22-24`. |
| 11a | `20261121_p1_2_quota_chatbot` — `:9` | `20261121_us48_exercice_lecon` (`:10`) | Aucune table cible `:16-32`. |
| 11b | `20261121_rec_recommandation_ia` — `:15` | `20261121_us48_exercice_lecon` (`:16`) | `parcours.recommandation_ia` `:22`. Down `:25-26`. |
| 12 | `20261121_p3_3_historique_chatbot` — `:9` | `20261121_p1_2_quota_chatbot` (`:10`) | Aucune table cible `:16-45`. |
| 13 | **`dfbf0715302a`** — `20261122_dfbf0715302a_fusion_quota_historique_chatbot_et_.py:5` | `("20261121_p3_3_historique_chatbot", "20261121_rec_recommandation_ia")` (`:6`) | Fusion ; `upgrade`/`downgrade` no-op `:11-16`. **Head actuel** : aucune autre révision ne le déclare comme `down_revision`. |

Test de réversibilité existant : `backend/tests/test_modele_diagnostic.py:184-306` (downgrades successifs
`:206,221,225,250,276` puis `upgrade head` `:280`).

---

## 3. Routes diagnostic et dépendances

Préfixe global `/api/v1` : `backend/app/api/router.py:19` (routeur inclus `:28`). Toutes les routes exigent le rôle
`APPRENANT` par contrôle inline (`utilisateur.role != Role.APPRENANT` → 403).

| Route exacte | Définition | Dépendances | Schémas | Logique question / réponse |
|---|---|---|---|---|
| `GET /api/v1/diagnostic/langues` | `backend/app/api/routes/diagnostic.py:120-136` | `db: DbSession`, `utilisateur: UtilisateurConnecte` `:121`, rôle `:123-124` | `LangueDiagnosticOut` (déf. `backend/app/schemas/diagnostic.py:24-32`) | `lister_langues_service` `:135` → `backend/app/services/diagnostic.py:89-92` → `_niveau_de_depart` `:82-86` → `_questions_par_niveau` `:68-79` : `select(Question.id_niveau, func.count())` `:71`, filtres langue/niveau/type `:73-76`, `group_by` `:77`. |
| `GET /api/v1/diagnostic/questions` | `:139-155` | `db`, `utilisateur` `:141-142`, rôle `:147-148`, `Query` `code_langue` (2-3) `:143`, `code_niveau` (1-20) `:144` | `QuestionOut` (déf. `backend/app/schemas/diagnostic.py:10-21`), `response_model_exclude_none=True` `:139` | `lister_questions_service` `:151` → `backend/app/services/diagnostic.py:48-65` : `select(Question)` `:61`, filtres `:62`, `order_by(id_question)` `:63`. Conversion `_question_out` `:97-108`, **sans `reponse_correcte`**. Erreurs `:41-71`, `:152-153`. |
| `POST /api/v1/diagnostic/tentatives` (201) | `:157-179` | `donnees: TentativeCreate` `:163`, `db`, `utilisateur` `:164-165`, rôle `:168-169` | `TentativeCreate` (`schemas/diagnostic.py:59-62`), `TentativeOut` (`:65-70`) | `creer_tentative_service` `:172` → `services/diagnostic.py:95-109` : niveau choisi par **compte de questions enregistrables** `:101-103`, insertion `TestDiagnostic` `:105-108`. |
| `POST /api/v1/diagnostic/reponse` (201) | `:182-202` | `donnees: ReponseCreate` `:184`, `db`, `utilisateur` `:185-186`, rôle `:189-190` | `ReponseCreate` (`schemas/diagnostic.py:35-47`, validator `:42-47`), `ReponseOut` (`:50-56`) | `int(donnees.id_question)` `:197` → `services/diagnostic.py:112-178` : chargement tentative `:120-129`, **`db.get(Question, id_question)` `:131`**, contrôles langue/niveau `:134`, choix `:136`, refus audio `:138`, doublon `Reponse` `:141-150`, **insert `Reponse(question=...)` `:152-157`**, `IntegrityError` 23505 `:158-175`. |
| `POST /api/v1/diagnostic/tentatives/{id_tentative}/terminer` | `:205-239` | `Path(gt=0)` `:211`, `db`, `utilisateur` `:212-213`, rôle `:216-217` | `ScoreDiagnosticOut` (`schemas/diagnostic.py:88-103`), `CompetenceResultatOut` `:73-78`, `PointFaibleOut` `:81-85` | `terminer_tentative_service` `:220` → `services/scoring.py:59-125` : **`select(Question)` `:88`**, filtres langue/niveau/type `'choix'` `:90-92`, contrôle clés de correction `:97-101`, lecture `Reponse` `:103-109`, score `:110-125` ; puis analyse IA `:227` (joint `Question`, `services/analyse_diagnostic.py:93-119`) et génération du parcours `:228` (`services/parcours.py:306-322`, **aucun accès à `Question`**). |

Dépendances partagées : `DbSession = Annotated[Session, Depends(get_db)]` `backend/app/api/deps.py:15` ;
`UtilisateurConnecte = Annotated[Utilisateur, Depends(utilisateur_connecte)]` `:41`, fonction `:26-38`
(JWT `lire_jeton` `:32`, relecture DB + statut `ACTIF` `:35-37`). Tableaux d'erreurs HTTP `diagnostic.py:41-71`
et `:73-84` (scoring), conversion `:87-94`.

---

## 4. Seed et tests dépendant des questions du diagnostic

### 4.1 Le seed de diagnostic est intégralement en dur

- `backend/app/seed.py:1-11` : référentiel toujours ; comptes, questions et exercices de parcours seulement si
  `SEED_DEMO=true`.
- `backend/app/seed.py:39` importe `charger_questions_demo` ; `:177` teste
  `os.getenv("SEED_DEMO","false").lower()=="true"` ; `:180-181` appelle le chargeur ; `:182-183` appelle le seed
  parcours. `docker-compose.yml:70` fixe le défaut à `true` (le défaut Python est `false`).
- `backend/app/seed_diagnostic.py:10-15` : **aucun `import json`**, aucun `open()`, aucun chemin de fichier.
  `:18-27` dataclass gelée `QuestionDemo` ; `:29-31` helper `_q` ; `:33-155` dict `QUESTIONS_DEMO` avec clés
  `en` (`:34-103`) et `fr` (`:104-154`) ; `:158-187` `charger_questions_demo`.

**Répartition vérifiée : 35 questions** — 18 anglaises, 17 françaises, **toutes `type_reponse="choix"`**,
niveaux CECRL A1→C2, langues `en`/`fr` uniquement.

| Langue | A1 | A2 | B1 | B2 | C1 | C2 | Total | Lignes |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| `en` | 2 | 4 | 3 | 4 | 3 | 2 | **18** | `:35-36,37-48,49-51,52-76,77-95,96-102` |
| `fr` | 2 | 4 | 3 | 3 | 3 | 2 | **17** | `:105-106,107-118,119-126,127-137,138-151,152-153` |

Compétences : `grammaire` (défaut), `vocabulaire`, `ecoute`, `lecture`. 3 `audio_texte` (`:46-47,74-75,116-117`),
2 `support` (`:65-66,135-136`), **aucun `audio_url` renseigné**.

Mapping vers `Question` : `enonce` `:174`, `competence` `:175`, `type_reponse="choix"` `:176`,
`choix=list(...)` `:177`, `reponse_correcte=choix[bonne_reponse]` `:178`, `support` `:179`, `audio_texte` `:180`,
FK langue/niveau `:160-161,164-169,181-182`. Idempotence par `(id_langue, id_niveau, enonce)` (`:162,170`),
**pas de code stable** ; langue absente → question ignorée (`:165-167`), niveau absent → `KeyError` (`:169`).
`db.commit()` unique `:186`.

Le seed parcours est distinct : `backend/app/seed_parcours.py:17` n'importe pas `Question`, `:67-252` contient
7 leçons × 3 exercices (21 lignes), `:269` fait `json.dumps` d'un dict en mémoire (aucune lecture de fichier),
`:270-278` dédup par `(langue, niveau, contenu)`.

### 4.2 Aucun fichier de données versionné utilisé par le seed

| Chemin | Format | Items | Utilisé par le seed ? |
|---|---|---:|---|
| `backend/app/seed_diagnostic.py:33-155` | Python en dur | **35** | **Oui, source unique** |
| `backend/app/seed_parcours.py:67-252` | Python en dur | 21 | Oui, table `exercice` distincte |
| `docs/donnees/exemple-questions.jsonl:1-3` | JSONL | 3 | **Non** — exemple documentaire |
| `docs/donnees/modele-questions.csv:1-4` | CSV 17 colonnes | 3 + en-tête | **Non** — modèle documentaire |
| `ia-service/corpus/cecrl/**/*_dataset_*.json` | JSON `question_answer`/`mcq` | 200 QA + 200 MCQ par niveau | Non — corpus RAG |
| `contrats/ia/recommandation-parcours/requete.json:13,19` | ids `q-12`, `q-18` | 2 | Non — exemple de contrat |

Aucun `scripts/` à la racine ; `backend/scripts/verifier_contrat_ia.py:1-95` est le seul script backend et ne
concerne que la correction. `database/seeds/` et `database/migrations/` ne contiennent qu'un `.gitkeep`.
Seuls importateurs de `seed_diagnostic` : `backend/app/seed.py:39` et `backend/tests/test_seed.py:12`.

### 4.3 Tests bloqués par la disparition de `Question` (échec de collecte)

| Fichier | Vérification | Rupture |
|---|---|---|
| `backend/tests/test_seed.py:10-12,21-29,31-40,42-44,47-59,62-105` | Import `Question`/`QUESTIONS_DEMO`, `SEED_DEMO`, idempotence, ≥2 questions par niveau, index `bonne_reponse`, chaîne HTTP complète aboutissant à 100 % | Import error ; `QUESTIONS_DEMO` disparaît ; mapping `bonnes[...]` cassé si le DTO change. |
| `backend/tests/test_diagnostic_questions.py:6,10-36,39-69,71-98,100-152` | Fabrique locale, filtre langue+niveau, **égalité stricte du JSON** `id_question`/`niveau`/`competence`/`type_reponse`/`enonce`/`choix` (`:59-68`), absence de `bonne_reponse` (`:69`), champs optionnels, erreurs | Contrat public entier à revoir (`schemas/diagnostic.py:10-21`). |
| `backend/tests/test_diagnostic_langues.py:6,12-23,52-58,60-75` | Langue sans question → `disponible=False` ; A1 `audio` → départ A2 (`:62-72`) | `TYPES_ENREGISTRABLES`/`_questions_par_niveau` liés à `Question.type_reponse`. |
| `backend/tests/test_diagnostic_reponses.py:6-7,20-30,46-76,81-91,93-120,122-245` | Fabrique, filtrage, `id_question`, 404/409/422, idempotence | FK `reponse.id_question` et validations `services/diagnostic.py:131-166`. |
| `backend/tests/test_diagnostic_scoring.py:9-12,27-45,48-58,113-151,153-166,168-188,190-202,204-219,221-248,250-262,264-274` | Clé de correction, seuils, arrondi, **non-exposition de `reponse_correcte`** (`:250-262`) | `scoring.py:86-113` ; clé à reloger dans `contenu`. |
| `backend/tests/test_diagnostic_analyse.py:7-12,21-71,81-107,110-133,136-186,189-218,221-239,238-357` | `FauxServiceIA` injecte `id_question` (`:49`), jointure `Reponse`↔`Question`, énoncés, dégradation IA | `analyse_diagnostic.py:94-117,163-173`. |
| `backend/tests/test_modele_diagnostic.py:14-16,19-54,57-75,94-127,129-182,184-306` | Relations, cascade, unicité, RESTRICT, SQL brut `DELETE FROM question` (`:162`), **chaîne de downgrade codée en dur** `:206,221,225,250,276`, assertions `information_schema`, upgrade `:280-282` | Point le plus fragile : la nouvelle révision doit être insérée dans cette chaîne. |
| `backend/tests/test_generation_parcours.py:6-27,30-55,122-189,192-309,311-351` | `_question_scorable`, `Reponse(question=...)` `:127,147,176,200,223,254,290`, route complète | Fabrique et clé de correction. |
| `backend/tests/test_smoke_generation_parcours.py:6-16,19-109` | `creer_question_diagnostic` `:16`, 100 % → C2/leçon 36, ids `:37-38,92-93` | Fabrique partagée. |
| `backend/tests/test_parcours_coherence.py:13-17,44-84,86-98` | `passer_diagnostic(client, apprenant, creer_question_diagnostic(db))` `:47` | Toute la chaîne repose sur la fabrique. |

**Fabriques concernées** : `backend/tests/fabriques_parcours.py:19,94-110` (`creer_question_diagnostic`),
`:113-132` (`passer_diagnostic`), `:34-52` (`creer_parcours_vide`, sans question) ; fabriques locales dans
`test_diagnostic_questions.py:10-36`, `test_diagnostic_langues.py:12-23`, `test_diagnostic_reponses.py:20-30`,
`test_diagnostic_scoring.py:27-45`, `test_diagnostic_analyse.py:81-107`, `test_modele_diagnostic.py:27-37`,
`test_generation_parcours.py:30-43`.

`backend/tests/conftest.py:47-52` (`base_migree`) rejoue toute la chaîne Alembic ; `:55-66` (`base_vide`)
TRUNCATE dynamiquement toutes les tables sans nommer `question` — ce fixture survivrait au renommage.

### 4.4 Fichiers mentionnant `question` sans dépendance DB

`backend/tests/test_ia_service.py:35,61` (ids opaques dans une enveloppe Pydantic),
`backend/tests/test_recommandation.py:22,28,236`, `backend/tests/test_modele_parcours.py:19-22,73`,
`backend/tests/test_parcours_correction.py:298` (`{"agent":"diagnostic"}`),
`backend/tests/test_correction_automatique.py:146` (clé JSON de contenu),
`backend/tests/test_chatbot.py:25` (fabrique sans question).

### 4.5 CI à prendre en compte

`.github/workflows/ci.yml:193-203` : le job Docker connecte un compte démo, exige que `/diagnostic/langues`
contienne `en` et `fr` disponibles, puis rejoue le seed pour l'idempotence. Le filtre `usage`/`statut` de la
nouvelle banque devra maintenir ce résultat, sinon le job échouera.

---

## 5. Schémas de l'agent Diagnostic (service IA) et contrats

### 5.1 Constats structurants

1. **Le contrat diagnostic n'est pas dans `contrats/ia/`.** Ce dossier ne contient que
   `correction-reponse-libre/` et `recommandation-parcours/` (`contrats/ia/README.md:24-29`). Le mot
   « diagnostic » n'y figure qu'en ligne 28, pour décrire l'origine des points faibles de la recommandation.
   Le contrat diagnostic est donc porté par les schémas Python du service IA, les exemples
   `ia-service/tests/exemples/`, le jeu de cas `ia-service/tests/data/diagnostic/jeu_cas.json` et les
   ressources de prompt versionnées.
2. `ia-service/app/main.py:95-98` enregistre quatre routeurs (`chatbot`, `correction`, `diagnostic`,
   `recommandation`) en plus de `/health` (`main.py:89-92`).
3. Le champ porteur de la migration est **`id_question`**, présent dans deux directions : entrée
   (`entree.reponses[]`) et sortie (`resultat.points_faibles[]`), plus un usage indirect dans la
   recommandation. Un renommage cosmétique casserait le contrat backend, les prompts versionnés
   (empreinte SHA-256) et une vingtaine de fichiers de tests/exemples.

### 5.2 Socle commun : `extra="forbid"`

| Schéma | Référence | Détails |
|---|---|---|
| `ModeleStrict` | `ia-service/app/schemas/base.py:6-14` | `ConfigDict(extra="forbid", str_strip_whitespace=True)` (l.14) : **tout champ inconnu est refusé**, y compris imbriqué. Un `id_exercice` ou un `usage` non déclaré entraîne un 422. |
| `RequeteAgent[T]` | `ia-service/app/schemas/commun.py:39-49` | `request_id: UUID` (l.46), `version_agent: str|None` au format SemVer (l.47), `contexte: ContexteApprenant` (l.48), `entree: T` (l.49). |
| `ReponseAgent[T]` | `ia-service/app/schemas/commun.py:52-61` | `statut: Literal["succes"]` (l.59), `resultat: T` (l.60), `meta: MetaExecution` (l.61). |
| `ContexteApprenant` | `ia-service/app/schemas/contexte.py:64-88` | `code_langue` (l.71), `referentiel` (l.72), `niveau_preliminaire` (l.73), `memoire_pedagogique` (l.74), `lecon_atteinte` (l.77). Aucun champ `question`. |

### 5.3 Entrée de `POST /diagnostic/evaluer`

**`ReponseDiagnosticPrompt`** — `ia-service/app/prompts/variables.py:19-30` (modèle Pydantic malgré son
emplacement dans `app/prompts/`) :

| Champ | Type / validation | Ligne |
|---|---|---|
| `id_question` | `str`, 1 à 64 caractères | l.26 |
| `competence` | `Competence` = `Literal["grammaire","lecture","ecoute","ecrit","oral"]` (`app/schemas/regles.py:44`, valeurs l.28) | l.27 |
| `type_reponse` | `Literal["choix","texte","audio"]` | l.28 |
| `contenu` | `str`, 1 à 5 000 caractères | l.29 |
| `enonce` | `str|None`, défaut `None`, max 2 000, **`exclude=True`** (l.30) : accepté en entrée mais **jamais sérialisé dans le prompt LLM** ; documenté l.22-23. | l.30 |

**`EntreeDiagnostic`** — `ia-service/app/agents/diagnostic.py:74-100` :

| Champ | Type / validation | Ligne |
|---|---|---|
| `scenario` | `Literal["quotidien","entretien","examen"]` (`variables.py:16`), défaut `"quotidien"` | l.81 |
| `reponses` | `list[ReponseDiagnosticPrompt]`, 1 à 100 éléments | l.82 |
| `score_preliminaire` | `float` 0–100 ; booléen refusé par `refuser_booleen` | l.83, l.85-91 |
| Unicité | `verifier_identifiants_uniques` sur `[reponse.id_question ...]`, doublon → erreur « Deux réponses ne peuvent pas partager le même identifiant de question. » | l.93-100 |

> Incohérence documentaire à corriger pendant la migration : `ia-service/docs/US-70-prompt-diagnostic.md:32`
> annonce « 0 à 100 » réponses alors que le code impose **1 à 100** (`agents/diagnostic.py:82`).

### 5.4 Sortie du diagnostic : citations de questions

| Schéma | Référence | Champs liés aux questions |
|---|---|---|
| `PreuveReponse` | `ia-service/app/schemas/diagnostic.py:54-63` | `id_question: str` 1–64 (l.61), `competence: Competence` (l.62), `type_reponse` (l.63). Le contenu n'est pas repris : la vérification porte sur l'identifiant cité (doc l.55-59). |
| `PointFaible` | `ia-service/app/schemas/diagnostic.py:66-84` | `domaine: DomaineFaiblesse` (l.75, valeurs `regles.py:45-52`), `id_question: str` 1–64 (l.76), `observation` 1–160 (l.77), `justification` 1–240 (l.78), normalisation des espaces (l.80-84). |
| `ResultatDiagnostic` | `ia-service/app/schemas/diagnostic.py:120-244` | `points_faibles` 0–5 (l.135), doublons de domaine interdits (l.148-155), écart `-5..+5` recalculé (l.34-35, l.108-117, l.176-188), confiance nulle + point faible interdit (l.190-195), `verifier_preuves()` (l.197-222), `verifier_coherence()` (l.224-244). |
| `preuve_directe()` | `ia-service/app/schemas/diagnostic.py:87-105` | Règle déterministe : un choix seul ne prouve jamais une compréhension (l.90-92) ; cas par domaine (l.94-105). |
| `DiagnosticIncoherent` | `ia-service/app/schemas/diagnostic.py:38-39` | Exception métier ; messages contenant `id_question` (l.206, l.211, l.216). |

### 5.5 Autres schémas consommant ces questions

| Schéma | Référence | Rôle |
|---|---|---|
| `preuves_depuis_reponses()` | `ia-service/app/prompts/variables.py:33-42` | Réduit chaque réponse à `PreuveReponse(id_question=..., ...)` (l.36-40) ; `contenu` et `enonce` sont écartés de la vérification. |
| `EntreeExempleFewShot` | `ia-service/app/prompts/variables.py:64-90` | `reponses` 1–10 (l.68), unicité des `id_question` (l.87-89). |
| `ExempleFewShot` | `ia-service/app/prompts/variables.py:93-107` | `sortie: ResultatDiagnostic` (l.98) + `verifier_coherence(... preuves_depuis_reponses(...))` (l.101-107). |
| `VariablesEvaluationDiagnostic` | `ia-service/app/prompts/variables.py:110-144` | `reponses` 0–100 (l.116) ; borne volontairement différente de `EntreeDiagnostic` (jeux de cas avec `score_preliminaire=None`) ; cohérence few-shot/RAG (l.129-144). |
| `EntreeRecommandation` | `ia-service/app/schemas/recommandation.py:52-65` | `POST /recommandation/actions` consomme des `PointFaible` (import l.17, champ l.55) : `id_question` circule aussi dans cet endpoint (`app/api/recommandation.py:18-40`). |
| `VariablesRecommandation` | `ia-service/app/prompts/variables.py:182-195` | `points_faibles: list[PointFaible]` (l.186). |
| `ReponseCas` (tests) | `ia-service/tests/test_jeu_cas_diagnostic.py:80-105` | `id_question` l.81, contrôle d'unicité l.101-103, validation croisée l.105. |

### 5.6 Parseur non-Pydantic

`ia-service/app/llm/demonstration.py:130-157` reconstruit le diagnostic du fournisseur factice **en lisant
des clés JSON brutes** : `r["id_question"]`, `r["competence"]`, `r["type_reponse"]`, `donnees["reponses"]`
(l.139-142). Un renommage de clé côté prompt impose aussi cette modification et ses tests.

### 5.7 Route `POST /diagnostic/evaluer`

- Déclaration : `ia-service/app/api/diagnostic.py:16` (préfixe `/diagnostic`), `:19-31` (décorateur
  `@router.post("/evaluer", response_model=ReponseAgent[ResultatDiagnostic])` ; statuts 422/429/500/502/503/504).
- Enregistrement : `ia-service/app/main.py:97`.
- Fonction : `ia-service/app/api/diagnostic.py:32-42` — `requete: RequeteAgent[EntreeDiagnostic]` (l.33),
  délégation intégrale au Harness `request.app.state.harness.executer(CODE_AGENT, requete)` (l.36),
  traduction des `ReponseErreur` en `JSONResponse` via `STATUTS_HTTP[reponse.erreur.code]` (l.37-41).
  **Aucune logique pédagogique dans la route**.
- Corps attendu : `ia-service/tests/exemples/valide/requete-diagnostic.json:19,25` (validé par
  `ia-service/tests/test_exemples_json.py:19`), test HTTP `ia-service/tests/test_api_diagnostic.py:16-31`.
- Validation Harness : `ia-service/app/harness/execution.py:74-82` (`schema_entree.model_validate(requete.entree)`
  → `ENTREE_INVALIDE`), sortie revalidée l.108-111, enveloppe l.113-130. Définition de l'agent :
  `ia-service/app/agents/diagnostic.py:271-283`.
- Pipeline : `texte_requete_depuis_preuves(entree.reponses)` concatène `enonce` + `contenu` borné par
  `TEXTE_REQUETE_MAX` (`agents/diagnostic.py:58-71`) ; requête RAG par compétences (l.143-151) ; variables du
  prompt `reponses=entree.reponses` (l.220-238) ; rendu + appel LLM avec `schema=ResultatDiagnostic`
  (l.123-130) ; réduction en preuves et contrôle de cohérence (l.240-251) ; sérialisation dans
  `<donnees_diagnostic_non_fiables>` (`app/prompts/diagnostic/evaluation@1.1.0.utilisateur.md:3-13`,
  variable déclarée `app/prompts/registre.py:24-34`, rendu l.182-224). `enonce` est exclu du JSON envoyé au LLM
  (`variables.py:30`) mais reste consommable par le RAG.
- Réponse : `ReponseAgent[ResultatDiagnostic]` (`api/diagnostic.py:21,42`) ; `points_faibles[].id_question`
  doit référencer une réponse réellement transmise (`schemas/diagnostic.py:197-222`). Exemple
  `ia-service/tests/exemples/valide/reponse-diagnostic.json:15`.

### 5.8 Contrat partagé backend ↔ IA dans `contrats/`

- Règle de fonctionnement : `contrats/ia/README.md:1-6` (aucun code partagé ; les deux suites de tests lisent
  les mêmes exemples), tableau l.8-15, procédure l.17-22, périmètre l.24-29.
- **Aucun exemple diagnostic n'existe dans `contrats/ia/`** : le test de contrat IA ne couvre que la correction
  (`ia-service/tests/test_contrat_backend.py:18`, validation l.35-55).
- Seul contrat partagé contenant `id_question` : `contrats/ia/recommandation-parcours/requete.json:13,19`
  (dans `entree.points_faibles[]`), consommé par `ia-service/tests/test_contrat_recommandation.py:17,32-48`.
  La réponse partagée (`reponse.json:1-37`) n'en contient pas.
- Conséquence : si la question devient un exercice de banque avec `usage='diagnostic'`, il faut **créer**
  `contrats/ia/diagnostic-evaluer/{requete.json,reponse.json,invalides/…}`, mettre à jour
  `contrats/ia/README.md:24-29`, étendre les tests de contrat des deux côtés, et modifier les deux occurrences
  de `recommandation-parcours/requete.json:13,19`.
- Le backend reflète le même nom de champ dans `backend/app/schemas/ia.py:59` et `:87`.

### 5.9 Tests `ia-service` utilisant des questions de diagnostic

| Fichier | Lignes `id_question` | Couverture |
|---|---|---|
| `ia-service/tests/test_api_diagnostic.py` | 18 | Corps HTTP de `POST /diagnostic/evaluer` (l.26-31), succès (l.58-73), entrée invalide sans recopie de données (l.76-91), contexte incohérent (l.94-101), erreurs LLM (l.104-126), réponse inexploitable (l.129-135), OpenAPI (l.138-145). |
| `ia-service/tests/donnees.py` | 26 | `RESULTAT_VALIDE` partagé (l.18-34). |
| `ia-service/tests/test_agent_diagnostic.py` | 49, 55, 76, 288, 295, 325, 350, 381, 630, 648, 668, 689, 709, 714, 720, 794 | Données `REPONSES`/`ENTREE`/`RESULTAT` (l.47-84), transmission au prompt (l.249), requête RAG avec/sans énoncé (l.282, 319, 344, 375), cohérence des preuves (l.598, 624, 643, 663, 684), unicité des identifiants (l.709-720), HSK (l.788). |
| `ia-service/tests/test_diagnostic.py` | 51, 57, 70, 83, 97, 109, 159, 243, 269, 274, 306, 312, 318, 324, 330, 331, 339, 346 | Validation Pydantic de `PointFaible`/`ResultatDiagnostic` (l.24-170), `verifier_coherence` (l.222-240), `preuve_directe` (l.263-282), `verifier_preuves` (l.297-348). |
| `ia-service/tests/test_jeu_cas_diagnostic.py` | 81, 101 | Schéma `ReponseCas` (l.80-86), validation croisée (l.99-130) des 12 cas ; `ia-service/tests/data/diagnostic/jeu_cas.json:12,46,53,87,121,155,162,196,230,264,298,320,342,364`. |
| `ia-service/tests/test_exemples_json.py` | via JSON | Valide tous les exemples : valides l.16-22, invalides l.25-35, tests l.42-53, couverture exhaustive l.56-61. |
| `ia-service/tests/test_llm_demonstration.py` | 30-33, 71, 84, 115, 220, 255 | Analyse déterministe du factice (l.37-50, 66-72, 75-99 et suivants). |
| `ia-service/tests/test_prompts.py` | 21, 112, 184, 225 | Version active du prompt : présence de `id_question` et règles de preuve (l.105-124), archives 1.0.0 non chargées (l.99-102), ressources présentes (l.127-132). |
| `ia-service/tests/test_agent_recommandation.py` | 37, 43, 134 | Points faibles transmis à `POST /recommandation/actions`. |
| `ia-service/tests/test_api_recommandation.py` | 19 | Corps HTTP de la route recommandation. |
| `ia-service/tests/test_chatbot.py` | 32 | Occurrence idiomatique « Bonne question ! » — **sans rapport**. |

### 5.10 Inventaire des occurrences du mot « question » dans `ia-service`

**Code applicatif (`app/`, 56 occurrences)** :

- Diagnostic / preuves : `app/schemas/diagnostic.py:8,58,61,76,204,206,208,211,216` ;
  `app/agents/diagnostic.py:96,97,99` ; `app/prompts/variables.py:26,37,87`.
- LLM factice : `app/llm/demonstration.py:62,71,120,121,140,250`.
- Chatbot (langage naturel, pas un champ de contrat) : `app/prompts/chatbot/conversation@1.0.0.systeme.md:1`,
  `conversation@1.1.0.systeme.md:1`.
- Ressources de prompt versionnées : `app/prompts/diagnostic/evaluation@1.1.0.systeme.md:17,37` ;
  `evaluation@1.1.0.jsonl:1,2,3` ; `evaluation@1.0.0.jsonl:1,2` (archivé, non chargé —
  `app/prompts/registre.py:20,77`) ; `app/prompts/exemples/diagnostic/quotidien.json:6,17,28,39,50` ;
  `examen.json:6,17,28,39,50` ; `entretien.json:6,17,19,21,28,39,50`.
- Corpus pédagogique (**autre notion, à ne pas renommer aveuglément**) :
  `app/rag/corpus_experimental.py:45,47,48,70,254,257,261,277,296` — `ExerciceExperimental.question: str`
  (l.70), groupes `question_answer`/`open_questions` mappés vers `exercice_qa` (l.44-49).

**Tests et exemples** : `ia-service/tests/exemples/valide/resultat-diagnostic.json:9`,
`reponse-diagnostic.json:15`, `requete-diagnostic.json:19,25`,
`invalide/resultat-diagnostic-confiance-nulle-avec-point-faible.json:9`,
`invalide/resultat-diagnostic-domaine-duplique.json:9,15`,
`invalide/resultat-diagnostic-domaine-inconnu.json:9`, `tests/data/diagnostic/jeu_cas.json` (14 occurrences).
`ia-service/tests/test_rag_experimental.py:53,58,66,76,88,92,99,103` concerne le corpus expérimental,
distinct du diagnostic.

**Documentation (`ia-service/docs/`, 21 occurrences)** : `contrat-modeles-ia.md:141,196,213,346,406` ;
`US-29-agent-diagnostic.md:13,59,120,190,196,225` ;
`US-30-points-faibles-phase-assimil.md:45,52,92,128,169,193` ; `US-70-prompt-diagnostic.md:32,54` ;
`US-71-bibliotheque-few-shot.md:21` ; `US-151-validation-stricte-pydantic.md:102` ; `ia-service/README.md:202`.

**Corpus de données (hors migration)** : 27 fichiers JSON, 16 800 occurrences de la clé `"question"` dans
`ia-service/corpus/cecrl/**/*_dataset_200_QA_200_MCQ.json` (ex. `italian/italian_a1_dataset_200_QA_200_MCQ.json:7,21,26`).
Ce sont des exercices pédagogiques non officiels (`corpus_experimental.py:1-6,32`), sans rapport avec le contrat
diagnostic.

### 5.11 Points d'adaptation recommandés (analyse, sans modification)

| Élément | Refs | Effet d'un passage à `usage='diagnostic'` |
|---|---|---|
| `id_question` (champ de contrat) | `variables.py:26`, `schemas/diagnostic.py:61,76`, `schemas/recommandation.py:55`, `contrats/ia/recommandation-parcours/requete.json:13,19` | Si le nom devient `id_exercice`, bascule **atomique des deux côtés** (backend `backend/app/schemas/ia.py:59,87`) : `extra="forbid"` refusera l'ancien et le nouveau tant que les deux ne sont pas alignés. Alternative moins cassante : conserver `id_question` et ajouter `usage_pedagogique` comme nouveau champ. |
| `enonce` | `variables.py:30`, `agents/diagnostic.py:67-70` | Un exercice de banque apporte son énoncé ; il existe déjà, exclu du prompt mais utilisé par le RAG. Ne pas le rendre visible au LLM sans réévaluer la défense anti-injection (`ia-service/docs/US-70-prompt-diagnostic.md:38-40`). |
| Prompt versionné | `app/prompts/registre.py:20,77,264-290` ; `evaluation@1.1.0.systeme.md:17,37` | Toute modification de nom de champ exige une **nouvelle version** (`1.2.0`) et une nouvelle `VERSION_AGENT` (`agents/diagnostic.py:48`) : l'empreinte SHA-256 est calculée sur les fichiers (`registre.py:273-281`) et testée (`test_api_diagnostic.py:69`). |
| Fournisseur `demonstration` | `app/llm/demonstration.py:139-142` | Parseur de clés brutes à mettre à jour en même temps que le template `utilisateur.md:7`. |
| `usage` existant | Aucun champ `usage` métier dans `ia-service/app` ; `usage` désigne la consommation de tokens dans `llm/adaptateurs/gemini.py:189,225,238-239,287-325` et `compatible_openai.py:96-166,203-206,358-361` | Privilégier un nom explicite (`usage_pedagogique`, `usage_exercice`) ou documenter clairement la valeur `"diagnostic"` pour éviter la confusion. |
| Recommandation | `app/schemas/recommandation.py:17,55` ; `contrats/ia/recommandation-parcours/requete.json:13,19` | Les points faibles transportent `id_question` jusqu'à la recommandation : migration coordonnée des deux contrats partagés. |

### 5.12 Le service IA n'accède pas à la base — confirmé

- Dépendances : `ia-service/requirements.txt:1-11` — FastAPI, uvicorn, Pydantic, httpx, packaging,
  google-genai uniquement. Aucun SQLAlchemy/psycopg/asyncpg, aucun client Redis, aucun Alembic.
- Code : `app/agents/diagnostic.py:8-10` (aucun accès PostgreSQL, aucune mémoire apprenant persistée, aucun
  recalcul du score objectif), `app/agents/correction.py:9`, `app/rag/local.py:5`, `app/harness/agent.py:3`,
  `app/main.py:7-8` (le service ne persiste rien ; le backend valide et enregistre).
- Configuration : `app/core/config.py:1-25,41-74` ne reconnaît que `LLM_*`/`GEMINI_*`/`ENVIRONNEMENT`, aucune
  `DATABASE_URL`.
- Container : `docker-compose.yml:91-127` — variables LLM/RAG/token uniquement (l.96-118), volumes `:ro` sur
  `models/` et `corpus/` (l.119-121), aucun port hôte (l.125), réseau `back-tier` seul (l.127). `depends_on: redis`
  (l.122-124) est un vestige : aucun client Redis n'est utilisé dans le code.

**Conclusion partielle** : le stockage de `usage='diagnostic'` relève exclusivement du backend, propriétaire de
PostgreSQL/Alembic. Le service IA ne nécessite aucune migration de schéma, seulement une coordination de contrat.

---

## 6. Liste exhaustive des appels à la table `question`

### 6.1 Backend — code de production

**Modèle et registre**
- `backend/app/models/diagnostic.py:19,20,22,25,27,30,37,42,44,46-47,48-49,85-86,90-91,97` ;
  `backend/app/models/__init__.py:5,45`.

**Routes**
- `backend/app/api/routes/diagnostic.py:8` (import), `:11` (`QuestionOut`), `:54` (mapping `QUESTION_INCONNUE`),
  `:97-108` (helper `_question_out`), `:115` (`id_question` depuis `Reponse`), `:139` (`response_model`),
  `:145,151,154,197`.

**Schémas**
- `backend/app/schemas/diagnostic.py:10-21` (`QuestionOut`, `id_question` `:13`, type `:16`), `:31`
  (`nombre_questions`), `:39` (`ReponseCreate.id_question`), `:55` (`ReponseOut.id_question`).
- `backend/app/schemas/ia.py:59` (`PreuveDiagnosticIA.id_question`), `:87` (`PointFaibleIA.id_question`).

**Services**
- `backend/app/services/diagnostic.py:10,17,20-21,27-28,37,48,61` (`select(Question)`), `:62` (filtres
  `Question.id_langue`/`id_niveau`), `:63` (`order_by`), `:71,73-75,77` (agrégat count), `:116,131`
  (`db.get(Question, id_question)`), `:132-139,144,154,164,170`.
- `backend/app/services/scoring.py:9,30,55-56,86-95` (`select(Question)` `:88`, filtres `:90-92`,
  `order_by` `:94`), `:97-101` (`choix`/`reponse_correcte`), `:106` (`Reponse.id_question.in_([...])`),
  `:109-111` (comparaison à `reponse_correcte`).
- `backend/app/services/analyse_diagnostic.py:12-13,26,75-82` (dataclass `_Ligne`, `id_question` `:77`),
  `:93-119` (requête : `Question.id_question` `:97`, `.competence` `:98`, `.type_reponse` `:99`,
  `.reponse_correcte` `:101`, `.enonce` `:102`, **jointure** `.join(Question, Question.id_question == Reponse.id_question)` `:105`,
  `order_by` `:107`), `:111,169` (`id_question=str(ligne.id_question)` transmis à l'IA), `:123-142`.
- `backend/app/services/lecture_parcours.py:36` — **chaîne JSON littérale `"question"`** dans `CHAMPS_VISIBLES`
  (`:31-44`), liste blanche des clés de `contenu` exposées par `_vers_exercice_de_lecon` `:169-171`. C'est le
  seul `"question"` littéral du code de production `app/` ; il ne s'agit pas de la table.

**Seeds**
- `backend/app/seed_diagnostic.py:15` (import), `:19-30` (dataclass `QuestionDemo`), `:33-155`
  (`QUESTIONS_DEMO`), `:158` (`charger_questions_demo`), `:162` (`select` d'existence), `:164,168`,
  `:172-184` (**insert `Question(...)`** `:173`, `reponse_correcte` `:178`), `:186` (commit).
- `backend/app/seed.py:39` (import du chargeur), `:180` (appel), `:181` (log).

**Scripts et migrations**
- `backend/scripts/verifier_contrat_ia.py` : **aucune occurrence** (le script ne teste que la correction `:16-19,26-38`).
- `backend/alembic/versions/20261021_bd6763f7f861_tables_du_diagnostic.py:1,25,26,33,56,59,62,64,68,72`.
- `backend/alembic/versions/20261023_diagnostic_question_payload.py:1,22,25-31,35-41`.
- `backend/alembic/versions/20261027_diagnostic_scoring.py:16,19,33,34`.
- Aucune occurrence dans les 11 autres migrations.

### 6.2 Backend — tests

`backend/tests/fabriques_parcours.py:19,94-110` (helper `creer_question_diagnostic`, insert `:99,108`), `:113,125-126`.

| Fichier | Références | Ce qui casserait si `question` disparaissait |
|---|---|---|
| `backend/tests/test_modele_diagnostic.py` | `:14,27,28-36,49,58-62,73,95-102,116,133-135,143,157-164,168,188,278,282,226-248,251-274,283-304` | Relations `Reponse.question`, unicité, RESTRICT langue/question, SQL brut `DELETE FROM question` `:162`, colonnes via `information_schema` à chaque palier de downgrade. |
| `backend/tests/test_seed.py` | `:11,29,35,38,43-44,50,57-59,79-98` | Comptage `Question`, idempotence du chargeur, `QuestionDemo`, chaîne HTTP complète avec `id_question` `:97`. |
| `backend/tests/test_diagnostic_questions.py` | `:6,10-36,42-50,61,73-84,100-152` | Helper `_ajouter_question`, créations, garde-fou « pas de `reponse_correcte` dans la réponse » `:69`. |
| `backend/tests/test_diagnostic_langues.py` | `:6,12-23,63-67` | Helper `_ajouter_question`, comptage par langue/niveau. |
| `backend/tests/test_diagnostic_reponses.py` | `:6,20-30,48-55,69-75,96,103,115,126,133,145,152,159,169,179,186,196,199,225,233,240` | Helper `_creer_question`, payloads `id_question`, cohérence tentative/question. |
| `backend/tests/test_diagnostic_scoring.py` | `:9,27-45,48-58,117-119,156-157,177-179,190,207-209,225,240,250-261` | Helper `_creer_question` avec `reponse_correcte`, scoring déterministe, non-exposition de la clé `:250-261`. |
| `backend/tests/test_diagnostic_analyse.py` | `:7,49,81-107,110-119,140-149,172,194-206,226-227,242-243,257-258,281-282,295,315-316,324,332-333,346-347` | Helper `_creer_question`, jointure analyse, `id_question` transmis à l'IA. |
| `backend/tests/test_generation_parcours.py` | `:12,30-43,48-55,125,127,146,147,165,175,176,195,200,219,223,251,254,289,290,314,317,332` | Helper `_question_scorable`, `Reponse(question=...)`, génération de parcours. |
| `backend/tests/test_smoke_generation_parcours.py` | `:16,22,37-38,57,66,92-93` | Usage du helper `creer_question_diagnostic`. |
| `backend/tests/test_parcours_coherence.py` | `:17,47` | `passer_diagnostic(client, apprenant, creer_question_diagnostic(db))`. |
| `backend/tests/test_correction_automatique.py` | `:146` | Chaîne JSON `"question": "Où ?"` dans un `contenu` d'exercice au format `ecoute` `:141-150` — **à ne pas confondre avec la table**. |
| `backend/tests/test_ia_service.py` | `:35,61` | `id_question` dans enveloppe IA simulée et `PreuveDiagnosticIA`. |
| `backend/tests/test_recommandation.py` | `:22,28,236` | `id_question` dans `POINTS_FAIBLES` et requête. |

### 6.3 Service IA et contrats

Les occurrences exhaustives côté IA sont recensées au §5.10 : schémas (`schemas/diagnostic.py:8,58,61,76,204,206,208,211,216` ;
`agents/diagnostic.py:96-99` ; `prompts/variables.py:26,37,87`), LLM factice (`llm/demonstration.py:62,71,120,121,140,250`),
prompts versionnés, exemples JSON, jeu de cas et documentation. **Hors périmètre de renommage** :
`app/rag/corpus_experimental.py:45-48,70,254,257,261,277,296` et les 16 800 occurrences de la clé `"question"`
dans `ia-service/corpus/cecrl/**/*_dataset_200_QA_200_MCQ.json` (corpus pédagogique expérimental, distinct du
contrat diagnostic).

Contrats partagés : `contrats/ia/recommandation-parcours/requete.json:13,19` (les deux seules occurrences) ;
**aucun contrat diagnostic n'existe** dans `contrats/ia/`.

### 6.4 Frontend — impact indirect (hors table, pour mémoire)

`frontend/src/types/test-diagnostic.ts:19-33` (`Question`, `id_question` en `:20`), `:46-49,66-71,79-100,188-192` ;
`frontend/src/mocks/questions-test.mock.ts` et `frontend/src/mocks/__tests__/test-diagnostic.mock.test.ts:3,10-11,19-38,59-77` ;
`frontend/src/hooks/useTestDiagnostic.ts:14,23-26,68-69,115-126,168` ;
`docs/api/contrat-frontend.md:432-617` (contrat diagnostic, `id_question` `:510,550,565,730`).

---

## 7. Synthèse des risques (provisoire)

### 7.1 Constats structurants backend

1. **Aucun code de conversion `question` → `exercice` n'existe.** La génération de parcours
   (`backend/app/services/parcours.py:260-322`) ne lit jamais `Question` : elle part de `TestDiagnostic`
   (`:267-278`), sélectionne des `Exercice` du catalogue (`:184-210,213-221`) et crée des `ParcoursExercice`
   (`:224-257`). Le catalogue est alimenté séparément par `backend/app/seed_parcours.py:27-63,258-282`.
2. La table `question` n'est lue/écrite **que** par les routes/services diagnostic
   (`backend/app/services/diagnostic.py`), le scoring (`backend/app/services/scoring.py`), l'analyse IA
   (`backend/app/services/analyse_diagnostic.py`) et le seed (`backend/app/seed_diagnostic.py`). Aucune référence
   dans `scripts/`, aucun appel dans les services parcours.
3. La clé JSON `"question"` n'existe en production que comme **clé visible** d'un `contenu` d'exercice
   (`backend/app/services/lecture_parcours.py:36`) ; le contenu de démo n'utilise que `enonce`/`choix`
   (`backend/app/seed_parcours.py:40-48`), tandis qu'un test couvre le format avec clé `question`
   (`backend/tests/test_correction_automatique.py:146`).
4. `reponse_correcte` (`backend/app/models/diagnostic.py:38`) est la donnée la plus sensible : lue par le scoring
   (`:98,111`) et l'analyse IA (`backend/app/services/analyse_diagnostic.py:101`), jamais exposée par `QuestionOut`
   (`backend/app/schemas/diagnostic.py:10-21`) — garde-fou testé en
   `backend/tests/test_diagnostic_scoring.py:250-261` et `backend/tests/test_diagnostic_questions.py:69`.
5. Le head Alembic est `dfbf0715302a` (fusion) : toute migration « question → exercice » devra le prendre comme
   `down_revision` et mettre à jour les modèles concernés ainsi que `backend/app/models/__init__.py:5,16`.

### 7.2 Tableau des risques

| Risque | Portée | Élément de contrôle |
|---|---|---|
| Rupture de contrat backend ↔ IA sur `id_question` | `extra="forbid"` (`ia-service/app/schemas/base.py:14`) | Bascule atomique backend + IA + prompts versionnés ; contrats partagés à créer |
| Perte de la clé privée `reponse_correcte` | scoring et analyse | Copie intégrale dans le `contenu` versionné ; test de non-exposition à relancer |
| Réponses existantes orphelines | `reponse.id_question` FK RESTRICT | Migration de la FK avec conservation des identifiants ou table de correspondance |
| Diagnostic en cours à la clôture | `test_diagnostic.statut = EN_COURS` | Fenêtre de maintenance ou double lecture pendant la transition |
| Empreinte du prompt versionnée | `registre.py:273-281`, `test_api_diagnostic.py:69` | Nouvelle version de prompt + `VERSION_AGENT` |
| Parseur JSON brut du factice | `demonstration.py:139-142` | Test `test_llm_demonstration.py` à relancer |
| Confusion du mot `usage` (tokens vs pédagogie) | adaptateurs LLM | Nom de champ explicite proposé |
| Renommage erroné des `question` du corpus RAG | `corpus_experimental.py`, `corpus/cecrl/**` | Hors périmètre : ne pas toucher |
| Seed insert-only | `backend/app/seed_diagnostic.py:162` | Ajout de `donnees_test` sans duplicateur ; base déjà peuplée non reconfigurée |

---

## 8. Synthèse finale

L'audit couvre les cinq points demandés. Aucun fichier n'a été modifié hors ces deux documents d'analyse.

**Ce que la migration devra déplacer** : 35 questions en dur (18 `en`, 17 `fr`, toutes `choix`), leurs réponses
associées, 3 migrations historiques qui ont construit `question`, 12 fichiers de tests backend, 7 fabriques, le
contrat `QuestionOut`/`ReponseOut`, le scoring, l'analyse IA, le seed, la CI Docker et — côté IA — un champ de
contrat (`id_question`), un parseur JSON brut, un prompt versionné et deux contrats partagés dont un à créer.

**Ce qu'elle ne doit pas toucher** : le corpus RAG (`ia-service/corpus/cecrl/**`, 16 800 clés `question`),
le chatbot (occurrence idiomatique), `app/rag/corpus_experimental.py`, les scripts de vérification de clés LLM,
ni aucun audio (le seed n'en contient déjà pas).

**Séquence critique** : `reponse.id_question` (FK RESTRICT) → `reponse.id_exercice` doit être backfillé avant la
suppression de `question` ; l'empreinte du prompt IA et le `extra="forbid"` imposent un déploiement atomique
backend + IA + frontend ; le head Alembic est `dfbf0715302a`.

Le plan de migration correspondant est dans
[`../plan/migration_banque_exercices.md`](../plan/migration_banque_exercices.md). Il doit encore être validé avant
toute modification de schéma.
