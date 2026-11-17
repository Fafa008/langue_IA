# Gestion des corpus CECRL, CARCL et HSK

**Date de l'audit :** 18 novembre 2026  
**Branche :** `feature/PRE-12-audit-corpus-cecrl-hsk` (créée depuis `origin/develop` après `git fetch`)  
**Statut :** bilan préparé, **en attente de validation** ; aucun commit, aucune PR, aucune ingestion et aucune modification du RAG.

> Périmètre observé : l'arborescence `ia-service/corpus/` telle qu'elle existe dans l'arbre de travail. Aucun fichier source du corpus n'a été déplacé, renommé, modifié ou supprimé. Les états préexistants (`docs/fonctionnalites/05-ia-service.md` modifié, `ia-service/corpus/cecrl/manifeste.json` absent du disque mais suivi par Git, dossiers non suivis `CARCL/` et `HSK/`) ont été conservés tels quels.
>
> Unités : **Mo = 1 000 000 octets**, **Go = 1 000 000 000 octets**. Les durées audio sont calculées par décompte des trames MPEG, sans `ffprobe` ni dépendance supplémentaire.

## 1. Objectif des corpus

| Famille | Usage pédagogique visé | Usage IA visé |
| --- | --- | --- |
| CECRL / CARCL | Questions ouvertes et QCM alignés sur A1–C2 pour l'anglais, l'allemand, le français et l'italien. | Matière potentielle pour le diagnostic, les invites et le RAG lexical ; les descripteurs officiels restent hors dépôt. |
| HSK | Manuels, cahiers d'exercices, production écrite et pistes audio pour le chinois de niveau HSK 1 à 4B. | À étudier pour la compréhension écrite/auditive et l'alignement transcription-audio ; **non branché** aujourd'hui. |

Déjà présent dans le code : `ia-service/app/rag/corpus.py` charge un corpus **CECRL** à partir d'un `manifeste.json` et d'un `descripteurs.jsonl` validés, avec un récupérateur BM25 déterministe. Le corpus est désactivé par défaut (`RAG_CORPUS_ACTIF=false`) et retombe sur `RecuperateurVide`. Le script `ia-service/scripts/ingestion_cecrl.py` génère le JSONL hors dépôt. Aucun PDF, audio, jeu CARCL ou manifeste HSK n'est consommé par le service IA.

## 2. Inventaire des ressources réellement examinées

### 2.1 Méthode et volumétrie

Lecture seule : listage des 517 fichiers, SHA256 sur tous les fichiers, `pdfinfo`/`pdftotext` pour les PDF, analyse des en-têtes et de la chaîne de trames MPEG pour les MP3, parcours JSON UTF-8 pour CARCL. Aucune transcription, OCR complet ou ingestion réelle n'a été lancé.

| Famille | Fichiers | Taille (Mo) | Formats | Observation |
| --- | ---: | ---: | --- | --- |
| CARCL | 27 | 11,41 | JSON | 4 langues, A1–C2, QA + QCM |
| HSK PDF | 10 | 715,8 | PDF | 1 326 pages au total |
| HSK audio | 479 | 423,3 | MP3 | 2,18 h au total |
| README | 1 | < 0,01 | Markdown | `ia-service/corpus/README.md` |
| **Total** | **517** | **≈ 1 150,5** | — | **Aucun groupe de doublons octet pour octet** |

### 2.2 Synthèse CECRL / CARCL

Les 27 fichiers JSON sont encodés en UTF-8 et analysables. Chaque fichier « par niveau » contient 200 questions ouvertes et 200 QCM pour un niveau A1 à C2. L'anglais, l'allemand et le français possèdent en plus un fichier agrégé A1–C2 ; l'italien ne possède que les six fichiers de niveau. Les schémas diffèrent selon la langue (`question_answer`/`mcq`, `open_questions`/`multiple_choice_questions`, `question_answer`/`multiple_choice`, structures imbriquées `data`, `cefr_levels`, `levels` ou `metadata`). Ces différences empêchent une ingestion directe sans normalisation.

| Fichier | Langue | Niveau | Taille (Mo) | QA | QCM | Clés racine | Observation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `CARCL/Deutsch/german_a1_dataset_200_QA_200_MCQ.json` | Allemand (de) | A1 | 0.23 | 200 | 200 | language, language_code, cefr_level, level_focus, source_basis | QCM : 55 énoncés uniques/200 |
| `CARCL/Deutsch/german_a2_dataset_200_QA_200_MCQ.json` | Allemand (de) | A2 | 0.24 | 200 | 200 | language, language_code, cefr_level, level_focus, source_basis | QCM : 55 énoncés uniques/200 |
| `CARCL/Deutsch/german_b1_dataset_200_QA_200_MCQ.json` | Allemand (de) | B1 | 0.25 | 200 | 200 | language, language_code, cefr_level, level_focus, source_basis | QCM : 55 énoncés uniques/200 |
| `CARCL/Deutsch/german_b2_dataset_200_QA_200_MCQ.json` | Allemand (de) | B2 | 0.27 | 200 | 200 | language, language_code, cefr_level, level_focus, source_basis | QCM : 55 énoncés uniques/200 |
| `CARCL/Deutsch/german_c1_dataset_200_QA_200_MCQ.json` | Allemand (de) | C1 | 0.30 | 200 | 200 | language, language_code, cefr_level, level_focus, source_basis | QCM : 55 énoncés uniques/200 |
| `CARCL/Deutsch/german_c2_dataset_200_QA_200_MCQ.json` | Allemand (de) | C2 | 0.34 | 200 | 200 | language, language_code, cefr_level, level_focus, source_basis | QCM : 55 énoncés uniques/200 |
| `CARCL/Deutsch/german_cefr_dataset_1200_QA_1200_MCQ.json` | Allemand (de) | A1–C2 | 1.84 | 1200 | 1200 | language, cefr_levels | QCM : 55 énoncés uniques/200; identique à l'union des six fichiers par niveau |
| `CARCL/anglais/english_a1_dataset_200_QA_200_MCQ.json` | Anglais (en) | A1 | 0.23 | 200 | 200 | title, level, source_alignment, scoring_note, question_answer | aucune répétition détectée dans les listes |
| `CARCL/anglais/english_a2_dataset_200_QA_200_MCQ.json` | Anglais (en) | A2 | 0.24 | 200 | 200 | title, level, source_alignment, scoring_note, question_answer | aucune répétition détectée dans les listes |
| `CARCL/anglais/english_b1_dataset_200_QA_200_MCQ.json` | Anglais (en) | B1 | 0.25 | 200 | 200 | title, level, source_alignment, scoring_note, question_answer | aucune répétition détectée dans les listes |
| `CARCL/anglais/english_b2_dataset_200_QA_200_MCQ.json` | Anglais (en) | B2 | 0.27 | 200 | 200 | title, level, source_alignment, scoring_note, question_answer | aucune répétition détectée dans les listes |
| `CARCL/anglais/english_c1_dataset_200_QA_200_MCQ.json` | Anglais (en) | C1 | 0.28 | 200 | 200 | title, level, source_alignment, scoring_note, question_answer | aucune répétition détectée dans les listes |
| `CARCL/anglais/english_c2_dataset_200_QA_200_MCQ.json` | Anglais (en) | C2 | 0.30 | 200 | 200 | title, level, source_alignment, scoring_note, question_answer | aucune répétition détectée dans les listes |
| `CARCL/anglais/english_cefr_dataset_1200_QA_1200_MCQ.json` | Anglais (en) | A1–C2 | 1.78 | 1200 | 1200 | title, version, language, levels, source_alignment | identique à l'union des six fichiers par niveau |
| `CARCL/français/french_a1_dataset_200_QA_200_MCQ.json` | Français (fr) | A1 | 0.21 | 200 | 200 | metadata, level_descriptor, question_answer, multiple_choice | aucune répétition détectée dans les listes |
| `CARCL/français/french_a2_dataset_200_QA_200_MCQ.json` | Français (fr) | A2 | 0.21 | 200 | 200 | metadata, level_descriptor, question_answer, multiple_choice | aucune répétition détectée dans les listes |
| `CARCL/français/french_b1_dataset_200_QA_200_MCQ.json` | Français (fr) | B1 | 0.22 | 200 | 200 | metadata, level_descriptor, question_answer, multiple_choice | aucune répétition détectée dans les listes |
| `CARCL/français/french_b2_dataset_200_QA_200_MCQ.json` | Français (fr) | B2 | 0.23 | 200 | 200 | metadata, level_descriptor, question_answer, multiple_choice | aucune répétition détectée dans les listes |
| `CARCL/français/french_c1_dataset_200_QA_200_MCQ.json` | Français (fr) | C1 | 0.24 | 200 | 200 | metadata, level_descriptor, question_answer, multiple_choice | aucune répétition détectée dans les listes |
| `CARCL/français/french_c2_dataset_200_QA_200_MCQ.json` | Français (fr) | C2 | 0.26 | 200 | 200 | metadata, level_descriptor, question_answer, multiple_choice | aucune répétition détectée dans les listes |
| `CARCL/français/french_cefr_dataset_1200_QA_1200_MCQ.json` | Français (fr) | A1–C2 | 1.58 | 1200 | 1200 | metadata, levels | identique à l'union des six fichiers par niveau |
| `CARCL/italian/italian_a1_dataset_200_QA_200_MCQ.json` | Italien (it) | A1 | 0.24 | 200 | 200 | metadata, level_descriptor, question_answer, multiple_choice | aucune répétition détectée dans les listes |
| `CARCL/italian/italian_a2_dataset_200_QA_200_MCQ.json` | Italien (it) | A2 | 0.25 | 200 | 200 | metadata, level_descriptor, question_answer, multiple_choice | QA : 190 énoncés uniques/200; QCM : 190 énoncés uniques/200 |
| `CARCL/italian/italian_b1_dataset_200_QA_200_MCQ.json` | Italien (it) | B1 | 0.26 | 200 | 200 | metadata, level_descriptor, question_answer, multiple_choice | QA : 190 énoncés uniques/200; QCM : 190 énoncés uniques/200 |
| `CARCL/italian/italian_b2_dataset_200_QA_200_MCQ.json` | Italien (it) | B2 | 0.27 | 200 | 200 | metadata, level_descriptor, question_answer, multiple_choice | QA : 170 énoncés uniques/200; QCM : 170 énoncés uniques/200 |
| `CARCL/italian/italian_c1_dataset_200_QA_200_MCQ.json` | Italien (it) | C1 | 0.28 | 200 | 200 | metadata, level_descriptor, question_answer, multiple_choice | QA : 160 énoncés uniques/200; QCM : 160 énoncés uniques/200 |
| `CARCL/italian/italian_c2_dataset_200_QA_200_MCQ.json` | Italien (it) | C2 | 0.31 | 200 | 200 | metadata, level_descriptor, question_answer, multiple_choice | aucune répétition détectée dans les listes |

