# US150-A — Audit approfondi des sources PDF CECRL

> **Date** : 20/11/2026  
> **Périmètre** : quatre PDF du Companion Volume CECRL présents dans `ia-service/corpus/CECRL/`, préparation du corpus documentaire RAG de La Digithèque.  
> **Branche / worktree** : `audit/US150-A-pdf-cecrl`, `C:\Users\Best\AppData\Local\Temp\opencode\audit-us150-a-pdf-cecrl`.  
> **Base** : `origin/develop` à `9608274538bde73ff0ba91c88a8dcac89b25c895`.  
> **Nature de l’intervention** : audit en lecture seule. Aucun code métier, test, configuration, manifeste ou corpus n’a été modifié. **Aucun `descripteurs.jsonl` définitif n’est généré.**  
> **Règle de preuve** : tout constat est déduit des fichiers réellement présents, de commandes exécutées ou de sources officielles citées. Les métadonnées déclaratives seules ne sont pas traitées comme une preuve d’extraction ou de droit.

---

## 1. Périmètre et méthode

### 1.1 Sources auditées

Les quatre PDF sont présents **localement** dans le checkout principal, sous :

`D:\etude\ENI\M2\Stage\Digitech\Projet IA Langue\langue_IA\ia-service\corpus\CECRL\`

Ils sont **absents du worktree d’audit et de Git** : `.gitignore:101` (`ia-service/corpus/**/*.pdf`) exclut ces sources binaires. L’audit les a donc lus depuis le chemin absolu ci-dessus, sans les copier dans le dépôt.

À noter : le dossier local porte la casse `CECRL/`, alors que le chargeur lit par défaut `ia-service/corpus/cecrl/` (`app/rag/config.py:17`) et que le manifeste versionné est `ia-service/corpus/cecrl/manifeste.json`. Cette différence de casse n’a pas d’effet sous Windows, mais doit être harmonisée dans la documentation.

### 1.2 Outils et limites

- Outils utilisés : `pdfinfo.exe` et `pdftotext.exe` de MiKTeX (`C:\Users\Best\AppData\Local\Programs\MiKTeX\miktex\bin\x64\`), avec `pdftotext -layout -enc UTF-8`.
- Python de l’environnement ne dispose ni de `fitz`/`pymupdf`, ni de `pypdf`, ni de `pdfplumber` : aucune extraction par bibliothèque Python n’a été possible ici.
- Aucun moteur OCR n’a été installé ni exécuté dans le cadre de cet audit. Une page sans couche texte est donc signalée comme telle, jamais « complétée » par du texte généré.
- Les extraits cités ci-dessous sont volontairement très courts (quelques mots) et servent uniquement à vérifier une structure, pas à reproduire le contenu protégé.

### 1.3 Ce qui est déjà établi par l’audit RAG précédent

Le rapport `docs/AUDIT_US150_A_RAG.md` conclut à un RAG **PARTIELLEMENT FONCTIONNEL** : BM25 local opérationnel, mais `descripteurs.jsonl` absent, `RAG_CORPUS_ACTIF=false` par défaut et corpus HSK non chargeable. Le présent document ne modifie pas ce verdict : il précise la nature des sources PDF et les conditions de leur éventuelle ingestion.

---

## 2. Inventaire des PDF

Commande de référence utilisée pour chaque fichier :

```text
pdfinfo.exe -isodates <fichier>
pdfinfo.exe -meta <fichier>
pdftotext.exe -layout -enc UTF-8 -eol unix <fichier> <sortie.txt>
```

Outil : Poppler/MiKTeX `pdfinfo` / `pdftotext` **24.04.0**. Les 4 fichiers sont non chiffrés.

| # | Nom exact | Taille (octets) | SHA-256 | Pages | Langue déduite du texte | Caractères extraits | Pages < 50 car. | Pages vides |
|---|---|---:|---|---:|---|---:|---:|---:|
| 1 | `CEFR Companion volume_fra.pdf` | 2 449 574 | `64E46CE90FC56E5F0DEC470E13B926B70C69B9384FBBCA26270B7077601DE01C` | 292 | français | 1 443 061 | 14 | 13 |
| 2 | `CEFR Companion Volume_ita.pdf` | 4 600 998 | `0E8BDE14E0B624AC590B3674CE66E489C876709F6DF63D1B3C0D3C27BEFDE752` | 285 | italien | 1 189 095 | 0 | 0 |
| 3 | `CEFR CV 2018_German.pdf` | 15 402 627 | `17707030052C3349B11547DB3938B5F0BF18D46B56090C8B6B85D262F6A71D65` | 202 | allemand | 778 810 | 3 | 3 |
| 4 | `Developing illustrative descriptors of aspects of mediation for the CEFR_eng.pdf` | 1 356 349 | `3556313B041F840A817FC12C953F9FA2264289C47F36C81F7DDB7394D0A7A2B2` | 68 | anglais | 221 497 | 6 | 5 |

**Langue** : aucun des 4 fichiers ne porte de champ `dc:language` dans le flux XMP ni de champ `Language` dans `pdfinfo`. La langue est donc déduite du texte, pas du seul nom de fichier : p.1 française `CADRE EUROPÉEN COMMUN DE RÉFÉRENCE POUR LES LANGUES`, p.1 italienne `QUADRO COMUNE EUROPEO DI RIFERIMENTO`, p.2 allemande `Gemeinsamer europäischer Referenzrahmen für Sprachen`, p.5 anglaise `Developing illustrative descriptors of aspects of mediation for the CEFR`. Le PDF anglais contient aussi une page de titre française en p.3, mais le corps est anglais.

**Pages pauvres en texte** :

- FRA : pages 9, 11, 25, 47, 175, 176, 177, 181, 187, 191, 195, 273, 275, 291. Treize sont vides ; la p.176 ne contient que `ANNEXES ... Page 177`, ce qui montre un décalage entre page PDF et page imprimée.
- GER : pages 1, 11, 202, toutes vides.
- ENG : pages 1, 2, 4, 15, 51, 57 ; cinq sont vides, la p.4 ne contenant que `►Page 1`.
- ITA : aucune page quasi vide ; minimum 107 caractères par page.

**Pages scannées** : aucun test OCR n’a été réalisé et aucune page scannée n’est prouvée. Les pages vides correspondent vraisemblablement à des intercalaires, versos ou pages image ; elles devront être vérifiées visuellement avant toute extraction complète, sans jamais être comblées par du texte généré.

### 2.1 Métadonnées techniques

| Fichier | Title | Creator | Producer | CreationDate | ModDate | Page size |
|---|---|---|---|---|---|---|
| FRA | — | Adobe InDesign 16.4 (Macintosh) | Adobe PDF Library 16.0 | 2021-12-13T13:57:49+01 | 2021-12-15T12:34:34+01 | A4 (595.276 × 841.89 pts) |
| ITA | — | Acrobat Pro DC 20.13.20074 | Acrobat Pro DC 20.13.20074 | 2021-01-31T18:59:04+01 | 2021-01-31T18:59:04+01 | 600.945 × 841.89 pts |
| GER | `DO01_3-12-676999_GER_Begleitband_COVER.indd` | Adobe InDesign 17.3 (Windows) | Adobe PDF Library 16.0.7 | 2022-11-09T11:26:21+01 | 2023-12-13T16:58:05+01 | 592.8 × 793.68 pts |
| ENG | — | Microsoft® Word for Microsoft 365 | Microsoft® Word for Microsoft 365 | 2021-12-17T05:30:58+01 | 2021-12-17T05:30:58+01 | A4 (595.4 × 841.8 pts) |

Le PDF allemand est un **PDF/X-4** (`GTS_PDFXVersion: PDF/X-4`). Aucun `Author` exploitable sauf `Brian` dans le PDF anglais.

### 2.2 Références bibliographiques observées dans les fichiers locaux

| Fichier | © et éditeur | ISBN | DOI / URL | Page |
|---|---|---|---|---|
| FRA | `© Conseil de l’Europe, année de publication` ; `Éditions © Conseil de l’Europe, décembre 2021` ; Éditions du Conseil de l’Europe, Strasbourg | `978-92-871-8646-1` | absent ; `www.coe.int/lang-cecr`, `http://book.coe.int` | 3, 12, 28, 292 |
| ITA | `© Council of Europe, aprile 2020` ; `© Università degli Studi di Milano «Italiano LinguaDue», 2020` ; Council of Europe Publishing, Strasbourg | `978-92-871-8621-8` | absent ; `www.coe.int/lang-cefr` | 2, 3, 10 |
| GER | `© 2020 Council of Europe, Straßburg` ; `© 2020 Goethe-Institut München` ; Ernst Klett Sprachen ; Council of Europe Publishing, Strasbourg | `978-3-12-676999-0` | absent ; `www.coe.int/lang-cefr`, `www.klett-sprachen.de/GER-Begleitband-Downloads` | 4, 5, 13, 33 |
| ENG | `© Council of Europe, 2016` ; Council of Europe Publishing | `92-871-4983-6` (CEFR 2001), `978-1-901095-37-1`, `978-92-871-6225-0` | `doi:10.1080/14790710802387562` ; `www.coe.int/lang-cefr` | 3, 33, 52, 58, 59, 62, 63 |

