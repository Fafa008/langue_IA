# PRE-08 — Corpus CECRL local et récupérateur lexical

Branchement d'un corpus documentaire CECRL derrière le port `RecuperateurRAG`, sans modifier le contrat API, le
frontend ni le pipeline du diagnostic. Le corpus reste **désactivé par défaut** et ses descripteurs officiels ne
sont **pas versionnés**.

## Objectif et périmètre

| Livré | Non livré |
| --- | --- |
| Manifeste documentaire versionné (métadonnées, empreinte, comptages) | Distribution ou versionnement des descripteurs officiels |
| Chargeur JSONL validé par Pydantic (`CorpusCecrl`) | Index vectoriel, embeddings ou base vectorielle |
| `RecuperateurLocal` BM25 déterministe | Appel réseau ou accès PostgreSQL depuis `ia-service` |
| Flag `RAG_CORPUS_ACTIF=false` et repli sur `RecuperateurVide` | Modification de `docs/api/contrat-frontend.md` ou du frontend |
| Script d'ingestion à sortie hors dépôt | Ingestion massive de sources non auditées |
| Tests synthétiques et documentation de provenance | Toute réutilisation commerciale sans accord écrit |

Périmètre documentaire P0 : **325 descripteurs** stricts A1, A2, B1 et B2, répartis sur les compétences
`ecoute`, `lecture`, `ecrit`, `oral`, `grammaire` et `lexique`.

## Architecture

```
POST /diagnostic/evaluer
        │
        ▼
Harness ──► DiagnosticAgent ──► RequeteRAG (langue, référentiel, niveau, compétences, texte)
        │                                   │
        ▼                                   ▼
construire_recuperateur()          RecuperateurRAG (port inchangé)
   │            │                        │
   │ flag off   │ flag on + corpus valide│
   ▼            ▼                        │
RecuperateurVide   RecuperateurLocal ◄────┘
                        │
                        ▼
                 CorpusCecrl.charger
                   ├── manifeste.json   (versionné)
                   └── descripteurs.jsonl (hors dépôt, lecture seule)
```

| Fichier | Rôle |
| --- | --- |
| `ia-service/app/rag/corpus.py` | `ManifesteCorpus`, `DescripteurCorpus`, `CorpusCecrl.charger`, `composer_manifeste`, `serialiser_descripteurs` |
| `ia-service/app/rag/local.py` | `RecuperateurLocal` (BM25), tokenisation sans accents, projection `DescripteurRAGPrompt` |
| `ia-service/app/rag/config.py` | `ConfigRAG` : `RAG_CORPUS_ACTIF`, `RAG_CORPUS_CHEMIN`, `RAG_CORPUS_VERIFIER_EMPREINTE` |
| `ia-service/app/rag/fabrique.py` | `construire_recuperateur` : local si activé et valide, sinon vide |
| `ia-service/app/rag/__init__.py` | Exports du port et des implémentations |
| `ia-service/app/main.py` | Injection du récupérateur dans le Harness et fermeture au shutdown |
| `ia-service/scripts/ingestion_cecrl.py` | Génération du corpus hors dépôt, refus d'écriture dans le dépôt |
| `ia-service/corpus/cecrl/manifeste.json` | Manifeste versionné `cecrl-2020.1` |
| `ia-service/corpus/README.md` | Contenu du dossier, génération, activation et droits |
| `ia-service/tests/donnees_corpus.py` | Corpus synthétique (aucun texte officiel) |
| `ia-service/tests/test_rag_*.py`, `test_ingestion_cecrl.py` | Tests du corpus, du récupérateur, de la fabrique et de l'ingestion |

## Manifeste versionné

`ia-service/corpus/cecrl/manifeste.json` ne contient **aucun texte de descripteur** :

- `version` : `cecrl-2020.1` ;
- `source` : œuvre, éditeur, année, URL et empreinte SHA256 du classeur officiel ;
- `licence` : statut `non_clarifiee`, citation et note d'usage ;
- `langues`, `niveaux`, `competences` ;
- `comptages` : total et ventilation par niveau et par compétence ;
- `empreinte_descripteurs_sha256` : empreinte du `descripteurs.jsonl` attendu.

| Niveau | A1 | A2 | B1 | B2 |
| --- | --- | --- | --- | --- |
| Descripteurs | 64 | 93 | 93 | 75 |