Points relevés :

- Les agrégats anglais, allemand et français contiennent **exactement l'union** des six fichiers de niveau, séparément pour les QA et les QCM : ce sont des redondances de présentation, pas des doublons d'octets.
- Allemand : chaque liste QCM ne contient que **55 énoncés uniques sur 200** ; 11 énoncés sont partagés entre A2 et B2.
- Italien : répétitions internes (par exemple 160 énoncés uniques sur 200 en C1) et recouvrements entre niveaux (10 à 20 énoncés communs selon les paires).
- Les métadonnées déclarent un contenu pédagogique original, non officiel, aligné sur des descripteurs ; cela ne constitue pas une preuve de droits de réutilisation.

### 2.3 Synthèse HSK

La langue chinoise (mandarin) est **inférée** des noms de dossiers et de titres tels que `新HSK教程4上` ; elle n'a pas été vérifiée par OCR sur chaque page. Les niveaux proviennent des dossiers `New HSK 3.0 Level 1`, `2`, `3`, `4A` et `4B`.

**PDF.** Les 10 fichiers sont lisibles par `pdfinfo` et non chiffrés. Huit ne présentent aucun texte extractible sur les pages 1–3 ; deux (`hsk-course-2.pdf` et `hsk-course-3.pdf`) portent des traces d'OCR (`OCRmyPDF` / `Tesseract`) avec respectivement 356 et 486 caractères extraits sur ces pages. Le reste du document n'a pas été testé page par page.

| Fichier | Niveau | Taille (Mo) | Pages | Type | Format page | Chiffré | Couche texte | Métadonnées PDF |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `HSK/New HSK 3.0 Level 1/hsk-course-1-workbook.pdf` | Level 1 | 74.0 | 139 | Cahier d'exercices | 595 x 842 pts (A4) | no | aucun texte extractible (pages 1–3) | 合并 扫描全能王 2026-4-27 17.28 — iOS Version 26.2.1 (Build 23C71) Quartz PDFContext |
| `HSK/New HSK 3.0 Level 1/hsk-course-1-writing.pdf` | Level 1 | 4.7 | 15 | Production écrite | 595.3 x 841.9 pts (A4) | no | aucun texte extractible (pages 1–3) | non renseigné — WPS 文字 |
| `HSK/New HSK 3.0 Level 1/hsk-course-1.pdf` | Level 1 | 66.7 | 144 | Manuel / contenu de cours | 595.276 x 841.89 pts (A4) | no | aucun texte extractible (pages 1–3) | non renseigné — RICOH Aficio MP 7502 / RICOH Aficio MP 7502 |
| `HSK/New HSK 3.0 Level 2/hsk-course-2-workbook.pdf` | Level 2 | 227.8 | 176 | Cahier d'exercices | 569.688 x 796.446 pts | no | aucun texte extractible (pages 1–3) | non renseigné — Adobe PSL 1.2e for Canon / Canon iR-ADV C5235 |
| `HSK/New HSK 3.0 Level 2/hsk-course-2-writing.pdf` | Level 2 | 16.6 | 15 | Production écrite | 595.3 x 841.9 pts (A4) | no | aucun texte extractible (pages 1–3) | non renseigné — WPS 文字 |
| `HSK/New HSK 3.0 Level 2/hsk-course-2.pdf` | Level 2 | 31.3 | 164 | Manuel / contenu de cours | 595 x 842 pts (A4) | no | 356 caractères extraits (pages 1–3) | non renseigné — GPL Ghostscript 10.06.0 / OCRmyPDF 16.11.1 / Tesseract OCR-hOCR 5.5.0.20241111 |
| `HSK/New HSK 3.0 Level 3/hsk-course-3-workbook.pdf` | Level 3 | 60.4 | 187 | Cahier d'exercices | 1404 x 1911 pts | no | aucun texte extractible (pages 1–3) | non renseigné — non renseigné |
| `HSK/New HSK 3.0 Level 3/hsk-course-3.pdf` | Level 3 | 43.5 | 212 | Manuel / contenu de cours | 595 x 842 pts (A4) | no | 486 caractères extraits (pages 1–3) | non renseigné — GPL Ghostscript 10.06.0 / OCRmyPDF 16.11.1 / Tesseract OCR-hOCR 5.5.0.20241111 |
| `HSK/New HSK 3.0 Level 4A/hsk-course-4a.pdf` | Level 4A | 89.5 | 137 | Manuel / contenu de cours | 595 x 842 pts (A4) | no | aucun texte extractible (pages 1–3) | 新HSK教程4上 — IntSig Information Co., Ltd |
| `HSK/New HSK 3.0 Level 4B/hsk-course-4b.pdf` | Level 4B | 101.5 | 137 | Manuel / contenu de cours | 595 x 842 pts (A4) | no | aucun texte extractible (pages 1–3) | 新HSK教程4B — iOS Version 26.2.1 (Build 23C71) Quartz PDFContext |

**Audio.** Tous les MP3 sont des flux MPEG-1 Layer III à débit constant, avec une chaîne de trames complète jusqu'à la fin du fichier : 479 fichiers lisibles, 0 illisible, durées de 1,0 à 294,3 secondes. Deux profils techniques : 359 fichiers en 128 kbps / 44,1 kHz (237 joint stereo, 122 mono) et 120 fichiers en 192 kbps / 48 kHz joint stereo (niveau 2). Des étiquettes ID3v2 sont présentes sur 357 fichiers (jusqu'à 180 131 octets, nature du contenu non vérifiée) et ID3v1 sur 356 fichiers.

**Totaux par niveau**

| Niveau | Fichiers | Taille (Mo) | Durée cumulée (min) |
| --- | --- | --- | --- |
| `Level 1` | 215 | 293.3 | 96.0 |
| `Level 2` | 120 | 60.2 | 12.7 |
| `Level 3` | 144 | 69.8 | 22.2 |

**Séries et ensembles de leçons**

| Regroupement | Fichiers | Taille (Mo) | Durée cumulée (min) |
| --- | --- | --- | --- |
| `Level 1 / HSK 1 Textbook` | 93 | 44.2 | 9.5 |
| `Level 1 / hsk1textbookaudios` | 85 | 57.3 | 19.9 |
| `Level 1 / hsk1workbookaudios` | 37 | 191.8 | 66.6 |
| `Level 2 / lesson-01` | 8 | 3.7 | 0.8 |
| `Level 2 / lesson-02` | 8 | 3.7 | 0.8 |
| `Level 2 / lesson-03` | 8 | 3.4 | 0.7 |
| `Level 2 / lesson-04` | 8 | 3.6 | 0.8 |
| `Level 2 / lesson-05` | 8 | 4.4 | 0.9 |
| `Level 2 / lesson-06` | 8 | 4.2 | 0.9 |
| `Level 2 / lesson-07` | 8 | 3.3 | 0.7 |
| `Level 2 / lesson-08` | 8 | 4.1 | 0.9 |
| `Level 2 / lesson-09` | 8 | 3.7 | 0.8 |
| `Level 2 / lesson-10` | 8 | 4.0 | 0.8 |
| `Level 2 / lesson-11` | 8 | 4.2 | 0.9 |
| `Level 2 / lesson-12` | 8 | 4.2 | 0.9 |
| `Level 2 / lesson-13` | 8 | 4.6 | 1.0 |
| `Level 2 / lesson-14` | 8 | 4.3 | 0.9 |
| `Level 2 / lesson-15` | 8 | 4.6 | 1.0 |
| `Level 3 / lesson-01` | 8 | 3.7 | 1.2 |
| `Level 3 / lesson-02` | 8 | 3.7 | 1.2 |
| `Level 3 / lesson-03` | 8 | 3.4 | 1.1 |
| `Level 3 / lesson-04` | 8 | 3.6 | 1.1 |
| `Level 3 / lesson-05` | 8 | 3.7 | 1.2 |
| `Level 3 / lesson-06` | 8 | 3.9 | 1.3 |
| `Level 3 / lesson-07` | 8 | 3.5 | 1.1 |
| `Level 3 / lesson-08` | 8 | 3.9 | 1.2 |
| `Level 3 / lesson-09` | 8 | 3.7 | 1.2 |
| `Level 3 / lesson-10` | 8 | 4.2 | 1.3 |
| `Level 3 / lesson-11` | 8 | 3.9 | 1.3 |
| `Level 3 / lesson-12` | 8 | 3.9 | 1.2 |
| `Level 3 / lesson-13` | 8 | 4.1 | 1.3 |
| `Level 3 / lesson-14` | 8 | 3.8 | 1.2 |
| `Level 3 / lesson-15` | 8 | 4.2 | 1.4 |
| `Level 3 / lesson-16` | 8 | 4.4 | 1.4 |
| `Level 3 / lesson-17` | 8 | 4.3 | 1.4 |
| `Level 3 / lesson-18` | 8 | 3.9 | 1.2 |

