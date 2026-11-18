# US150 — Audit technique de préparation à l'ingestion des corpus réels

**Date de l'audit :** 18 novembre 2026

**Branche :** `feature/US150-audit-preparation-ingestion`, créée depuis `origin/develop` à `63aad14` après `git fetch` et vérification de l'état Git

**Statut :** bilan préparé, **en attente de validation du développeur** ; aucun commit, aucune PR, aucune ingestion, aucun OCR, aucune activation du corpus réel et aucune modification du RAG ou des sources.

> **Périmètre.** Sources originales lues en lecture seule : 27 JSON CARCL (hors dépôt), 10 PDF et 479 MP3 HSK (`ia-service/corpus/HSK`), manifeste CECRL versionné et code du RAG. Aucun fichier source n'a été déplacé, renommé, réécrit ou supprimé.
>
> **Conventions.** Mo = 1 000 000 octets, MiB = 1 048 576 octets. Les volumes sont mesurés sur les octets des fichiers ; les durées MP3 proviennent d'un décompte des trames MPEG (CBR), sans lecture audio ni outil externe. Ce document complète `docs/architecture/gestion-corpus-cecrl-hsk.md` (PRE-12) : il ne reprend pas l'inventaire fichier par fichier des 479 MP3, mais approfondit la **préparation à l'ingestion** (schéma commun, formats intermédiaires, pipeline, contrats, tests).

---

## 1. Synthèse exécutive

| Famille | Sources présentes | Réellement exploitable par le RAG aujourd'hui | Verdict d'ingestion |
| --- | --- | --- | --- |
| CECRL officiel | `manifeste.json` seul dans le dépôt ; `descripteurs.jsonl` généré hors dépôt, absent ici | **Non** : corpus désactivé (`RAG_CORPUS_ACTIF=false`), fichier privé non monté | Mécanisme PRE-08 déjà prêt ; droits toujours `non_clarifiee` |
| CARCL | 27 JSON, 9 600 items uniques | **Non** : aucun script ne les consomme ; schémas hétérogènes | Normalisation possible sans dépendance ; déduplication obligatoire |
| HSK PDF | 10 PDF, 1 326 pages, 715,8 Mo | **Non** : aucun PDF n'est lu par le service | 8 PDF image-only → OCR requis ; 2 couches OCR bruitées à vérifier |
| HSK audio | 479 MP3, 423,3 Mo, ≈ 2 h 11 | **Non** : ni transcrits ni indexés | Association par chemin possible ; transcription hors périmètre |

**Quatre constats bloquants avant toute ingestion réelle :**

1. **Droits non clarifiés** pour CARCL et HSK (le manifeste CECRL porte déjà `non_clarifiee`). Aucune autorisation écrite n'a été trouvée.
2. **Couverture PDF insuffisante** : 8 PDF sur 10 ne contiennent aucune couche texte exploitable (une image par page). Un OCR fiable est nécessaire et aucun moteur d'OCR n'est installé dans l'environnement.
3. **Contrat RAG trop étroit** : `ManifesteCorpus` n'accepte que des niveaux CECRL (`A1`…`C2`) et `DescripteurCorpus` impose un identifiant `cecrl:...`. Les niveaux HSK (`HSK 1`…`HSK 6`) et les identifiants HSK/CARCL ne peuvent pas être stockés tels quels sans évolution du modèle, dans une US distincte.
4. **Aucune transcription audio** : les 479 MP3 ne peuvent pas produire de descripteurs textuels seuls ; ils doivent rester des références pédagogiques associées aux pages PDF.

**Ce qui est déjà prêt et ne doit pas être refait** : le port `RecuperateurRAG`, le chargement manifeste + JSONL avec vérification d'empreinte, le récupérateur BM25 déterministe, le repli synthétique explicitement étiqueté (US150-B) et les règles `.gitignore` qui excluent PDF/MP3 et dérivés du dépôt.

---

## 2. Inventaire des sources

### 2.1 Cartographie