Les trois premières archives citent 2001, 2018 et 2020 (FRA aussi 2021). Le PDF anglais cite 2001 et 2016 ; **`2018` et `2020` en sont absents** : ce n’est pas une traduction du Companion Volume 2020.

### 2.3 Doublons et relation entre les documents

Les **quatre SHA-256 sont tous différents** : aucun doublon bit à bit. Les premières lignes non vides confirment quatre documents distincts : `CADRE EUROPÉEN…`, `QUADRO COMUNE…`, `Gemeinsamer europäischer Referenzrahmen…`, `Developing illustrative descriptors…`.

- FRA / ITA / GER : même ossature (chapitres 3.1→3.4, 5.1→5.3), mêmes niveaux A1→C2, mêmes renvois à la version en ligne de 2018, mais langues, paginations et ISBN nationaux différents. **Inféré** : trois traductions/éditions nationales du même *Volume complémentaire* du CECR.
- ENG : document distinct, sans sommaire ni grilles A1→C2, avec titre, © 2016, projet daté de janvier 2014 à avril 2016 (p.6), ISBN/DOI propres. **Inféré** : texte de travail sur la médiation, apparenté au même programme du Conseil de l’Europe, mais pas une traduction du Companion Volume.

---

## 3. Analyse du contenu

### 3.1 Niveaux A1–C2

Les trois traductions FRA, ITA et GER contiennent **les six niveaux A1, A2, B1, B2, C1 et C2**. Le comptage ci-dessous est le nombre de pages où le code de niveau apparaît : c’est un indicateur de présence, **pas un nombre de descripteurs**.