<details>
<summary>Tableau exhaustif des 479 fichiers audio</summary>

| Fichier (relatif à `ia-service/corpus/HSK/`) | Mo | Durée (s) | kbps | kHz | Canal | ID3v2 (o) | ID3v1 | Statut |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 01/01-1.mp3` | 0.28 | 2.1 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 01/01-2.mp3` | 0.29 | 2.2 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 01/01-3.mp3` | 0.33 | 3.2 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 01/01-4.mp3` | 0.47 | 6.1 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 01/01-5.mp3` | 0.33 | 3.2 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 01/01-6.mp3` | 0.37 | 3.9 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 01/01-7.mp3` | 0.46 | 5.8 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 02/02-1.mp3` | 0.27 | 1.8 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 02/02-2.mp3` | 0.42 | 5.1 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 02/02-3.mp3` | 0.39 | 4.4 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 02/02-4.mp3` | 0.40 | 4.5 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 02/02-5.mp3` | 0.37 | 3.9 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 02/02-6.mp3` | 0.35 | 3.5 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 02/02-7.mp3` | 0.55 | 7.7 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 03/03-1.mp3` | 0.31 | 2.8 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 03/03-2.mp3` | 0.40 | 4.6 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 03/03-3.mp3` | 0.34 | 3.3 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 03/03-4.mp3` | 0.51 | 7.0 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 03/03-5.mp3` | 0.46 | 5.9 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 03/03-6.mp3` | 0.60 | 8.7 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 03/03-7.mp3` | 0.56 | 7.9 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 04/04-1.mp3` | 0.34 | 3.4 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 04/04-2.mp3` | 0.31 | 2.8 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 04/04-3.mp3` | 0.40 | 4.6 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 04/04-4.mp3` | 0.61 | 9.0 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 04/04-5.mp3` | 0.45 | 5.6 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 04/04-6.mp3` | 0.51 | 6.9 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 05/05-1.mp3` | 0.34 | 3.2 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 05/05-2.mp3` | 0.56 | 7.8 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 05/05-3.mp3` | 0.39 | 4.4 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 05/05-4.mp3` | 0.49 | 6.5 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 05/05-5.mp3` | 0.38 | 4.2 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 05/05-6.mp3` | 0.47 | 6.1 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 06/06-1.mp3` | 0.52 | 7.1 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 06/06-2.mp3` | 0.31 | 2.7 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 06/06-3.mp3` | 0.40 | 4.5 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 06/06-4.mp3` | 0.56 | 7.9 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 06/06-5.mp3` | 0.51 | 6.9 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 06/06-6.mp3` | 0.72 | 11.2 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 07/07-1.mp3` | 0.41 | 4.7 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 07/07-2.mp3` | 0.53 | 7.4 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 07/07-3.mp3` | 0.48 | 6.2 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 07/07-4.mp3` | 0.53 | 7.4 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 07/07-5.mp3` | 0.46 | 5.9 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 07/07-6.mp3` | 0.65 | 9.8 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 08/08-1.mp3` | 0.36 | 3.8 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 08/08-2.mp3` | 0.60 | 8.7 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 08/08-3.mp3` | 0.41 | 4.7 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 08/08-4.mp3` | 0.47 | 6.1 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 08/08-5.mp3` | 0.51 | 6.9 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 08/08-6.mp3` | 0.48 | 6.2 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 09/09-1.mp3` | 0.44 | 5.5 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 09/09-2.mp3` | 0.45 | 5.7 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 09/09-3.mp3` | 0.55 | 7.7 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 09/09-4.mp3` | 0.51 | 6.9 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 09/09-5.mp3` | 0.62 | 9.3 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 09/09-6.mp3` | 0.61 | 9.0 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 10/10-1.mp3` | 0.51 | 6.8 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 10/10-2.mp3` | 0.48 | 6.3 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 10/10-3.mp3` | 0.54 | 7.5 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 10/10-4.mp3` | 0.43 | 5.1 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 10/10-5.mp3` | 0.60 | 8.8 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 10/10-6.mp3` | 0.57 | 8.1 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 11/11-1.mp3` | 0.47 | 6.1 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 11/11-2.mp3` | 0.48 | 6.3 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 11/11-3.mp3` | 0.46 | 5.9 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 11/11-4.mp3` | 0.42 | 5.0 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 11/11-5.mp3` | 0.51 | 7.0 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 11/11-6.mp3` | 0.71 | 11.0 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 12/12-1.mp3` | 0.41 | 4.7 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 12/12-2.mp3` | 0.54 | 7.6 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 12/12-3.mp3` | 0.39 | 4.4 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 12/12-4.mp3` | 0.45 | 5.5 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 12/12-5.mp3` | 0.51 | 6.8 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 12/12-6.mp3` | 0.57 | 8.1 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 13/13-1.mp3` | 0.47 | 6.0 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 13/13-2.mp3` | 0.47 | 6.0 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 13/13-3.mp3` | 0.53 | 7.3 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 13/13-4.mp3` | 0.66 | 10.0 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 13/13-5.mp3` | 0.56 | 8.0 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 13/13-6.mp3` | 0.30 | 2.6 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 14/14-1.mp3` | 0.43 | 5.1 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 14/14-2.mp3` | 0.47 | 6.0 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 14/14-3.mp3` | 0.60 | 8.7 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 14/14-4.mp3` | 0.62 | 9.1 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 14/14-5.mp3` | 0.50 | 6.7 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 14/14-6.mp3` | 0.69 | 10.6 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 15/15-1.mp3` | 0.44 | 5.3 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 15/15-2.mp3` | 0.26 | 1.8 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 15/15-3.mp3` | 0.52 | 7.0 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 15/15-4.mp3` | 0.48 | 6.3 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 15/15-5.mp3` | 0.69 | 10.6 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/HSK 1 Textbook/Lesson 15/15-6.mp3` | 0.67 | 10.3 | 128 | 44.1 | joint stereo | 180131 | oui | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-01/hsk1-textbook-0101.mp3` | 0.42 | 8.8 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-01/hsk1-textbook-0102.mp3` | 0.29 | 6.0 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-01/hsk1-textbook-0103.mp3` | 0.30 | 6.3 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-01/hsk1-textbook-0104.mp3` | 1.32 | 27.4 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-01/hsk1-textbook-0105.mp3` | 1.21 | 25.3 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-01/hsk1-textbook-0106.mp3` | 0.68 | 14.1 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-01/hsk1-textbook-0107.mp3` | 0.58 | 12.0 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-01/hsk1-textbook-0108.mp3` | 0.83 | 17.3 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-01/hsk1-textbook-0109.mp3` | 0.38 | 7.9 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-02/hsk1-textbook-0201.mp3` | 0.44 | 9.2 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-02/hsk1-textbook-0202.mp3` | 0.28 | 5.9 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-02/hsk1-textbook-0203.mp3` | 0.27 | 5.6 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-02/hsk1-textbook-0204.mp3` | 1.22 | 25.4 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-02/hsk1-textbook-0205.mp3` | 0.81 | 17.0 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-02/hsk1-textbook-0206.mp3` | 0.56 | 11.7 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-02/hsk1-textbook-0207.mp3` | 0.85 | 17.8 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-02/hsk1-textbook-0208.mp3` | 0.91 | 19.0 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-02/hsk1-textbook-0209.mp3` | 0.87 | 18.1 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-02/hsk1-textbook-0210.mp3` | 0.39 | 8.0 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-03/hsk1-textbook-0301.mp3` | 0.63 | 13.2 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-03/hsk1-textbook-0302.mp3` | 0.43 | 8.9 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-03/hsk1-textbook-0303.mp3` | 0.49 | 10.2 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-03/hsk1-textbook-0304.mp3` | 0.57 | 11.9 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-03/hsk1-textbook-0305.mp3` | 0.58 | 12.1 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-03/hsk1-textbook-0306.mp3` | 0.65 | 13.6 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-03/hsk1-textbook-0307.mp3` | 0.91 | 19.0 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-04/hsk1-textbook-0401.mp3` | 0.64 | 13.3 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-04/hsk1-textbook-0402.mp3` | 0.43 | 8.9 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-04/hsk1-textbook-0403.mp3` | 0.53 | 11.1 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-04/hsk1-textbook-0404.mp3` | 0.92 | 19.1 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-04/hsk1-textbook-0405.mp3` | 0.75 | 15.7 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-04/hsk1-textbook-0406.mp3` | 0.81 | 16.8 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-04/hsk1-textbook-0407.mp3` | 0.90 | 18.7 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-05/hsk1-textbook-0501.mp3` | 0.58 | 12.1 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-05/hsk1-textbook-0502.mp3` | 0.45 | 9.3 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-05/hsk1-textbook-0503.mp3` | 0.43 | 9.0 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-05/hsk1-textbook-0504.mp3` | 0.30 | 6.2 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-05/hsk1-textbook-0505.mp3` | 0.90 | 18.8 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-05/hsk1-textbook-0506.mp3` | 0.91 | 18.9 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-05/hsk1-textbook-0507.mp3` | 0.59 | 12.4 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-05/hsk1-textbook-0508.mp3` | 0.78 | 16.3 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-05/hsk1-textbook-0509.mp3` | 0.70 | 14.5 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-05/hsk1-textbook-0510.mp3` | 0.78 | 16.3 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-06/hsk1-textbook-0601.mp3` | 0.65 | 13.5 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-06/hsk1-textbook-0602.mp3` | 0.51 | 10.7 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-06/hsk1-textbook-0603.mp3` | 0.60 | 12.5 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-06/hsk1-textbook-0604.mp3` | 0.85 | 17.7 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-07/hsk1-textbook-0701.mp3` | 0.76 | 15.8 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-07/hsk1-textbook-0702.mp3` | 0.50 | 10.5 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-07/hsk1-textbook-0703.mp3` | 0.54 | 11.2 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-07/hsk1-textbook-0704.mp3` | 0.90 | 18.9 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-08/hsk1-textbook-0801.mp3` | 0.69 | 14.4 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-08/hsk1-textbook-0802.mp3` | 0.52 | 10.9 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-08/hsk1-textbook-0803.mp3` | 0.55 | 11.5 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-08/hsk1-textbook-0804.mp3` | 0.96 | 19.9 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-09/hsk1-textbook-0901.mp3` | 0.85 | 17.7 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-09/hsk1-textbook-0902.mp3` | 0.60 | 12.6 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-09/hsk1-textbook-0903.mp3` | 0.35 | 7.3 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-09/hsk1-textbook-0904.mp3` | 0.93 | 19.3 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-10/hsk1-textbook-1001.mp3` | 0.77 | 16.1 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-10/hsk1-textbook-1002.mp3` | 0.67 | 14.0 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-10/hsk1-textbook-1003.mp3` | 0.49 | 10.2 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-10/hsk1-textbook-1004.mp3` | 0.32 | 6.7 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-10/hsk1-textbook-1005.mp3` | 0.86 | 17.9 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-10/hsk1-textbook-1006.mp3` | 0.83 | 17.4 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-11/hsk1-textbook-1101.mp3` | 0.69 | 14.4 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-11/hsk1-textbook-1102.mp3` | 0.53 | 11.0 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-11/hsk1-textbook-1103.mp3` | 0.55 | 11.4 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-11/hsk1-textbook-1104.mp3` | 0.40 | 8.3 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-12/hsk1-textbook-1201.mp3` | 0.83 | 17.3 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-12/hsk1-textbook-1202.mp3` | 0.58 | 12.2 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-12/hsk1-textbook-1203.mp3` | 0.60 | 12.5 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-12/hsk1-textbook-1204.mp3` | 1.03 | 21.4 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-13/hsk1-textbook-1301.mp3` | 0.83 | 17.4 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-13/hsk1-textbook-1302.mp3` | 0.66 | 13.7 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-13/hsk1-textbook-1303.mp3` | 0.65 | 13.5 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-13/hsk1-textbook-1304.mp3` | 1.05 | 21.9 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-14/hsk1-textbook-1401.mp3` | 0.71 | 14.7 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-14/hsk1-textbook-1402.mp3` | 0.72 | 15.0 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-14/hsk1-textbook-1403.mp3` | 0.68 | 14.2 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-14/hsk1-textbook-1404.mp3` | 0.99 | 20.6 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-15/hsk1-textbook-1501.mp3` | 0.75 | 15.7 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-15/hsk1-textbook-1502.mp3` | 0.52 | 10.9 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-15/hsk1-textbook-1503.mp3` | 0.51 | 10.7 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1textbookaudios/lesson-15/hsk1-textbook-1504.mp3` | 1.01 | 20.9 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-01/hsk1-workbook-0101.mp3` | 1.73 | 36.1 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-01/hsk1-workbook-0102.mp3` | 1.15 | 24.1 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-01/hsk1-workbook-0103.mp3` | 2.71 | 56.5 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-01/hsk1-workbook-0104.mp3` | 2.58 | 53.8 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-01/hsk1-workbook-0105.mp3` | 2.76 | 57.5 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-02/hsk1-workbook-0201.mp3` | 1.79 | 37.3 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-02/hsk1-workbook-0202.mp3` | 1.17 | 24.4 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-02/hsk1-workbook-0203.mp3` | 2.53 | 52.7 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-02/hsk1-workbook-0204.mp3` | 2.63 | 54.7 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-02/hsk1-workbook-0205.mp3` | 2.51 | 52.2 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-03/hsk1-workbook-0301.mp3` | 8.24 | 171.7 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-03/hsk1-workbook-0302.mp3` | 2.98 | 62.0 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-04/hsk1-workbook-0401.mp3` | 8.09 | 168.5 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-04/hsk1-workbook-0402.mp3` | 2.90 | 60.4 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-05/hsk1-workbook-0501.mp3` | 8.41 | 175.3 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-05/hsk1-workbook-0502.mp3` | 4.11 | 85.7 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-06/hsk1-workbook-0601.mp3` | 8.52 | 177.5 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-06/hsk1-workbook-0602.mp3` | 3.22 | 67.0 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-07/hsk1-workbook-0701.mp3` | 8.48 | 176.7 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-07/hsk1-workbook-0702.mp3` | 3.34 | 69.7 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-08/hsk1-workbook-0801.mp3` | 8.13 | 169.3 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-08/hsk1-workbook-0802.mp3` | 3.19 | 66.5 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-09/hsk1-workbook-0901.mp3` | 8.23 | 171.5 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-09/hsk1-workbook-0902.mp3` | 3.32 | 69.1 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-10/hsk1-workbook-1001.mp3` | 8.05 | 167.8 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-10/hsk1-workbook-1002.mp3` | 4.31 | 89.8 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-11/hsk1-workbook-1101.mp3` | 9.45 | 196.9 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-11/hsk1-workbook-1102.mp3` | 1.95 | 40.5 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-12/hsk1-workbook-1201.mp3` | 9.63 | 200.7 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-12/hsk1-workbook-1202.mp3` | 3.16 | 65.9 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-13/hsk1-workbook-1301.mp3` | 9.56 | 199.1 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-13/hsk1-workbook-1302.mp3` | 3.17 | 66.1 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-14/hsk1-workbook-1401.mp3` | 9.68 | 201.7 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-14/hsk1-workbook-1402.mp3` | 3.08 | 64.2 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-15/hsk1-workbook-1501.mp3` | 9.74 | 203.0 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-15/hsk1-workbook-1502.mp3` | 3.14 | 65.5 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 1/HSK 3.0 audio files/hsk1workbookaudios/lesson-16/hsk1-workbook-1601.mp3` | 14.13 | 294.3 | 128 | 44.1 | mono | non | non | OK |
| `New HSK 3.0 Level 2/Audio/lesson-01/1-1.mp3` | 0.71 | 9.1 | 192 | 48.0 | joint stereo | 47805 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-01/1-2.mp3` | 0.28 | 3.3 | 192 | 48.0 | joint stereo | 43270 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-01/1-3.mp3` | 0.59 | 7.6 | 192 | 48.0 | joint stereo | 47798 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-01/1-4.mp3` | 0.18 | 1.8 | 192 | 48.0 | joint stereo | 43681 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-01/1-5.mp3` | 0.79 | 10.3 | 192 | 48.0 | joint stereo | 46569 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-01/1-6.mp3` | 0.34 | 4.1 | 192 | 48.0 | joint stereo | 43683 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-01/1-7.mp3` | 0.47 | 5.9 | 192 | 48.0 | joint stereo | 43270 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-01/1-8.mp3` | 0.40 | 4.9 | 192 | 48.0 | joint stereo | 44925 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-02/2-1.mp3` | 0.52 | 6.6 | 192 | 48.0 | joint stereo | 46565 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-02/2-2.mp3` | 0.53 | 6.7 | 192 | 48.0 | joint stereo | 46963 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-02/2-3.mp3` | 0.73 | 9.5 | 192 | 48.0 | joint stereo | 46566 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-02/2-4.mp3` | 0.48 | 6.1 | 192 | 48.0 | joint stereo | 45751 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-02/2-5.mp3` | 0.70 | 9.0 | 192 | 48.0 | joint stereo | 46571 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-02/2-6.mp3` | 0.21 | 2.3 | 192 | 48.0 | joint stereo | 43681 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-02/2-7.mp3` | 0.42 | 5.2 | 192 | 48.0 | joint stereo | 43270 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-02/2-8.mp3` | 0.15 | 1.4 | 192 | 48.0 | joint stereo | 43270 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-03/3-1.mp3` | 0.46 | 5.8 | 192 | 48.0 | joint stereo | 44680 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-03/3-2.mp3` | 0.25 | 2.8 | 192 | 48.0 | joint stereo | 44095 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-03/3-3.mp3` | 0.56 | 7.2 | 192 | 48.0 | joint stereo | 46160 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-03/3-4.mp3` | 0.22 | 2.5 | 192 | 48.0 | joint stereo | 43683 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-03/3-5.mp3` | 0.74 | 9.7 | 192 | 48.0 | joint stereo | 46572 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-03/3-6.mp3` | 0.45 | 5.6 | 192 | 48.0 | joint stereo | 45337 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-03/3-7.mp3` | 0.43 | 5.4 | 192 | 48.0 | joint stereo | 43242 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-03/3-8.mp3` | 0.29 | 3.5 | 192 | 48.0 | joint stereo | 44509 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-04/4-1.mp3` | 0.48 | 6.0 | 192 | 48.0 | joint stereo | 47776 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-04/4-2.mp3` | 0.36 | 4.4 | 192 | 48.0 | joint stereo | 44923 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-04/4-3.mp3` | 0.75 | 9.8 | 192 | 48.0 | joint stereo | 46574 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-04/4-4.mp3` | 0.40 | 5.0 | 192 | 48.0 | joint stereo | 44923 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-04/4-5.mp3` | 0.58 | 7.4 | 192 | 48.0 | joint stereo | 46569 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-04/4-6.mp3` | 0.40 | 5.0 | 192 | 48.0 | joint stereo | 43270 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-04/4-7.mp3` | 0.51 | 6.5 | 192 | 48.0 | joint stereo | 43270 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-04/4-8.mp3` | 0.12 | 1.1 | 192 | 48.0 | joint stereo | 43267 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-05/5-1.mp3` | 0.64 | 8.3 | 192 | 48.0 | joint stereo | 47775 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-05/5-2.mp3` | 0.69 | 8.9 | 192 | 48.0 | joint stereo | 47769 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-05/5-3.mp3` | 0.99 | 13.1 | 192 | 48.0 | joint stereo | 49342 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-05/5-4.mp3` | 0.39 | 4.8 | 192 | 48.0 | joint stereo | 44923 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-05/5-5.mp3` | 0.86 | 11.3 | 192 | 48.0 | joint stereo | 48196 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-05/5-6.mp3` | 0.17 | 1.8 | 192 | 48.0 | joint stereo | 43681 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-05/5-7.mp3` | 0.46 | 5.8 | 192 | 48.0 | joint stereo | 44896 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-05/5-8.mp3` | 0.18 | 1.9 | 192 | 48.0 | joint stereo | 43270 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-06/6-1.mp3` | 0.68 | 8.8 | 192 | 48.0 | joint stereo | 46981 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-06/6-2.mp3` | 0.39 | 4.8 | 192 | 48.0 | joint stereo | 44923 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-06/6-3.mp3` | 0.83 | 10.8 | 192 | 48.0 | joint stereo | 49600 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-06/6-4.mp3` | 0.20 | 2.2 | 192 | 48.0 | joint stereo | 43681 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-06/6-5.mp3` | 0.80 | 10.4 | 192 | 48.0 | joint stereo | 46990 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-06/6-6.mp3` | 0.34 | 4.2 | 192 | 48.0 | joint stereo | 44923 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-06/6-7.mp3` | 0.80 | 10.5 | 192 | 48.0 | joint stereo | 43660 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-06/6-8.mp3` | 0.17 | 1.8 | 192 | 48.0 | joint stereo | 43681 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-07/7-1.mp3` | 0.62 | 8.0 | 192 | 48.0 | joint stereo | 44905 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-07/7-2.mp3` | 0.35 | 4.2 | 192 | 48.0 | joint stereo | 44923 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-07/7-3.mp3` | 0.54 | 6.9 | 192 | 48.0 | joint stereo | 45312 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-07/7-4.mp3` | 0.35 | 4.2 | 192 | 48.0 | joint stereo | 44923 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-07/7-5.mp3` | 0.51 | 6.5 | 192 | 48.0 | joint stereo | 45309 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-07/7-6.mp3` | 0.25 | 2.8 | 192 | 48.0 | joint stereo | 44095 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-07/7-7.mp3` | 0.51 | 6.5 | 192 | 48.0 | joint stereo | 43265 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-07/7-8.mp3` | 0.21 | 2.3 | 192 | 48.0 | joint stereo | 43681 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-08/8-1.mp3` | 0.49 | 6.2 | 192 | 48.0 | joint stereo | 46565 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-08/8-2.mp3` | 0.41 | 5.1 | 192 | 48.0 | joint stereo | 44513 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-08/8-3.mp3` | 0.83 | 10.9 | 192 | 48.0 | joint stereo | 46572 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-08/8-4.mp3` | 0.27 | 3.2 | 192 | 48.0 | joint stereo | 44095 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-08/8-5.mp3` | 0.97 | 12.8 | 192 | 48.0 | joint stereo | 48203 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-08/8-6.mp3` | 0.29 | 3.4 | 192 | 48.0 | joint stereo | 44491 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-08/8-7.mp3` | 0.51 | 6.5 | 192 | 48.0 | joint stereo | 43638 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-08/8-8.mp3` | 0.29 | 3.5 | 192 | 48.0 | joint stereo | 44098 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-09/9-1.mp3` | 0.86 | 11.3 | 192 | 48.0 | joint stereo | 46985 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-09/9-2.mp3` | 0.49 | 6.2 | 192 | 48.0 | joint stereo | 45751 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-09/9-3.mp3` | 0.75 | 9.8 | 192 | 48.0 | joint stereo | 46984 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-09/9-4.mp3` | 0.23 | 2.6 | 192 | 48.0 | joint stereo | 43270 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-09/9-5.mp3` | 0.50 | 6.3 | 192 | 48.0 | joint stereo | 46155 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-09/9-6.mp3` | 0.16 | 1.6 | 192 | 48.0 | joint stereo | 43681 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-09/9-7.mp3` | 0.59 | 7.6 | 192 | 48.0 | joint stereo | 43647 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-09/9-8.mp3` | 0.12 | 1.0 | 192 | 48.0 | joint stereo | 43267 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-10/10-1.mp3` | 0.79 | 10.3 | 192 | 48.0 | joint stereo | 48571 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-10/10-2.mp3` | 0.38 | 4.6 | 192 | 48.0 | joint stereo | 44923 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-10/10-3.mp3` | 0.72 | 9.4 | 192 | 48.0 | joint stereo | 46572 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-10/10-4.mp3` | 0.39 | 4.8 | 192 | 48.0 | joint stereo | 45319 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-10/10-5.mp3` | 0.77 | 10.0 | 192 | 48.0 | joint stereo | 49636 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-10/10-6.mp3` | 0.17 | 1.7 | 192 | 48.0 | joint stereo | 43681 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-10/10-7.mp3` | 0.68 | 8.8 | 192 | 48.0 | joint stereo | 43251 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-10/10-8.mp3` | 0.12 | 1.1 | 192 | 48.0 | joint stereo | 43267 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-11/11-1.mp3` | 0.76 | 9.9 | 192 | 48.0 | joint stereo | 46511 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-11/11-2.mp3` | 0.31 | 3.7 | 192 | 48.0 | joint stereo | 43270 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-11/11-3.mp3` | 0.98 | 12.9 | 192 | 48.0 | joint stereo | 48223 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-11/11-4.mp3` | 0.17 | 1.7 | 192 | 48.0 | joint stereo | 43681 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-11/11-5.mp3` | 0.93 | 12.2 | 192 | 48.0 | joint stereo | 49042 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-11/11-6.mp3` | 0.36 | 4.4 | 192 | 48.0 | joint stereo | 44923 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-11/11-7.mp3` | 0.62 | 8.0 | 192 | 48.0 | joint stereo | 44102 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-11/11-8.mp3` | 0.13 | 1.2 | 192 | 48.0 | joint stereo | 43268 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-12/12-1.mp3` | 0.82 | 10.8 | 192 | 48.0 | joint stereo | 46574 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-12/12-2.mp3` | 0.25 | 2.8 | 192 | 48.0 | joint stereo | 44095 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-12/12-3.mp3` | 0.89 | 11.8 | 192 | 48.0 | joint stereo | 36126 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-12/12-4.mp3` | 0.19 | 2.0 | 192 | 48.0 | joint stereo | 43681 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-12/12-5.mp3` | 0.93 | 12.4 | 192 | 48.0 | joint stereo | 36126 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-12/12-6.mp3` | 0.27 | 3.1 | 192 | 48.0 | joint stereo | 44092 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-12/12-7.mp3` | 0.64 | 8.3 | 192 | 48.0 | joint stereo | 43270 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-12/12-8.mp3` | 0.23 | 2.6 | 192 | 48.0 | joint stereo | 44095 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-13/13-1.mp3` | 1.00 | 13.3 | 192 | 48.0 | joint stereo | 46059 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-13/13-2.mp3` | 0.31 | 3.7 | 192 | 48.0 | joint stereo | 44509 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-13/13-3.mp3` | 0.98 | 13.0 | 192 | 48.0 | joint stereo | 46978 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-13/13-4.mp3` | 0.33 | 4.0 | 192 | 48.0 | joint stereo | 44509 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-13/13-5.mp3` | 0.98 | 12.9 | 192 | 48.0 | joint stereo | 47401 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-13/13-6.mp3` | 0.27 | 3.1 | 192 | 48.0 | joint stereo | 44095 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-13/13-7.mp3` | 0.58 | 7.4 | 192 | 48.0 | joint stereo | 43270 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-13/13-8.mp3` | 0.17 | 1.8 | 192 | 48.0 | joint stereo | 43681 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-14/14-1.mp3` | 0.59 | 7.6 | 192 | 48.0 | joint stereo | 46146 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-14/14-2.mp3` | 0.16 | 1.7 | 192 | 48.0 | joint stereo | 43270 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-14/14-3.mp3` | 1.12 | 15.5 | 192 | 48.0 | joint stereo | 32 | non | OK |
| `New HSK 3.0 Level 2/Audio/lesson-14/14-4.mp3` | 0.32 | 3.9 | 192 | 48.0 | joint stereo | 44509 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-14/14-5.mp3` | 0.93 | 12.3 | 192 | 48.0 | joint stereo | 46364 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-14/14-6.mp3` | 0.26 | 3.0 | 192 | 48.0 | joint stereo | 44095 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-14/14-7.mp3` | 0.68 | 8.8 | 192 | 48.0 | joint stereo | 43676 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-14/14-8.mp3` | 0.26 | 3.0 | 192 | 48.0 | joint stereo | 44095 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-15/15-1.mp3` | 0.76 | 10.0 | 192 | 48.0 | joint stereo | 47153 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-15/15-2.mp3` | 0.13 | 1.3 | 192 | 48.0 | joint stereo | 43268 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-15/15-3.mp3` | 1.17 | 15.6 | 192 | 48.0 | joint stereo | 47814 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-15/15-4.mp3` | 0.48 | 6.0 | 192 | 48.0 | joint stereo | 43270 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-15/15-5.mp3` | 0.88 | 11.5 | 192 | 48.0 | joint stereo | 46991 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-15/15-6.mp3` | 0.26 | 3.0 | 192 | 48.0 | joint stereo | 44092 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-15/15-7.mp3` | 0.68 | 8.9 | 192 | 48.0 | joint stereo | 43678 | oui | OK |
| `New HSK 3.0 Level 2/Audio/lesson-15/15-8.mp3` | 0.20 | 2.1 | 192 | 48.0 | joint stereo | 43681 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-01/1-1.mp3` | 0.59 | 11.5 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-01/1-2.mp3` | 0.31 | 5.6 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-01/1-3.mp3` | 0.53 | 10.3 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-01/1-4.mp3` | 0.42 | 7.9 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-01/1-5.mp3` | 0.59 | 11.4 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-01/1-6.mp3` | 0.30 | 5.4 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-01/1-7.mp3` | 0.65 | 12.8 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-01/1-8.mp3` | 0.26 | 4.6 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-02/2-1.mp3` | 0.53 | 10.3 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-02/2-2.mp3` | 0.31 | 5.6 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-02/2-3.mp3` | 0.64 | 12.5 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-02/2-4.mp3` | 0.44 | 8.4 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-02/2-5.mp3` | 0.53 | 10.1 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-02/2-6.mp3` | 0.26 | 4.6 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-02/2-7.mp3` | 0.73 | 14.3 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-02/2-8.mp3` | 0.22 | 3.6 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-03/3-1.mp3` | 0.59 | 11.4 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-03/3-2.mp3` | 0.49 | 9.4 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-03/3-3.mp3` | 0.53 | 10.3 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-03/3-4.mp3` | 0.31 | 5.5 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-03/3-5.mp3` | 0.54 | 10.4 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-03/3-6.mp3` | 0.29 | 5.2 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-03/3-7.mp3` | 0.53 | 10.1 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-03/3-8.mp3` | 0.16 | 2.6 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-04/4-1.mp3` | 0.58 | 11.3 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-04/4-2.mp3` | 0.39 | 7.3 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-04/4-3.mp3` | 0.63 | 12.2 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-04/4-4.mp3` | 0.35 | 6.4 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-04/4-5.mp3` | 0.63 | 12.3 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-04/4-6.mp3` | 0.32 | 5.8 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-04/4-7.mp3` | 0.52 | 10.1 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-04/4-8.mp3` | 0.18 | 2.9 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-05/5-1.mp3` | 0.50 | 9.5 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-05/5-2.mp3` | 0.34 | 6.3 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-05/5-3.mp3` | 0.66 | 13.0 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-05/5-4.mp3` | 0.31 | 5.7 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-05/5-5.mp3` | 0.68 | 13.4 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-05/5-6.mp3` | 0.21 | 3.6 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-05/5-7.mp3` | 0.54 | 10.5 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-05/5-8.mp3` | 0.41 | 7.7 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-06/6-1.mp3` | 0.57 | 11.1 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-06/6-2.mp3` | 0.20 | 3.4 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-06/6-3.mp3` | 0.61 | 11.8 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-06/6-4.mp3` | 0.39 | 7.4 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-06/6-5.mp3` | 0.59 | 11.5 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-06/6-6.mp3` | 0.41 | 7.8 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-06/6-7.mp3` | 0.82 | 16.2 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-06/6-8.mp3` | 0.33 | 6.0 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-07/7-1.mp3` | 0.59 | 11.4 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-07/7-2.mp3` | 0.23 | 4.0 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-07/7-3.mp3` | 0.53 | 10.2 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-07/7-4.mp3` | 0.34 | 6.2 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-07/7-5.mp3` | 0.54 | 10.4 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-07/7-6.mp3` | 0.41 | 7.6 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-07/7-7.mp3` | 0.62 | 12.2 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-07/7-8.mp3` | 0.25 | 4.4 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-08/8-1.mp3` | 0.57 | 11.1 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-08/8-2.mp3` | 0.38 | 7.2 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-08/8-3.mp3` | 0.60 | 11.7 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-08/8-4.mp3` | 0.29 | 5.2 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-08/8-5.mp3` | 0.77 | 15.2 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-08/8-6.mp3` | 0.38 | 7.1 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-08/8-7.mp3` | 0.57 | 11.0 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-08/8-8.mp3` | 0.30 | 5.5 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-09/9-1.mp3` | 0.55 | 10.6 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-09/9-2.mp3` | 0.50 | 9.6 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-09/9-3.mp3` | 0.62 | 12.2 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-09/9-4.mp3` | 0.17 | 2.8 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-09/9-5.mp3` | 0.59 | 11.4 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-09/9-6.mp3` | 0.34 | 6.3 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-09/9-7.mp3` | 0.61 | 11.9 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-09/9-8.mp3` | 0.36 | 6.8 | 128 | 44.1 | joint stereo | 40605 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-10/10-1.mp3` | 0.67 | 13.2 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-10/10-2.mp3` | 0.40 | 7.5 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-10/10-3.mp3` | 0.75 | 14.8 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-10/10-4.mp3` | 0.42 | 7.9 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-10/10-5.mp3` | 0.72 | 14.2 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-10/10-6.mp3` | 0.26 | 4.6 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-10/10-7.mp3` | 0.74 | 14.5 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-10/10-8.mp3` | 0.23 | 3.9 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-11/11-1.mp3` | 0.60 | 11.6 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-11/11-2.mp3` | 0.44 | 8.3 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-11/11-3.mp3` | 0.61 | 11.9 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-11/11-4.mp3` | 0.30 | 5.4 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-11/11-5.mp3` | 0.67 | 13.1 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-11/11-6.mp3` | 0.28 | 5.1 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-11/11-7.mp3` | 0.71 | 14.0 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-11/11-8.mp3` | 0.31 | 5.7 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-12/12-1.mp3` | 0.66 | 12.8 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-12/12-2.mp3` | 0.27 | 4.7 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-12/12-3.mp3` | 0.56 | 10.9 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-12/12-4.mp3` | 0.44 | 8.4 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-12/12-5.mp3` | 0.71 | 13.9 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-12/12-6.mp3` | 0.17 | 2.7 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-12/12-7.mp3` | 0.74 | 14.6 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-12/12-8.mp3` | 0.32 | 5.7 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-13/13-1.mp3` | 0.72 | 14.3 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-13/13-2.mp3` | 0.36 | 6.6 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-13/13-3.mp3` | 0.67 | 13.1 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-13/13-4.mp3` | 0.22 | 3.8 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-13/13-5.mp3` | 0.65 | 12.8 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-13/13-6.mp3` | 0.29 | 5.2 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-13/13-7.mp3` | 0.78 | 15.5 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-13/13-8.mp3` | 0.40 | 7.5 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-14/14-1.mp3` | 0.56 | 10.9 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-14/14-2.mp3` | 0.32 | 5.8 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-14/14-3.mp3` | 0.80 | 15.9 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-14/14-4.mp3` | 0.22 | 3.7 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-14/14-5.mp3` | 0.53 | 10.3 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-14/14-6.mp3` | 0.37 | 7.0 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-14/14-7.mp3` | 0.63 | 12.3 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-14/14-8.mp3` | 0.37 | 6.9 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-15/15-1.mp3` | 0.74 | 14.6 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-15/15-2.mp3` | 0.39 | 7.2 | 128 | 44.1 | joint stereo | 40595 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-15/15-3.mp3` | 0.73 | 14.4 | 128 | 44.1 | joint stereo | 40595 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-15/15-4.mp3` | 0.41 | 7.7 | 128 | 44.1 | joint stereo | 40595 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-15/15-5.mp3` | 0.80 | 15.9 | 128 | 44.1 | joint stereo | 40595 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-15/15-6.mp3` | 0.21 | 3.4 | 128 | 44.1 | joint stereo | 40595 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-15/15-7.mp3` | 0.77 | 15.3 | 128 | 44.1 | joint stereo | 40595 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-15/15-8.mp3` | 0.21 | 3.4 | 128 | 44.1 | joint stereo | 40595 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-16/16-1.mp3` | 0.79 | 15.6 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-16/16-2.mp3` | 0.56 | 10.9 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-16/16-3.mp3` | 0.86 | 17.1 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-16/16-4.mp3` | 0.36 | 6.6 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-16/16-5.mp3` | 0.71 | 13.9 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-16/16-6.mp3` | 0.26 | 4.7 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-16/16-7.mp3` | 0.77 | 15.2 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-16/16-8.mp3` | 0.14 | 2.0 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-17/17-1.mp3` | 0.83 | 16.6 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-17/17-2.mp3` | 0.36 | 6.7 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-17/17-3.mp3` | 0.81 | 16.2 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-17/17-4.mp3` | 0.28 | 5.0 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-17/17-5.mp3` | 0.64 | 12.5 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-17/17-6.mp3` | 0.32 | 5.8 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-17/17-7.mp3` | 0.72 | 14.3 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-17/17-8.mp3` | 0.30 | 5.3 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-18/18-1.mp3` | 0.65 | 12.6 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-18/18-2.mp3` | 0.38 | 7.0 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-18/18-3.mp3` | 0.69 | 13.5 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-18/18-4.mp3` | 0.35 | 6.4 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-18/18-5.mp3` | 0.61 | 11.8 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-18/18-6.mp3` | 0.30 | 5.4 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-18/18-7.mp3` | 0.61 | 11.9 | 128 | 44.1 | joint stereo | 40607 | oui | OK |
| `New HSK 3.0 Level 3/Audio/lesson-18/18-8.mp3` | 0.31 | 5.7 | 128 | 44.1 | joint stereo | 40607 | oui | OK |

</details>

### 2.4 Doublons, lisibilité et limites de vérification

- Empreinte SHA256 des 517 fichiers : **0 groupe de doublons**, **0 fichier redondant**.
- JSON : 27/27 analysables ; PDF : 10/10 lisibles et non chiffrés ; MP3 : 479/479 décodables au niveau des en-têtes.
- Aucun contenu audio n'a été écouté ; aucune transcription n'a été produite ; aucun OCR n'a été lancé. Les auditory titles et la correspondance exacte avec les leçons restent à confirmer.

## 3. Organisation des dossiers

### 3.1 État actuel

```text
ia-service/corpus/
├── README.md
├── cecrl/
│   └── manifeste.json          # suivi par Git, absent du disque dans l'arbre examiné
├── CARCL/
│   ├── anglais/                # 7 JSON
│   ├── Deutsch/                # 7 JSON
│   ├── français/               # 7 JSON
│   └── italian/                # 6 JSON (aucun agrégat)
└── HSK/
    ├── New HSK 3.0 Level 1/    # 3 PDF + 3 séries audio
    ├── New HSK 3.0 Level 2/    # 3 PDF + Audio/lesson-01..15
    ├── New HSK 3.0 Level 3/    # 2 PDF + Audio/lesson-01..18
    ├── New HSK 3.0 Level 4A/   # 1 PDF
    └── New HSK 3.0 Level 4B/   # 1 PDF
