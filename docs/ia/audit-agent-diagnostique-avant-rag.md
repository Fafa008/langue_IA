# PRE-13 — Audit de l’Agent Diagnostique avant intégration du RAG hybride

**Date de l’audit :** 18 novembre 2026

**Branche :** `feature/PRE-13-audit-agent-diagnostique-rag`, créée depuis `origin/develop` à `86c529fa7f9845c921604803ac90f31f333c0a87` après `git fetch` et vérification de l’état Git.

**Statut :** audit rédigé, **en attente de validation du développeur** ; aucun commit, aucune PR, aucune modification applicative, aucune installation de dépendance, aucune génération d’embedding, aucune modification de prompt et aucun accès base de données.

**Périmètre :** module `ia-service`, plus le client HTTP du backend uniquement pour comprendre comment la requête arrive et comment la réponse est consommée.

---

## Synthèse exécutive — réponses aux neuf questions

| # | Question | Réponse courte |
| --- | --- | --- |
| 1 | Où se trouve l’Agent Diagnostique ? | `ia-service/app/agents/diagnostic.py` : `DiagnosticAgent`, `EntreeDiagnostic`, `construire_definition()`. |
| 2 | Comment reçoit-il les réponses de l’apprenant ? | Via `POST /diagnostic/evaluer` (`app/api/diagnostic.py`), enveloppées dans `RequeteAgent[EntreeDiagnostic]`, validées par Pydantic puis transmises par le Harness. |
| 3 | Comment évalue-t-il et estime-t-il le niveau ? | Il ne recalcule pas le score objectif. Il construit un prompt avec réponses, score préliminaire, contexte et descripteurs RAG ; le LLM propose `niveau_estime`, phase Assimil et points faibles ; le service rejette toute sortie incohérente. |
| 4 | Comment utilise-t-il Harness et LLM ? | Le Harness résout l’agent, revalide l’entrée, injecte les outils, applique un budget de 45 s, valide la sortie et construit l’enveloppe. Le LLM est un client partagé injecté dans `OutilsCommuns`. |
| 5 | Comment récupère-t-il les connaissances pédagogiques ? | Par le port `RecuperateurRAG`. En configuration actuelle, `RAG_CORPUS_ACTIF=false` donc `RecuperateurVide`, puis le Harness ajoute un repli synthétique étiqueté pour CECRL `fr/en/it/de`. Le BM25 local existe mais n’est pas activé par défaut. |
| 6 | Quels sont les formats exacts ? | `RequeteAgent[EntreeDiagnostic]` en entrée, `ReponseAgent[ResultatDiagnostic]` ou `ReponseErreur` en sortie. Tous les modèles sont stricts. Des exemples versionnés existent dans `tests/exemples/valide/`. |
| 7 | Qu’est-ce qui est déjà fonctionnel ? | Route HTTP, contrats stricts, Harness, budget, catalogue d’erreurs, prompts versionnés, few-shot, adaptateurs LLM, client de démonstration sans clé, port RAG, BM25 local, repli étiqueté, intégration backend. |
| 8 | Que manque-t-il pour le RAG hybride ? | Embeddings, index vectoriel, fusion BM25/vectorielle, corpus HSK normalisé, manifeste HSK, descripteurs HSK, consommateur CARCL, OCR/transcription, et traçabilité fine de la provenance. |
| 9 | Quels tests vérifient le fonctionnement ? | Tests agent, schémas, API, Harness, LLM, prompts et RAG. Suite complète exécutée : **608 passed, 2 skipped, 1 warning in 29.47s**. |

**Conclusion :** le pipeline diagnostic est déjà solide et testé. Le RAG hybride n’existe pas encore, mais le port `RecuperateurRAG` permet de l’ajouter sans réécrire l’agent. L’essentiel du travail futur porte sur l’ingestion HSK, le modèle de corpus et l’implémentation d’un récupérateur hybride injectable.

---

## 1. Périmètre et méthode

### 1.1 Ce qui a été fait

- Lecture du code du service IA, du Harness, des schémas, des prompts, du client LLM, du RAG et du client backend.
- Localisation des flux réels et des points d’extension.
- Comparaison entre le code et la documentation présente dans le dépôt.
- Exécution de la suite complète `ia-service` depuis l’environnement virtuel existant.
- Rédaction de ce document uniquement.

### 1.2 Ce qui n’a pas été fait

- Aucun fichier applicatif modifié.
- Aucune dépendance installée.
- Aucun embedding généré.
- Aucun prompt existant modifié.
- Aucune table, aucun schéma et aucune donnée de base de données touchés.
- Aucun commit, aucune PR, aucune fusion.
- Aucun OCR, aucune transcription audio et aucune ingestion réelle de corpus.

### 1.3 Commande de test réellement exécutée

Depuis `ia-service/` :

```powershell
& '.venv/Scripts/python.exe' -m pytest --disable-warnings
```

Résultat obtenu :

```text
608 passed, 2 skipped, 1 warning in 29.47s
```

Le seul avertissement observé sans `--disable-warnings` provient de Starlette :

```text
DeprecationWarning: The anyio.abc.BlockingPortal alias is deprecated,
use anyio.from_thread.BlockingPortal instead.
```

Les deux tests ignorés correspondent aux tests d’intégration qui supposent des fournisseurs LLM réels/clés externes ; ils ne sont pas nécessaires au parcours de démonstration local.

---

## 2. Architecture actuelle

### 2.1 Chaîne d’exécution complète