| Compétence | `ecoute` | `lecture` | `ecrit` | `oral` | `grammaire` | `lexique` |
| --- | --- | --- | --- | --- | --- | --- |
| Descripteurs | 46 | 59 | 50 | 145 | 12 | 13 |

Le corpus de référence est la feuille anglaise du classeur « CEFR Descriptors 2020 » (Conseil de l'Europe,
`https://rm.coe.int/cefr-descriptors-2020-/16809ed2c7`), empreinte
`7c80f798758b7c780225376f1bdedaef7a073c8f6616810f36e13b74b6f614d7`. L'empreinte du JSONL généré est
`b0bce621e8bde633d0aa8e40eb6fa502b40c6a796b0627cdb61f57575f586be7` (325 descripteurs).

## Format des descripteurs

Un objet JSON par ligne, sans champ supplémentaire (`extra="forbid"`) :

```json
{"identifiant":"cecrl:en:2020:0001","code_langue":"en","referentiel":"CECRL","niveau":"B1","sous_niveau":"B1","competence":"oral","echelle":"Conversation","contenu":"…","source_no":1}
```

Règles de validation :

- `referentiel` est déduit de `code_langue` (`zh` → HSK, sinon CECRL) ;
- `niveau` est un niveau de base ; `sous_niveau` conserve l'étiquette publiée (`A2+`, `B1+`, `B2+`) et doit se
  projeter exactement sur le niveau ;
- `competence` accepte les six valeurs de corpus ; `lexique` n'existe pas dans le contrat public ;
- identifiant unique, langue, niveau et compétence présents dans le manifeste ;
- comptages du corpus identiques à ceux du manifeste, empreinte SHA256 vérifiée par défaut.

Toute anomalie (fichier absent, JSON invalide, UTF-8 incorrect, empreinte différente, identifiant en double,
comptage divergent) lève `ErreurCorpusIndisponible` : le service préfère un récupérateur vide à un index partiel.

## Récupérateur lexical

`RecuperateurLocal` classe les descripteurs par score **BM25** (`K1 = 1.5`, `B = 0.75`) :

1. filtrage par langue (index précalculé par langue), puis par niveau et compétences demandées ;
2. tokenisation minuscule, sans accents et sans mots vides anglais/français ;
3. score BM25 sur l'échelle et le contenu, puis tri total : score décroissant, compétence, `source_no`,
   identifiant — le résultat est donc reproductible ;
4. plafonnement à `RequeteRAG.limite` (8 par défaut, 20 au maximum).

Garanties :

- **Mandarin/HSK** : aucun descripteur CECRL, retour d'une séquence vide ;
- **requête sans terme exploitable** : séquence vide, jamais une sélection arbitraire ;
- **échelle lexicale** : candidate pour toute compétence, puis étiquetée avec la compétence de la requête
  (`lecture`, puis `ecrit`, puis `oral`, sinon première compétence demandée) ;
- **aucune dépendance supplémentaire**, aucun appel réseau, aucun accès PostgreSQL ;
- `fermer()` est idempotent et ne libère aucune ressource externe.

Aucun agent ne connaît l'implémentation : le Harness reçoit toujours un `RecuperateurRAG`.

## Configuration et déploiement

| Variable | Défaut | Effet |
| --- | --- | --- |
| `RAG_CORPUS_ACTIF` | `false` | Charge le corpus au démarrage |
| `RAG_CORPUS_CHEMIN` | `corpus/cecrl` | Dossier du manifeste et des descripteurs |
| `RAG_CORPUS_VERIFIER_EMPREINTE` | `true` | Contrôle SHA256 du fichier de descripteurs |

- Flag désactivé, dossier absent, manifeste invalide ou empreinte différente → `RecuperateurVide`, avec un journal
  d'erreur ; le service démarre et le diagnostic répond.
- `docker-compose.yml` monte `./ia-service/corpus` en lecture seule (`/app/corpus`) et transmet les trois
  variables. `.env.example` documente leur usage.
- Aucun accès PostgreSQL : le corpus est un fichier local monté.

## Procédure d'ingestion

Prérequis : `openpyxl==3.1.5` (dépendance de développement uniquement).

```powershell
cd ia-service
python -m scripts.ingestion_cecrl `
    --source "C:/temp/cefr-descriptors-2020.zip" `
    --sortie "C:/temp/corpus/cecrl" `
    --langue en