```

Les noms mêlent français, anglais, allemand, italien et chinois ; les niveaux HSK 4A/4B ne suivent pas le même motif que 1 à 3. C'est un état de dépôt de ressources, pas une organisation d'ingestion.

### 3.2 Organisation proposée (non appliquée)

```text
ia-service/corpus/
├── README.md                       # versionné
├── cecrl/
│   ├── manifeste.json              # versionné, source de vérité
│   ├── sources/                    # descripteurs/PDF hors Git
│   ├── normalise/                  # JSONL généré, hors Git sauf manifeste/README
│   └── temp/                       # extractions temporaires, hors Git
├── carcl/
│   ├── manifeste.json              # à créer, versionné (métadonnées seulement)
│   ├── datasets/                   # 27 JSON source, décision de droits à prendre
│   ├── normalise/                  # corpus normalisé généré, hors Git
│   └── temp/
└── hsk/
    ├── manifeste.json              # à créer, versionné (métadonnées seulement)
    ├── pdf/                        # 10 PDF, hors Git
    ├── audio/                      # 479 MP3, hors Git
    ├── transcription/              # textes alignés générés, hors Git
    ├── normalise/                  # segments RAG générés, hors Git sauf manifeste/README
    └── temp/
```

Aucun déplacement n'a été effectué : ce schéma sert de cible après validation des droits et choix du developpeur. Les règles `.gitignore` ajoutées fonctionnent déjà avec ces noms de dossiers.

## 4. Formats et caractéristiques des fichiers

| Format | Quantité | Caractéristiques observées |
| --- | ---: | --- |
| JSON | 27 | UTF-8, 0,16 à 1,84 Mo, schémas hétérogènes par langue ; QA et QCM, généralement structurés autour de `question`, `answer`, `options`, `correct_answer` ou `level`. |
| PDF | 10 | 4,7 à 227,8 Mo, 15 à 212 pages, A4 sauf deux formats de numérisation (569,688 × 796,446 pts et 1404 × 1911 pts), non chiffrés. |
| MP3 | 479 | MPEG-1 Layer III, CBR, 128 ou 192 kbps, 44,1 ou 48 kHz, joint stereo ou mono, étiquettes ID3v2/ID3v1 fréquentes. |
| Markdown | 1 | `ia-service/corpus/README.md` : règles actuelles du corpus CECRL, génération et droits. |

Aucun XLSX, ZIP ou JSONL n'est présent dans l'arbre examiné ; les règles Git ajoutées couvrent pourtant ces dérivés afin d'éviter qu'ils apparaissent plus tard dans un commit.

## 5. Rôle des PDF dans le RAG

**Présent.** Aucun PDF n'est lu par le service IA. Le récupérateur local n'accepte que des `DescripteurCorpus` validés depuis `descripteurs.jsonl`, avec un `manifeste.json` décrivant source, licence, langues, niveaux, compétences, comptages et empreinte SHA256. Les PDF HSK sont donc aujourd'hui des ressources pédagogiques stockées, non une source du RAG.

**Envisagé.** Après validation des droits, un pipeline pourrait : extraire le texte ou lancer un OCR, découper en segments par page/leçon, ajouter les métadonnées `langue`, `référentiel`, `niveau`, `compétence`, `source_id`, produire un JSONL normalisé et un manifeste vérifiable, puis lire ces segments via le port `RecuperateurRAG`. Les PDF resteraient hors dépôt ; seuls les segments normalisés et leurs manifestes légers seraient candidats à une indexation. Aucune ingestion de ce type n'a été réalisée.

## 6. Rôle des audios dans les fonctionnalités pédagogiques et vocales

**Présent.** Le service IA n'expose aucun traitement audio ; le backend refuse les réponses audio selon les dérives connues du projet. Les 479 MP3 ne sont ni transcrits ni indexés et ne sont pas utilisés par le diagnostic.

**Envisagé.** Les pistes pourraient alimenter des exercices d'écoute, de dictée, de répétition guidée ou de prononciation, avec alignement transcription-audio et gestion de la durée par leçon. Ces fonctions nécessiteraient une transcription/alignement et décideraient d'un nouveau service ou d'une dépendance : hors périmètre de cet audit, à valider séparément.

## 7. Gestion des métadonnées et liens entre ressources

Le manifeste CECRL existant est la référence : version, édition, source avec empreinte, statut juridique, langues, niveaux, compétences, comptages et empreinte du JSONL. Toute incohérence fait échouer le chargement plutôt que de servir un index partiel.

Pour les autres familles, le schéma envisagé doit pouvoir relier :

- un `source_id` stable vers un PDF et une page (`hsk:pdf:<niveau>:<fichier>#page=n`) ou une piste audio (`hsk:audio:<lecon>:<fichier>#t=...`) ;
- un `item_id` par question CARCL, avec langue, niveau, type QA/QCM et énoncé normalisé ;
- un `descripteur_id` CECRL déjà normalisé (`cecrl:<langue>:<année>:<numéro>`) ;
- les champs communs `langue`, `référentiel`, `niveau`, `compétence`, `version`, `statut_droits`, `empreinte_sha256`.

