# US150-A — Corpus RAG CECRL expérimental (CARCL)

## 1. Objectif et périmètre

Ce corpus **expérimental** permet de démontrer le fonctionnement réel du Retriever RAG de La Digithèque sans
exploiter les descripteurs officiels du Conseil de l'Europe, dont les droits de réutilisation ne sont pas établis.

> **Le corpus officiel CECRL reste désactivé par défaut.** Le corpus décrit ici n'est **pas** une source officielle
> de niveaux CECRL et ne doit jamais être présenté comme une preuve de niveau.

Sources utilisées : les 27 fichiers JSON d'exercices déjà suivis par Git dans `ia-service/corpus/cecrl/`
(`anglais/`, `Deutsch/`, `français/`, `italian/`). Aucun PDF officiel, aucun MP3, aucun `descripteurs.jsonl` et aucun
fichier local ignoré par Git n'a été lu pour produire un artefact ou modifié.

## 2. Ce qui a été réutilisé

| Composant | Réutilisation |
| --- | --- |
| `RecuperateurRAG` (`app/rag/base.py`) | Le nouveau récupérateur implémente exactement le même port ; ni l'agent, ni le Harness, ni l'API n'ont changé de contrat. |
| Noyau BM25 | Tokenisation accent-insensible, statistiques par langue, score BM25 (`K1=1.5`, `B=0.75`) et tri déterministe extraits dans `app/rag/lexical.py` et partagés avec `RecuperateurLocal`. |
| `RecuperateurAvecRepli` (`app/rag/repli.py`) | Inchangé. Si le corpus expérimental est vide ou indisponible, le repli synthétique US150-B reste utilisé et reste étiqueté `synthetique_fallback:`. |
| `DescripteurRAGPrompt` (`app/prompts/variables.py`) | Inchangé. Les exercices y sont projetés avec un identifiant `carcl:` et un contenu qui rappelle leur nature. |
| `CorpusCecrl` / `manifeste.json` | Intacts. Le chargeur strict officiel n'a pas été assoupli. |

## 3. Adaptateur expérimental

Les exercices ne peuvent pas passer par `DescripteurCorpus` : ce schéma exige un identifiant
`^cecrl:[a-z]{2}:[0-9]{4}:[0-9]{4}$`, une `echelle` et un `source_no`, c'est-à-dire trois champs qui fabriqueraient
une provenance officielle inexistante. Un schéma distinct et documenté est donc utilisé :

- `ExerciceExperimental` (`ia-service/app/rag/corpus_experimental.py`) : identifiant `carcl:*`, `nature`
  (`exercice_qa` / `exercice_qcm`), `question`, `options`, `texte_bm25`, `contenu`, `source_fichier`, `id_original`,
  `non_officiel: true`, sans licence ni auteur supposés.
- `RecuperateurExperimental` (`ia-service/app/rag/experimental.py`) : même BM25, mais indexe seulement
  `texte_bm25` et filtre sur la compétence dérivée.
- `manifeste-experimental.json` (`ia-service/corpus/cecrl/`) : type `exercices_pedagogiques_non_officiels`,
  version `carcl-experimental-2026.1`, empreintes des 24 fichiers sources et comptages vérifiés. Il est régénérable
  avec `python -m scripts.generer_manifeste_experimental --date AAAA-MM-JJ` depuis `ia-service/`.

### Provenance conservée

Chaque exercice garde :

- son `id_original` (`A1_QA_001`, `FR-A1-QA-001`, `de_a1_qa_001`, `IT-A1-QA-001`…) ;
- son `source_fichier` relatif ;
- son niveau d'origine ;
- un préfixe d'identifiant `carcl:` distinct de `cecrl:` et de `synthetique_fallback:` ;
- un contenu commençant par `[Exercice pédagogique non officiel — corpus carcl-experimental-2026.1 — pas un
  descripteur officiel du CECRL]`.

Les déclarations originales des JSON sont préservées dans les métadonnées de chaque famille. Elles disent
explicitement « contenu pédagogique original… non officiel », « original German practice material, not official exam
questions » ou « non sono quesiti ufficiali di certificazione ». Aucune licence ni aucun auteur n'est inventé : les
champs correspondants du manifeste restent `null`.

### Langues et déduplication

Le code langue est déduit du dossier (`anglais → en`, `Deutsch → de`, `français → fr`, `italian → it`). L'allemand
le déclare aussi explicitement dans ses JSON ; les autres familles n'ont qu'un nom de langue en clair.

Les 3 agrégats `*cefr*` sont exclus car ils dupliquent exactement les fichiers de niveau. La déduplication est
ensuite littérale (pas tokenisée, afin de conserver les variantes anglaises « Practice variation 2…9 ») :