```

- L'archive officielle est un ZIP contenant directement les parties d'un XLSX ; le script la recopie sous
  `.xlsx` dans un dossier temporaire, sans la modifier.
- La source est reconnue par son empreinte SHA256 ; une empreinte inconnue est refusée sauf
  `--accepter-source-inconnue`.
- `--avec-sous-niveaux` inclut les niveaux `+`, normalisés vers leur niveau de base.
- Les lignes « No descriptors available » sont écartées, jamais comblées.
- Le script **refuse toute sortie dans le dépôt** ; le corpus est ensuite copié dans `ia-service/corpus/cecrl`
  (ignoré par Git) ou monté via `RAG_CORPUS_CHEMIN`.
- La sortie est écrite en octets UTF-8/LF pour que l'empreinte soit reproductible entre Windows et Linux.

## Tests et résultats

```bash
cd ia-service
pytest --cov=app --cov-report=term-missing --cov-fail-under=70
ruff check . && ruff format --check .
```

| Vérification | Résultat |
| --- | --- |
| Suite complète `pytest` | **574 passed, 2 skipped** |
| Tests PRE-08 (`test_rag_*`, `test_ingestion_cecrl`) | **87 passed** |
| Couverture `--cov=app` | **97,23 %** (seuil 70 %) |
| `ruff check .` | aucune erreur |
| `ruff format --check .` | 78 fichiers conformes |

Couverture des modules PRE-08 : `corpus.py` 96 %, `local.py` 100 %, `config.py` 100 %, `fabrique.py` 100 %,
`__init__.py` 100 %. Les scripts d'ingestion sont hors périmètre `--cov=app`.

Cas couverts :

- manifeste : comptages, champs inconnus, valeurs hors bornes, corpus vide, version versionnée du dépôt ;
- chargeur : dossier absent, manifeste invalide, fichier non UTF-8, empreinte, identifiants en double, langue ou
  niveau hors manifeste, désactivation du contrôle d'empreinte ;
- récupérateur : classement BM25, filtres langue/niveau/compétence, wildcard lexical, mandarin, texte vide,
  terme sans correspondance, limite, déterminisme, fermeture ;
- fabrique : configuration par défaut et par environnement, flag désactivé, corpus valide, dossier absent, corpus
  corrompu, empreinte désactivée ;
- ingestion : normalisation `A2+`, lignes hors noyau, refus d'écriture dans le dépôt, source inconnue, lecture
  XLSX, aller-retour `ecrire_corpus` → `CorpusCecrl.charger`, CLI complète.

Toutes les données de test sont synthétiques (`tests/donnees_corpus.py`) : aucun descripteur officiel n'est
recopié dans le dépôt.

## Limites et droits documentaires

- **Droits non clarifiés** : le classeur et le Companion volume du Conseil de l'Europe ne portent pas de licence
  de réutilisation explicite. Le manifeste conserve `licence.statut = "non_clarifiee"` ; le corpus reste interne,
  non distribué et non commercial.
- **Corpus hors dépôt** : `descripteurs.jsonl`, classeurs et archives sont ignorés par Git. Aucun descripteur
  officiel ne doit être ajouté à une image publiée, un artefact de build ou un jeu de données partagé.
- **Pas de couverture C1/C2** : le noyau P0 s'arrête à B2 ; les niveaux supérieurs, la médiation, l'interaction
  en ligne et le plurilingue restent hors périmètre.
- **Une seule langue par corpus versionné** : le manifeste de référence est anglais (`en`). Une feuille française
  produit un corpus distinct, à valider et versionner séparément.
- **Récupération lexicale** : BM25 ne capture ni synonymes ni paraphrases ; il est volontairement déterministe et
  sans dépendance, en attendant un index sémantique.
- **Comparaison des droits** : toute clarification écrite devra être reportée dans `licence.statut`, la citation
  et la note du manifeste avant toute distribution.

## Références

- `ia-service/corpus/README.md` — contenu, génération, activation, droits.
- `ia-service/README.md` — variables du service et section « Corpus CECRL local (PRE-08) ».
- `docs/api/contrat-frontend.md` — contrat public inchangé.
- `ia-service/docs/US-29-agent-diagnostic.md` — port RAG et pipeline du diagnostic.