| PDF | A1 | A2 | B1 | B2 | C1 | C2 |
|---|---:|---:|---:|---:|---:|---:|
| FRA | 134 | 135 | 147 | 154 | 130 | 132 |
| ITA | 138 | 145 | 152 | 160 | 137 | 140 |
| GER | 102 | 96 | 105 | 105 | 93 | 98 |
| ENG | 5 | 2 | 7 | 6 | 2 | 8 |

Dans le PDF anglais, les codes existent mais **aucune grille complète n’est présente** et aucune cellule de niveau isolée n’a été détectée : les occurrences proviennent de renvois et d’exemples de médiation, pas de tableaux A1→C2.

### 3.2 Catégories de descripteurs et compétences

| PDF | Catégories observées | Traduction des sections |
|---|---|---|
| FRA | Activités communicatives (réception, production, interaction, médiation) ; stratégies (réception, interaction, médiation) ; compétence linguistique, sociolinguistique, pragmatique ; compétence plurilingue et pluriculturelle | `3.1. RÉCEPTION` p.49, `3.2. PRODUCTION` p.64, `3.3. INTERACTION` p.75, `3.4. MÉDIATION` p.96, `5.1. COMPÉTENCE LINGUISTIQUE` p.135, `5.2.` p.142, `5.3.` p.143 |
| ITA | Mêmes catégories, en italien ; `attività di comunicazione linguistica` p.37 | `3.1. Ricezione` p.49, `3.2. Produzione` p.64, `3.3. Interazione` p.76, `3.4. Mediazione` p.99, `5.1. Competenza linguistica` p.140, `5.2.` p.148, `5.3.` p.148 |
| GER | `kommunikative Aktivitäten`, `Rezeption/Produktion/Interaktion/Mediation`, `Rezeptions-/Interaktions-/Mediationsstrategien`, `sprachliche/soziolinguistische/pragmatische Kompetenz`, `Mehrsprachigkeit` | `3.1 Rezeption` p.57, `3.2 Produktion` p.72, `3.3 Interaktion` p.86, `3.4 Mediation` p.111, `5.2 Soziolinguistische Kompetenz` p.160, `5.3 Pragmatische Kompetenz` p.160 |
| ENG | `mediation activities`, `strategies`, `related competences`, `plurilingual and pluricultural repertoire` ; pas de sections `linguistic/sociolinguistic/pragmatic competence` | Sections numérotées de type `4.4.4.1 oral mediation: simultaneous interpretation` p.9 ; pas de `Contents` |

**Projection vers le chargeur** : les catégories PDF ne se mappent pas une pour une sur les 6 compétences de `CompetenceCorpus`. À titre indicatif : réception → `ecoute` / `lecture`, production → `oral` / `ecrit`, interaction → `oral` / `ecrit`, compétence linguistique → `grammaire` / `lexique`. La médiation, les stratégies, le plurilinguisme et les compétences sociolinguistique/pragmatique **n’ont pas de compétence équivalente** dans le schéma actuel. Le script d’ingestion contient déjà une projection partielle (`scripts/ingestion_cecrl.py:61-106`) pour les échelles du noyau P0.

### 3.3 Identifiants et références observés

Aucun des quatre PDF n’utilise d’identifiant opaque de descripteur (type `[D-12]`). Les repères réellement observés sont :

- le **code de niveau seul** (`C2`, `B1`, `A2`…) dans la colonne de gauche des grilles (FRA p.36/38/60, GER p.44/48/50, ITA p.52–54) ;
- la **numérotation hiérarchique des échelles**, par exemple `3.4.1.2. MÉDIATION DE CONCEPTS` (FRA) ou `3.1.2. Strategie di ricezione` (ITA) ;
- les **renvois Figure/Tableau**, par exemple `Figure 14 – Activités de médiation et stratégies` (FRA p.96), `Figura 1 – Struttura dello schema descrittivo del QCER` (ITA p.8/31), `Abbildung 1: Die Struktur des Beschreibungssystems des GeR` (GER p.10/39), `Figure 1` (ENG p.8), `Figure 2` (ENG p.36), `Figure 4` (ENG p.39) ;
- les **variantes entre crochets**, par exemple `[uditiva/visiva]` (ITA p.55) ou `[auditive / visuelle]` (GER p.60). Les crochets sont surtout des ellipses éditoriales ailleurs (FRA p.128) ;
- le PDF anglais renvoie aussi à `CEFR Section 8.4.2: English version, p. …` (p.9), mais sans ID stable.

**Conséquence** : il n’existe pas dans ces PDF de clé primaire réutilisable telle quelle. Un identifiant `cecrl:xx:2020:nnnn` ne peut être fabriqué que depuis la **ligne du classeur officiel** (`source_no`), pas depuis la page PDF.

### 3.4 Structure des tableaux et sections

- **FRA / ITA / GER** : sommaire respectivement `TABLE DES MATIÈRES` p.4, `INDICE` p.4, `Inhaltsverzeichnis` p.6 ; même progression chapitre 3 (activités communicatives) puis chapitre 5 (compétences). Les tableaux de descripteurs sont disposés en colonnes avec le niveau à gauche et le texte à droite. `-layout` conserve globalement cette disposition, mais les figures sont aplaties.
- **ENG** : document de type rapport, sans sommaire : titre p.5, introduction p.6, sections numérotées (ex. `4.4.4.1 oral mediation: simultaneous interpretation` p.9). Il ne fournit pas de grilles A1→C2 exploitables pour l’ingestion.

### 3.5 Exemples très courts — vérification de structure

Ces extraits de 5 à 12 mots ne sont donnés que pour montrer un phénomène d’extraction ou de structure.