```text
Backend / client HTTP
        │
        ▼
POST /diagnostic/evaluer
        │
        ▼
FastAPI + Pydantic
RequeteAgent[EntreeDiagnostic]
        │
        ▼
Harness.executer("diagnostic", requete)
        │
        ├─ RegistreAgents.resoudre()
        ├─ revalidation de l’entrée
        ├─ OutilsCommuns(client_llm, registre_prompts, recuperateur_rag)
        ├─ RecuperateurAvecRepli appliqué automatiquement
        └─ asyncio.timeout(BUDGET_MS / 1000)
                │
                ▼
        DiagnosticAgent.executer()
                │
                ├─ RequeteRAG → RecuperateurRAG
                ├─ VariablesEvaluationDiagnostic
                ├─ RegistrePrompts.rendre_evaluation_diagnostic()
                ├─ FournisseurLLM.generer_json(schema=ResultatDiagnostic)
                ├─ ResultatDiagnostic.verifier_coherence()
                └─ signalement d’un écart ≥ 2 niveaux
                │
                ▼
Validation Harness de la sortie
        │
        ▼
ReponseAgent[ResultatDiagnostic]  ou  ReponseErreur
        │
        ▼
Backend : validation, dégradation si erreur, persistance de l’enveloppe
```

### 2.2 Câblage au démarrage

`ia-service/app/main.py` :

- `RegistrePrompts()` : ligne 32 ;
- `obtenir_client()` pour le client LLM partagé : ligne 33 ;
- `RegistreAgents()` : ligne 34 ;
- `construire_recuperateur()` : ligne 35 ;
- enregistrement des agents `diagnostic` et `chatbot` : lignes 37-38 ;
- injection dans `app.state` puis construction du `Harness` : lignes 40-49 ;
- fermeture propre des ressources : lignes 53-56 ;
- inclusion du routeur diagnostic : ligne 85.

Le point important est que le Harness reçoit toujours le récupérateur construit par la fabrique, mais l’enveloppe dans `RecuperateurAvecRepli` (`harness/execution.py:55`). C’est ce décorateur — et non l’agent — qui fournit les repères synthétiques lorsque le corpus ne répond pas.

---

## 3. Classes et fichiers concernés

### 3.1 Agent et entrée métier

| Fichier | Éléments | Rôle |
| --- | --- | --- |
| `ia-service/app/agents/diagnostic.py` | `CODE_AGENT`, `VERSION_AGENT`, `BUDGET_MS`, `SEUIL_ECART_IMPORTANT`, `EntreeDiagnostic`, `DiagnosticAgent`, `construire_definition()` | Cœur de l’agent diagnostic. |
| `ia-service/app/schemas/diagnostic.py` | `ResultatDiagnostic`, `PointFaible`, `PreuveReponse`, `PhaseAssimil`, `calculer_ecart()`, `DiagnosticIncoherent` | Contrat de sortie et règles de cohérence. |
| `ia-service/app/schemas/contexte.py` | `ContexteApprenant`, `MemoirePedagogique` | Contexte minimal sans données identifiantes. |
| `ia-service/app/schemas/commun.py` | `RequeteAgent`, `ReponseAgent`, `ReponseErreur`, `ErreurAgent`, `MetaExecution` | Enveloppes communes du Harness. |
| `ia-service/app/prompts/variables.py` | `ReponseDiagnosticPrompt`, `DescripteurRAGPrompt`, `VariablesEvaluationDiagnostic`, `preuves_depuis_reponses()` | Formes strictes injectées dans le prompt. |
| `ia-service/app/schemas/regles.py` | langues, référentiels, niveaux, compétences, domaines de faiblesse | Source des règles métier partagées. |

Identité de l’agent (`agents/diagnostic.py:43-46`) :

```python
CODE_AGENT = "diagnostic"
VERSION_AGENT = "1.0.0"
BUDGET_MS = 45_000
SEUIL_ECART_IMPORTANT = 2
```

### 3.2 Harness

| Fichier | Éléments | Rôle |
| --- | --- | --- |
| `ia-service/app/harness/execution.py` | `Harness` | Point d’entrée unique : résolution, budget, validation, enveloppe. |
| `ia-service/app/harness/agent.py` | `OutilsCommuns`, `SignalementRAG`, `ContexteExecution`, `DefinitionAgent` | Contrats d’exécution injectés dans l’agent. |
| `ia-service/app/harness/registre.py` | `RegistreAgents` | Résolution d’un agent par code et version. |
| `ia-service/app/core/codes_erreur.py` | `CodeErreur`, `CODES_RETRYABLES`, `STATUTS_HTTP` | Catalogue public des erreurs et statuts HTTP. |
| `ia-service/app/core/gestionnaire_erreurs.py` | traduction des exceptions | Produit des `ReponseErreur` sans trace ni secret. |

Le Harness ne contient aucune logique pédagogique. Il est déjà le bon point d’injection pour un futur récupérateur hybride.

### 3.3 Prompt et LLM

| Fichier | Rôle |
| --- | --- |
| `app/prompts/registre.py` | Charge, valide et rend `diagnostic/evaluation@1.1.0`. |
| `app/prompts/diagnostic/evaluation@1.1.0.systeme.md` | Règles de prudence, preuves directes, phases Assimil, JSON strict. |
| `app/prompts/diagnostic/evaluation@1.1.0.utilisateur.md` | Template avec sept variables, dont le bloc `<donnees_diagnostic_non_fiables>`. |
| `app/prompts/diagnostic/evaluation@1.1.0.jsonl` | Trois exemples few-shot validés au chargement. |
| `app/prompts/bibliotheque_few_shot.py` | Sélection déterministe par `(scénario, langue)`. |
| `app/prompts/exemples/diagnostic/*.json` | Bibliothèque utilisée à l’exécution quand `exemples_few_shot` n’est pas fourni. |
| `app/llm/base.py` | Contrat `FournisseurLLM`. |
| `app/llm/fabrique.py` | Fabrique du client partagé : factice, compatible OpenAI, Gemini. |
| `app/llm/demonstration.py` | Répondeur déterministe sans clé ni réseau. |
| `app/llm/adaptateurs/*.py` | Adaptateurs concrets. |

Paramètres du prompt chargé dans `prompts/registre.py:167-193` :