- QA : langue + niveau + nature + énoncé exact ;
- QCM : langue + niveau + nature + énoncé exact + options.

| Langue | QA uniques | QCM uniques | Total |
| --- | ---: | ---: | ---: |
| `en` | 1 200 | 1 200 | 2 400 |
| `fr` | 1 200 | 1 200 | 2 400 |
| `de` | 1 200 | 330 | 1 530 |
| `it` | 1 110 | 1 200 | 2 310 |
| **Total** | **4 710** | **3 930** | **8 640** |

## 4. Configuration

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `RAG_CORPUS_ACTIF` | `false` | Interrupteur général. `false` ⇒ `RecuperateurVide`. |
| `RAG_CORPUS_TYPE` | `officiel` | `officiel` ou `experimental`. Valeur historique préservée quand la variable est absente. |
| `RAG_CORPUS_OFFICIEL_AUTORISE` | `false` | Nouveau garde-fou : sans `true`, une configuration officielle ne charge rien et journalise une erreur. |
| `RAG_CORPUS_CHEMIN` | `/app/corpus/cecrl` dans Compose | Dossier du manifeste officiel ou des JSON pédagogiques. |
| `RAG_CORPUS_VERIFIER_EMPREINTE` | `true` | Vérifie `descripteurs.jsonl` ou `manifeste-experimental.json`. Une empreinte fausse ⇒ `RecuperateurVide`. |

Activation expérimentale (développement / démonstration) :

```bash
RAG_CORPUS_ACTIF=true
RAG_CORPUS_TYPE=experimental
RAG_CORPUS_CHEMIN=/app/corpus/cecrl
RAG_CORPUS_VERIFIER_EMPREINTE=true
```

La valeur `version_corpus` exposée dans `MetaExecution` est alors `carcl-experimental-2026.1` (25 caractères, limite
32). Les agents Diagnostic **et** Correction positionnent leur provenance interne sur `experimentale` dès qu'un
identifiant `carcl:` est utilisé, au lieu de le classer à tort comme officiel ; la détection est partagée dans
`app/rag/base.py` (`est_descripteur_experimental`). Un mélange `carcl:` + descripteur officiel est classé
`experimentale`. Le frontend étiquette désormais les deux préfixes non officiels (`synthetique_fallback:` et
`carcl:`) dans `PREFIXES_REPERES_NON_OFFICIELS`.

## 5. Limites pédagogiques

- Ce sont des **exercices**, pas des descripteurs : ils ne définissent pas ce qu'un apprenant « peut faire » à un
  niveau CECRL.
- La compétence associée (`grammaire`, `lecture`, `ecrit`, `oral`, `ecoute`) est une **heuristique de filtrage**
  dérivée de mots-clés (`skill`, énoncé, consigne). Elle n'est pas déclarée par les sources et n'est pas certifiée.
  `ecoute` n'est attribuée qu'en présence d'un indice explicite (audio, listening, écoute…).
- Les scores des QCM (0/20/50/75/100 %) sont des **barèmes de crédit partiel**, pas des probabilités et pas des
  niveaux.
- Le BM25 est lexical : il retrouve des formulations proches, il ne juge pas la qualité de la production.
- Les langues sont séparées dans l'index ; aucune recherche interlangue n'est tentée.
- Les agrégats étant exclus, les 8 640 items comptés le sont une seule fois.

## 6. Tests

Fichiers :

- `ia-service/tests/test_rag_experimental.py` : chargement réel et volumétrie, déduplication, manifeste valide puis
  corrompu, recherches `en/fr/de/it`, requête sans résultat, corpus absent, fabrique expérimentale, configuration
  officielle sans autorisation, repli synthétique préservé, correspondance des sources retournées.
- `ia-service/tests/test_agent_diagnostic.py` : un repère `carcl:` fait passer `meta.version_corpus` à
  `carcl-experimental-2026.1`, sans être qualifié d'officiel, avec avertissement explicite dans les journaux.
- `ia-service/tests/test_correction.py` : la correction classe elle aussi un repère `carcl:` (seul ou mêlé à un
  descripteur officiel) en provenance `experimentale`, propage la version et journalise l'avertissement ; un
  descripteur officiel seul ne déclenche pas cette étiquette.
- `ia-service/tests/test_rag_fabrique.py` et `test_rag_local.py` : garde-fous de configuration et non-régression du
  récupérateur officiel.
- `frontend/src/lib/__tests__/resultatDiagnostic.test.ts` : détection des deux préfixes non officiels.

Commandes exécutées dans le worktree (`Python 3.12.10`, `pytest 8.3.4`, `ruff 0.8.4`) :