Ces liens permettraient de citer la page ou la leçon d'origine dans une réponse pédagogique sans distribuer le fichier source. Aucun manifeste HSK/CARCL n'a été créé lors de cet audit.

## 8. Règles Git et `.gitignore`

Le `.gitignore` existant n'a pas été remplacé. Les règles déjà présentes pour `descripteurs.jsonl`, `*.xlsx` et `*.zip` ont été conservées ; le bloc suivant a été ajouté à la fin de la section « Corpus documentaire CECRL ».

```gitignore
# ===== Corpus pédagogiques volumineux (PRE-12) =====
# Sources PDF/audio et dérivés générés : stockage hors dépôt. Les scripts, README,
# manifestes légers et la documentation restent versionnés.
ia-service/corpus/**/*.pdf
ia-service/corpus/**/*.mp3
ia-service/corpus/**/*.wav
ia-service/corpus/**/*.m4a
ia-service/corpus/**/*.aac
ia-service/corpus/**/*.ogg
ia-service/corpus/**/*.flac
ia-service/corpus/**/*.wma
ia-service/corpus/**/*.7z
ia-service/corpus/**/*.rar
ia-service/corpus/**/*.tar
ia-service/corpus/**/*.tgz
ia-service/corpus/**/*.gz
ia-service/corpus/**/*.bz2
ia-service/corpus/**/*.xz
ia-service/corpus/**/normalise/**
ia-service/corpus/**/temp/**
ia-service/corpus/**/tmp/**
ia-service/corpus/**/extraction/**
!ia-service/corpus/**/normalise/
!ia-service/corpus/**/normalise/**/
!ia-service/corpus/**/temp/
!ia-service/corpus/**/temp/**/
!ia-service/corpus/**/tmp/
!ia-service/corpus/**/tmp/**/
!ia-service/corpus/**/extraction/
!ia-service/corpus/**/extraction/**/
!ia-service/corpus/**/normalise/**/README.md
!ia-service/corpus/**/normalise/**/manifeste.json
!ia-service/corpus/**/temp/**/README.md
!ia-service/corpus/**/tmp/**/README.md
!ia-service/corpus/**/extraction/**/README.md
```

