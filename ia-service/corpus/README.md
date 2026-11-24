# Corpus documentaire CECRL

Ce dossier contient **uniquement les métadonnées** du corpus documentaire utilisé par le RAG du service IA
(PRE-08). Les descripteurs officiels du Conseil de l'Europe ne sont pas versionnés : leurs droits de réutilisation
ne sont pas clarifiés par écrit.

## Contenu

| Fichier | Versionné | Rôle |
| --- | --- | --- |
| `cecrl/manifeste.json` | oui | Version, source, statut juridique, langues, niveaux, compétences, comptages et empreinte SHA256 du corpus généré. |
| `cecrl/descripteurs.jsonl` | **non** (`.gitignore`) | Un descripteur par ligne, produit par `scripts/ingestion_cecrl.py` hors du dépôt puis copié ou monté ici. |

Le manifeste ne contient aucun texte de descripteur : il ne peut donc pas être distribué comme un substitut du
document officiel.

## Génération

Depuis `ia-service/`, avec `openpyxl` installé (`requirements-dev.txt`) :

```powershell
python -m scripts.ingestion_cecrl `
    --source "C:/temp/cefr-descriptors-2020.zip" `
    --sortie "C:/temp/corpus/cecrl" `
    --langue en
```

Le script refuse toute sortie située dans le dépôt. Il vérifie l'empreinte SHA256 du classeur officiel
(`7c80f798758b7c780225376f1bdedaef7a073c8f6616810f36e13b74b6f614d7`) et échoue sur toute autre source tant que
`--accepter-source-inconnue` n'est pas fourni.

## Activation

Le corpus est **désactivé par défaut** : le service reste sur `RecuperateurVide` et le prompt applique sa règle de
prudence. Pour l'activer :

```bash
# Corpus monté hors du dépôt (recommandé)
export RAG_CORPUS_ACTIF=true
export RAG_CORPUS_CHEMIN=/chemin/vers/corpus/cecrl
```

`RAG_CORPUS_VERIFIER_EMPREINTE=false` ne désactive que le contrôle d'intégrité du fichier ; les validations de
structure du manifeste et des descripteurs restent actives. Un corpus absent ou incohérent est journalisé puis
remplacé par `RecuperateurVide`, sans bloquer le démarrage.

## Droits

Le statut `non_clarifiee` du manifeste signifie : usage interne, non distribué, non commercial, tant qu'aucune
autorisation écrite n'a été obtenue auprès du Conseil de l'Europe. Aucun descripteur officiel ne doit être ajouté
au dépôt, à un artefact de build, à une image Docker publiée ou à un jeu de données partagé.

Les tests n'utilisent que `ia-service/tests/donnees_corpus.py`, un corpus synthétique inventé.

## Corpus PDF du volume complémentaire (US150-C)

Deuxième source possible des descripteurs : les **éditions PDF** du *CECR — Volume complémentaire* (par exemple
`CEFR Companion volume_fra.pdf`, `CEFR Companion Volume_ita.pdf`, `CEFR CV 2018_German.pdf`, inventoriées dans
`docs/US150_A_AUDIT_PDF_CECRL.md`). Les PDF (`corpus/**/*.pdf`) et le corpus produit ne sont **jamais versionnés**.

### 1. Générer le corpus, hors du dépôt

Depuis `ia-service/`, avec `pypdf` (`requirements-dev.txt`) ; `pdftotext` (paquet `poppler-utils`) est utilisé en
priorité s'il est installé, car il conserve mieux les colonnes des grilles :

```bash
python -m scripts.ingestion_pdf_cecrl \
    --source /chemin/hors/depot/pdf \
    --sortie /chemin/hors/depot/corpus-pdf
