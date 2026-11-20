# AUDIT TECHNIQUE — US150-A : Indexation et récupération RAG

> **Date** : 20/11/2026  
> **Périmètre** : indexation et récupération RAG (CECRL / HSK) de l'Agent IA Diagnostique, La Digithèque.  
> **Branche / worktree** : `audit/US150-A-rag-indexation`, `C:\Users\Best\AppData\Local\Temp\opencode\audit-us150-a-rag`.  
> **Commit audité** : `acd74ed5ecad9b4b4fe38fbc986d21436aadbc08` (`origin/develop` au moment de l'audit).  
> **Nature de l'intervention** : audit en lecture seule. Aucun code métier, aucune configuration et aucun test n'ont été modifiés ; ce document est le seul livrable.  
> **Règle de preuve** : un statut « terminé » dans un document, un nom de branche ou un notebook ne constituent pas une preuve. Tout constat ci-dessous est déduit du code, des fichiers réellement présents et de commandes dont la sortie est citée. Les textes synthétiques de test ne sont jamais présentés comme des descripteurs officiels.

---

## 1. État général du RAG

**Verdict : PARTIELLEMENT FONCTIONNEL.**

Le service IA contient une chaîne de récupération lexicale BM25 **complète et testée**, mais elle ne peut pas servir de descripteurs réels dans la configuration livrée : le fichier `descripteurs.jsonl` du corpus CECRL est absent du dépôt, aucun corpus HSK n'existe, `RAG_CORPUS_ACTIF=false` par défaut et aucun embedding/index vectoriel n'a jamais été produit ni chargé. En exploitation, le chemin effectivement exécuté est donc `RecuperateurVide` → repli synthétique pour `fr/en/it/de`, et résultat vide avec `A_VERIFIER` pour `zh` (HSK).

| Couche | État | Preuve courte |
|---|---|---|
| Corpus CECRL officiel normalisé | **Bloquant** : manifeste seul, JSONL absent | `ia-service/corpus/cecrl/manifeste.json`, `.gitignore:94` |
| JSON pédagogiques CARCL | **Présents mais non officiels, non consommés, avec doublons** | 27 fichiers suivis par Git, §3.3 |
| Corpus HSK | **Bloquant** : aucun artefact récupérable | voir §4 |
| Embeddings / index Colab | **Inexistant** : notebook historique supprimé, jamais exécuté | §5 |
| Retriever dense | **Absent** | `ia-service/app/rag/local.py:3-5` |
| Retriever BM25 local | **Implémenté, déterministe, borné** | `ia-service/app/rag/local.py:27-59, 85-193` |
| Fusion dense + lexical | **Absente** | `RecuperateurAvecRepli` est un repli, pas une fusion (`repli.py:107-116`) |
| Intégration FastAPI / agent | **Présente et testée**, mais branchée sur le repli par défaut | `ia-service/app/main.py:31-59`, `app/agents/diagnostic.py:111-201` |
| Pertinence sur données réelles | **Non démontrée** : tous les tests utilisent un corpus synthétique | `ia-service/tests/donnees_corpus.py:1-4` |

Ce qui fonctionne réellement (preuves exécutées ; §8) : chargement d'un corpus valide, filtres langue/niveau/compétence, classement BM25 déterministe, troncature et déduplication avant injection au prompt, repli explicite « non officiel », gestion d'erreurs `CORPUS_INDISPONIBLE`, réponse HTTP 200 avec `version_corpus=synthetique_fallback`.

Ce qui ne fonctionne pas : récupération de descripteurs officiels CECRL, récupération HSK, recherche sémantique, fusion hybride, citation de sources par descripteur, visibilité de l'état du corpus dans `/health`, rechargement d'index.

---

## 2. Inventaire des composants existants

Tous les chemins sont relatifs à la racine du worktree.

| Composant | Rôle réel | Preuve |
|---|---|---|
| `ia-service/app/rag/base.py` | `RequeteRAG` (6 champs), `Protocol RecuperateurRAG` (`nom`, `version_corpus`, `rechercher`, `fermer`), constantes de provenance | `base.py:45-88` |
| `ia-service/app/rag/corpus.py` | Lecture stricte de `manifeste.json` + `descripteurs.jsonl`, validation SHA256, comptages, doublons, schéma `cecrl:*` | `corpus.py:32-33, 86-125, 199-224` |
| `ia-service/app/rag/local.py` | BM25 maison, filtres, tri total, projection `DescripteurRAGPrompt` | `local.py:27-193` |
| `ia-service/app/rag/vide.py` | Récupérateur neutre (`nom='aucun'`, `version_corpus=None`) | `vide.py` |
| `ia-service/app/rag/repli.py` | Catalogue `fr/en/it/de`, refus HSK, identifiants `synthetique_fallback:*`, texte « non officiel » | `repli.py:21-50, 58-91, 107-116` |
| `ia-service/app/rag/fabrique.py` | Bascule `RecuperateurVide` / `RecuperateurLocal` selon `RAG_CORPUS_ACTIF` ; erreurs absorbées et journalisées | `fabrique.py:23-47` |
| `ia-service/app/rag/config.py` | `ConfigRAG`, préfixe `RAG_`, 3 variables, chemin par défaut `ia-service/corpus/cecrl` | `config.py:16-45` |
| `ia-service/app/main.py` | Chargement unique au lifespan, injection dans `app.state` et dans le `Harness` | `main.py:31-59` |
| `ia-service/app/agents/diagnostic.py` | `_recuperer_descripteurs()`, validation, dédup/plafond 8, injection `descripteurs_rag`, marquage `A_VERIFIER` | `diagnostic.py:111-201` |
| `ia-service/app/prompts/variables.py` | `DescripteurRAGPrompt` (6 champs), `verifier_referentiel()` | `variables.py:39-55` |
| `ia-service/app/harness/execution.py` | Enveloppe toujours le récupérateur dans `RecuperateurAvecRepli`, budget global, `version_corpus` dans `MetaExecution` | `execution.py:55, 84-120` |
| `ia-service/corpus/cecrl/manifeste.json` | Manifeste réel : version `cecrl-2020.1`, `langues: ["en"]`, A1–B2, 325 descripteurs annoncés | `manifeste.json:2, 18-52` |
| `ia-service/corpus/cecrl/{anglais,Deutsch,français,italian}/` | 27 JSON CARCL suivis par Git (QA/QCM originaux non officiels), **non lus par le service IA** | §3.3 ; `git ls-files -- ia-service/corpus` |
| `ia-service/scripts/ingestion_cecrl.py` | Génère le JSONL à partir du classeur source (hors dépôt) | `scripts/ingestion_cecrl.py` |
| `ia-service/tests/test_rag_*.py`, `test_agent_diagnostic.py` | 96 tests ciblés, corpus synthétique uniquement | §8 |
| `docker-compose.yml` | `RAG_CORPUS_ACTIF=false`, `RAG_CORPUS_CHEMIN=/app/corpus/cecrl`, montage `./ia-service/corpus:/app/corpus:ro` | `docker-compose.yml:111-116` |

La branche locale `feature/US150-A-rag-multi-referentiels` pointe sur `86c529f`, **ancêtre de `develop`**, sans commit propre : aucune implémentation US150-A « multi-référentiels » n'est disponible ici.

---

## 3. État du corpus CECRL

### 3.1 Deux corpus distincts à ne pas confondre

Le dossier `ia-service/corpus/cecrl/` contient **deux réalités très différentes** : le manifeste du corpus officiel PRE-08, et 27 fichiers JSON pédagogiques d'origine CARCL. Aucun des deux n'est servi au prompt aujourd'hui.

### 3.2 Corpus CECRL officiel (PRE-08) : manifeste seul

| Critère | Constat | Preuve |
|---|---|---|
| Sources brutes | **Absentes du worktree**. Décrites seulement : URL `https://rm.coe.int/cefr-descriptors-2020-/16809ed2c7`, SHA256 `7c80f798…`, édition 2020. | `ia-service/corpus/cecrl/manifeste.json:5-11`, `ia-service/corpus/README.md:28-30`, `scripts/ingestion_cecrl.py:45-57` |
| Artefact normalisé | **`descripteurs.jsonl` absent** ; empreinte attendue `b0bce621…` non recalculable. Le script sait le produire **hors dépôt** (`verifier_sortie_hors_depot` refuse une sortie dans le dépôt). | `manifeste.json:52`, `ingestion_cecrl.py:193-201, 267-271`, `.gitignore:94` |
| Couverture déclarée | `langues: ["en"]`, niveaux `A1,A2,B1,B2` ; 6 compétences ; **325 descripteurs** (A1 64, A2 93, B1 93, B2 75 ; écoute 46, lecture 59, écrit 50, oral 145, grammaire 12, lexique 13). Chiffres **déclarés, non vérifiables ici**. | `manifeste.json:18-52`, `docs/PRE-08-corpus-cecrl.md:18-19, 75-78` |
| Licence / provenance | URL officielle et SHA256 de la source présents, mais `licence.statut: non_clarifiee` (interprétation documentaire : « usage interne, non distribué, non commercial »). | `manifeste.json:9-16`, `corpus/README.md:47-51` |
| Exploitable pour un diagnostic | **Non** : `RAG_CORPUS_ACTIF=false` ; même activé, le chargeur échoue sans JSONL et la fabrique renvoie `RecuperateurVide`. | `config.py:30-32`, `corpus.py:210-224`, `fabrique.py:30-40` |
| Couverture contractuelle | Le manifeste couvre `en`/A1–B2 alors que l'API accepte `fr/it/de` et C1/C2 : ces cas retombent systématiquement en repli. | `manifeste.json:18-26`, `app/schemas/regles.py:22-25` |

Commandes de vérification exécutées (lecture seule) :

```text
Test-Path ia-service/corpus/cecrl/descripteurs.jsonl  → False
Test-Path corpus                                      → False
git ls-files -- ia-service/corpus corpus              → 29 entrées, aucune source binaire, aucun JSONL
```

### 3.3 Les 27 JSON « CARCL » : présents, mais non officiels et non consommés

Ces fichiers sont **suivis par Git** dans `ia-service/corpus/cecrl/{anglais,Deutsch,français,italian}/` : 6 fichiers de niveau par langue (24) + 3 agrégats (anglais, allemand, français ; **aucun agrégat italien**). Aucun script ne les lit.

| Critère | Constat vérifié | Preuve |
|---|---|---|
| Langues / niveaux | `en`, `de`, `fr`, `it` ; niveaux A1→C2. | noms de fichiers, `docs/architecture/gestion-corpus-cecrl-hsk.md:36` |
| Schémas | 4 racines hétérogènes : `question_answer`/`mcq` (en), `open_questions`/`multiple_choice_questions` (de), `question_answer`/`multiple_choice` + `metadata` (fr/it), agrégats imbriqués `data`/`cefr_levels`/`levels`. | `gestion-corpus-cecrl-hsk.md:36, 40-73` |
| Comptage | 8 400 QA + 8 400 QCM enregistrés ; **9 600 items uniques** (4 800 + 4 800) après retrait des 3 agrégats redondants. | `docs/ia/US150-audit-preparation-ingestion.md:53-61` |
| Qualité — doublons | en et fr : 100 % uniques. **Allemand QCM : 55 énoncés uniques/200 par niveau, 319/1 200 dans l'agrégat**, 11 énoncés partagés A2/B2. **Italien : A2 190/200, B1 190/200, B2 170/200, C1 160/200** (QA et QCM). Agrégats en/de/fr = union exacte des fichiers de niveau (différence d'IDs = 0). | parcours des 27 JSON ; `gestion-corpus-cecrl-hsk.md:21-22, 40-73` ; exemples `de_a1_mcq_034/_084/_134/_184` (`...german_a1_dataset_200_QA_200_MCQ.json:2966, 2969, 4716, 6466, 8216`), `IT-A2-QA-132/140` (`italian_a2…json:1202, 1274`), `IT-C1-QA-124/130/134/138/140` (`italian_c1…json:1130, 1184, 1220, 1256, 1274`) |
| Valeurs vides | **0** champ vide parmi `question`, `answer`, `correct_answer`, `options` sur les 27 fichiers. | parcours direct des 27 JSON |
| Métadonnées | Aucune SHA256, aucun auteur, aucune licence. Seule `version: "1.0"` dans l'agrégat anglais. | `english_cefr_dataset_1200_QA_1200_MCQ.json:3` |
| Barème | Les MCQ anglais sont notés `0 %, 20 %, 50 %, 75 %, 100 %` : **crédits partiels, pas des probabilités**. | `english_cefr_dataset_1200_QA_1200_MCQ.json:13-15` |