Vérification avec `git check-ignore -v --no-index` (un motif commençant par `!` signifie que le chemin reste versionnable) :

| Chemin testé | Résultat |
| --- | --- |
| `ia-service/corpus/HSK/.../hsk-course-2-workbook.pdf` | ignoré par `*.pdf` |
| `ia-service/corpus/HSK/.../lesson-01/2-1.mp3` | ignoré par `*.mp3` |
| `ia-service/corpus/HSK/normalise/hsk/descripteurs.jsonl` | ignoré par `normalise/**` |
| `ia-service/corpus/HSK/normalise/hsk/README.md` | versionnable (exception `!.../README.md`) |
| `ia-service/corpus/HSK/normalise/hsk/manifeste.json` | versionnable (exception `!.../manifeste.json`) |
| `ia-service/corpus/HSK/temp/extraction/page-001.txt` | ignoré par `extraction/**` |
| `ia-service/corpus/CARCL/anglais/english_a1_...json` | versionnable |
| `ia-service/corpus/cecrl/manifeste.json` | versionnable |
| `ia-service/corpus/README.md` | versionnable |
| `docs/architecture/gestion-corpus-cecrl-hsk.md` | versionnable |
| `ia-service/scripts/ingestion_cecrl.py` | versionnable |
| `ia-service/tests/data/exemple.csv` | versionnable (exception préexistante) |