- version publique : `diagnostic/evaluation@1.1.0` ;
- température : `0.2` ;
- `max_tokens` : `900` ;
- empreinte statique calculée sur le système, le template utilisateur et le fichier few-shot versionné.

### 3.4 RAG actuel

| Fichier | Rôle |
| --- | --- |
| `app/rag/base.py` | Port `RecuperateurRAG`, `RequeteRAG`, constantes de provenance. |
| `app/rag/config.py` | `RAG_CORPUS_ACTIF`, `RAG_CORPUS_CHEMIN`, `RAG_CORPUS_VERIFIER_EMPREINTE`. |
| `app/rag/fabrique.py` | Unique point d’assemblage du récupérateur. |
| `app/rag/vide.py` | `RecuperateurVide`, ne retourne aucun descripteur. |
| `app/rag/local.py` | `RecuperateurLocal`, BM25 déterministe sur corpus CECRL. |
| `app/rag/corpus.py` | Chargement et contrôle d’intégrité du manifeste et des descripteurs. |
| `app/rag/repli.py` | `RecuperateurAvecRepli` et repères synthétiques non officiels. |

### 3.5 API et backend

| Fichier | Rôle |
| --- | --- |
| `ia-service/app/api/diagnostic.py` | Route `POST /diagnostic/evaluer`. |
| `ia-service/app/main.py` | Initialisation de l’application. |
| `backend/app/services/ia.py` | Appel HTTP best-effort vers `/diagnostic/evaluer`. |
| `backend/app/schemas/ia.py` | Miroir des contrats côté backend. |
| `backend/app/services/analyse_diagnostic.py` | Prépare la requête, dégrade en résultat partiel, persiste l’enveloppe. |

---

## 4. Flux d’exécution détaillé

### 4.1 Réception de la requête

`app/api/diagnostic.py:19-42` :

1. FastAPI valide le corps comme `RequeteAgent[EntreeDiagnostic]`.
2. La route appelle `request.app.state.harness.executer(CODE_AGENT, requete)`.
3. Si le Harness renvoie une `ReponseErreur`, la route construit un `JSONResponse` avec le statut issu de `STATUTS_HTTP`.
4. Sinon, elle renvoie directement `ReponseAgent[ResultatDiagnostic]`.

La route elle-même ne contient aucune logique pédagogique.

### 4.2 Pipeline Harness

`app/harness/execution.py:58-130` :

1. Calcul de l’identifiant affiché et de la version demandée : lignes 71-72.
2. Résolution de la définition d’agent : lignes 74-77.
3. Revalidation de `requete.entree` contre `definition.schema_entree` : lignes 79-82.
4. Création de `OutilsCommuns` et `ContexteExecution` : lignes 84-95.
5. Exécution sous `asyncio.timeout(definition.budget_ms / 1000)` : lignes 99-100.
6. `TimeoutError` → `LLM_TIMEOUT` : lignes 101-102.
7. Toute autre exception est traduite en code public : lignes 103-106 et 148-152.
8. Validation de la sortie brute contre `ResultatDiagnostic` : lignes 108-111.
9. Construction de `MetaExecution` :
   - durée bornée à 600 000 ms : ligne 113 ;
   - provenance corpus : ligne 114 ;
   - fournisseur et modèle : lignes 117-118 ;
   - empreinte prompt statique : ligne 120.
10. Retour de l’enveloppe succès : lignes 122-130.

### 4.3 Exécution de l’agent

`app/agents/diagnostic.py:93-109` :

1. `self._recuperer_descripteurs(entree, contexte)` : ligne 96.
2. `_construire_variables(...)` assemble les sept variables du prompt : ligne 97.
3. `registre_prompts.rendre_evaluation_diagnostic(variables)` : ligne 98.
4. Appel LLM avec `schema=ResultatDiagnostic`, température et `max_tokens` fournis par le prompt : lignes 100-105.
5. `_verifier_coherence(...)` : ligne 107, détail aux lignes 203-214.
6. `_signaler_ecart(...)` si l’écart absolu est ≥ 2 : ligne 108, détail aux lignes 216-231.
7. Retour du `ResultatDiagnostic` validé : ligne 109.

### 4.4 Requête RAG construite par l’agent

`agents/diagnostic.py:111-157` :

```text
texte       = concaténation des contenus de réponses, tronquée à 4 000 caractères
langue      = contexte.code_langue
référentiel = contexte.referentiel
niveau      = contexte.niveau_preliminaire
compétences = compétences dédupliquées des réponses
limite      = 8 descripteurs
```

Points de robustesse :

- `ErreurServiceIA` est propagée sans être déguisée ;
- toute autre exception devient `ErreurCorpusIndisponible` ;
- chaque descripteur reçu est revalidé contre `DescripteurRAGPrompt` ;
- un descripteur dont la langue ou le référentiel ne correspond pas au contexte fait échouer le diagnostic ;
- les identifiants dupliqués sont ignorés ;
- le nombre de descripteurs est plafonné à huit.

Provenance enregistrée dans le signalement du Harness :

| Cas | `signalement` | Effet dans `meta.version_corpus` |
| --- | --- | --- |
| Tous les descripteurs sont synthétiques | `provenance = synthetique_fallback`, `version_corpus_effective = synthetique_fallback` | `synthetique_fallback` |
| Au moins un descripteur officiel | `provenance = officiel` | version du récupérateur principal |
| Aucun descripteur | `statut_verification = A_VERIFIER`, `version_corpus_effective = A_VERIFIER` | `A_VERIFIER` |

### 4.5 Évaluation et estimation du niveau

L’agent ne recalcule pas le score objectif du test. Ce score appartient au backend et arrive dans `entree.score_preliminaire`. L’agent produit une **estimation** :