**Ces JSON ne sont pas des descripteurs officiels.** Leurs propres métadonnées le disent explicitement :

- anglais : « *These are newly authored practice items broadly aligned with the supplied descriptors, not official EAQUALS questions or a validated high-stakes examination.* » (`.../anglais/english_cefr_dataset_1200_QA_1200_MCQ.json:13-15`) ;
- allemand : « *original German practice material, not official exam questions.* » (`.../Deutsch/german_a1_dataset_200_QA_200_MCQ.json:6`) ;
- français : « *Contenu pédagogique original aligné sur les descripteurs du document ; non officiel.* » (`.../français/french_a1_dataset_200_QA_200_MCQ.json:5, 17`) ;
- italien : « *Contenuti didattici originali … non sono quesiti ufficiali di certificazione.* » (`.../italian/italian_a1_dataset_200_QA_200_MCQ.json:5, 17`).

Ils ne sont pas exploitables tels quels pour le diagnostic : schémas incompatibles avec `DescripteurCorpus` (identifiant `cecrl:…` obligatoire, niveaux CECRL ; `corpus.py:101-125`), doublons à éliminer, droits non documentés. Les seuls textes réellement injectés dans les prompts sont les exemples explicitement synthétiques (`app/prompts/exemples/diagnostic/quotidien.json:8`) et le repli original du projet (`repli.py:19, 61-65`).