| PDF | Page | Extrait court | Ce que cela prouve |
|---|---:|---|---|
| FRA | 60 | `f le sujet des instructions, allant des interdits courants` | puce de liste rendue comme `f` (police symbolique) |
| FRA | 3 | `jusqu’à 500 mots) est auto- risée, sauf à des fins commerciales` | césure typographique conservée dans le mot |
| FRA | 96 | `Médiation d’un texte Médiation de concepts Médiation de la communication` | figure 14 aplatie en colonnes |
| ITA | 9 | `PREFAZIONE _______ Il Quadro Comune Europeo` | filet de soulignement du sommaire devenu texte |
| ITA | 24 | `la mediazione interlinguistica (in particolare per le scale` | puce en zone privée U+F02D |
| GER | 3 | `CEFR/GeR in einer benutzer- freundlichen Form` | césure conservée |
| GER | 28 | `Soziolinguistische Kompetenz  Pragmatische Kompetenz ` | cases à cocher en zone privée U+F0FC |
| ENG | 5 | `Page 2 ►Developing illustrative descriptors of aspects of mediation for the CEFR` | en-tête fusionné au texte, flèche U+25BA |
| ENG | 17 | `The ecological- semiotic perspective helps to overcome the idea` | césure conservée |

**Bilan qualité** : 0 caractère de remplacement U+FFFD dans les 4 extraits, donc aucun décodage UTF-8 invalide. En revanche, `-layout` produit des artefacts de police (`f`, `►`, U+F02D, U+F0FC), des césures intra-mots, des en-têtes/pieds de page fusionnés et des figures aplaties. Une relecture humaine et un nettoyage ciblé seront nécessaires avant toute extraction automatisée de descripteurs.

---

## 4. Vérification juridique

### 4.1 Titulaire, éditeur et référence de l’ouvrage

| Point | Réponse | Source | Certitude |
|---|---|---|---|
| Titulaire du copyright | **Conseil de l’Europe**, Council of Europe Publishing, Strasbourg. © Council of Europe, April 2020. | PDF officiel `https://rm.coe.int/common-european-framework-of-reference-for-languages-learning-teaching/16809ea0d4`, page de copyright. | Élevée |
| Auteur·s éditoriaux | Brian North, Tim Goodier (Eurocentres Foundation), Enrica Piccardo (University of Toronto / Université Grenoble-Alpes) ; chapitre « signing competences » par Jörg Keller. | Idem, « Preface with acknowledgements ». | Élevée |
| Titre exact | *Common European Framework of Reference for Languages: Learning, teaching, assessment – Companion volume*, 2020. Une version préliminaire était parue en ligne en 2018 sous le titre *Companion Volume with New Descriptors*. | Page de copyright du PDF officiel ; page CEFR `https://www.coe.int/en/web/common-european-framework-reference-languages/home`. | Élevée |
| ISBN | Papier `978-92-871-8621-8` ; PDF `978-92-871-8645-4`. | Fiches bookshop `8150` et `8152` sur `book.coe.int`. | Élevée |
| DOI | **Aucun DOI officiel trouvé** dans le PDF ni dans les pages consultées. | Recherche documentaire ; ne pas inventer de DOI dans une citation. | Moyenne |

#### 4.1.1 Droits par document local

| Fichier | Titulaire(s) / éditeur indiqué dans le PDF | Ce que le fichier dit explicitement | Conséquence pour l’audit |
|---|---|---|---|
| `CEFR Companion volume_fra.pdf` | © Conseil de l’Europe, décembre 2021 ; Éditions du Conseil de l’Europe, Strasbourg | p.3 : reproduction « jusqu’à 500 mots » autorisée « sauf à des fins commerciales » ; p.292 : `Council of Europe Publishing` | Pas de licence ouverte. Le seuil 500 mots et l’exclusion commerciale sont confirmés dans le fichier local. |
| `CEFR Companion Volume_ita.pdf` | © Council of Europe, aprile 2020 ; © Università degli Studi di Milano « Italiano LinguaDue », 2020 ; Council of Europe Publishing | p.3 : double copyright Council of Europe / université ; ISBN `978-92-871-8621-8` | Un second titulaire apparaît : l’autorisation du seul Conseil de l’Europe peut être insuffisante pour cette édition. |
| `CEFR CV 2018_German.pdf` | © 2020 Council of Europe, Straßburg ; © 2020 Goethe-Institut München ; Ernst Klett Sprachen ; Council of Europe Publishing | p.5 : double copyright Conseil de l’Europe / Goethe-Institut ; ISBN `978-3-12-676999-0` ; PDF/X-4 | Idem : titulaires multiples, notice distincte à vérifier avant toute extraction. |
| `Developing illustrative descriptors of aspects of mediation for the CEFR_eng.pdf` | © Council of Europe, 2016 ; Council of Europe Publishing | p.3 : `© Council of Europe, 2016` ; p.62 : DOI ; p.6 : projet 2014–2016 | Document de travail plus ancien, distinct du Companion Volume 2020 ; ne pas l’utiliser comme source de descripteurs officiels 2020. |

Aucun des quatre fichiers ne contient de mention de licence `Creative Commons` ou d’équivalent.

### 4.2 Licence ouverte ?

**Aucune licence ouverte (CC BY, CC BY-SA ou équivalent) n’a été trouvée** sur le PDF officiel, le classeur officiel, les pages CEFR Companion Volume / CEFR Descriptors, la page « Copyright, licensing & permissions », le disclaimer, les fiches bookshop ni le pied de page edoc.coe.int. Le régime décrit est celui d’une **autorisation sur demande**, pas d’une licence ouverte.