- le LLM choisit `niveau_estime` dans le référentiel imposé par la langue ;
- il choisit `phase_assimil` entre `impregnation` et `activation` ;
- il propose zéro à cinq points faibles, chacun citant un `id_question` existant ;
- il renseigne `score_confiance` entre 0 et 1 ;
- il renvoie `niveau_preliminaire` et `ecart_avec_niveau_preliminaire`.

Le service impose ensuite des règles déterministes (`schemas/diagnostic.py`) :

- référentiel cohérent avec la langue : `en/fr/it/de → CECRL`, `zh → HSK` ;
- niveaux appartenant au référentiel ;
- écart **recalculé** à partir des deux niveaux, jamais cru tel quel : lignes 176-188 ;
- `score_confiance = 0.0` interdit tout point faible : lignes 190-195 ;
- domaines de faiblesse uniques : lignes 148-155 ;
- un point faible doit citer une réponse disponible et constituer une preuve directe : lignes 197-222 ;
- `activation` exige au moins une production libre `texte` ou `audio` : lignes 219-222 ;
- cohérence finale avec le contexte apprenant : lignes 224-244.

Un écart signé de magnitude ≥ 2 est journalisé sans contenu d’apprenant (`agents/diagnostic.py:216-231`). Le résultat conserve l’écart exact pour le backend.

### 4.6 Mode démonstration sans clé

Configuration effective :

- `.env.example` et `docker-compose.yml:97-98` : `LLM_FOURNISSEUR=factice`, `LLM_FACTICE_SCENARIO=demonstration` ;
- `llm/fabrique.py:26-29` injecte `repondre_demonstration` dans le client factice.

`app/llm/demonstration.py` :

- relit le bloc `<donnees_diagnostic_non_fiables>` du message utilisateur : lignes 53-67 ;
- estime le niveau avec des seuils déterministes : `score ≥ 85` → niveau supérieur, `score < 30` → niveau inférieur, sinon niveau inchangé : lignes 70-78 ;
- choisit `activation` si une production libre existe et `score ≥ 60`, sinon `impregnation` : lignes 114-117 ;
- construit au plus deux points faibles explicites et les étiquette comme analyse de démonstration : lignes 81-98 ;
- fixe `score_confiance = 0.5` ;
- ne répond que pour le schéma `ResultatDiagnostic` : lignes 131-135.

Cela permet une démonstration reproducible sans clé LLM, sans réseau et sans base de données.

---

## 5. Formats exacts d’entrée et de sortie

Les exemples ci-dessous sont ceux versionnés dans `ia-service/tests/exemples/valide/`. Ils sont utilisés par la suite de tests ; ils ne doivent pas être confondus avec une réponse live d’un fournisseur LLM réel.

### 5.1 Requête — `requete-diagnostic.json`

```json
{
  "request_id": "3f1c9b7e-6a2d-4f0e-9c1a-2b7d5e8f4a10",
  "version_agent": "1.0.0",
  "contexte": {
    "code_langue": "en",
    "referentiel": "CECRL",
    "niveau_preliminaire": "B1",
    "memoire_pedagogique": {
      "resume": "Deux sessions de conversation, bonnes bases lexicales.",
      "points_forts": ["aisance à l'oral"],
      "points_faibles": ["emploi des temps"],
      "nb_activites": 12
    }
  },
  "entree": {
    "scenario": "entretien",
    "reponses": [
      {
        "id_question": "q-entretien-en-01",
        "competence": "ecrit",
        "type_reponse": "texte",
        "contenu": "I have been learning English for two years and I work in a small company."
      },
      {
        "id_question": "q-entretien-en-02",
        "competence": "oral",
        "type_reponse": "audio",
        "contenu": "Transcription fictive d'une présentation professionnelle."
      }
    ],
    "score_preliminaire": 64
  }
}
```

Contraintes principales :

- `request_id` : UUID valide ;
- `version_agent` : SemVer optionnel ;
- `code_langue` : `fr|en|zh|it|de` ;
- `referentiel` : `CECRL|HSK`, imposé par la langue ;
- `niveau_preliminaire` : niveau du référentiel ;
- `memoire_pedagogique` : objet optionnel ou `null` ;
- `scenario` : `quotidien|entretien|examen`, défaut `quotidien` ;
- `reponses` : 1 à 100 éléments, identifiants uniques ;
- `competence` : `grammaire|lecture|ecoute|ecrit|oral` ;
- `type_reponse` : `choix|texte|audio` ;
- `contenu` : 1 à 5 000 caractères ;
- `score_preliminaire` : nombre de 0 à 100, booléen refusé.

### 5.2 Succès — `reponse-diagnostic.json`

```json
{
  "request_id": "3f1c9b7e-6a2d-4f0e-9c1a-2b7d5e8f4a10",
  "agent": "diagnostic",
  "version_agent": "1.0.0",
  "version_prompt": "diagnostic/evaluation@1.1.0",
  "statut": "succes",
  "resultat": {
    "code_langue": "en",
    "referentiel": "CECRL",
    "niveau_estime": "B2",
    "phase_assimil": "activation",
    "points_faibles": [
      {
        "domaine": "expression_ecrite",
        "id_question": "q-entretien-en-01",
        "observation": "La réponse comporte une phrase au présent là où le passé serait attendu.",
        "justification": "Cette observation semble indiquer un emploi irrégulier des temps ; elle reste à confirmer."
      }
    ],
    "score_confiance": 0.78,
    "niveau_preliminaire": "B1",
    "ecart_avec_niveau_preliminaire": 1
  },
  "meta": {
    "duree_ms": 1840,
    "fournisseur": "factice",
    "modele": "modele-test",
    "version_corpus": "2026.10",
    "empreinte_prompt": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }
}
```

Le résultat seul est également exemplifié dans `tests/exemples/valide/resultat-diagnostic.json`.

### 5.3 Erreur — `erreur-standard.json`