# --source est répétable (fichiers ou dossiers) ; --langue "fichier.pdf=it" force la langue d'une édition.
```

Le script détecte la langue de chaque édition, lit les grilles de niveaux (A1 à C2, `A2+`… conservés en
sous-niveau), associe chaque échelle à une compétence (réception orale → `ecoute`, réception écrite → `lecture`,
production et interaction → `oral` / `ecrit`, compétence linguistique → `grammaire` / `lexique`) et écarte la
médiation, les stratégies, le pré-A1 et les cellules « pas de descripteur ». Il refuse toute sortie dans le dépôt et
n'affiche **aucun texte de descripteur** : seulement des comptages par section, à contrôler avant l'activation
(l'extraction est heuristique, la mise en page variant selon les éditions).

### 2. Activer, avec autorisation écrite seulement

```dotenv
RAG_CORPUS_ACTIF=true
RAG_CORPUS_TYPE=pdf
RAG_CORPUS_OFFICIEL_AUTORISE=true        # attestation : autorisation écrite du Conseil de l'Europe obtenue
RAG_CORPUS_HOTE=/chemin/hors/depot/corpus-pdf
RAG_CORPUS_CHEMIN=/corpus-externe
```

Puis `docker compose up -d ia-service` (ou `make dev`). Journal attendu :
`Corpus CECRL PDF cecrl-pdf-2020.1 chargé : N descripteurs, M document(s), éditions fr,it,de.`
Sans autorisation, corpus absent ou incohérent : `RecuperateurVide`, puis le repli synthétique habituel.

### 3. Fonctionnement

`RecuperateurPdf` (`app/rag/pdf.py`) choisit l'édition de la langue apprise, sinon une édition de repli
(`fr`, `en`, `it`, `de`) — un descripteur CECRL décrit une capacité valable pour toute langue. Il filtre par niveau
et compétences, classe par BM25 quand le texte de la requête apporte des termes, et diversifie les échelles. Chaque
descripteur transmis au prompt indique sa source : édition, page, échelle et sous-niveau. Les quatre agents qui
utilisent le RAG (diagnostic, correction de réponse libre, tuteur, exercice ciblé) en bénéficient sans modification.

### 4. Sources officielles vérifiées (24 novembre 2026)

Téléchargées depuis les sites officiels, conservées **hors du dépôt**. Les empreintes des éditions française et
italienne et du classeur sont identiques à celles de l'audit (`docs/US150_A_AUDIT_PDF_CECRL.md`).

| Source | URL | SHA256 | Résultat |
| --- | --- | --- | --- |
| Classeur *CEFR Descriptors 2020* | `https://rm.coe.int/cefr-descriptors-2020-/16809ed2c7` | `7c80f798…f614d7` | `ingestion_cecrl --langue en` : 325 descripteurs, empreinte `b0bce621…` = manifeste versionné |
| *Companion volume* 2020, anglais (278 p.) | `https://rm.coe.int/common-european-framework-of-reference-for-languages-learning-teaching/16809ea0d4` | `bfbd8c74…d73a1b1` | 227 descripteurs |
| Volume complémentaire, français (292 p.) | `https://rm.coe.int/cadre-europeen-commun-de-reference-pour-les-langues-apprendre-enseigne/1680a4e270` | `64e46ce9…601de01c` | 233 descripteurs |
| Volume complementare, italien (285 p.) | `https://rm.coe.int/0900001680a52d52` | `0e8bde14…befde752` | 235 descripteurs |

Corpus PDF obtenu : 695 descripteurs (A1 106, A2 132, B1 126, B2 127, C1 116, C2 88), aucun ne commence au milieu
d'une phrase. Mêmes sections retenues dans les trois éditions (3.1.1.1 à 3.3.1.3 et 5.1).

Limites constatées :

- l'échelle de **maîtrise phonologique** est une grille à trois colonnes que la lecture par mise en page ne sépare
  pas : absente des éditions anglaise et française, mélangée dans l'édition italienne ;
- l'édition **allemande** (Klett / Goethe-Institut) est payante : non téléchargée ; les apprenants d'allemand
  reçoivent l'édition française ;
- le classeur ne donne que 17 descripteurs avec `--langue fr` (échelles reconnues par leur nom anglais) : utiliser
  la feuille anglaise.

### 5. HSK (mandarin) : non couvert

La source officielle est le standard **GF 0025-2021** (*国际中文教育中文水平等级标准*, ministère chinois de
l'Éducation, `http://www.moe.gov.cn/jyb_xwfb/gzdt_gzdt/s5987/202103/W020210329527301787356.pdf`, SHA256
`e451fdf0…90d73a63`, 260 p.). Le texte y est vectorisé (aucune police, aucun texte extractible) : il faut un OCR
chinois (`tesseract-ocr-chi-sim`) avant toute ingestion. Le standard décrit neuf niveaux (一级 à 九级), alors que le
service utilise `HSK 1` et `HSK 2` ; le chargeur PDF ne traite aujourd'hui que le CECRL (`fr`, `en`, `it`, `de`).
