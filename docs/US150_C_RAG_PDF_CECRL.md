# US150-C — RAG CECRL alimenté par les PDF du volume complémentaire

> Centre Langues IA · La Digithèque · 24 novembre 2026 · branche `feature/US150-C-rag-pdf-cecrl`
>
> Suite de l'audit `docs/US150_A_AUDIT_PDF_CECRL.md` et de l'inventaire `docs/ia/inventaire-agents-ia.md`.
> **Statut : fonctionnel, désactivé par défaut.** Le corpus n'est chargé qu'avec une autorisation écrite
> (`RAG_CORPUS_OFFICIEL_AUTORISE=true`) et n'est jamais versionné.

## 1. Problème de départ

Quatre agents du service IA utilisent le RAG : **diagnostic** (et sa variante positionnement), **correction de
réponse libre**, **tuteur v2** et **exercice ciblé**. Ils interrogent le port `RecuperateurRAG` avec une langue, un
niveau, des compétences et un texte.

Avant cette US, aucun corpus n'était réellement exploitable :

- le corpus du **classeur officiel** existait en code, mais son fichier de descripteurs n'était pas généré ;
- les **PDF** du volume complémentaire avaient été audités, sans aucun moyen de les ingérer ;
- surtout, le classement était **purement lexical** : le texte de la requête du diagnostic est fait des réponses
  de l'apprenant, dans la langue apprise, alors qu'un descripteur décrit une capacité (« Peut comprendre… »). Sur
  une requête réelle, le corpus du classeur renvoie **0 résultat** ; l'agent tombe alors sur le repli synthétique
  (`synthetique_fallback`) ou sur `A_VERIFIER`.

## 2. Ce qui a été réalisé

### 2.1 Ingestion des PDF — `ia-service/scripts/ingestion_pdf_cecrl.py`

Script exécuté hors du service, qui écrit le corpus **hors du dépôt** (il refuse toute sortie dans le dépôt) :

1. **Extraction** page par page, mise en page conservée : `pdftotext -layout` s'il est installé, sinon `pypdf`.
2. **Nettoyage** des artefacts relevés par l'audit : glyphes de police en zone privée, puces, césures (sans casser
   « Lese- und Hörverstehen »), titres courants et pieds de page répétés.