```json
{
  "request_id": "3f1c9b7e-6a2d-4f0e-9c1a-2b7d5e8f4a10",
  "agent": "diagnostic",
  "statut": "erreur",
  "erreur": {
    "code": "LLM_TIMEOUT",
    "message": "Le fournisseur LLM n'a pas répondu dans le délai imparti.",
    "retryable": true,
    "details": null
  }
}
```

`retryable` est vérifié contre `CODES_RETRYABLES`, donc un même code ne peut pas être annoncé tantôt rejouable, tantôt définitif (`schemas/commun.py:102-110`).

---

## 6. État réel du RAG

### 6.1 Ce qui est implémenté

| Élément | État | Preuve |
| --- | --- | --- |
| Port injectable | ✅ | `rag/base.py:68-88` |
| Requête typée et bornée | ✅ | `rag/base.py:42-65` |
| BM25 lexical déterministe | ✅ | `rag/local.py:27-29,80-197` |
| Filtres langue/niveau/compétence | ✅ | `rag/local.py:145-153` |
| Tri total reproductible | ✅ | `rag/local.py:128-136` |
| Intégrité SHA256 du corpus | ✅ | `rag/corpus.py:199-224` |
| Repli synthétique étiqueté | ✅ | `rag/repli.py:58-120` |
| Provenance dans `meta.version_corpus` | ✅ | `agents/diagnostic.py:136-150`, `harness/execution.py:114` |
| Règle de prudence dans le prompt | ✅ | `evaluation@1.1.0.systeme.md:7,35` |

### 6.2 Ce qui est actif par défaut

- `RAG_CORPUS_ACTIF=false` (`rag/config.py:30`) ;
- la fabrique retourne donc `RecuperateurVide` (`rag/fabrique.py:29-31`) ;
- mais le Harness enveloppe toujours ce récupérateur dans `RecuperateurAvecRepli` (`harness/execution.py:55`) ;
- Résultat : pour `fr/en/it/de` en CECRL, des repères synthétiques sont injectés ; pour HSK ou une langue sans catalogue, aucun descripteur n’est fourni et `meta.version_corpus="A_VERIFIER"`.

`RecuperateurVide` ne fabrique lui-même rien (`rag/vide.py:12-24`). L’affirmation du README selon laquelle « l’agent ne fabrique aucun descripteur » est vraie pour l’agent, mais fausse au niveau du pipeline complet à cause du décorateur du Harness.

### 6.3 Corpus CECRL présent

Manifeste versionné : `ia-service/corpus/CECRL/manifeste.json`.

- version : `cecrl-2020.1` ;
- langue : uniquement `en` ;
- niveaux : `A1`, `A2`, `B1`, `B2` ;
- total annoncé : 325 descripteurs ;
- licence : `non_clarifiee` ;
- empreinte JSONL attendue : `b0bce621e8bde633d0aa8e40eb6fa502b40c6a796b0627cdb61f57575f586be7`.

Points bloquants :

- aucun `descripteurs.jsonl` n’est présent dans l’arbre de travail ;
- `.gitignore:94` exclut `ia-service/corpus/**/descripteurs.jsonl` ;
- le dossier versionné est `corpus/CECRL` en majuscules, alors que le code cherche `corpus/cecrl` en minuscules (`rag/config.py:15-17`) et que Compose monte `/app/corpus/cecrl` (`docker-compose.yml:112`) ;
- sur un système Linux sensible à la casse, le chemin par défaut ne pointe donc pas vers le manifeste versionné.

Le script `ia-service/scripts/ingestion_cecrl.py` est présent et refuse toute sortie dans le dépôt ; il doit être utilisé hors dépôt pour produire le JSONL attendu.

### 6.4 HSK et CARCL

- Les fichiers HSK présents sont des PDF et MP3 sous `ia-service/corpus/HSK/`.
- Aucun manifeste HSK n’est consommé par le service.
- Aucun `descripteurs.jsonl` HSK n’existe.
- `RecuperateurLocal.rechercher()` retourne immédiatement une séquence vide si `referentiel != "CECRL"` (`rag/local.py:115-117`).
- Le repli synthétique refuse également HSK (`rag/repli.py:61-66`).
- Le modèle de corpus est structurellement CECRL :
  - `ManifesteCorpus.niveaux: tuple[NiveauCecrl, ...]` ;
  - `DescripteurCorpus.niveau: NiveauCecrl` ;
  - identifiant de la forme `^cecrl:...`.
- Les JSON CARCL ne sont consommés par aucun script applicatif.

Ces constats sont cohérents avec `docs/ia/US150-audit-preparation-ingestion.md` et `docs/architecture/gestion-corpus-cecrl-hsk.md`.

---

## 7. Éléments déjà fonctionnels

1. **Route réelle** : `POST /diagnostic/evaluer` est active, incluse dans l’application et appelée par le backend.
2. **Contrats stricts** : toutes les structures Pydantic refusent les champs inconnus et les types ambigus.
3. **Harness centralisé** : budget 45 s, timeout, catalogue d’erreurs, enveloppes succès/erreur, journalisation sans contenu sensible.
4. **Validation défensive** : sortie LLM revalidée, écart recalculé, preuves directes vérifiées, cohérence avec le contexte contrôlée.
5. **Prompt versionné** : `diagnostic/evaluation@1.1.0`, few-shot par scénario et langue, règles de prudence.
6. **LLM injectable** : factice, compatible OpenAI et Gemini ; client partagé créé au démarrage.
7. **Démonstration sans clé** : réponse déterministe et valide au sens du schéma, sans réseau.
8. **Port RAG propre** : l’agent dépend uniquement de `RecuperateurRAG`, pas d’une implémentation concrète.
9. **BM25 local** : implémentation déterministe, sans dépendance supplémentaire, avec intégrité corpus.
10. **Repli étiqueté** : provenance `synthetique_fallback` distincte d’un corpus officiel.
11. **Intégration backend** : appel HTTP best-effort et persistance de l’enveloppe complète dans `analyse_ia`.
12. **Suite de tests large** : 608 tests réussis localement.