**Incohérence documentaire à corriger** : `ia-service/corpus/README.md:3` affirme que le dossier contient « uniquement les métadonnées », alors que 27 JSON y sont suivis par Git ; les audits les décrivent comme « hors dépôt » sous `CARCL/`. Les chemins `CECRL/` et `cecrl/` diffèrent aussi en casse selon les documents.

---

## 4. État du corpus HSK

**Aucune donnée HSK n'est présente dans le worktree.** Vérifications exécutées :

```text
Test-Path ia-service/corpus/HSK                         → False
git ls-files | Select-String 'HSK|CARCL|hsk|carcl'       → docs/architecture/gestion-corpus-cecrl-hsk.md uniquement
Get-ChildItem -Recurse -Include *.pdf,*.mp3,*.xlsx,*.zip,*.wav,*.jsonl
   → seulement 3 .jsonl de prompts/exemples, aucun binaire de corpus
```

| Critère | Constat | Preuve |
|---|---|---|
| Sources brutes | **Absentes**. Décrites seulement : 10 PDF (1 326 pages, 715,8 Mo) + 479 MP3 (423,3 Mo, ≈ 2 h 11), arborescences `New HSK 3.0 Level 1/2/3/4A/4B`. Chiffres **non re-comptés ici** (fichiers absents). | `docs/architecture/gestion-corpus-cecrl-hsk.md:26-32, 83-92`, `docs/ia/US150-audit-preparation-ingestion.md:63-95` |
| Langue / niveaux | Mandarin `zh` **inféré** des noms de dossiers et titres, non vérifié par OCR. Niveaux documentés `1,2,3,4A,4B` ; le contrat API n'offre que `HSK 1`…`HSK 6` : 5 niveaux sans données et `4A`/`4B` sans projection. | `gestion-corpus-cecrl-hsk.md:77-79`, `US150-audit-preparation-ingestion.md:88, 194`, `app/schemas/regles.py:22-23` |
| Qualité | 8 PDF image-only, 2 avec OCR partiel ; 120 noms de fichiers audio dupliqués ; 3 conventions de nommage. Aucun doublon binaire affirmé par les audits, non re-vérifiable ici. | `gestion-corpus-cecrl-hsk.md:77-79, 83-92`, `US150-audit-preparation-ingestion.md:94, 359` |
| Artefacts normalisés | **`segments.jsonl`, `audio_index.jsonl`, manifeste HSK absents** : uniquement envisagés dans le plan US150. Aucune transcription MP3. | `US150-audit-preparation-ingestion.md:21-22, 31, 230-233` |
| Provenance / droits | Aucune URL source, version, SHA256 par fichier ni licence. Les audits mentionnent des SHA256 globaux sans les reproduire ; éditeur FLTRP visible dans les ID3 sans accord. | `US150-audit-preparation-ingestion.md:47, 418-420`, `PRE-12` cité ligne 24 |
| Exploitable pour un diagnostic | **Non**. Le chargeur est strictement CECRL (`corpus.py:1, 86-116`), les niveaux HSK ne sont pas représentables dans `ManifesteCorpus` et `RecuperateurLocal.rechercher()` court-circuite tout `referentiel != "CECRL"` (`local.py:115-117`). Résultat observé : vide + `A_VERIFIER`. | `docs/PRE-08-corpus-cecrl.md:112`, `tests/test_rag_local.py:73-101`, `tests/test_agent_diagnostic.py:346-356` |

En synthèse : le HSK est **entièrement documentaire**, sans donnée ni code de récupération. Toute annonce de « RAG HSK opérationnel » serait aujourd'hui fictive.

---

## 5. État des embeddings et index

### 5.1 Notebook Colab : design historique, jamais exécuté

- **Aucun fichier `*.ipynb` n'existe dans le worktree.** Le seul notebook de l'historique a été ajouté en `3250ede` puis supprimé en `3e0df17` (motif : faire échouer `ruff` en CI). Il est récupérable par `git show 3250ede:ia-service/app/rag/La_Digitheque_RAG_CECRL_HSK.ipynb`, mais il n'existe aucun lien `colab.research.google.com` versionné.
- Les 31 cellules du notebook historique ont `execution_count: null` et aucune sortie stockée : **il n'a jamais été exécuté**. Sa mention dans `docs/ia/rapport-US157-IA.md:35-36` (« suppression du notebook Colab », « récupérable ») ne prouve aucune génération d'artefacts.