```bash
cd ia-service
python -m pytest -p no:cacheprovider -o addopts="" -q tests
python -m ruff check .
python -m ruff format --check .
```

Résultats observés en CI (run `44794585684`, six contrôles au vert) :

- Service IA : **684 tests passés, 2 ignorés**, couverture totale **96,39 %** (seuil 70 % respecté), ruff OK ;
- Backend : **347 tests passés**, couverture **96,44 %**, ruff OK ;
- Frontend : typecheck et lint OK, **380 tests Jest passés**, build de production réussi (24 pages générées) ;
- Playwright : **370 tests passés, 16 ignorés, 0 échec** (dont les 10 scénarios de `e2e/login.spec.ts` sur desktop et
  mobile). Un échec local reproductible de `connecte l'utilisateur, enregistre le JWT et redirige` (redirection
  absente après 5 s) a été reproduit à l'identique sur la base `2aceb33`, sans ce changement : il est indépendant
  de cette US et n'a pas été masqué ;
- Docker : images construites, healthchecks `db`/`redis`/`backend`/`frontend` et santé de l'IA via le backend OK,
  seed idempotent (`0 ajouté(s)`), images de développement construites.

Après la correction de provenance appliquée à l'agent Correction, la suite locale passe à **687 tests passés,
2 ignorés**, couverture **96,39 %**, ruff OK. Les trois tests supplémentaires ne figurent pas dans le run CI cité
ci-dessus : la PR a été fusionnée avant cette correction, qui reste à intégrer séparément dans `develop`.

Les commandes Python et npm ont aussi été lancées directement dans le worktree de préparation ; Docker n'y était pas
disponible et a donc été validé en CI.

## 7. Différences avec le corpus officiel

| | Officiel | Expérimental CARCL |
| --- | --- | --- |
| Source | Descripteurs du Companion Volume (droits non clarifiés) | Exercices pédagogiques originaux des 27 JSON |
| Identifiant | `cecrl:en:2020:0012` | `carcl:en:A1:exercice_qa:A1_QA_001` |
| Schéma | `DescripteurCorpus` strict | `ExerciceExperimental` distinct |
| Artefact | `descripteurs.jsonl` généré hors dépôt | JSON sources versionnés + manifeste expérimental versionné |
| Version | `cecrl-2020.1` | `carcl-experimental-2026.1` |
| Provenance interne | `officiel` | `experimentale` |
| Autorisation | `RAG_CORPUS_OFFICIEL_AUTORISE=true` requis | Aucune prétention officielle ; activation par `RAG_CORPUS_TYPE=experimental` |
| Usage | Évaluation de référence (une fois les droits obtenus) | Démonstration technique du Retriever uniquement |

## 8. Activation future du corpus officiel

1. Obtenir l'autorisation écrite de réutilisation et identifier précisément l'édition, l'année, l'URL, le format et
   l'empreinte du document source.
2. Générer `descripteurs.jsonl` **hors du dépôt** avec `python -m scripts.ingestion_cecrl --source <classeur>
   --sortie <dossier externe>`, puis vérifier le manifeste officiel (`licence.statut` doit passer à `accord_ecrit`
   avec la citation exigée).
3. Monter le dossier dans le conteneur en lecture seule, puis positionner :
   `RAG_CORPUS_ACTIF=true`, `RAG_CORPUS_TYPE=officiel`, `RAG_CORPUS_OFFICIEL_AUTORISE=true`,
   `RAG_CORPUS_CHEMIN=/app/corpus/cecrl`, `RAG_CORPUS_VERIFIER_EMPREINTE=true`.
4. Relancer la suite `make check` et le job Docker complet, puis vérifier que `meta.version_corpus` vaut la version
   officielle attendue (et non `carcl-experimental-2026.1`).
5. Ne jamais réutiliser les identifiants ou le manifeste expérimentaux pour valider le corpus officiel.

## 9. Blocages restants

- Aucun droit d'exploitation n'est établi pour les descripteurs officiels : le RAG officiel **n'est pas opérationnel**
  et ne doit pas être annoncé comme tel.
- Docker n'était pas disponible dans l'environnement de préparation : le job Docker complet et `make check` dans
  les conteneurs restent à exécuter en CI. Les tests IA et le lint Python ont été lancés directement.
- Le navigateur Playwright n'était pas installé : il a été installé localement pour les tests, mais un test de
  redirection de connexion reste en échec (voir §6). À confirmer en CI avant de considérer la branche prête à merger.
- Le corpus officiel ne doit être activé qu'après obtention des droits : ce travail ne démontre que le Retriever,
  pas la validité officielle d'un niveau CECRL.