---

## 8. Problèmes détectés

### 8.1 Divergences code / documentation

| Sujet | Documentation | Code réel |
| --- | --- | --- |
| Route diagnostic | `ia-service/README.md` affirme qu’aucune route d’inférence n’est exposée. | Route active dans `api/diagnostic.py` et `main.py:85`. |
| Budget | `README.md:189-190` annonce 15 000 ms. | `agents/diagnostic.py:45` : 45 000 ms. |
| Port 8001 publié | Plusieurs docs parlent d’un port publié. | `docker-compose.yml:120-122` supprime l’exposition et place le service sur `back-tier`. |
| Factice sans scénario | Un document affirme que Compose met `factice` sans scénario, donc 500. | `.env.example` et `docker-compose.yml:97-98` activent `LLM_FACTICE_SCENARIO=demonstration`. |
| Aucun descripteur fabriqué | `README.md:208-210`. | Vrai pour l’agent, faux pour le pipeline complet à cause de `RecuperateurAvecRepli`. |
| RAG hybride | Présenté comme extension possible, non retenu dans `docs/PRE-08-corpus-cecrl.md`. | Aucune implémentation ; documentation cohérente sur ce point précis. |

### 8.2 Provenance et traçabilité

- `RegistrePrompts.rendre_evaluation_diagnostic()` calcule une empreinte dynamique qui inclut l’exemple few-shot sélectionné (`prompts/registre.py:128-142`).
- Mais `MetaExecution.empreinte_prompt` reprend l’empreinte statique de la définition (`harness/execution.py:120`, issue de `agents/diagnostic.py:236`).
- L’enveloppe ne permet donc pas d’identifier exactement quel exemple few-shot a été injecté pour une requête donnée.

### 8.3 Intégration backend

- Le backend n’envoie ni `scenario` ni `memoire_pedagogique` (`backend/app/services/analyse_diagnostic.py:150-180`, `backend/app/schemas/ia.py:38-43`). Le scénario reste donc `quotidien` par défaut en production.
- `retryable` n’est pas exploité pour une reprise automatique : toute erreur IA est journalisée puis l’analyse revient `None` (`analyse_diagnostic.py:218-222`).

### 8.4 Limites actuelles du RAG

- Corpus désactivé par défaut.
- Descripteurs CECRL absents.
- Incohérence de casse `CECRL` / `cecrl`.
- Licence `non_clarifiee`.
- HSK non consommable.
- CARCL non consommé.
- Aucune ingestion OCR/transcription.
- Aucun embedding, aucun index vectoriel, aucune fusion hybride, aucun reranker.

---

## 9. Manques pour un RAG hybride BM25 + embeddings CECRL/HSK

### 9.1 Ce qui n’existe pas encore

| Manque | Constat |
| --- | --- |
| Modèle d’embedding | Aucun appel d’embedding dans `app/`, aucune dépendance dédiée dans `requirements.txt`. |
| Index vectoriel | Aucun FAISS, Chroma, pgvector ou service vectoriel. `rag/local.py:3-5` le dit explicitement. |
| Fusion hybride | Aucune fonction RRF, weighted score ou reranker. |
| Corpus HSK exploitable | Pas de manifeste HSK, pas de descripteurs HSK. |
| Modèle de corpus multi-référentiels | `corpus.py` est typé CECRL uniquement. |
| CECRL multilingue réel | Le manifeste ne contient que `en`. |
| CARCL | Aucun parseur applicatif. |
| OCR / transcription | Uniquement documentés comme nécessaires. |
| Traçabilité hybride | `MetaExecution` ne distingue pas `lexical`, `hybride`, `synthetique_fallback` et `A_VERIFIER` de façon explicite. |

Le champ `RequeteRAG.texte` est commenté comme pouvant servir à une recherche sémantique (`rag/base.py:45-46`), mais l’implémentation actuelle le traite uniquement comme une suite de jetons BM25 (`rag/local.py:119-127`). C’est un point d’extension, pas une fonctionnalité hybride.

### 9.2 Ce qu’il ne faut pas refondre

- Ne pas remplacer le Harness : il est déjà le bon point d’injection.
- Ne pas déplacer la logique LLM dans l’agent : le contrat `FournisseurLLM` suffit.
- Ne pas modifier `diagnostic/evaluation@1.1.0` dans le cadre de cette intégration : le prompt est déjà défensif et versionné.
- Ne pas ajouter d’accès PostgreSQL dans `ia-service` : le service reste sans état.
- Ne pas transformer le repli synthétique en référence officielle.

---

## 10. Modifications nécessaires pour l’intégration RAG

Les modifications ci-dessous sont **à réaliser plus tard**, après validation. Elles sont volontairement minimales et localisées au port RAG, à sa fabrique et aux métadonnées.

### 10.1 Modèle de corpus

1. Généraliser `ManifesteCorpus` et `DescripteurCorpus` pour accepter un `referentiel` explicite et les niveaux HSK.
2. Conserver une validation stricte : référentiel cohérent avec la langue, niveau cohérent avec le référentiel, identifiant unique, SHA256.
3. Prévoir un manifeste HSK léger avec : version, langues, niveaux, comptages, provenance des PDF/MP3, licence.
4. Corriger le chemin par défaut pour qu’il corresponde au dossier réel (`CECRL`) ou normaliser le dossier versionné en `cecrl`. Une seule convention doit être retenue.

### 10.2 Ingestion HSK / CARCL — hors runtime

1. Normaliser les textes issus des PDF et des transcriptions MP3 vers des descripteurs JSONL.
2. Garder la provenance par document source, page ou plage audio.
3. Ne pas exposer les fichiers volumineux dans Git ; le `.gitignore` actuel les exclut déjà.
4. Ne pas activer HSK tant que le gate juridique sur les droits n’est pas levé.

### 10.3 Récupérateur hybride