### 5.2 Design relevé dans le notebook (non réalisé)

| Élément | Valeur prévue | Preuve (notebook historique) |
|---|---|---|
| Modèle d'embedding | `intfloat/multilingual-e5-base`, révision **non figée** | cellule 20/21, l. 533 |
| Normalisation / préfixes | `passage: ` pour les documents, `query: ` pour les requêtes, `normalize_embeddings=True`, puis `faiss.normalize_L2` sur du `float32` | cellules 20, 21, 23, 25, l. 539, 545, 573-577, 611-613 |
| Index dense | `faiss.IndexFlatIP(dimension)`, `dimension = vector_matrix.shape[1]` (calculée à l'exécution, non verrouillée) | cellules 23, 25, l. 575-579, 689 |
| Index lexical | `rank_bm25.BM25Okapi`, tokenisation `[\w]+|[\u4e00-\u9fff]` (CJK conservé), sérialisation `pickle` | cellules 23, 26, 27, l. 689-692 |
| Découpage | `CHUNK_SIZE=900`, `CHUNK_OVERLAP=150` caractères, chunks < 30 caractères rejetés, `chunk_id` = SHA1 de `source_file|source_locator|idx|chunk` | cellule 19, l. 461-480 |
| Fusion | RRF, `rrf_k=60` | cellule 27, l. 696-706 |
| Export prévu | `/content/langue_ia_rag/rag_export/` : `chunks.jsonl`, `faiss.index`, `bm25.pkl`, `manifest.json`, `quality_report.json`, puis ZIP `langue_ia_rag_pack.zip` | cellules 26, 27, 29 |

### 5.3 Réellement présent

- **Aucun artefact** `.faiss`, `.index`, `.npy`, `.npz`, `.pkl`, `chunks.jsonl`, `bm25.pkl`, `manifest.json` ou `quality_report.json` n'existe dans le worktree (`git ls-files` et recherche filesystem négatifs). `ia-service/models/` ne contient que `.gitkeep`. `MODEL_RECO_PATH=./models/recommandation.pkl` (`.env.example:109`) n'est lu par aucun code : ce n'est pas un embedding.
- **Aucune dépendance vectorielle** dans `ia-service/requirements.txt` et `requirements-dev.txt` : pas de `numpy`, `faiss-cpu`, `sentence-transformers`, `rank-bm25`, `torch` ou `chromadb`. Dans l'environnement Python utilisé pour les tests, `importlib.util.find_spec` renvoie `False` pour ces cinq modules.
- **Aucun code de chargement** : `git grep -i -E 'faiss|bm25\.pkl|chunks\.jsonl|rag_export|sentence_transformers|embedding'` sur `ia-service/app`, `scripts` et `tests` ne renvoie aucun résultat. `CorpusCecrl.charger()` lit uniquement `manifeste.json` et `descripteurs.jsonl` (`corpus.py:32-33, 210-224`).
- **Aucun montage du pack** dans Compose : seuls `./ia-service/corpus:/app/corpus:ro` et `./ia-service/models:/app/models:ro` sont montés (`docker-compose.yml:111-116`).

### 5.4 Incompatibilités si le pack Colab était produit tel quel

1. **Noms et schémas divergents** : pack `manifest.json` (clés `pack_version`, `embedding_model`, `vector_index`, `lexical_index`, `chunks_file`) vs service `manifeste.json` (clés françaises strictes, `version` `^[a-z0-9][a-z0-9._-]*$` sur 3–32 caractères, `licence`, `comptages`, `empreinte_descripteurs_sha256` — `corpus.py:86-98`). Un ZIP Colab déposé dans `/app/corpus/cecrl` ne serait pas reconnu.
2. **Facettes incompatibles** : le notebook produit `language: "unknown"`, `level: None`, des niveaux `HSK4A/HSK4B` et des chunks sans `identifiant` `cecrl:xx:yyyy:nnnn`, sans `sous_niveau`, `echelle` ni `competence` valide ; le service impose `DescripteurCorpus` (`corpus.py:101-125`) et `code_langue`/`niveau` fermés (`app/schemas/regles.py:22-44`).
3. **Tokenisation BM25 incompatible** : CJK conservé dans Colab, supprimé par la regex ASCII `[0-9a-z']+` du service (`local.py:32-59`). Les chunks HSK seraient invisibles côté lexical.
4. **Version non verrouillée** : dimension dérivée de `embeddings.shape[1]`, aucune révision HuggingFace, aucune version de `sentence-transformers` épinglée, aucun SHA256 des artefacts dans le manifeste du pack. Une régénération pourrait produire un index silencieusement incompatible.
5. **Droits non portés** : le manifeste du pack n'a aucun champ `licence`, alors que le service l'exige (`corpus.py:55-64, 92-93`).
6. **Risque de versioning accidentel** : `git check-ignore -v --no-index` montre que `faiss.index`, `bm25.pkl`, `chunks.jsonl` et `manifest.json` sous `ia-service/corpus/` ne sont **pas** ignorés ; seul `descripteurs.jsonl` l'est (`.gitignore:94`).
7. **Deux « CECRL » différents** : le notebook ingère des JSON pédagogiques (jeux CARCL originaux non officiels), alors que le manifeste du service décrit le classeur officiel 2020 (325 descripteurs). Les fusionner sans décision documentaire falsifierait la provenance.

---

## 6. État du Retriever

### 6.1 Dense, lexical, fusion

| Fonction | État | Preuve |
|---|---|---|
| Retriever dense | **Absent**. Le champ `texte` de `RequeteRAG` n'alimente que la tokenisation BM25 (`local.py:119`). | `local.py:3-5`, `local.py:119`, `requirements.txt:5-11` |
| Retriever lexical BM25 | **Présent**. `K1=1.5`, `B=0.75`, jetons ≥ 2, NFKD sans accents, mots vides FR/EN, `idf = log(1 + (N-df+0.5)/(df+0.5))`, tri total `(score, compétence, source_no, identifiant)`, `limite` appliquée après tri. | `local.py:27-39, 47-59, 85-111, 113-137, 155-175` |
| Fusion dense + lexical | **Absente**. Aucun RRF, pondération ni fusion de rangs dans `app/**/*.py`. | `repli.py:107-116` (repli seulement) |

### 6.2 Filtres et comportements

- `RequeteRAG.verifier_contexte()` valide la cohérence langue/référentiel/niveau (`base.py:56-65`) ; `referentiel_pour_langue("zh") == "HSK"` (`app/schemas/regles.py:83-90`).
- `RecuperateurLocal.rechercher()` **court-circuite immédiatement** si `referentiel != "CECRL"` ou si le corpus n'est pas chargé (`local.py:115-117`) : le mandarin ne peut jamais être indexé par ce composant.
- Les candidats sont filtrés par `niveau == requete.niveau` et par compétence demandée ou `lexique` (`local.py:145-153`). Langue, niveau et compétence sont donc bien pris en compte, mais la couverture réelle du manifeste (`en`, A1–B2) est plus étroite que celle de l'API (`fr/it/de`, C1/C2).
- Requête sans terme exploitable → séquence vide (`local.py:113-119`), comportement couvert par `test_requete_sans_terme_exploitable_retourne_une_sequence_vide`.
- Restitution des sources : **partielle**. `source_no` est calculé dans `corpus.py:116` puis perdu dans `_vers_prompt()` (`local.py:186-193`) ; `DescripteurRAGPrompt` ne porte que 6 champs (`prompts/variables.py:39-55`). Aucun `sources[]` n'est produit par le service IA ni par le backend, malgré le champ `justification.sources[]` du contrat frontend (`docs/api/contrat-frontend.md:618-675`).
- Corpus vide / flag off / corpus corrompu → `RecuperateurVide` (`fabrique.py:29-40`), puis `RecuperateurAvecRepli` injecté par le Harness (`execution.py:55`) : repères `synthetique_fallback` pour `fr/en/it/de`, rien pour `zh`/HSK (`repli.py:58-91`). Seule `ErreurCorpusIndisponible` est absorbée ; toute autre erreur est propagée (`repli.py:107-116`).
- Aucun timeout RAG dédié : le RAG local est synchrone et sans I/O réseau. Le seul garde-fou est le budget global de 45 s (`diagnostic.py:45`, `execution.py:98-102`) ; une lenteur RAG serait étiquetée `LLM_TIMEOUT`.

### 6.3 Pertinence prouvée

Les 96 tests RAG/agent passent, mais tous les tests de classement utilisent `tests/donnees_corpus.py:1-4` (« Corpus CECRL synthétique … textes inventés », 9 descripteurs). Le test du manifeste versionné (`test_rag_corpus.py:260-275`) vérifie le manifeste et affirme explicitement l'absence de `descripteurs`. **Aucun benchmark, jeu de requêtes annoté ni métrique precision@k / nDCG sur les 325 descripteurs annoncés n'existe.**

---

## 7. État de l'intégration FastAPI

- **Composants réellement utilisés** : `construire_recuperateur()` au démarrage (`main.py:37`), stocké dans `app.state.recuperateur_rag` (`:46`) et passé au `Harness` (`:47-52`). Le Harness ajoute `RecuperateurAvecRepli` (`execution.py:55`) : la fabrique seule ne fournit pas de repli.
- **Chargement au démarrage** : unique, sans watcher ni rechargement ; l'index BM25 est reconstruit en mémoire dans `RecuperateurLocal.__init__` (`local.py:85-88`). `/health` renvoie toujours `{"status": "ok", "service": "ia-service"}` (`main.py:81-84`) : ni corpus actif, ni version, ni état d'index.
- **Séparation CECRL / HSK** : explicite dans les contrats (`regles.py:19-27, 83-90`) et le prompt système (`prompts/diagnostic/evaluation@1.1.0.systeme.md:6`). L'exemple few-shot HSK (`evaluation@1.1.0.jsonl:2`) est un exemple rédigé, **pas** un descripteur récupéré. Aucun récupérateur HSK n'existe.
- **Interface avec l'agent** : `_recuperer_descripteurs()` construit `RequeteRAG` depuis le contexte et les réponses (code langue, référentiel, niveau, compétences dédupliquées, `texte` tronqué à `TEXTE_REQUETE_MAX`, `limite=DESCRIPTEURS_MAX`), appelle le récupérateur puis valide (dédup, refus hors contexte, plafond 8) avant `_construire_variables()` (`diagnostic.py:111-201`). Les identifiants des descripteurs sont bien présents dans le prompt (`test_agent_diagnostic.py:228-245`).
- **Transmission au prompt et à la réponse** : `descripteurs_rag` est substitué dans `evaluation@1.1.0.utilisateur.md:10` par `RegistrePrompts` (`prompts/registre.py:148-163`). `meta.version_corpus` traverse la frontière (`harness/execution.py:114-120`, `backend/app/schemas/ia.py:95-102`), mais `provenance` et `statut_verification` sont écrits puis jamais lus ni sérialisés (`harness/agent.py:45-47`, `diagnostic.py:137-156`). Le backend persiste l'enveloppe dans `analyse_ia` (JSONB) mais n'expose aucun champ `sources` public (`backend/app/services/analyse_diagnostic.py:183-192, 224-230`, `backend/app/schemas/diagnostic.py:88-103`).
- **Erreurs et timeouts** : `ErreurCorpusIndisponible` → code public `CORPUS_INDISPONIBLE`, HTTP 503, `retryable` (`core/erreurs.py:103-106`, `core/codes_erreur.py:33, 53, 60-68, 85`). Timeouts périphériques : `LLM_TIMEOUT=12` (`docker-compose.yml:106`), `IA_SERVICE_TIMEOUT_S=55` (`docker-compose.yml:70`). Aucun `RAG_TIMEOUT`.
- **Configuration** : 3 variables lues au démarrage, `RAG_CORPUS_ACTIF` (défaut `false`), `RAG_CORPUS_CHEMIN`, `RAG_CORPUS_VERIFIER_EMPREINTE` (`config.py:20-45`, `docker-compose.yml:111-113`, `.env.example:92-100`). `docker-compose.dev.yml:34-40` n'ajoute aucun réglage RAG.
- **Frontière de responsabilité** : conformité vérifiée. Aucun import ni pilote PostgreSQL dans `ia-service` (`requirements*.txt` et recherche `sqlalchemy|psycopg|asyncpg|DATABASE_URL` : un seul résultat, un docstring dans `app/harness/agent.py:3`). Le service `ia-service` n'a pas de `DATABASE_URL` dans Compose (`:94-122`) ; la persistance reste dans le backend.

---

## 8. Résultats des tests

### 8.1 Tests exécutés

Commande, depuis `C:\Users\Best\AppData\Local\Temp\opencode\audit-us150-a-rag\ia-service` :

```text
python -m pytest -p no:cacheprovider -o addopts="" -q tests
→ 671 passed, 2 skipped, 1 warning in 33.59s   (exit 0)

python -m pytest -p no:cacheprovider -o addopts="" -q \
  tests/test_rag_local.py tests/test_rag_corpus.py tests/test_rag_fabrique.py \
  tests/test_rag_repli.py tests/test_agent_diagnostic.py
→ 96 passed in 3.34s
```

Les 2 tests ignorés sont `tests/integration/test_gemini_reel.py:19` et `test_groq_reel.py:19` (opt-in `TEST_GEMINI_INTEGRATION=1` / `TEST_GROQ_INTEGRATION=1`, hors suite automatisée pour cause de quota). L'unique avertissement est un `DeprecationWarning` Starlette sur `anyio.abc.BlockingPortal`.

Exemples de tests réellement verts et de ce qu'ils prouvent (liste complète : 96 nœuds collectés) :

| Test | Ce qui est prouvé |
|---|---|
| `test_rag_local.py::test_classement_par_pertinence_lexicale` | BM25 classe `cecrl:en:2020:0013` en tête pour « write a short email » |
| `test_rag_local.py::test_filtre_par_langue`, `::test_filtre_par_niveau`, `::test_filtre_par_competence` | Filtres appliqués |
| `test_rag_local.py::test_mandarin_sans_descripteur_cecrl_retourne_une_sequence_vide`, `::test_referentiel_non_cecrl_est_ignore_meme_avec_un_corpus` | Court-circuit HSK |
| `test_rag_local.py::test_requete_sans_terme_exploitable_retourne_une_sequence_vide`, `::test_recherche_deterministe` | Prudence et reproductibilité |
| `test_rag_corpus.py::test_charger_empreinte_differente`, `::test_charger_refuse_identifiant_en_double`, `::test_charger_refuse_comptage_divergent` | Contrôles d'intégrité du chargeur |
| `test_rag_fabrique.py::test_flag_desactive_retourne_le_recuperateur_vide`, `::test_corpus_corrompu_retourne_le_recuperateur_vide` | Repli sur corpus indisponible |
| `test_rag_repli.py::test_aucun_repli_pour_le_hsk`, `::test_descripteurs_repli_sont_synthetiques_bornes_et_non_officiels` | Refus HSK, étiquetage non officiel |
| `test_agent_diagnostic.py::test_transmet_au_prompt_les_reponses_le_score_et_les_descripteurs`, `::test_preserve_les_descripteurs_reels_sans_fausse_provenance` | Injection au prompt sans fausse provenance |
| `test_agent_diagnostic.py::test_utilise_le_referentiel_hsk_pour_le_mandarin` | Choix du référentiel HSK dans le contrat, **pas** de récupération HSK |

### 8.2 Requêtes anonymisées exécutées

Méthode : script hors dépôt `C:\Users\Best\AppData\Local\Temp\opencode\requetes_US150A.py`, journaux `requetes_US150A.log` et `api_US150A_demo.log`. Aucune donnée personnelle. Le corpus utilisé pour les cas 1, 3 et 4 est le **corpus synthétique de test** (`tests/donnees_corpus.py::corpus_synthetique`, 9 descripteurs, `version=cecrl-test.1`, provenance `non_clarifiee`, textes inventés) : il ne s'agit **pas** de descripteurs officiels.

| Cas | Requête (champs `RequeteRAG`) | Résultats obtenus | Sources |
|---|---|---|---|
| 1. CECRL | `en/CECRL/B1`, compétence `ecrit`, texte « write a short email about your daily routine », `limite=3` | `local-cecrl`, `version=cecrl-test.1`, **2 résultats** : `cecrl:en:2020:0013` (« Can write a short email about travel. »), `cecrl:en:2020:0015` | Descripteurs **synthétiques de test**, identifiants non officiels |
| 2. HSK | `zh/HSK/HSK 3`, compétence `lecture`, texte « 我每天都喝茶 », `limite=3` | Sur `local-cecrl` : **0 résultat** (court-circuit) ; sur `repli-synthetique` : **0 résultat** | Aucune. Aucun corpus HSK |
| 3. Langue + niveau | `en/CECRL/A2`, compétence `grammaire`, texte « present simple third person singular is are » | Sur `local-cecrl` : **0 résultat** (le corpus synthétique n'a pas de grammaire A2) | Aucune ; montre la couverture limitée, pas une panne |
| 3b. Langue + niveau absent | `fr/CECRL/B2`, compétence `oral`, texte « se presenter lors d un entretien » | Local : **0** ; avec repli : **1** (`synthetique_fallback:fr:B2:oral`) | Texte explicite « non officiel et non valide » |
| 4. Sans résultat pertinent | `en/CECRL/B1`, compétence `ecrit`, texte « zzz qqq aucun terme exploitable » | Local : **0** ; avec repli : **1** (`synthetique_fallback:en:B1:ecrit`) | Repli synthétique étiqueté, pas une source officielle |
| 5. Corpus indisponible | `ConfigRAG(corpus_actif=False)` puis `ConfigRAG(corpus_actif=True, corpus_chemin=<dossier inexistant>)` | Dans les deux cas `RecuperateurVide`, `nom='aucun'`, `version_corpus=None` ; journal `Corpus CECRL indisponible (ErreurCorpusIndisponible) : récupérateur vide…` ; avec repli `en/B1/lecture` → 1 repère synthétique, `zh` → 0 | Aucune source réelle |
| API intégrée | `POST /diagnostic/evaluer`, fixture anonymisée `tests/exemples/valide/requete-diagnostic.json`, factice `demonstration` | `GET /health` → **200** ; `POST` → **200**, `meta.version_corpus = synthetique_fallback`, `fournisseur = factice`, 2 points faibles ; ni `provenance` ni `statut_verification` dans la réponse | Repli synthétique ; journal `Repli RAG synthetique utilise` |

Sans `LLM_FACTICE_SCENARIO=demonstration`, le même appel renvoie **500** `ErreurConfiguration`/`LLM_CONFIGURATION` : configurationLLM du factice incomplète, **non** un défaut RAG. Avec un vrai fournisseur, la configuration exige `LLM_MODELE`, `LLM_BASE_URL`, `LLM_API_KEY` (`app/core/config.py:84-109`) ; aucune clé n'était disponible pour cet audit.

### 8.3 Tests impossibles à exécuter ici (non inventés)

| Test | Raison exacte, preuve de commande |
|---|---|
| `make test` / `make check` (backend, PostgreSQL, coverage) | `docker version` → `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine` (exit 1) ; `sqlalchemy` et `psycopg` absents de l'interpréteur (`find_spec` → `False`) |
| Job Docker complet (healthchecks, seed, images) | même démon Docker absent |
| Jest / E2E frontend | `Test-Path frontend/node_modules` → `False` |
| Fournisseurs LLM réels Groq / Gemini | Aucune clé ; tests opt-in explicitement ignorés (quota) |
| Pertinence sur corpus CECRL réel | `descripteurs.jsonl` absent (voir §3) |
| Mise à jour ClickUp | Aucun accès à l'outil depuis cet environnement |

---

## 9. Problèmes identifiés et preuves

| ID | Gravité | Problème | Preuve |
|---|---|---|---|
| P-01 | **Bloquant** | Le corpus CECRL annoncé (325 descripteurs) n'est pas chargeable : `descripteurs.jsonl` absent ; même `RAG_CORPUS_ACTIF=true` retombe en `RecuperateurVide`. | §3.2 ; `corpus.py:210-224`, `fabrique.py:33-40` |
| P-01b | Majeur | 27 JSON CARCL sont versionnés sous `cecrl/` alors que le README dit l'inverse ; ils sont non officiels, sans licence, avec doublons massifs (de, it) et ne sont pas consommés. | §3.3 ; `corpus/README.md:3`, `gestion-corpus-cecrl-hsk.md:40-73` |
| P-02 | **Bloquant** | Aucun corpus HSK exploitable : chargeur limité au CECRL, identifiants `^cecrl:…`, tokenisation ASCII qui élimine le chinois. | §4 ; `corpus.py:108-125`, `local.py:32, 115-117` |
| P-03 | **Bloquant** | Aucun embedding/index généré ni chargeable : notebook supprimé, jamais exécuté, aucune dépendance ni artefact. | §5 |
| P-04 | Majeur | Aucune fusion dense + lexical ; le décorateur existant est un repli. | `repli.py:107-116` |
| P-05 | Majeur | En configuration livrée, la récupération effective est un repli synthétique : `A_VERIFIER` pour `zh`, repères non officiels pour les autres langues. | §8.2 ; `repli.py:58-91` |
| P-06 | Majeur | Sources non citables : `source_no` perdu à la projection, pas de licence/URL par descripteur, `sources[]` absent du contrat backend. | `local.py:186-193`, `prompts/variables.py:39-55` |
| P-07 | Majeur | Aucune preuve de pertinence sur données réelles ; tests uniquement sur 9 descripteurs inventés. | `tests/donnees_corpus.py:1-4` |
| P-08 | Mineur | `/health` ne signale ni corpus actif ni version ; pas de rechargement d'index ni de timeout RAG dédié. | `main.py:81-84`, `execution.py:98-102` |
| P-09 | Mineur | Deux schémas de manifeste incompatibles (`manifest.json` Colab vs `manifeste.json` service), version du modèle non verrouillée, artefacts non ignorés par Git. | §5.4 |
| P-10 | Mineur | `provenance` / `statut_verification` calculés puis jamais exposés ; `MODEL_RECO_PATH` est un leurre. | `harness/agent.py:45-47`, `.env.example:109` |
| P-11 | Majeur | Exposition Docker : `ia-service/.dockerignore` n'exclut aucun corpus et `COPY . .` embarque les 27 JSON (et d'éventuels PDF/MP3 locaux) dans l'image, malgré `non_clarifiee` et l'absence de licence. | `ia-service/.dockerignore:1-13`, `ia-service/Dockerfile:20, 26` |

---

## 10. Travaux nécessaires pour terminer US150-A

Liste ordonnée (dépendances incluses) :

1. **[BLOQUANT] CECRL réel** — générer et livrer `ia-service/corpus/cecrl/descripteurs.jsonl` à partir du classeur source via `scripts/ingestion_cecrl.py`, vérifier les 325 descripteurs, l'empreinte SHA256 et la licence ; conserver le fichier hors Git et le monter en lecture seule. **Ne jamais ingérer les 27 JSON CARCL comme des descripteurs officiels** : dédupliquer (de, it) et clarifier droits d'abord ; corriger `corpus/README.md:3`. Critère : `RAG_CORPUS_ACTIF=true` + `construire_recuperateur()` → `local-cecrl` et non `RecuperateurVide`.
2. **[BLOQUANT] Décision d'architecture « dense »** — trancher explicitement entre (a) RAG lexical seul, documenté comme tel, et (b) pack hybride Colab. En (b), écrire le chargeur, épingler modèle/révision/versions, définir `manifest.json` ↔ `manifeste.json`, ajouter SHA256 des artefacts, dépendances, configuration, montages, tests de dimension/tokenisation/normalisation et clarifier la licence. Ne pas activer « hybride » sans chargeur.
3. **[BLOQUANT] HSK** — étendre le schéma de corpus (`referentiel`, niveaux HSK 1–6, identifiants `hsk:*`), la tokenisation (CJK), la fabrique et les tests ; fournir des sources HSK prouvées. Ne pas présenter les QCM/JSON CARCL comme des descripteurs officiels sans preuve documentaire.À défaut, documenter HSK comme « non couvert, estimation prudente » et le retirer du périmètre US150-A.
4. **Traçabilité des sources** — conserver `source_no`/`source_id`, URL et licence par descripteur jusqu'au prompt ; exposer un statut de vérification explicite (`A_VERIFIER` comme valeur dédiée, pas détournée dans `version_corpus`) ; aligner le contrat `justification.sources[]` avec ce que le service produit réellement.
5. **Preuves de pertinence** — jeu de requêtes annoté sur corpus réel, métriques precision@k / nDCG, seuil d'acceptation, tests CECRL et HSK séparés, régression sur le repli.
6. **Opérabilité** — `/health` expose `rag_actif`, `version_corpus`, `nombre_descripteurs` ; journalisation cohérente flag off vs erreur ; timeout RAG dédié ; invalidation/rechargement contrôlé de l'index.
7. **Sécurité des artefacts** — exclure corpus et artefacts du contexte Docker (`.dockerignore`) ; vérifier `git check-ignore` avant tout export Colab. *Correctif déjà appliqué hors du périmètre de cet audit, dans une branche séparée non commitée.*
8. **Clôture documentaire** — mettre à jour `docs/api/contrat-frontend.md`, `docs/architecture/03-ia-service.md` et le README corpus des décisions 1–3, puis ouvrir la PR avec 2 reviewer IA.

### Actions manuelles dans Google Colab (si l'option 2b est retenue)

Le notebook n'étant plus dans l'arbre de travail, les étapes ci-dessous sont **à réaliser manuellement**, d'après le design historique non exécuté :

1. Récupérer le notebook : `git show 3250ede:ia-service/app/rag/La_Digitheque_RAG_CECRL_HSK.ipynb` ; aucun lien Colab n'est versionné.
2. Runtime Python 3.10/3.11 ; épingler les versions de `sentence-transformers`, `faiss-cpu`, `torch` (absentes du notebook) et noter la révision exacte de `intfloat/multilingual-e5-base`.
3. Téléverser les archives sources (JSON CECRL, PDF HSK) via `files.upload()` ; contrôler l'inventaire après extraction sécurisée.
4. Audit qualité obligatoire : corriger `language: "unknown"`, `level: None`, analyser `needs_ocr_review` ; décider manuellement l'OCR des PDF image-only.
5. Découpage 900/150 caractères, minimum 30 ; vérifier quelques chunks.
6. Embeddings avec préfixes `passage: ` / `query: `, `normalize_embeddings=True`, puis `float32` + `faiss.normalize_L2`, `IndexFlatIP`.
7. Évaluation comparée BM25 / dense / RRF (`rrf_k=60`) sur un jeu de requêtes métier validé.
8. Export : ajouter SHA256 des artefacts, révision du modèle, licence, version compatible `^[a-z0-9._-]{3,32}$` ; télécharger le ZIP et le conserver **hors du dépôt**.
9. Hand-off développeur : chargeur FastAPI, dépendances, configuration, tests et gate juridique (étape 10 du plan ci-dessus). Le `descripteurs.jsonl` officiel reste à générer séparément : le pack Colab ne le remplace pas.

### Prochaine tâche ClickUp à traiter

**`[US150-A / CORPUS-REEL] Livrer le descripteur CECRL exploitable et trancher l'architecture d'indexation`** — dépendance directe de toutes les autres corrections. Aucun identifiant ClickUp vérifiable n'est disponible ici : seul `123t3hw0f33` (US157) est connu, et il concerne une autre tâche. À créer manuellement avec les critères d'acceptation de l'item 1 ci-dessus, puis à relier à PRE-08 et à la décision d'architecture. Note : `CONTRIBUTING.md` parle de Trello, pas de ClickUp ; outil de suivi à clarifier avec l'équipe.

---

## 11. Dépendances avec PRE-08 et les autres tâches US150

| Tâche | Relation avec US150-A | État observable |
|---|---|---|
| **PRE-08** — préparation/ingestion du corpus | Fournit les sources et le référentiel que `CorpusCecrl.charger()` doit consommer. Sans `descripteurs.jsonl` ni clarification des droits, US150-A reste bloquée (P-01, P-01b, P-09). Le JSON CARCL ne peut pas servir de substitut officiel. | `docs/ia/US150-audit-preparation-ingestion.md` ; manifeste présent, JSONL absent, 27 JSON non officiels versionnés, 8 PDF image-only signalés par cet audit |
| **US150-A** — indexation/récupération | Objet du présent audit. Le BM25 local est écrit ; dense/fusion/index HSK manquent. | branche `feature/US150-A-rag-multi-referentiels` = commit ancien, aucun travail propre |
| **US150-B** — repli de descripteurs | Déjà implémenté (`repli.py`) et testé ; il masque l'absence de corpus réel. Doit rester clairement étiqueté « non officiel ». | `feature/US150-B-fallback-descripteurs` ; tests `test_rag_repli.py` verts |
| **US150-C** — périmètre non documenté dans ce worktree | À définir une fois l'architecture d'indexation tranchée ; ne pas lancer de reconstruction avant la décision de l'item 2. | Aucune preuve de portée disponible |
| **PR #65 / #66 (front)** | Indépendantes du RAG : délais et justification absente déjà fusionnés dans `develop` (`73f70ea`, `800a60e`). | Vérifié sur `develop` courant |
| **B-03 / SEC-IMG** (hors US150) | Correctifs préparés dans des branches séparées, hors du périmètre de cet audit, non commités au moment de la rédaction. | `feature/B-03-plafond-analyses`, `feature/F-03-securite-delais` |

---

## Livraison

- Branche : `audit/US150-A-rag-indexation` depuis `origin/develop` (`acd74ed`) ; checkout principal laissé intact (3 fichiers modifiés et 2 fichiers non suivis non touchés).
- Livrable : uniquement `docs/AUDIT_US150_A_RAG.md`. Aucun code métier modifié, aucun test modifié, aucune configuration modifiée.
- Commit : explicite, sur cette branche uniquement.
- Pull Request : préparée vers `develop`, **non fusionnée**.
