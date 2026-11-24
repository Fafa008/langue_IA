# Inventaire des agents IA et état du RAG

> Centre Langues IA · La Digithèque · 24 novembre 2026 · branche `feature/US150-C-rag-pdf-cecrl`
>
> Constat établi sur le code de `ia-service/` (`app/main.py`, `app/harness/`, `app/agents/`, `app/agent/`,
> `app/rag/`). Les analyses détaillées par agent restent dans `docs/ia/analyse-agent-*-harness.md`.

## 1. Pipeline commun

Tous les agents passent par le **Harness** (`app/harness/execution.py`), seul point d'entrée :

1. résolution de l'agent dans le registre (code + version, la dernière par défaut) ;
2. revalidation Pydantic de l'entrée ;
3. outils injectés : client LLM unique, registre de prompts versionnés, **récupérateur RAG enveloppé dans
   `RecuperateurAvecRepli`**, mémoire courte Redis (ou vide), horloge ;
4. exécution sous budget (`asyncio.timeout`) ;
5. validation de la sortie ; toute exception devient une `ReponseErreur` codée (jamais de trace) ;
6. `MetaExecution` : durée, fournisseur, modèle, `version_corpus`, empreinte du prompt.

Le service ne persiste rien et n'accède à aucune base : le backend valide et enregistre. Le LLM est choisi par
`LLM_FOURNISSEUR` (`factice`, `compatible-openai` pour Groq, `gemini`).

## 2. Les dix agents enregistrés