1. Ajouter une implémentation `RecuperateurHybride` conforme à `RecuperateurRAG`.
2. Composer :
   - le BM25 existant pour le score lexical ;
   - un score vectoriel issu d’un adaptateur d’embedding ;
   - une fusion déterministe, par exemple RRF avec `k` constant ;
   - un tri final total identique à celui du BM25 : score fusionné, compétence, source, identifiant.
3. Conserver la limite de huit descripteurs envoyée à l’agent.
4. Conserver le repli `RecuperateurAvecRepli` : un échec du mode hybride doit retomber sur des repères explicitement non officiels, jamais sur une référence HSK inventée.

### 10.4 Configuration et fabrique

1. Ajouter un flag `RAG_HYBRIDE_ACTIF` ou équivalent, désactivé par défaut.
2. Injecter l’adaptateur d’embedding et l’index via la fabrique uniquement.
3. Garder `RAG_CORPUS_ACTIF` pour le lexical seul afin de permettre une montée en charge progressive.
4. Exposer la version du corpus et le mode de récupération dans les métadonnées.

### 10.5 Métadonnées

Option minimale recommandée : ajouter un champ optionnel `mode_rag` à `MetaExecution`, avec des valeurs bornées :

```text
lexical | hybride | synthetique_fallback | a_verifier
```

`version_corpus` continue de porter la version du corpus. Cela évite de surcharger une chaîne de 32 caractères avec un format maison.

Option complémentaire : propager `rendu.empreinte_prompt` dans l’enveloppe afin que l’empreinte observée corresponde réellement au few-shot injecté.

---

## 11. Plan d’intégration minimal pour la démonstration

Aucune étape ci-dessous n’a été exécutée pendant cet audit.

### Étape 0 — Socle inchangé, verrouillage des garanties

- Garder `LLM_FOURNISSEUR=factice` et `LLM_FACTICE_SCENARIO=demonstration`.
- Garder le prompt `diagnostic/evaluation@1.1.0` tel quel.
- Vérifier que la suite de tests reste verte après chaque étape.
- Ne toucher ni à la base de données ni aux dépendances existantes.

**Critère d’acceptation :** `POST /diagnostic/evaluer` répond encore 200 sans clé ni réseau.

### Étape 1 — Rendre le corpus lexical réellement chargeable

- Harmoniser `CECRL` / `cecrl`.
- Produire un `descripteurs.jsonl` CECRL hors dépôt avec le script existant.
- Pointer `RAG_CORPUS_CHEMIN` vers ce dossier.
- Mettre `RAG_CORPUS_ACTIF=true` uniquement dans l’environnement de démonstration.

**Critère d’acceptation :** `meta.version_corpus` vaut `cecrl-2020.1`, pas `synthetique_fallback`, et les tests RAG restent verts.

### Étape 2 — Ajouter un jeu HSK minimal de démonstration

- Créer un manifeste HSK et quelques descripteurs HSK normalisés, avec provenance explicite.
- Étendre le modèle de corpus juste assez pour accepter `HSK` et ses niveaux.
- Ne pas brancher les 479 MP3 ni les 10 PDF complets dans cette étape.

**Critère d’acceptation :** une requête `zh/HSK` retourne des descripteurs HSK typés, ou `A_VERIFIER` si la source n’est pas encore exploitable ; jamais un repère synthétique présenté comme officiel.

### Étape 3 — Ajouter le récupérateur hybride derrière le port

- Implémenter `RecuperateurHybride` sans modifier `DiagnosticAgent`.
- Pour la démo, utiliser un petit index d’embedding pré-calculé ou un adaptateur clairement étiqueté comme démonstratif ; ne pas générer d’embedding pendant l’audit.
- Fusionner avec le BM25 existant par RRF déterministe.

**Critère d’acceptation :** avec le même corpus, les résultats hybrides sont stables d’un appel à l’autre et respectent la limite de huit descripteurs.

### Étape 4 — Brancher via la fabrique et exposer la provenance

- Activer le mode hybride par variable d’environnement.
- Ajouter `mode_rag` dans la métadonnée de réponse.
- Garder le repli synthétique pour les cas sans corpus.

**Critère d’acceptation :** l’enveloppe permet de distinguer `hybride`, `lexical`, `synthetique_fallback` et `A_VERIFIER`.

### Étape 5 — Tests de non-régression

Ajouter des cas ciblés :

- BM25 seul retourne des descripteurs CECRL ;
- hybride retourne des descripteurs CECRL et HSK ;
- fusion stable avec ex æquo ;
- HSK sans corpus → `A_VERIFIER` ;
- corpus corrompu → repli étiqueté ;
- agent inchangé : mêmes contrats d’entrée/sortie ;
- suite complète toujours verte.

---

## 12. Tests existants et résultats obtenus

### 12.1 Tests de l’agent et des contrats

| Fichier | Couverture |
| --- | --- |
| `ia-service/tests/test_agent_diagnostic.py` | Exécution complète, prompt reçu, few-shot, bornage des descripteurs, repli synthétique, provenance officielle/synthétique, `A_VERIFIER`, écart important, refus d’entrée, incohérences, preuves directes, erreurs RAG, HSK, définition enregistrée. |
| `ia-service/tests/test_diagnostic.py` | `ResultatDiagnostic`, niveaux, écart calculé, cohérence, preuves par domaine, phase Assimil. |
| `ia-service/tests/test_contexte.py` | Contexte minimal, HSK/CECRL, mémoire pédagogique, refus hors contrat. |
| `ia-service/tests/test_jeu_cas_diagnostic.py` | Jeux de cas diagnostic. |
| `ia-service/tests/test_exemples_json.py` | Validité des exemples JSON versionnés. |

### 12.2 Tests API et intégration HTTP