| Emplacement | Contenu | Suivi Git | Rôle |
| --- | --- | --- | --- |
| `D:\...\Corpus\CARCL\` | 27 JSON (`anglais/`, `Deutsch/`, `français/`, `italian/`) | Hors dépôt | Sources pédagogiques originales |
| `ia-service/corpus/CECRL/manifeste.json` | Métadonnées seules | Oui | Source de vérité du corpus CECRL (PRE-08) |
| `ia-service/corpus/HSK/` | 10 PDF + 479 MP3 | Non (ignorés) | Sources HSK |
| `ia-service/corpus/README.md` | Règles de droits et d'activation | Oui | Documentation du corpus |
| `ia-service/scripts/ingestion_cecrl.py` | Générateur hors dépôt | Oui | Référence de méthode (empreinte, JSONL, refus d'écrire dans le dépôt) |

Aucun `descripteurs.jsonl`, XLSX, ZIP ou artefact normalisé n'est présent. Les 517 fichiers source ont des empreintes SHA256 distinctes : **aucun doublon binaire** (PRE-12). La redondance est interne aux JSON (agrégats), pas entre fichiers.

### 2.2 CECRL / CARCL — 27 JSON, 11,4 Mo

| Langue | Dossier | Fichiers par niveau | Agrégat | Enregistrements comptés | Items uniques |
| --- | --- | --- | --- | ---: | ---: |
| Anglais (`en`) | `anglais/` | 6 (A1→C2) | `english_cefr_dataset_1200_QA_1200_MCQ.json` (1,78 Mo) | 2 400 QA + 2 400 QCM | 2 400 (1 200 + 1 200) |
| Allemand (`de`) | `Deutsch/` | 6 (A1→C2) | `german_cefr_dataset_1200_QA_1200_MCQ.json` (1,84 Mo) | 2 400 QA + 2 400 QCM | 2 400 (1 200 + 1 200) |
| Français (`fr`) | `français/` | 6 (A1→C2) | `french_cefr_dataset_1200_QA_1200_MCQ.json` (1,58 Mo) | 2 400 QA + 2 400 QCM | 2 400 (1 200 + 1 200) |
| Italien (`it`) | `italian/` | 6 (A1→C2) | **aucun** | 1 200 QA + 1 200 QCM | 2 400 (1 200 + 1 200) |
| **Total** | | **24** | **3** | **8 400 QA + 8 400 QCM = 16 800** | **9 600 (4 800 + 4 800)** |

Les fichiers par niveau contiennent chacun 200 QA + 200 QCM. Les trois agrégats reprennent exactement les mêmes enregistrements, réorganisés par niveau : pour `en`, `de` et `fr`, les identifiants des fichiers par niveau et de l'agrégat se recouvrent à 100 %. **Ils ne constituent pas des sources supplémentaires** et ne doivent pas être ingérés deux fois. L'italien n'a pas d'agrégat, ce qui confirme que l'agrégat est une vue de commodité, pas une exigence du jeu de données.

Les métadonnées déclarent un contenu **pédagogique original aligné** sur des descripteurs (EAQUALS/ALTE 2008 pour l'anglais, descripteurs CEFR pour les autres), avec la mention explicite : *« newly authored practice items broadly aligned with the supplied descriptors, not official […] questions »*. Les scores QCM (`0, 20, 50, 75, 100 %`) sont des **valeurs de rubrique de crédit partiel**, pas des probabilités : cette sémantique doit être conservée lors de la normalisation.

### 2.3 HSK — 10 PDF, 1 326 pages, 715,8 Mo

| Fichier | Niveau | Pages | Taille | Couche texte | CJK extractibles | Images |
| --- | --- | ---: | ---: | --- | ---: | ---: |
| `hsk-course-1-workbook.pdf` | 1 | 139 | 74,0 Mo | aucune | 0 | 139 (1/page) |
| `hsk-course-1-writing.pdf` | 1 | 15 | 4,7 Mo | aucune | 0 | 23 |
| `hsk-course-1.pdf` | 1 | 144 | 66,7 Mo | aucune | 0 | 144 (1/page) |
| `hsk-course-2-workbook.pdf` | 2 | 176 | 227,8 Mo | aucune | 0 | 176 (1/page) |
| `hsk-course-2-writing.pdf` | 2 | 15 | 16,6 Mo | aucune | 0 | 30 |
| `hsk-course-2.pdf` | 2 | 164 | 31,3 Mo | **OCR partiel** | 29 301 | 164 |
| `hsk-course-3-workbook.pdf` | 3 | 187 | 60,4 Mo | aucune | 0 | 187 (1/page) |
| `hsk-course-3.pdf` | 3 | 212 | 43,5 Mo | **OCR partiel** | 47 579 | 212 |
| `hsk-course-4a.pdf` | 4A | 137 | 89,5 Mo | aucune | 0 | 137 (1/page) |
| `hsk-course-4b.pdf` | 4B | 137 | 101,5 Mo | aucune | 0 | 137 (1/page) |
| **Total** | | **1 326** | **715,8 Mo** | | **76 880** | **1 367** |

Tous les PDF sont non chiffrés et lisibles. Les huit fichiers sans texte ne contiennent que des sauts de page (environ 1 caractère extractible par page) et aucune police embarquée : ce sont des pages scannées. Les deux fichiers avec couche OCR n'ont qu'une police et présentent un texte très bruité (caractères parasites, espaces insérés dans les mots, ponctuation corrompue) : voir § 7.1.

### 2.4 HSK — 479 MP3, 423,3 Mo (403,6 MiB)

| Niveau | Nombre | Organisation observée |
| --- | ---: | --- |
| `New HSK 3.0 Level 1` | 215 | `HSK 1 Textbook/Lesson 01..31` (93), `hsk1textbookaudios/lesson-01..31` (85), `hsk1workbookaudios/lesson-01..` (37) |
| `New HSK 3.0 Level 2` | 120 | `Audio/lesson-01..15`, 8 pistes par leçon |
| `New HSK 3.0 Level 3` | 144 | `Audio/lesson-01..18`, 8 pistes par leçon |
| `New HSK 3.0 Level 4A` / `4B` | 0 | Aucun audio pour ces niveaux |
| **Total** | **479** | Organisation par leçon dans chaque série |

Points relevés :

- **120 noms de fichiers identiques** (`10-1.mp3`, `10-2.mp3`, `1-1.mp3`…) : un identifiant ne peut pas être le seul nom de fichier ; il doit être qualifié par niveau + série + leçon.
- Trois conventions de nommage coexistent : `01-1.mp3`, `hsk1-textbook-0101.mp3` / `hsk1-workbook-0101.mp3`, `1-1.mp3`.
- **357 fichiers** commencent par `ID3` ; les étiquettes sont partielles et souvent illisibles (`Album = ?HSK??1`, `Auteurs = FLTRP`, `Titre = 1-1`). Les pistes des séries `hsk1textbookaudios` et `hsk1workbookaudios` n'ont que durée et débit.
- Débits 128 ou 192 kbps, 44,1 ou 48 kHz, CBR. Aucun fichier corrompu détecté au niveau des en-têtes.
- **Aucune transcription** n'existe : l'association au texte PDF doit passer par le chemin et le numéro de leçon/piste.

---

## 3. Structures identifiées et schéma commun

### 3.1 Quatre dialectes JSON

| Langue | Clés racine QA | Clés racine QCM | Niveau (fichier par niveau) | Niveau (agrégat) |
| --- | --- | --- | --- | --- |
| `en` | `question_answer` | `mcq` | clé `level` à la racine | `data.A1…C2.question_answer / mcq` |
| `de` | `open_questions` | `multiple_choice_questions` | clé `cefr_level` à la racine | `cefr_levels.A1…C2.open_questions / multiple_choice_questions` |
| `fr` | `question_answer` | `multiple_choice` | clé `level_descriptor` + `metadata` | `levels.A1…C2.question_answer / multiple_choice` + `metadata` |
| `it` | `question_answer` | `multiple_choice` | clé `level_descriptor` + `metadata` | pas d'agrégat |

Métadonnées racine également hétérogènes : `title`, `version`, `language`, `source_alignment`, `important_note`, `scoring_note` (anglais) ; `language`, `language_code`, `cefr_level`, `level_focus`, `source_basis` (allemand) ; `metadata` (français/italien). Les noms de langue sont tantôt des codes (`de`, `en`), tantôt des libellés (`German`, `English`, `français`, `italiano`). Un adaptateur par dialecte est donc nécessaire ; aucun ne doit réécrire le fichier source.

### 3.2 Union des champs d'items

| Type | Champs observés | Fréquence (comptage avec agrégats) |
| --- | --- | ---: |
| QA | `id`, `question`, `answer`, `level` | 8 400 / 8 400 |
| QA | `language` | 6 000 |
| QA | `answer_type`, `note` | 3 600 / 1 200 |
| QA | `skill`, `type`, `task_instruction` | 2 400 chacun (jeu allemand) |
| QCM | `id`, `question`, `options`, `correct_answer`, `level` | 8 400 / 8 400 |
| QCM | `language`, `scoring_note` | 6 000 / 3 600 |
| QCM | `skill`, `type` | 2 400 chacun |

Structure des options : tableau d'objets `text`, `score_pct`, `is_correct`, avec `score_pct` dans `{0, 20, 50, 75, 100}` et une option correcte. La sémantique de score de rubrique doit être conservée telle quelle ; elle ne doit jamais être interprétée comme une probabilité par un agent.

### 3.3 Schéma commun proposé

Un seul type d'enregistrement `ElementPedagogique` (JSONL) pour les trois familles, avec des champs obligatoires minimaux et un bloc `details` propre à la famille :

| Champ | Type / contrainte | Rôle |
| --- | --- | --- |
| `identifiant` | string, pattern par famille, unique | Clé primaire stable, dérivée de la source |
| `famille` | `carcl` / `cecrl` / `hsk` | Sélection de l'adaptateur et du manifeste |
| `code_langue` | `fr`, `en`, `de`, `it`, `zh` | Facet existante du RAG |
| `referentiel` | `CECRL` / `HSK` | Cohérence avec la langue (déjà validée par le port) |
| `niveau` | `A1`…`C2` ou `HSK 1`…`HSK 6` | Facet de requête |
| `competence` | `grammaire`, `lecture`, `ecoute`, `ecrit`, `oral` | Les 5 valeurs du contrat API (cf. § 4.2) |
| `type_element` | `qa`, `qcm`, `descripteur`, `segment_texte`, `piste_audio` | Destinations pédagogiques distinctes |
| `contenu` | string, 1…3 000 caractères | Texte indexable, tronqué proprement sans invention |
| `source` | objet `SourceRef` (§ 8) | Provenance complète et vérifiable |
| `licence` | `non_clarifiee` / `extraits_non_commercial` / `accord_ecrit` | Même énumération que `LicenceCorpus` |
| `qualite` | `exact`, `ocr_a_verifier`, `metadata_partielle` | Fiabilité du contenu, jamais implicite |
| `details` | objet libre validé par famille | Champs d'origine (options, réponses, page, piste…) |

Le choix de conserver `competence` dans l'énumération API à cinq valeurs est délibéré : la sixième valeur interne `lexique` du corpus CECRL reste dans `details.echelle` et n'est pas exposée. Les champs d'origine non mappés (`skill`, `level_focus`, `source_basis`, `note`, `answer_type`, `scoring_note`, `task_instruction`) sont tous conservés dans `details` : la normalisation ne doit pas appauvrir l'information pédagogique.

### 3.4 Règles de déduplication

- Les **fichiers par niveau** sont la source canonique ; les trois agrégats servent uniquement de **contrôle de cohérence** (comparaison des identifiants et des contenus).
- La clé de déduplication est `identifiant`, complétée par une empreinte du contenu sérialisé de façon déterministe (clés triées, UTF-8).
- Résultat attendu après normalisation CARCL : **9 600 enregistrements**, dont 4 800 QA et 4 800 QCM, répartis également (2 400 par langue). Tout autre total doit faire échouer la validation.

---

## 4. Architecture RAG existante et contrats

### 4.1 Composants

| Fichier | Rôle |
| --- | --- |
| `app/rag/base.py` | Port `RecuperateurRAG` (`nom`, `version_corpus`, `rechercher`, `fermer`) et `RequeteRAG` |
| `app/rag/corpus.py` | `ManifesteCorpus`, `DescripteurCorpus`, `CorpusCecrl.charger()`, sérialisation JSONL et empreinte |
| `app/rag/local.py` | `RecuperateurLocal` : BM25 déterministe, aucun réseau, aucun accès base |
| `app/rag/vide.py` | `RecuperateurVide`, repli par défaut |
| `app/rag/repli.py` | Repli synthétique US150-B, étiqueté `synthetique_fallback` |
| `app/rag/fabrique.py` | Unique point d'assemblage ; absorbe les erreurs de corpus et retombe sur le récupérateur vide |
| `app/rag/config.py` | `RAG_CORPUS_ACTIF` (faux par défaut), `RAG_CORPUS_CHEMIN`, `RAG_CORPUS_VERIFIER_EMPREINTE` |
| `app/prompts/variables.py` | `DescripteurRAGPrompt`, forme remontée aux agents |
| `app/schemas/regles.py` | Langues, référentiels, niveaux et compétences de l'API |
| `app/schemas/commun.py` | `MetaExecution.version_corpus`, 32 caractères maximum |
| `scripts/ingestion_cecrl.py` | Générateur hors dépôt à partir du classeur officiel ; refuse d'écrire dans le dépôt |

### 4.2 Contrats à respecter

| Contrat | Valeurs ou limites |
| --- | --- |
| `RequeteRAG` | 5 langues, 2 référentiels, niveaux CECRL ou HSK, 1 à 5 compétences sans doublon, texte de 4 000 caractères maximum, limite de 1 à 20 (défaut 8) |
| `DESCRIPTEURS_MAX` | 8 descripteurs demandés par l'agent Diagnostic |
| `DescripteurRAGPrompt` | identifiant de 1 à 128 caractères, contenu de 1 à 3 000, cohérence référentiel/langue/niveau validée |
| `Competence` (API) | 5 valeurs : `grammaire`, `lecture`, `ecoute`, `ecrit`, `oral` |
| `CompetenceCorpus` (interne) | 6 valeurs, avec `lexique` en plus |
| `ManifesteCorpus` | version de 3 à 32 caractères, source avec URL HTTPS et empreinte SHA256, licence énumérée, comptages cohérents, empreinte du JSONL |
| `DescripteurCorpus` | identifiant au format `cecrl:langue:annee:numero`, sous-niveau avec `+` facultatif, `echelle`, `source_no`, contenu de 3 000 caractères maximum |
| `CorpusCecrl.charger()` | refuse dossier absent, manifeste invalide, empreinte différente, ligne JSONL invalide, identifiant en double, facet hors manifeste ou comptage divergent |
| `MetaExecution.version_corpus` | 32 caractères maximum, étiquette de l'index utilisé |
| `RecuperateurVide` et `repli.py` | repli par défaut ; repères synthétiques étiquetés `synthetique_fallback` et statut `A_VERIFIER` quand aucun repli n'est pertinent |

### 4.3 Écart entre les contrats et les sources réelles

Trois incompatibilités structurelles empêchent de brancher CARCL ou HSK directement sur le chargement actuel :

1. `ManifesteCorpus.niveaux` est un tuple de `NiveauCecrl` uniquement. Les niveaux `HSK 1` à `HSK 6` sont pourtant acceptés par `RequeteRAG`, mais pas par le manifeste. Les niveaux HSK `4A` et `4B` des PDF ne correspondent à aucun niveau de l'API (`HSK 4` est la seule valeur disponible) : une règle de projection explicite devra être validée.
2. `DescripteurCorpus.identifiant` impose le préfixe `cecrl:...` et `sous_niveau` n'autorise que `A1+` à `C2+`. Les identifiants CARCL (`FR-A1-QA-001`, `de_a1_mcq_001`…) et HSK ne peuvent pas être représentés tels quels.
3. `DescripteurRAGPrompt.niveau` doit appartenir au référentiel : les items CARCL en `en`/`de`/`fr`/`it` relèvent du référentiel `CECRL` et de ses niveaux `A1` à `C2` (compatible) ; les segments HSK relèvent de `HSK` et de ses niveaux (à projeter pour 4A/4B).

**Conséquence** : la normalisation peut produire des artefacts conformes au schéma commun proposé dès maintenant, mais l'adaptation du chargeur et du manifeste à plusieurs familles doit faire l'objet d'une **US distincte**, sans toucher au comportement actuel. Le port `RecuperateurRAG` lui-même n'a pas besoin de changer : c'est le point d'extension prévu.

---

## 5. Formats intermédiaires proposés

### 5.1 Arborescence cible (non appliquée)

```text
ia-service/corpus/
├── README.md                         # versionné, règles de droits
├── cecrl/manifeste.json              # existant, inchangé
├── carcl/
│   ├── manifeste.json                # à créer, métadonnées seules, versionné
│   ├── sources/                      # 27 JSON originaux, hors Git
│   ├── normalise/items.jsonl         # généré, hors Git
│   └── temp/                         # rapports de validation, hors Git
└── hsk/
    ├── manifeste.json                # à créer, métadonnées seules, versionné
    ├── pdf/                          # 10 PDF originaux, hors Git
    ├── audio/                        # 479 MP3 originaux, hors Git
    ├── normalise/segments.jsonl      # généré, hors Git
    ├── normalise/audio_index.jsonl   # généré, hors Git
    └── temp/                         # pages OCR et contrôles, hors Git