3. **Langue de l'édition** détectée par des mots-outils (forçable avec `--langue fichier.pdf=it`).
4. **Lecture des grilles** de niveaux :
   - les titres numérotés (`3.1.1.2.`), de chapitre (`CHAPITRE 6`, `CAPITOLO`…) et d'annexe structurent les sections ;
   - le titre centré au-dessus d'une grille donne le nom de l'échelle ;
   - le code de niveau (`A1` à `C2`, `+` conservé en sous-niveau) est **centré verticalement** dans sa cellule :
     le texte est découpé en **phrases** et chaque phrase est rattachée au code le plus proche, ce qui évite de
     couper un descripteur entre deux niveaux (y compris dans l'édition anglaise, sans ligne vide entre cellules).
5. **Projection sur les compétences du contrat** à partir de la section et du titre (fr, en, it, de) :
   réception orale/audiovisuelle → `ecoute`, réception écrite → `lecture`, production et interaction → `oral` ou
   `ecrit`, compétence linguistique → `grammaire`, `lexique`, `oral` (phonologie), `ecrit` (orthographe).
6. **Écart** des cellules « pas de descripteur », du pré-A1, de la médiation, des stratégies et des compétences
   sociolinguistique, pragmatique, plurilingue et en langue des signes ; dédoublonnage.
7. **Sortie** : `manifeste.json` (documents sources avec empreinte SHA256, licence `non_clarifiee`, comptages,
   empreinte des descripteurs) et `descripteurs.jsonl`. Le rapport affiché ne contient **aucun texte de
   descripteur**, seulement des comptages par section.

### 2.2 Corpus et récupérateur — `ia-service/app/rag/corpus_pdf.py`, `ia-service/app/rag/pdf.py`

- `CorpusPdf.charger` valide le manifeste, l'empreinte, les références de documents, les pages et les comptages ;
  un corpus incohérent lève `ErreurCorpusIndisponible`.
- Chaque descripteur garde sa **provenance** : document, page, section, échelle, sous-niveau.
- `RecuperateurPdf` :
  1. choisit l'**édition** de la langue apprise, sinon une édition de repli (`fr`, `en`, `it`, `de`) — un
     descripteur CECRL décrit une capacité valable pour toute langue ;
  2. **filtre par facettes** : niveau exact et compétences demandées (les échelles lexicales restent transverses) ;
  3. **classe** par BM25 quand le texte apporte des termes, puis par compétence demandée et ordre du document ;
  4. **diversifie** les échelles (une par échelle d'abord) ;
  5. projette sur le contrat du prompt dans la **langue de la requête** (l'agent Diagnostic refuse sinon), avec
     un rappel de source : `[Source : …, édition française, p. 55, échelle « … », niveau B1.]`.

Une requête sans terme utile renvoie quand même les descripteurs du niveau et de la compétence : c'est ce qui rend
le RAG utile au diagnostic et au tuteur.

### 2.3 Configuration et déploiement

| Élément | Détail |
| --- | --- |
| `RAG_CORPUS_TYPE=pdf` | Nouveau type, à côté de `officiel` (classeur) et `experimental` (CARCL) |
| `RAG_CORPUS_OFFICIEL_AUTORISE` | Exigé pour `pdf` comme pour `officiel` ; sinon `RecuperateurVide` |
| `RAG_CORPUS_HOTE` | Dossier hôte du corpus généré, monté en lecture seule sur `/corpus-externe` (`docker-compose.yml`) |
| Corpus absent ou invalide | Journalisé, `RecuperateurVide`, le service démarre ; repli synthétique inchangé |
| `pypdf==5.1.0` | Ajouté à `requirements-dev.txt` uniquement (ingestion hors service) |

Activation (après autorisation écrite) :

```dotenv
RAG_CORPUS_ACTIF=true
RAG_CORPUS_TYPE=pdf
RAG_CORPUS_OFFICIEL_AUTORISE=true
RAG_CORPUS_HOTE=/chemin/hors/depot/corpus-pdf
RAG_CORPUS_CHEMIN=/corpus-externe
```

Journal attendu : `Corpus CECRL PDF cecrl-pdf-2020.1 chargé : 695 descripteurs, 3 document(s), éditions fr,en,it.`

### 2.4 Aucun agent modifié

Les quatre agents consommateurs reçoivent ces descripteurs via le port existant, sans changement de code ni de
contrat. Le diagnostic les signale en provenance `officiel`, avec `version_corpus = cecrl-pdf-2020.1`.

### 2.5 Correction annexe

`scripts/_depot.py` : les deux scripts d'ingestion calculaient la racine du dépôt avec `parents[2]`, soit `/` dans
le conteneur ; ils refusaient alors toute sortie et trois tests de `ingestion_cecrl.py` échouaient avec
`make test-ia`. La racine est désormais le premier dossier contenant `.git`, sinon le dossier du service.

## 3. Résultats sur les sources officielles

Sources téléchargées depuis `rm.coe.int` (adresses et empreintes : `ia-service/corpus/README.md`, §4). Les
éditions française et italienne et le classeur ont **exactement** les empreintes de l'audit.

| Source | Descripteurs | Contrôle |
| --- | ---: | --- |
| Classeur *CEFR Descriptors 2020* (`ingestion_cecrl --langue en`) | 325 | empreinte identique au manifeste versionné |
| *Companion volume*, anglais (278 p.) | 227 | |
| Volume complémentaire, français (292 p.) | 233 | |
| Volume complementare, italien (285 p.) | 235 | |
| **Corpus PDF** | **695** | A1 106 · A2 132 · B1 126 · B2 127 · C1 116 · C2 88 |

- Les trois éditions retiennent les mêmes sections (3.1.1.1 à 3.3.1.3 et 5.1) avec des volumes très proches.
- **0 descripteur sur 695** ne commence au milieu d'une phrase (tous débutent par « Peut », « Can », « È in grado »…).
- Sur une requête de diagnostic réelle (anglais, B1, écoute et écrit, réponses d'apprenant) : **0 résultat**
  avec le classeur, **8 descripteurs** pertinents avec le corpus PDF.

Tests : 874 réussis, 2 ignorés, couverture 96 %, `ruff` sans erreur. Les tests n'utilisent que des textes inventés
et un générateur de PDF minimal (`tests/pdf_minimal.py`).

## 4. Limites

1. **Droits.** Le Conseil de l'Europe n'accorde pas de licence ouverte ; l'audit conclut qu'extraire, stocker et
   indexer ces textes demande une autorisation écrite (et, pour les éditions italienne et allemande, celle des
   co-titulaires). D'où le verrou `RAG_CORPUS_OFFICIEL_AUTORISE`, la licence `non_clarifiee` du manifeste, et
   l'interdiction de versionner PDF et corpus ou de les embarquer dans une image publiée.
2. **Extraction heuristique.** Elle dépend de la mise en page des éditions 2020-2021. Une nouvelle édition ou un
   PDF scanné peut demander d'ajuster les règles : relire les comptages par section du rapport avant d'activer.
3. **Échelle de phonologie** (grille à trois colonnes) mal lue : absente des éditions anglaise et française,
   colonnes mélangées dans l'édition italienne.
4. **Périmètre des compétences.** Médiation, stratégies, compétences sociolinguistique, pragmatique et plurilingue
   n'ont pas d'équivalent dans le contrat `Competence` (5 valeurs) : elles sont écartées. Les échelles lexicales
   sont projetées sur une compétence demandée.
5. **Langue des descripteurs.** Pas d'édition allemande (payante chez Klett) : un apprenant d'allemand reçoit les
   descripteurs de l'édition française. Le modèle lit donc parfois des descripteurs dans une autre langue que celle
   de l'apprenant (la source est indiquée).
6. **HSK non couvert.** Le standard officiel GF 0025-2021 a été récupéré, mais son texte est vectorisé : un OCR
   chinois est nécessaire. Il décrit 9 niveaux, le service n'en utilise que deux (`HSK 1`, `HSK 2`), et le chargeur
   PDF ne traite que les éditions CECRL.
7. **Pertinence non mesurée.** Le classement (facettes, BM25, diversité) est déterministe et testé, mais aucune
   évaluation de pertinence n'a été faite avec des formateurs ; pas d'index vectoriel.
8. **Classeur en français.** `ingestion_cecrl --langue fr` ne donne que 17 descripteurs (échelles reconnues par leur
   nom anglais) : utiliser la feuille anglaise.
9. **Tests dans Docker.** `make test-ia` transmet aux tests les variables d'environnement du service, ce qui fait
   échouer des tests de configuration sans rapport avec cette US (ils passent en CI) : problème existant, non traité.

## 5. Suites proposées

1. Obtenir l'autorisation écrite (formulaire et adresse dans l'audit, §4.5), puis activer en dev.
2. Faire relire par un formateur un échantillon de descripteurs par édition et par niveau.
3. Lire l'échelle de phonologie (découpage par colonnes) ou l'importer depuis le classeur.
4. Ingestion HSK : OCR du standard, chargeur `zh`, correspondance des niveaux.
5. Corriger l'environnement de `make test-ia`.