| Fichier | Couverture |
| --- | --- |
| `ia-service/tests/test_api_diagnostic.py` | Route `POST /diagnostic/evaluer`, statuts et enveloppes. |
| `ia-service/tests/test_llm_demonstration.py` | Réponse 200 sans clé ni réseau, dont un appel HTTP complet. |
| `ia-service/tests/test_main.py` | Initialisation de l’application et du Harness. |

### 12.3 Tests Harness, enveloppes et erreurs

| Fichier | Couverture |
| --- | --- |
| `ia-service/tests/test_harness.py` | Résolution, timeout, validation sortie, erreurs, metadata. |
| `ia-service/tests/test_registre.py` | Registre d’agents. |
| `ia-service/tests/test_commun.py` | Enveloppes communes. |
| `ia-service/tests/test_gestionnaire_erreurs.py` | Traduction des exceptions. |
| `ia-service/tests/test_codes_erreur.py` | Catalogue d’erreurs. |

### 12.4 Tests LLM et prompts

| Fichier | Couverture |
| --- | --- |
| `ia-service/tests/test_fabrique.py` | Sélection de l’adaptateur. |
| `ia-service/tests/test_llm_factice.py` | Client factice. |
| `ia-service/tests/test_llm_demonstration.py` | Répondeur déterministe. |
| `ia-service/tests/test_adaptateur_compatible_openai.py` | Adaptateur compatible OpenAI. |
| `ia-service/tests/test_adaptateur_gemini.py` | Adaptateur Gemini. |
| `ia-service/tests/test_config_llm.py` | Configuration LLM. |
| `ia-service/tests/test_prompts.py` | Chargement, version, rendu, empreinte. |
| `ia-service/tests/test_bibliotheque_few_shot.py` | Sélection par scénario/langue. |

Les tests `tests/integration/test_gemini_reel.py` et `tests/integration/test_groq_reel.py` nécessitent des clés externes et expliquent les deux éléments ignorés de la suite locale.

### 12.5 Tests RAG

| Fichier | Couverture |
| --- | --- |
| `ia-service/tests/test_rag_corpus.py` | Manifeste, SHA256, comptages, doublons, facettes. |
| `ia-service/tests/test_rag_local.py` | BM25, jetons, filtres, tri déterministe, HSK vide. |
| `ia-service/tests/test_rag_fabrique.py` | Activation, corpus absent, repli sur récupérateur vide. |
| `ia-service/tests/test_rag_repli.py` | Repères synthétiques, étiquetage, priorité du corpus réel. |
| `ia-service/tests/test_ingestion_cecrl.py` | Script d’ingestion hors dépôt. |

### 12.6 Résultat réel

```text
Commande : & '.venv/Scripts/python.exe' -m pytest --disable-warnings
Résultat : 608 passed, 2 skipped, 1 warning in 29.47s
```

Aucun test d’hybride n’existe aujourd’hui, puisque la fonctionnalité n’est pas implémentée.

---

## 13. Recommandations classées par priorité

### P0 — Bloquant avant toute activation RAG

1. **Ne pas activer le corpus réel tant que le chemin et les descripteurs ne sont pas corrigés.** Harmoniser `CECRL` / `cecrl` et produire le `descripteurs.jsonl` attendu hors dépôt.
2. **Ne pas brancher HSK avant d’avoir un manifeste HSK et des descripteurs HSK validés.** Le code actuel refuse HSK ; ce refus est une protection, pas un bug à contourner.
3. **Conserver le verrou juridique.** La licence CECRL est `non_clarifiee` ; les droits HSK/CARCL doivent être vérifiés avant ingestion ou exposition.
4. **Ne pas modifier le prompt `diagnostic/evaluation@1.1.0`** dans le cadre de l’intégration RAG : il impose déjà prudence et preuves directes.

### P1 — Intégration hybride minimale

5. **Implémenter `RecuperateurHybride` derrière `RecuperateurRAG`** et laisser l’agent inchangé.
6. **Utiliser une fusion déterministe** type RRF, avec tri final total et limite de huit descripteurs.
7. **Garder `RecuperateurAvecRepli`** et refuser tout repli HSK présenté comme officiel.
8. **Ajouter un `mode_rag` borné dans `MetaExecution`** pour distinguer lexical, hybride, repli synthétique et `A_VERIFIER`.
9. **Propager l’empreinte réelle du prompt rendu**, notamment le few-shot sélectionné, pour une traçabilité exacte.

### P2 — Complétions de qualité

10. **Faire remonter `scenario` et `memoire_pedagogique` depuis le backend** lorsque ces données sont disponibles ; le contrat IA les accepte déjà.
11. **Exploiter `retryable` côté backend** pour une reprise automatique sur les erreurs rejouables, sans changer la dégradation actuelle en résultat partiel.
12. **Corriger la documentation obsolète** : route diagnostic, budget 45 s, port non publié, factice avec scénario démonstration, réalité du repli synthétique.
13. **Ajouter les tests hybrides et HSK** avant toute activation : stabilité, provenance, cas vide, corpus corrompu, contrat inchangé.
14. **Ne lancer OCR/transcription CARCL/HSK qu’après le gate juridique** et avec des artefacts intermédiaires versionnés uniquement pour les manifestes et scripts légers.

### À ne pas faire

- Ne pas remplacer le Harness.
- Ne pas mettre d’embedding ou de base vectorielle dans l’agent.
- Ne pas supprimer les validations Pydantic existantes.
- Ne pas transformer un repère synthétique en descripteur officiel.
- Ne pas committer les PDF, MP3 ou gros JSONL de corpus.

---

## 14. État Git final de l’audit

- Branche : `feature/PRE-13-audit-agent-diagnostique-rag`.
- HEAD de départ : `86c529f`.
- Aucun commit et aucune PR créés pour cet audit.
- Aucun fichier applicatif modifié.
- Seul ce document est ajouté.
- Les dossiers non suivis préexistants `ia-service/corpus/CECRL/{Deutsch,anglais,français,italian}/` ont été préservés.