```

Les règles `.gitignore` déjà présentes (`*.pdf`, `*.mp3`, `normalise/**`, `temp/**`, avec exceptions pour `README.md` et `manifeste.json`) couvrent cette arborescence. Aucun déplacement de fichier n'a été effectué ; la cible doit être validée avant toute action.

### 5.2 Artefacts

| Artefact | Format | Contenu | Versionné |
| --- | --- | --- | --- |
| `manifeste.json` par famille | JSON | version, source, licence, langues, niveaux, compétences, comptages, empreinte du JSONL | oui (métadonnées seulement) |
| `items.jsonl` (CARCL) | JSONL UTF-8, LF | 9 600 `ElementPedagogique` de type `qa` ou `qcm` | non |
| `segments.jsonl` (HSK) | JSONL UTF-8, LF | segments de page ou de leçon issus des PDF, avec `page`, `confiance_ocr`, `source_id` | non |
| `audio_index.jsonl` (HSK) | JSONL UTF-8, LF | 479 entrées : chemin relatif, série, leçon, piste, durée, débit, étiquettes ID3, `source_id` PDF associé | non |
| `rapport-validation.json` | JSON | comptages, doublons, pages sans texte, items rejetés et motif | non |
| `README.md` par famille | Markdown | provenance, droits, commande de régénération | oui |

### 5.3 Règles d'écriture des artefacts

- Sérialisation en **octets** (comme `serialiser_descripteurs`) pour éviter que la conversion des sauts de ligne sous Windows change l'empreinte.
- UTF-8, fin de ligne LF, une entrée par ligne, aucune ligne vide significative.
- Tri déterministe par `identifiant` avant écriture, afin qu'une régénération produise exactement la même empreinte.
- Empreinte SHA256 du fichier JSONL recopiée dans le manifeste ; toute divergence fait échouer le chargement, comme le fait déjà `CorpusCecrl.charger()`.
- Aucune donnée synthétique n'est insérée dans ces artefacts. Les seules données synthétiques du service sont celles de `repli.py` (US150-B), explicitement étiquetées et sans rapport avec ces fichiers.

---

## 6. Pipeline d'ingestion proposé (non exécuté)

Le pipeline est **progressif et réversible** : chaque étape produit un artefact intermédiaire vérifiable et peut être arrêtée sans effet sur le service. Aucune étape ne modifie une source ni le RAG.

```text
P0  Gate juridique  ──► P1  Inventaire + empreintes ──► P2  Normalisation CARCL
                                                            │
                                                            ▼
P6  Branchement RAG (US future) ◄── P5  Validation + manifeste ◄── P4  Index audio
                                                            ▲
                                                            │
                                                   P3  Extraction PDF (OCR)
```

### P0 — Gate juridique (bloquant)

- **Entrée** : droits des trois familles.
- **Action** : obtenir une confirmation écrite pour CARCL et HSK ; confirmer le statut `non_clarifiee` du CECRL.
- **Sortie** : décision d'autorisation ou d'arrêt.
- **Contrôle** : aucune extraction ni indexation avant validation. Aucune exception prévue.

### P1 — Inventaire et empreintes (lecture seule)

- **Entrée** : 517 fichiers source.
- **Action** : calculer les empreintes, les comptages et les chemins relatifs ; produire `rapport-validation.json`.
- **Sortie** : référentiel de départ immuable.
- **Contrôle** : 27 JSON / 10 PDF / 479 MP3, volumes et niveaux conformes au § 2.
- **État** : déjà réalisé dans cet audit, à rejouer sous forme de script avant toute génération.

### P2 — Normalisation CARCL par lots

- **Entrée** : fichiers par niveau uniquement (les agrégats servent au contrôle).
- **Action** : adaptateur par dialecte (`en`, `de`, `fr`, `it`), mapping vers `ElementPedagogique`, conservation intégrale des champs d'origine dans `details`, déduplication par identifiant.
- **Sortie** : `items.jsonl` avec 9 600 entrées.
- **Contrôle** : un lot de 400 items par langue maximum ; comparaison avec l'agrégat quand il existe ; échec si un identifiant manque ou si un score hors `{0,20,50,75,100}` apparaît.
- **Réversibilité** : sortie hors dépôt, supprimable sans conséquence.

### P3 — Extraction PDF en deux vagues

- **Vague 1** : `hsk-course-2.pdf` et `hsk-course-3.pdf`, couche OCR existante. Nettoyage contrôlé du texte (caractères parasitess, espaces), sans corriger le fond par inférence. Contrôle manuel sur un échantillon de pages.
- **Vague 2** : les 8 PDF image-only. Nécessite un moteur OCR **à choisir et à installer dans une US distincte** ; aucun OCR n'a été lancé ici. Découpage par page, puis détection des blocs (exercices, tableaux, vocabulaire).
- **Sortie** : `segments.jsonl` avec `page`, `source_id`, `qualite = ocr_a_verifier` pour tout texte OCR.
- **Contrôle** : seuil de confiance et revue humaine avant indexation ; aucune page omise silencieusement.
- **Volume** : 1 326 pages, dont 950 entièrement sans texte et 10 pages sans texte dans les deux PDF partiellement OCR : traitement par lots de 10 pages, jamais massif.

### P4 — Index audio sans transcription

- **Entrée** : 479 MP3 et l'arborescence de leçons.
- **Action** : extraire chemin relatif, série, leçon, numéro de piste, durée, débit, fréquence, étiquettes ID3 ; construire un `source_id` unique ; proposer une association avec le PDF du même niveau et de la même leçon.
- **Sortie** : `audio_index.jsonl`.
- **Contrôle** : unicité des `source_id` malgré les 120 noms de fichiers dupliqués ; aucune transcription produite ; association marquée `proposee` tant qu'elle n'est pas validée humainement.
- **Dépendance** : aucune pour les métadonnées de base via les outils système ; `mutagen` ou équivalent restera à valider séparément pour une lecture ID3 portable.

### P5 — Validation et manifeste

- **Entrée** : artefacts des étapes P2 à P4.
- **Action** : validation Pydantic des enregistrements, contrôle des comptages, calcul des empreintes, rédaction des manifestes légers.
- **Sortie** : corpus prêt à être monté en lecture seule.
- **Contrôle** : toute anomalie lève une erreur explicite ; aucun index partiel n'est publié.

### P6 — Branchement au RAG (hors US150)

- **Action** : faire évoluer le chargeur multi-familles dans une US dédiée, puis activer un corpus par configuration, jamais par défaut.
- **Contrôle** : `RAG_CORPUS_ACTIF` reste `false` ici ; le repli US150-B reste inchangé ; le contrat API et le frontend restent identiques.

---

## 7. Gestion des PDF et des audios

### 7.1 PDF HSK

**Extraction textuelle observée.** Les outils déjà présents (`pdftotext`, `pdfinfo`, `pdfimages`, `pdffonts` de MiKTeX) suffisent pour l'audit et pour la première vague. Aucun module Python `fitz`, `pypdf`, `PyPDF2` ou `pdfplumber` n'est installé.

| Catégorie | Fichiers | Pages | Traitement |
| --- | --- | ---: | --- |
| Sans couche texte | 8 | 950 | OCR complet à planifier (dépendance à valider) |
| Couche OCR existante | 2 (`hsk-course-2.pdf`, `hsk-course-3.pdf`) | 376 | Nettoyage et contrôle de qualité ; 6 et 4 pages sans texte respectivement |

Le texte des deux PDF avec couche OCR est utilisable comme **indice de recherche** mais pas comme vérité pédagogique : les extraits montrent des caractères parasites, des mots coupés et une ponctuation altérée. Il doit être marqué `qualite = ocr_a_verifier` et rester lié à l'image de la page pour relecture. Les 29 301 et 47 579 caractères CJK extraits ne doivent pas être traités comme une transcription validée.

**Tableaux et images.** Le mode `-layout` restitue un flux de lecture, pas une structure de tableau. Aucun tableau n'est actuellement reconnaissable de façon fiable. Les images sont au nombre de 1 367, souvent une page scannée entière ; les exercices, illustrations et éventuels tableaux sont donc dans le bitmap. Une segmentation doit conserver l'image de page comme référence et stocker le texte reconnu à côté, jamais à la place. Les deux PDF de writing contiennent 23 et 30 images pour 15 pages : plusieurs images par page, à traiter comme des blocs distincts.

**Découpage proposé.** Page comme unité de base ; regroupement en leçons lorsque la pagination ou les en-têtes le permettent ; un `segment_id` par page ou par bloc ; conservation des numéros de page d'origine. Les pages sans texte après OCR doivent être listées explicitement dans le rapport, pas ignorées.

### 7.2 Audios HSK

Les 479 pistes sont des fichiers MPEG-1 Layer III CBR à 128 ou 192 kbps. Les métadonnées exploitables sans dépendance supplémentaire sont le chemin relatif, la taille, l'horodatage de modification et, via l'API Shell Windows utilisée pendant l'audit, la durée, le débit et certaines étiquettes ID3. 357 fichiers ont un en-tête ID3 ; les étiquettes sont partielles, parfois mojibake, et ne doivent pas être censurées ni réécrites.

Association envisagée, à valider humainement :

| Niveau | PDF du même niveau | Séries audio | Clé d'association |
| --- | --- | --- | --- |
| 1 | `hsk-course-1.pdf`, `hsk-course-1-workbook.pdf`, `hsk-course-1-writing.pdf` | `HSK 1 Textbook/Lesson NN`, `hsk1textbookaudios/lesson-NN`, `hsk1workbookaudios/lesson-NN` | numéro de leçon + type textbook/workbook |
| 2 | `hsk-course-2*.pdf` | `Audio/lesson-01..15` (8 pistes) | numéro de leçon + numéro de piste |
| 3 | `hsk-course-3*.pdf` | `Audio/lesson-01..18` (8 pistes) | numéro de leçon + numéro de piste |
| 4A / 4B | `hsk-course-4a.pdf`, `hsk-course-4b.pdf` | aucun audio | sans objet |

Limites : aucune transcription, aucun alignement audio-texte, aucune écoute. Le service IA n'a pas de traitement audio et le backend refuse les réponses audio : les MP3 restent donc des références pédagogiques, pas des descripteurs RAG. Toute fonction de dictée ou de prononciation nécessitera une transcription et probablement une dépendance, à décider dans une US séparée.

---

## 8. Traçabilité des sources

### 8.1 Identifiants stables proposés

| Famille | Motif | Exemple |
| --- | --- | --- |
| CECRL (existant) | `cecrl:langue:annee:numero` | `cecrl:en:2020:0001` |
| CARCL | `carcl:langue:id_original` | `carcl:fr:FR-A1-QA-001` |
| HSK PDF | `hsk:pdf:niveau:fichier.page=N` | `hsk:pdf:2:hsk-course-2.page=42` |
| HSK audio | `hsk:audio:niveau:serie:lecon:fichier` | `hsk:audio:3:Audio:lesson-18:18-8.mp3` |

Ces identifiants sont dérivés du chemin et du nom d'origine : ils ne nécessitent aucune invention de contenu et restent stables tant que la source n'est pas remplacée. Le préfixe `hsk:audio` inclut la série et la leçon précisément parce que 120 noms de fichiers sont dupliqués.

### 8.2 Objet `SourceRef`

Chaque `ElementPedagogique` porte une référence complète :

| Champ | Contenu |
| --- | --- |
| `source_id` | identifiant stable du paragraphe 8.1 |
| `chemin_relatif` | chemin depuis la racine du corpus, sans lecteur Windows |
| `famille` | `carcl`, `cecrl` ou `hsk` |
| `nature` | `json`, `pdf`, `mp3` ou `xlsx` |
| `empreinte_sha256` | empreinte du fichier source d'origine |
| `localisation` | page, plage, leçon ou piste selon le cas |
| `licence` | statut juridique, identique à celui du manifeste |
| `url_source` | URL officielle quand elle existe (CECRL), sinon vide et tracée comme telle |

### 8.3 Chaîne de citation jusqu'à l'agent

```text
Fichier source (SHA256)
   -> manifeste de famille (version, licence, comptages, empreinte du JSONL)
      -> ElementPedagogique (identifiant, source_id, localisation)
         -> descripteur servi par RecuperateurRAG (identifiant, contenu)
            -> MetaExecution.version_corpus + référence source dans la réponse
```

Le port `RecuperateurRAG` ne transporte pas encore `SourceRef` : `DescripteurRAGPrompt` contient uniquement l'identifiant, la langue, le référentiel, le niveau, la compétence et le contenu. Deux options sont possibles sans casser le contrat public :

1. coder la provenance dans l'identifiant et dans `version_corpus` (approche minimale, déjà utilisée par `repli.py` avec `synthetique_fallback`) ;
2. enrichir ultérieurement le descripteur d'un champ optionnel de citation, dans une US dédiée, avec un test de non-régression du prompt.

Dans les deux cas, une réponse pédagogique doit pouvoir indiquer par exemple : « exercice issu de `hsk:pdf:2:hsk-course-2.page=42`, version `hsk-2026.1` », sans redistribuer le PDF.

### 8.4 Provenance et absence de substitution

Les trois étiquettes déjà en usage sont conservées : `officiel`, `synthetique_fallback`, `A_VERIFIER`. Les artefacts d'ingestion ne produisent que des contenus d'origine (`officiel` au sens « issu de la source », avec le statut juridique réel du manifeste). Aucun exercice CARCL, aucun segment HSK et aucune piste audio ne doit être remplacé par un contenu généré pour combler une lacune : page illisible, OCR incertain ou audio non transcrit sont **signalés**, pas comblés. Les repères synthétiques de `repli.py` restent cantonnés au repli du diagnostic et ne doivent jamais entrer dans un artefact de corpus réel.

---

## 9. Contraintes techniques et juridiques

### 9.1 Contraintes techniques

| Contrainte | Impact | État |
| --- | --- | --- |
| 1,14 Go de sources (715,8 Mo PDF + 423,3 Mo MP3 + 11,4 Mo JSON) | Ne doivent jamais entrer dans Git, la CI ni l'image Docker | Règles `.gitignore` déjà présentes ; contexte Docker à vérifier séparément |
| 8 PDF sans couche texte | OCR obligatoire avant indexation | Aucun moteur installé ; dépendance à valider en US dédiée |
| Textes OCR bruités sur 2 PDF | Revue humaine obligatoire | Non réalisée |
| 479 MP3 sans transcription | Pas de descripteurs textuels possibles | Hors périmètre |
| Identifiants de niveaux incompatibles (`4A`, `4B`, `HSK 1`…) | Évolution du manifeste/chargeur requise | US distincte, hors US150 |
| Encodage Windows et fins de ligne | Empreintes non reproductibles si écriture texte | Règle d'écriture en octets définie au paragraphe 5.3 |
| Outils disponibles | `pdftotext`, `pdfinfo`, `pdfimages`, `pdffonts`, API Shell Windows ; pas de `fitz`, `pypdf`, `mutagen`, `ffprobe` | Aucune dépendance ajoutée pendant l'audit |
| RAG désactivé par défaut | Aucun effet observable tant que `RAG_CORPUS_ACTIF=false` | Conforme |

### 9.2 Contraintes juridiques

| Famille | État constaté | Action requise |
| --- | --- | --- |
| CECRL | `licence.statut = non_clarifiee`, © Conseil de l'Europe 2020, corpus interne non distribué | Conserver le statut ; aucune clarification obtenue ici |
| CARCL | Contenu déclaré original, aligné sur des descripteurs, non officiel ; auteur et licence de diffusion non documentés | Confirmer par écrit provenance, auteur et licence avant versionnement ou indexation |
| HSK | Aucune mention de licence ; métadonnées PDF = scanner/éditeur uniquement ; éditeur visible (FLTRP) mais aucun accord | Vérifier édition, éditeur, année et autorisation d'usage interne avant extraction ou indexation |

Aucune donnée personnelle ni secret n'a été relevé. Aucun fichier source n'a été modifié, ajouté à l'index ou distribué.

### 9.3 Contraintes respectées pendant l'audit

- [x] Aucune donnée synthétique créée pour remplacer une source.
- [x] Aucun fichier original modifié, déplacé ou supprimé.
- [x] Aucune ingestion massive, aucun OCR, aucune transcription lancée.
- [x] `RAG_CORPUS_ACTIF` non activé ; aucun code du RAG modifié.
- [x] Aucune dépendance ajoutée.
- [x] Droits non présumés acquis ; statuts juridiques conservés.
- [x] État Git préexistant préservé ; branche dédiée créée depuis `origin/develop` après vérification.
- [x] Aucun commit et aucune PR créés.

---

## 10. Plan d'implémentation en petites tâches

| Tâche | Objectif | Dépendance | Livrable | Validation |
| --- | --- | --- | --- | --- |
| T1 | Script d'inventaire lecture seule (chemins, tailles, empreintes, comptages) | aucune | `scripts/inventaire_corpus.py` + rapport JSON | 27 / 10 / 479, volumes conformes |
| T2 | Modèles Pydantic `ElementPedagogique` et `SourceRef` dans un module dédié | T1 | schéma validé | tests de validation |
| T3 | Adaptateur CARCL anglais | T2 | lot de 2 400 items | comparaison à l'agrégat |
| T4 | Adaptateur CARCL allemand | T2 | lot de 2 400 items | comparaison à l'agrégat |
| T5 | Adaptateur CARCL français | T2 | lot de 2 400 items | comparaison à l'agrégat |
| T6 | Adaptateur CARCL italien | T2 | lot de 2 400 items | aucun agrégat, comptage direct |
| T7 | Déduplication et assemblage `items.jsonl` | T3 à T6 | 9 600 entrées triées | unicité des identifiants, empreinte stable |
| T8 | Détection de la couche texte des 10 PDF et rapport par page | T1 | rapport OCR | 8 sans texte, 2 avec couche partielle |
| T9 | Nettoyage contrôlé et segmentation des 2 PDF avec couche OCR | T8 | segments marqués `ocr_a_verifier` | revue d'un échantillon de pages |
| T10 | Choix d'un moteur OCR et PoC sur 10 pages (US séparée) | T8 + décision dépendance | rapport de qualité | seuil de confiance validé |
| T11 | Indexation des 479 MP3 (métadonnées sans transcription) | T1 | `audio_index.jsonl` | identifiants uniques, associations `proposee` |
| T12 | Génération des manifestes légers CARCL et HSK | T7, T9, T11 | manifestes versionnés | validation par le même mécanisme que `ManifesteCorpus` |
| T13 | Évolution du chargeur multi-familles (US distincte) | T12 | chargeur générique | non-régression RAG complète |
| T14 | Activation configurée d'un corpus réel (US distincte) | T13 + droits validés | flag dédié, désactivé par défaut | aucune activation dans cette US |

L'ordre recommandé est T1, T2, puis T3 à T7 (voie la plus rapide, sans dépendance externe), puis T8, T9, T11, T12. T10 et T13/T14 sont conditionnés à des décisions explicites et ne font pas partie de l'US150. Chaque tâche produit un artefact hors dépôt vérifiable ; aucune ne touche aux sources ni au RAG existant.

---

## 11. Tests nécessaires

### 11.1 Tests unitaires et de normalisation

| Test | Objectif | Critère d'acceptation |
| --- | --- | --- |
| `test_inventaire_reproductible` | rejouer P1 | mêmes comptages et empreintes qu'aujourd'hui |
| `test_adaptateur_en_de_fr_it` | mapper chaque dialecte | aucun champ d'origine perdu, `details` complet |
| `test_aggregat_redondant` | comparer agrégat et fichiers par niveau | 100 % d'identifiants et de contenus identiques pour `en`, `de`, `fr` |
| `test_dedup_carcl` | assembler les 9 600 items | 9 600 entrées, aucun doublon, 2 400 par langue |
| `test_scores_rubrique` | valider les options QCM | valeurs dans `{0,20,50,75,100}`, une seule option correcte |
| `test_ecriture_jsonl_deterministe` | régénérer le fichier | empreinte SHA256 identique |
| `test_source_ref_complete` | valider la traçabilité | chaque entrée porte `source_id`, chemin, empreinte, licence |
| `test_audio_id_unique` | différencier les 120 noms dupliqués | aucun `source_id` en double |
| `test_pdf_sans_texte_declare` | classer les 10 PDF | 8 sans texte, 2 avec couche partielle, pages manquantes listées |

Les tests de mapping utilisent des **fixtures minuscules et étiquetées comme telles**, servant uniquement à vérifier la logique de code. Elles ne sont jamais insérées dans un artefact de corpus et ne remplacent aucune source.

### 11.2 Tests d'intégration et de non-régression RAG

| Test | Objectif | Critère d'acceptation |
| --- | --- | --- |
| `test_manifeste_empreinte` | détecter un JSONL modifié | `ErreurCorpusIndisponible` levée |
| `test_manifeste_comptages` | détecter un comptage divergent | chargement refusé |
| `test_rag_desactive_par_defaut` | préserver le comportement actuel | `RecuperateurVide` retourné par la fabrique |
| `test_repli_us150b_inchange` | préserver le repli synthétique | `synthetique_fallback` et `A_VERIFIER` inchangés, HSK sans repli |
| `test_contrat_api_stable` | vérifier OpenAPI et `MetaExecution` | `version_corpus` à 32 caractères maximum, aucun nouveau champ public |
| `test_citation_source` | retrouver la source d'un descripteur | `source_id` résolu vers fichier + page/piste + empreinte |
| `test_aucune_ingestion_automatique` | vérifier le déclenchement | aucun script d'ingestion appelé au démarrage du service |

### 11.3 Tests manuels et contrôles de livraison

- Revue d'un échantillon de pages OCR des deux PDF avec couche texte, comparaison visuelle avec l'image de page.
- Confirmation écrite des droits CARCL et HSK avant tout passage à l'échelle.
- Vérification que `git status --short` ne contient que le document d'audit, que `git diff --check` est propre et qu'aucun fichier volumineux n'est indexé.
- Vérification du contexte Docker et de la CI : aucun PDF, MP3 ou JSONL généré dans l'image ou les artefacts.

---

## 12. Décisions attendues du développeur

1. **Droits** : confirmer par écrit l'usage interne et la diffusion des 27 JSON CARCL et des 10 PDF / 479 MP3 HSK.
2. **Source canonique CARCL** : valider les fichiers par niveau comme référence et les trois agrégats comme simple contrôle (recommandation de l'audit).
3. **Niveaux HSK** : décider de la projection de `4A` et `4B` vers `HSK 4`, ou de l'ajout de niveaux dédiés dans une évolution du contrat.
4. **Évolution du chargeur** : valider une US séparée pour rendre `ManifesteCorpus` et le chargeur multi-familles, sans modifier le port `RecuperateurRAG`.
5. **OCR** : choisir un moteur et une dépendance pour les 8 PDF image-only, ou renoncer à leur indexation textuelle.
6. **Audio** : décider si les MP3 restent de simples références (recommandation) ou si une transcription/alignement est envisagé dans une US ultérieure.
7. **Destination des items CARCL** : items de diagnostic, chatbot pédagogique, ou les deux ; cela conditionne le choix de `competence` et de la longueur de `contenu`.
8. **Arborescence cible** : valider ou ajuster la disposition proposée au paragraphe 5.1 avant tout déplacement de fichiers.

## 13. Limites de l'audit

- Aucun OCR n'a été lancé ; la qualité réelle des textes après OCR n'est pas mesurée.
- Aucun fichier audio n'a été écouté ; les durées proviennent d'un décompte des trames et les associations PDF/audio restent des hypothèses à valider.
- Le contenu pédagogique des questions CARCL a été analysé structurellement, pas évalué sur le fond.
- Les droits d'utilisation n'ont pas été vérifiés ; les statuts juridiques sont ceux déclarés par les métadonnées.
- Aucune ingestion, aucun branchement au RAG, aucune activation de corpus, aucune modification de source et aucune dépendance n'ont été réalisés.
- Aucun commit ni pull request n'a été créé ; le document est en attente de validation.

**Livrable :** `docs/ia/US150-audit-preparation-ingestion.md` (ce document), sur la branche `feature/US150-audit-preparation-ingestion` créée depuis `origin/develop` `63aad14`.