Source principale : `https://www.coe.int/en/web/portal/copyright-licensing-permissions` — « *Prior written permission is required to reproduce, republish, or translate material from a Council of Europe publication or document.* »

Il ne s’agit pas d’une preuve absolue d’absence : la page racine `rm.coe.int` n’a pas pu être lue (redirection JavaScript / challenge), et deux URLs `coe.int` testées (`/en/web/conventions/copyright-and-copying-policy`, `/en/web/about-us/copyright`) renvoyaient 404 au moment de l’audit.

### 4.3 Distinction des usages

| Usage | Autorisation écrite semble nécessaire ? | Motivation |
|---|---|---|
| Consultation humaine du PDF en ligne | **Non** pour la lecture. Citer sans reproduire : **non**, avec crédit. | Page « Copyright, licensing & permissions », sections *Citing* et *Links* ; « *No permission is necessary merely to cite …* ». |
| Extraction automatisée de texte | **Oui, par prudence**. | La clause « All rights reserved » vise la reproduction « *in any form or by any means, electronic …* ». Aucun texte consulté n’exonere l’automatisation. |
| Stockage d’un corpus dérivé | **Oui, très vraisemblablement**. | La même clause interdit « *any information storage or retrieval system* » sans autorisation écrite ; la règle des 500 mots est très probablement dépassée par 325 descripteurs. |
| Indexation / RAG | **Oui, recommandé**. | Usage dérivé non visé explicitement par les textes officiels ; le manifeste local exige déjà une clarification écrite. |
| Mise en ligne / republication | **Oui**. | « *Prior written permission is required to reproduce, republish, or translate …* ». |
| Exploitation commerciale | **Oui, clairement**. | Page « Rights and permissions » : « *Persons wishing to make some other use, including commercial … are asked to apply for prior written authorisation* ». |

Deux règles importantes de la page officielle :

- extraits de **moins de 500 mots** : aucune autorisation, crédit requis ; au-delà, autorisation écrite préalable ;
- lien direct vers une page web du Conseil de l’Europe autorisé sans demande pour un usage non commercial, mais le disclaimer prévient qu’un document en ligne « *does not constitute an official publication* ».

### 4.4 Nuance sur le classeur officiel

Le classeur `https://rm.coe.int/cefr-descriptors-2020-/16809ed2c7` contient une note du type : « *These descriptors can be reproduced for non-commercial purposes provided the source is indicated. … English edition © Council of Europe, 2020 …* ».

**Attention** : cette chaîne n’a été retrouvée que dans la feuille **Bulgarian** du classeur téléchargé, pas dans la feuille **English** utilisée par `scripts/ingestion_cecrl.py`. Elle ne peut donc pas être invoquée telle quelle pour lever le statut `non_clarifiee`. Une clarification écrite doit porter explicitement sur la feuille anglaise.

### 4.5 État local et autorisations à demander

Les fichiers locaux sont déjà prudents :

- `ia-service/corpus/cecrl/manifeste.json:13-16` : `licence.statut = "non_clarifiee"`, citation « © Conseil de l’Europe, 2020 », note « usage interne, non distribué, non commercial uniquement tant que les droits ne sont pas clarifiés par écrit » ;
- `ia-service/corpus/README.md:47-51` : aucun descripteur officiel ne doit être ajouté au dépôt, à un artefact de build, à une image Docker publiée ou à un jeu de données partagé ;
- `docs/PRE-08-corpus-cecrl.md:191-205` : droits non clarifiés pour le classeur **et** le Companion volume ;
- `docs/ia/US150-audit-preparation-ingestion.md:414-422` : conserver le statut, aucune clarification obtenue.

Autorisations à demander par écrit au Conseil de l’Europe (Directorate of Communication, `publishing@coe.int`, formulaire `https://www.coe.int/en/web/forms/shared/-/form/183010022`) :

1. reproduction, stockage et indexation des descripteurs de la feuille anglaise pour un RAG interne de diagnostic ;
2. clarification du conflit apparent entre la clause « All rights reserved » du PDF et la note non commerciale du classeur, et confirmation que cette note couvre la feuille anglaise ;
3. autorisation commerciale distincte si la fonctionnalité est monétisée, exposée à des tiers ou embarquée dans une image publiée ;
4. autorisation de republication si le corpus quitte le montage local en lecture seule ;
5. autorisation de traduction si d’autres versions linguistiques sont envisagées.

Ces éléments ne constituent pas un avis juridique définitif ; le droit national applicable (France / Madagascar) et une éventuelle exception TDM n’ont pas été analysés ici.

---

## 5. Préparation technique — schéma JSONL

### 5.1 Schéma réel du chargeur

`DescripteurCorpus` (`ia-service/app/rag/corpus.py:101-125`) impose **9 champs et aucun autre** (`app/schemas/base.py:6-14`, `extra="forbid"`) :

| Champ | Constraint |
|---|---|
| `identifiant` | regex `^cecrl:[a-z]{2}:[0-9]{4}:[0-9]{4}$`, ≤ 64 |
| `code_langue` | `fr/en/zh/it/de` (`app/schemas/regles.py:25,39`) |
| `referentiel` | `CECRL` ou `HSK`, cohérent avec la langue |
| `niveau` | `A1`…`C2` |
| `sous_niveau` | `A1`…`C2` avec `+` optionnel ; cohérent avec `niveau` |
| `competence` | `ecoute`, `lecture`, `ecrit`, `oral`, `grammaire`, `lexique` dans le corpus ; 5 valeurs côté prompt |
| `echelle` | 1–120 caractères, ex. `Conversation`, `Vocabulary range` |
| `contenu` | 1–3000 caractères |
| `source_no` | entier 1–9999, **numéro de ligne du classeur**, pas une page PDF |