| Agent (code) | Version | Route (service IA) | Prompt versionné | Budget | RAG | Mémoire |
| --- | --- | --- | --- | --- | --- | --- |
| `diagnostic` | 1.0.0 | `POST /diagnostic/evaluer` | `diagnostic/evaluation@1.1.0` | 45 s | **oui** (niveau préliminaire, compétences des preuves, énoncés + réponses) | non |
| `diagnostic` (positionnement) | 1.2.0 | `POST /diagnostic/evaluer` avec `version_agent` | `diagnostic/evaluation@1.2.0` | 45 s | **oui** | non |
| `correction` | 1.0.0 | `POST /correction/reponse-libre` | `correction/reponse-libre@1.0.0` | 45 s | **oui** (niveau de l'apprenant, expression écrite) | non |
| `recommandation` | 1.0.0 | `POST /recommandation/actions` | `recommandation/actions@1.0.0` | — | non (par conception, v1) | non |
| `chatbot` (v1) | 1.2.0 | `POST /chatbot/message` (version explicite) | `chatbot/conversation@1.2.0` | 30 s | non | non |
| `chatbot` (tuteur v2) | 2.0.0 | `POST /chatbot/message` (défaut) | `chatbot/conversation@1.3.0` | 35 s | **oui** (un descripteur du niveau effectif) | tours + résumé (Redis) |
| `chatbot-correction` | 1.0.0 | `POST /chatbot/correction` | `chatbot/correction@1.0.0` | 12 s | non | non |
| `chatbot-traduction` | 1.0.0 | `POST /chatbot/traduction` | `chatbot/traduction@1.0.0` | 15 s | non | cache de traduction |
| `chatbot-memoire` | 1.0.0 | `POST /chatbot/session/close` | `chatbot/memoire@1.0.0` | 20 s | non | lit tours + résumé |
| `chatbot-exercice` | 1.0.0 | `POST /chatbot/exercice` | `chatbot/exercice@1.0.0` | 20 s | **oui** (compétence déduite de l'erreur) | non |

Garde-fous communs observés : sorties JSON strictes revalidées, refus des extraits inventés (correction), aucune
donnée d'apprenant journalisée, contexte pseudonyme, référence de corpus ajoutée par le service et non par le modèle
(exercice).

## 3. État du RAG avant cette branche

- **Port stable** `RecuperateurRAG` ; fabrique unique `construire_recuperateur` ; repli synthétique étiqueté
  `synthetique_fallback` quand le corpus ne renvoie rien ; statut `A_VERIFIER` quand rien n'est disponible.
- **Corpus officiel (classeur XLSX)** : chargeur et BM25 prêts, mais `descripteurs.jsonl` absent et verrou
  `RAG_CORPUS_OFFICIEL_AUTORISE=false`.
- **Corpus expérimental CARCL** : exercices non officiels, activable pour la démonstration.
- **PDF du volume complémentaire** : audités (`docs/US150_A_AUDIT_PDF_CECRL.md`), **aucun chemin d'ingestion**.
- **Limite de conception** : la requête du diagnostic contient surtout les réponses de l'apprenant, dans la langue
  apprise ; un classement purement lexical contre des descripteurs (« Peut comprendre… ») renvoie presque toujours
  une liste vide, et le repli synthétique prend la main. Même chose pour le tuteur, dont le texte de requête par
  défaut est « niveau X compétence Y ».

## 4. Ce qu'apporte US150-C : RAG sur le corpus PDF

Explication complète, résultats sur les sources officielles et limites : [`../US150_C_RAG_PDF_CECRL.md`](../US150_C_RAG_PDF_CECRL.md).

| Élément | Fichier |
| --- | --- |
| Ingestion PDF hors dépôt (extraction, nettoyage, grilles, compétences, rapport sans texte) | `ia-service/scripts/ingestion_pdf_cecrl.py` |
| Manifeste, descripteurs avec provenance (document, page, section, échelle), chargement validé | `ia-service/app/rag/corpus_pdf.py` |
| Récupérateur par facettes + BM25 + diversité d'échelles, édition de repli, source citée | `ia-service/app/rag/pdf.py` |
| `RAG_CORPUS_TYPE=pdf`, même verrou d'autorisation que le corpus officiel | `ia-service/app/rag/config.py`, `fabrique.py` |
| Montage en lecture seule d'un corpus externe (`RAG_CORPUS_HOTE` → `/corpus-externe`) | `docker-compose.yml` |
| Procédure | `ia-service/corpus/README.md` |

Les quatre agents consommateurs (diagnostic, correction, tuteur v2, exercice) profitent du corpus sans modification :
ils reçoivent des descripteurs du **niveau et de la compétence demandés**, même quand le texte de la requête ne
recoupe pas lexicalement le descripteur. Le diagnostic les signale comme provenance `officiel`, avec
`version_corpus` = version du corpus PDF.

## 5. Points d'attention

1. **Droits** : l'audit conclut qu'extraire, stocker et indexer ces PDF demande une autorisation écrite du Conseil
   de l'Europe (et, pour les éditions italienne et allemande, des co-titulaires). Le verrou
   `RAG_CORPUS_OFFICIEL_AUTORISE` est donc requis pour le type `pdf` ; le corpus reste hors du dépôt et de l'image.
2. **Extraction heuristique, validée sur les vraies éditions** : la lecture des grilles repose sur la mise en page
   (`pdftotext -layout`) et sur la numérotation des chapitres 3 et 5. Sur les éditions officielles anglaise,
   française et italienne, elle donne 227, 233 et 235 descripteurs, mêmes sections dans les trois, aucun descripteur
   coupé (détail et empreintes : `ia-service/corpus/README.md`, §4). Seule l'échelle de phonologie (grille à trois
   colonnes) n'est pas lue correctement.
3. **Langue d'édition** : un apprenant d'anglais reçoit des descripteurs de l'édition française si aucune édition
   anglaise n'est fournie (le PDF anglais audité ne contient que la médiation). La source est indiquée dans le texte
   transmis au modèle.
4. **Hors périmètre** : médiation, stratégies, compétences socio-linguistique, pragmatique et plurilingue n'ont pas
   de compétence équivalente dans le contrat (`Competence`) ; HSK non couvert (pas de PDF HSK).
5. **Recommandation** : sans RAG ni mémoire en v1, par conception.
6. **Tests dans Docker** : `make test-ia` transmet aux tests les variables d'environnement du service
   (`RAG_CORPUS_CHEMIN`, `LLM_*`, `GEMINI_*`…), ce qui fait échouer des tests de configuration qui passent en CI.
   Les trois tests de `ingestion_cecrl.py` qui échouaient aussi dans Docker (racine du dépôt calculée à `/`) sont
   corrigés par `scripts/_depot.py`.