Contrôle global sur les 517 fichiers présents : **489 ignorés** (10 PDF + 479 MP3) et **28 versionnables** (27 JSON CARCL + le README). Les scripts, manifestes légers, README et documentation ne sont pas ignorés. Aucun fichier volumineux du corpus n'est ajouté à l'index.

Fichiers déjà suivis par Git et pesant plus de 1 Mo : **0**. Aucun fichier suivi n'a été retiré de l'index.

## 9. Contraintes de stockage

- Volume total ≈ **1,15 Go**, dominé par les PDF (715,8 Mo) puis les audios (423,3 Mo). Les JSON CARCL ne représentent que 11,41 Mo.
- Le seul fichier `hsk-course-2-workbook.pdf` pèse 227,8 Mo ; la série `hsk1workbookaudios` pèse 191,8 Mo à elle seule.
- Ces fichiers ne doivent pas entrer dans Git, les artefacts CI ni les images Docker. Le montage conteneur doit rester en lecture seule, comme le prévoit déjà la configuration CECRL.
- Le contexte de build Docker et un éventuel `.dockerignore` sont à vérifier séparément : `.gitignore` ne suffit pas à exclure des fichiers du contexte Docker. Ce point n'a pas été modifié ici.
- Les étiquettes ID3 volumineuses augmentent la taille des MP3 sans contribuer à la durée utile ; un nettoyage éventuel doit être validé avant toute action et n'a pas été effectué.
- Aucune compression, conversion, transcription ni ré-écriture de fichier source n'a été réalisée.