`ManifesteCorpus` (`corpus.py:86-98`) porte la version, la source, la licence, les langues/niveaux/compétences, les comptages et l’empreinte SHA-256 du JSONL. `CorpusCecrl.charger()` vérifie l’empreinte puis valide chaque ligne (`corpus.py:217-278`).

### 5.2 Correspondance avec les 12 champs demandés

**Verdict : la ligne à 12 champs serait rejetée en l’état** (champs inconnus + champs requis absents).

| Champ demandé | Équivalent actuel | Verdict | Traitement proposé |
|---|---|---|---|
| `id` | `identifiant` | Renommer + convertir | Générer `cecrl:<langue>:2020:<numéro à 4 chiffres>` depuis le classeur ; jamais d’ID d’exercice sous ce préfixe. |
| `framework` | `referentiel` | Renommer + normaliser | Valeur fermée `CECRL`. |
| `version` | `ManifesteCorpus.version` | **Rejeté sur la ligne** | Version globale dans le manifeste (`cecrl-2020.1`), pas par descripteur. |
| `language` | `code_langue` | Renommer + mapper | `fr/en/it/de` ; valeur `zh` ⇒ HSK, pas CECRL. |
| `level` | `niveau` + `sous_niveau` | Renommer | `A2+` se stocke dans `sous_niveau`, `A2` dans `niveau`. |
| `skill` | Aucun | **Rejeté** | Ne pas détourner `echelle` ; prévoir un champ optionnel dans une US dédiée si nécessaire. |
| `competence` | `competence` | Nom accepté | Mapping explicite et validé. |
| `descriptor` | `contenu` | Renommer | Texte exact issu de la source, jamais complété. |
| `source_title` | `manifeste.source.oeuvre` | **Rejeté sur la ligne** | Provenance au niveau manifeste ; extension `SourceRef` à prévoir. |
| `source_page` | Aucun ; `source_no` ≠ page | **Rejeté** | Nouveau champ optionnel `page` uniquement si la page PDF est réellement vérifiée. |
| `source_reference` | `manifeste.source.url` / `empreinte_sha256` | **Rejeté sur la ligne** | Bloc `SourceRef` : `source_id`, chemin, nature, SHA, localisation. |
| `rights_status` | `manifeste.licence.statut` | **Rejeté sur la ligne** | Statut fermé dans le manifeste : `non_clarifiee`, `extraits_non_commercial`, `accord_ecrit`. |

### 5.3 Template de forme — aucune donnée inventée

```json
{"id":"<identifiant stable à générer>","framework":"<à extraire de la source validée>","version":"<version du manifeste>","language":"<code langue validé>","level":"<à extraire de la source validée>","skill":"<à valider ou à laisser absent>","competence":"<à valider dans l'énumération>","descriptor":"<texte exact à extraire de la source validée>","source_title":"<titre de la source validée>","source_page":"<page vérifiée ou absent>","source_reference":"<référence imprimée vérifiée>","rights_status":"<statut juridique confirmé par écrit>"}
```

Ce bloc illustre uniquement les 12 champs demandés. **Tel quel, il n’est pas compatible avec le chargeur actuel.** Il ne doit jamais être écrit dans `descripteurs.jsonl` en l’état.

### 5.4 Schéma définitif proposé

Pour la première version exploitable, **conserver le schéma actuel du chargeur**, sans modifier le code :

```json
{"identifiant":"cecrl:<langue>:2020:<NNNN>","code_langue":"<langue>","referentiel":"CECRL","niveau":"<A1|A2|B1|B2>","sous_niveau":"<niveau ou niveau+>","competence":"<competence>","echelle":"<echelle exacte>","contenu":"<texte exact>","source_no":<numéro_de_ligne>}
```

La traçabilité enrichie (`source_title`, `source_page`, `source_reference`, `rights_status`) reste dans le manifeste et, dans une US séparée, dans un objet `SourceRef` par item. Aucune page, aucun titre et aucun statut juridique ne doivent être inférés.

---

## 6. Analyse des 27 JSON existants

### 6.1 Nature des fichiers

Les 27 JSON de `ia-service/corpus/cecrl/{anglais,Deutsch,français,italian}/` sont **des exercices**, pas des descripteurs officiels :

- 6 fichiers par langue pour A1→C2 (24) + 3 agrégats (`en`, `de`, `fr`) ; aucun agrégat italien ;
- 200 questions ouvertes + 200 QCM par fichier de niveau, 1 200 + 1 200 par agrégat ;
- **9 600 items uniques** après retrait des 3 agrégats redondants (4 800 QA + 4 800 QCM).

Leurs propres métadonnées les qualifient d’originaux et non officiels, par exemple :

- anglais : « *newly authored practice items … not official EAQUALS questions* » ;
- allemand : « *original German practice material, not official exam questions.* » ;
- français : « *Contenu pédagogique original … non officiel.* » ;
- italien : « *Contenuti didattici originali … non sono quesiti ufficiali di certificazione.* ».

### 6.2 Recoupements et doublons

- Agrégats `en`/`de`/`fr` = union exacte des six fichiers de niveau : différence d’IDs nulle.
- Allemand : QCM **55 énoncés uniques / 200** par niveau et **319 / 1 200** dans l’agrégat ; 11 énoncés partagés A2/B2.
- Italien : A2 190/200, B1 190/200, B2 170/200, C1 160/200 en QA et QCM, avec recouvrements inter-niveaux.
- Aucun auteur, aucune licence et aucune SHA propre dans ces JSON ; seule `version: "1.0"` apparaît dans l’agrégat anglais.

Les thèmes (`greetings`, `daily routines`, `formal requests`, `famille`, `conversazione quotidiana`, etc.) recoupent du vocabulaire pédagogique proche d’échelles CECRL, mais **aucun numéro de page PDF, titre de Companion Volume ou ID de descripteur officiel** n’y figure. Ce sont des recoupements thématiques, pas une preuve d’extraction.

### 6.3 Utilisation comme corpus pédagogique distinct

Ces JSON peuvent constituer un corpus **CARCL** séparé, à condition de :

- exclure les 3 agrégats redondants et dédupliquer `de`/`it` avant indexation ;
- garder des identifiants `carcl:<langue>:<id_original>`, jamais `cecrl:` ;
- conserver les mentions « original / aligné / non officiel » et les champs pédagogiques (`skill`, `level_focus`, `answer_type`, `score_pct`) ;
- traiter les scores `0/20/50/75/100` comme des crédits partiels, pas des probabilités ;
- conserver `licence` non clarifiée et ne pas mélanger ce corpus aux descripteurs officiels dans le même index sans étiquette de famille ;
- ne pas réutiliser `synthetique_fallback`, réservé au repli du diagnostic.

---

## 7. Méthode de constitution du corpus — sans artefact généré ici

1. **Obtenir l’autorisation écrite** décrite au §4.5, en précisant la feuille anglaise du classeur, le volume, l’usage RAG interne, la durée et la citation exacte.
2. **Choisir la source de vérité** : pour le chargeur actuel, le classeur officiel `CEFR Descriptors 2020` reste la source directe des 325 descripteurs annoncés ; les PDF servent à la vérification documentaire et à la compréhension des catégories, pas à remplacer le classeur par défaut.
3. **Vérifier chaque nouvelle source PDF** : pages, texte extractible, éventuel OCR, structure des tableaux, référence imprimée et numéro de page avant toute extraction.
4. **Normaliser sans inventer** : un descripteur n’est créé que si son texte exact existe dans la source validée ; une page illisible ou un champ absent est signalé, pas comblé.
5. **Écrire hors dépôt** : `python -m scripts.ingestion_cecrl --source <archive> --sortie <hors dépôt> --langue en` ; le script refuse toute sortie dans le dépôt (`ingestion_cecrl.py:193-201`).
6. **Contrôler l’artefact** : SHA256 du JSONL conforme au manifeste, 325 lignes, comptages A1 64 / A2 93 / B1 93 / B2 75, compétences cohérentes, aucun ID dupliqué.
7. **Monter en lecture seule** dans le conteneur via `RAG_CORPUS_CHEMIN`, sans ajouter le fichier à Git ni à l’image.
8. **Activer et vérifier** : `RAG_CORPUS_ACTIF=true`, redémarrage, contrôle du chargement dans les logs puis requête de diagnostic avec `version_corpus` cohérent.
9. **Mettre à jour la documentation** : manifeste licence/citation/note, `corpus/README.md`, contrat frontend si une citation source est exposée, et tests de non-régression du repli.

---

## 8. Rapport final

### 8.1 PDF réellement exploitables

Le critère n’est pas seulement « du texte sort de `pdftotext` » : un PDF est exploitable pour l’ingestion seulement si (a) le texte est fiable, (b) la structure des descripteurs est identifiable, (c) la provenance page/référence est vérifiable et (d) les droits sont clarifiés par écrit.

| Fichier | Structure A1→C2 | Texte extractible | Verdict technique | Verdict juridique |
|---|---|---|---|---|
| `CEFR Companion volume_fra.pdf` | Oui | Oui, 1 443 061 car., 14 pages pauvres | **Exploitable après nettoyage et relecture** ; édition française 2021 | **Bloqué** : droits non clarifiés |
| `CEFR Companion Volume_ita.pdf` | Oui | Oui, 1 189 095 car., aucune page vide | **Meilleure extraction des quatre** ; édition italienne 2020 | **Bloqué** : droits non clarifiés, © université en plus |
| `CEFR CV 2018_German.pdf` | Oui | Oui, 778 810 car., 3 pages vides | **Exploitable après nettoyage** ; édition allemande avec © Goethe-Institut | **Bloqué** : droits non clarifiés, titulaires multiples |
| `Developing illustrative descriptors of aspects of mediation for the CEFR_eng.pdf` | Non (codes présents, pas de grilles) | Oui, 221 497 car., 6 pages pauvres | **Partiellement exploitable** comme source conceptuelle sur la médiation, **pas** comme table de descripteurs 2020 | **Bloqué** : document 2016 distinct, droits non clarifiés |

**Conclusion** : techniquement, les trois traductions FRA/ITA/GER sont exploitables comme sources de validation ; l’anglais ne l’est que partiellement. **Juridiquement, aucun des quatre n’est exploitable pour un corpus RAG tant qu’une autorisation écrite n’a pas été obtenue.**

### 8.2 Niveaux et compétences disponibles