## 10. Droits d'utilisation et provenance à vérifier

Aucun droit d'utilisation n'est supposé acquis.

- **CECRL** : le manifeste versionné porte `licence.statut = "non_clarifiee"` ; les descripteurs officiels restent hors dépôt, non distribués et non commerciaux tant qu'une autorisation écrite n'existe pas.
- **CARCL** : les métadonnées déclarent un contenu pédagogique original, aligné sur des descripteurs et non officiel. La provenance exacte, l'auteur et la licence de diffusion restent à confirmer par écrit avant versionnement définitif des 27 JSON.
- **HSK** : aucun fichier n'indique de licence ou d'accord de reproduction. Les métadonnées PDF ne donnent que des informations de scanner/OCR ou d'éditeur de bureau. Il faut vérifier l'édition, l'éditeur, l'année et l'autorisation d'usage interne avant toute extraction ou indexation.
- Aucune donnée personnelle ni clé API n'a été relevée dans les fichiers examinés ; aucun secret n'est ajouté à la documentation.

## 11. Architecture d'intégration envisagée

| Élément | État réel | Envisagé uniquement |
| --- | --- | --- |
| Corpus CECRL local | Manifeste + JSONL validés, BM25, désactivé par défaut | Extension des niveaux/langues après droits clarifiés |
| Jeux CARCL | 27 JSON présents, non consommés | Normalisation, contrôle de qualité, items de diagnostic ou d'exercice |
| PDF HSK | Stockés, non lus | OCR/extraction, segmentation, segments RAG avec citations de page |
| Audio HSK | Stockés, non lus | Écoute, dictée, alignement transcription-audio, prononciation |
| RAG | Port `RecuperateurRAG`, implémentation locale CECRL | Sources multiples et manifeste par corpus, sans changer le contrat API |

```text
Sources hors Git (PDF / MP3 / descripteurs / JSON)
        │  extraction ou normalisation contrôlée
        ▼
corpus/<famille>/normalise/  +  manifeste.json léger versionné
        │  validation Pydantic + empreinte SHA256
        ▼
RecuperateurRAG ──► Harness ──► agents (diagnostic / chatbot)
```

Le contrat public, le frontend et le scoring déterministe du backend restent inchangés. Aucun appel réseau, PostgreSQL ni nouvelle dépendance n'est introduit par cette mission.

## 12. Travaux restant à réaliser

1. Obtenir la validation du developpeur sur le bilan, l'organisation proposée et le sort des 27 JSON CARCL avant tout commit ou PR.
2. Vérifier par écrit les droits et la provenance de chaque famille, surtout HSK et CARCL.
3. Créer les manifestes légers HSK/CARCL et définir les identifiants stables de liens entre PDF, audio, transcription et questions.
4. Décider des emplacements définitifs et déplacer les sources uniquement après autorisation ; ne pas réécrire les fichiers d'origine.
5. Écrire, dans un second temps, des scripts d'extraction/normalisation à sortie hors dépôt, avec tests synthétiques et contrôle d'empreinte.
6. Vérifier le contexte Docker/`.dockerignore` et les règles CI pour que les sources restent hors images et artefacts.
7. Ne brancher le RAG qu'après validation juridique et technique ; aucun OCR, ingestion ou appel LLM réel n'a été lancé ici.

**Limites de l'audit :** langue HSK inférée, couche texte PDF testée seulement sur les pages 1–3, audio non écouté, contenu des questions CARCL analysé structurellement mais non évalué pédagogiquement, droits non vérifiés. Les durées MP3 proviennent de l'analyse des trames et sont exactes pour ces flux CBR ; aucun outil audio externe n'a été installé.