- **Dans les PDF** : FRA, ITA et GER couvrent A1, A2, B1, B2, C1 et C2, avec réception, production, interaction, médiation, stratégies, compétences linguistique/sociolinguistique/pragmatique et compétence plurilingue. L’anglais ne couvre que la médiation et les compétences associées, sans grilles complètes.
- **Dans le chargeur actuel** : le manifeste livré couvre uniquement `en`, **A1–B2**, avec 325 descripteurs et 6 compétences (`ecoute`, `lecture`, `ecrit`, `oral`, `grammaire`, `lexique`). Les niveaux **C1/C2** sont modélisables par le schéma (`NIVEAUX_CECRL` inclut C1/C2, `app/schemas/regles.py:22`) mais absents du manifeste : ils nécessiteraient une nouvelle version de corpus validée.
- **Écarts** : médiation, stratégies, plurilinguisme et compétences sociolinguistique/pragmatique ne correspondent à aucune compétence du chargeur. Le noyau P0 de `scripts/ingestion_cecrl.py:59-106` ne retient qu’une projection partielle des échelles.

### 8.3 Problèmes d’extraction

1. **Langue non déclarée** : aucun `dc:language` dans les 4 fichiers ; la langue est déduite du texte, avec une page de titre française incluse dans le PDF anglais.
2. **Pages pauvres / vides** : 14 pages < 50 caractères en français, 3 en allemand, 6 en anglais, 0 en italien. Aucune page scannée prouvée, mais les pages image/intercalaires restent à vérifier visuellement.
3. **Artefacts de police** : `f` pour une puce, `►` (U+25BA), U+F02D, U+F0FC, filets de soulignement transformés en texte.
4. **Césures typographiques** conservées dans les mots (`auto- risée`, `benutzer- freundlichen`, `ecological- semiotic`) et URL de notes brisées en allemand.
5. **Mise en page** : en-têtes/pieds fusionnés au corps, figures aplaties en colonnes, décalage page PDF / page imprimée en français (p.176 → `Page 177`).
6. **Aucun identifiant stable** : aucun code opaque de descripteur dans les PDF ; seulement niveau, numérotation de section et renvois Figure. L’ID `cecrl:xx:2020:nnnn` doit venir du classeur, pas du PDF.
7. **Document anglais hétérogène** : © 2016, pas de sommaire, pas de grilles A1→C2, ISBN/DOI propres ; ne pas le présenter comme le Companion Volume 2020.

### 8.4 Conditions juridiques

© Conseil de l’Europe 2020. Aucune licence ouverte trouvée. Consultation/citation sans reproduction : pas d’autorisation. Extraction automatisée, stockage d’un corpus dérivé, indexation RAG, republication, exploitation commerciale : autorisation écrite à demander. Le statut local reste `non_clarifiee` ; aucun PDF, classeur, archivage ou `descripteurs.jsonl` ne doit être versionné ou embarqué dans une image publiée avant clarification.

### 8.5 Schéma JSONL définitif proposé

Le schéma définitif pour la première version reste les **9 champs stricts de `DescripteurCorpus`** décrits au §5.4. Les 12 champs demandés par l’US sont une couche de traçabilité cible : ils nécessitent soit une extension du manifeste/du chargeur dans une US dédiée, soit un objet `SourceRef` séparé. En aucun cas un champ inconnu ne doit être ajouté au JSONL actuel sous peine de rejet par `extra="forbid"`.

### 8.6 Étapes exactes pour activer le RAG CECRL

1. Clarification écrite des droits (§4.5) et report dans `manifeste.json` : `licence.statut`, `citation`, `note`.
2. Récupération du classeur officiel vérifié (SHA-256 `7c80f798…`) et génération du JSONL **hors dépôt** avec `scripts/ingestion_cecrl.py --langue en`.
3. Contrôle des 325 descripteurs, de l’empreinte `b0bce621…`, des comptages et de l’absence de doublons d’identifiants.
4. Montage du dossier en lecture seule : `- ./chemin/hors/depot/cecrl:/app/corpus/cecrl:ro` (le compose livré monte déjà `./ia-service/corpus:/app/corpus:ro`).
5. Configuration : `RAG_CORPUS_ACTIF=true`, `RAG_CORPUS_CHEMIN=/app/corpus/cecrl`, `RAG_CORPUS_VERIFIER_EMPREINTE=true`.
6. Redémarrage du service IA ; log attendu : `Corpus CECRL cecrl-2020.1 chargé : 325 descripteurs.` et récupérateur `local-cecrl` (pas `RecuperateurVide`).
7. Vérification fonctionnelle : requête de diagnostic `fr/en/it/de` A1–B2, descripteurs non vides, `version_corpus` renseigné ; hors couverture (`C1/C2`, `zh`) le repli prudent reste attendu.
8. Non-régression : `make check` et les 96 tests RAG/agent ciblés ; le repli doit rester étiqueté `synthetique_fallback`.
9. Documentation et PR : mise à jour du README corpus, du contrat si la citation source est exposée, puis PR vers `develop` avec 2 reviewer IA.

---

## Livraison

- Branche : `audit/US150-A-pdf-cecrl` depuis `origin/develop` (`9608274`).
- Checkout principal laissé intact : ses 3 fichiers modifiés et 2 fichiers non suivis n’ont pas été touchés.
- Livrable : uniquement `docs/US150_A_AUDIT_PDF_CECRL.md`.
- Aucun PDF, MP3, classeur, JSONL ni fichier volumineux ajouté à Git.
- Aucun descripteur fictif créé.
- PR préparée vers `develop`, **non fusionnée**.
