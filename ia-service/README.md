# Service IA — Centre de Langues IA

Microservice FastAPI interne (`ia-service/`). Le backend reste propriétaire des sessions, du scoring et du contrat
public ; ce service ne fait que produire des estimations pédagogiques (diagnostic linguistique, puis les autres
agents du Harness).

## État

- `GET /health` : squelette de déploiement conservé (healthcheck Docker et CI).
- `POST /chatbot/message` : premier endpoint d'inférence, connecté au modèle via l'agent `chatbot` du Harness (US67).
- `app/schemas/` : contrat interne validé par Pydantic (US-151) — enveloppes du Harness, contexte apprenant, résultat
  du diagnostic et erreurs standardisées.
- `app/core/` : configuration du client LLM (`SecretStr`, variables d'environnement), catalogue des codes d'erreur,
  exceptions typées, politique de reprise et gestionnaire d'erreurs central (US-69, US-154).
- `app/llm/` : client LLM fournisseur-agnostique, fabrique et adaptateurs `factice`, `compatible-openai` et Gemini
  (US-69).
- `app/harness/` : définition d'agent, registre et pipeline commun d'exécution (US-69).
- `app/prompts/` : registre partagé et prompts versionnés `diagnostic/evaluation@1.1.0` (US30) et
  `chatbot/conversation@1.0.0` (US67).
- `app/prompts/exemples/diagnostic/` : bibliothèque few-shot synthétique triée par scénario et langue (US71).
- `app/rag/` : port `RecuperateurRAG`, récupérateur neutre `RecuperateurVide` (US29) et, derrière
  `RAG_CORPUS_ACTIF`, corpus CECRL local et `RecuperateurLocal` BM25 (PRE-08).
- `app/agents/` : agents Diagnostic (`diagnostic@1.0.0`, US29) et chatbot (`chatbot@1.0.0`, US67), enregistrés
  au démarrage. Seul `POST /chatbot/message` est exposé ; l'agent Diagnostic n'a pas encore de route HTTP.

## Client LLM et Harness (US-69)

Un seul client LLM est partagé par processus. Aucun fournisseur n'est imposé : le code métier ne connaît que le
contrat `FournisseurLLM`. Aucun accès à la base de données, aucun stockage permanent de mémoire apprenant.

### Pipeline du Harness

1. résolution de `(code, version)` dans le registre (dernière version SemVer si absente) ;
2. revalidation de l'entrée contre le schéma de l'agent ;
3. préparation des `OutilsCommuns` (client LLM partagé, registre de prompts, récupérateur RAG, horloge) et du
   `ContexteExecution` ;
4. exécution sous budget (`asyncio.timeout`) ;
5. validation de la sortie de l'agent ;
6. enveloppe `ReponseAgent` normalisée, ou `ReponseErreur` avec un code stable.

### Configuration

Toutes les valeurs viennent de l'environnement ; aucune clé n'est écrite dans le code. Les clés `LLM_API_KEY` et
`GEMINI_API_KEY` sont des `SecretStr` : elles n'apparaissent ni dans `repr`, ni dans les erreurs, ni dans les
journaux. Le fournisseur principal est **Groq** via son API compatible OpenAI (`LLM_FOURNISSEUR=compatible-openai`) ;
**Gemini** reste disponible comme alternative (`LLM_FOURNISSEUR=gemini`). Pour Gemini, `GEMINI_MODEL` attend
l'identifiant du modèle (par exemple `gemini-3.5-flash-lite`), pas son nom d'affichage, et doit correspondre à un
modèle activé pour le compte Google utilisé. Aucun changement de code n'est nécessaire pour changer de fournisseur.

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `ENVIRONNEMENT` | `dev` | `dev`, `test` ou `prod` ; `prod` interdit le fournisseur `factice` |
| `LLM_FOURNISSEUR` | `factice` | `factice`, `compatible-openai` ou `gemini` |
| `LLM_MODELE` | — | nom du modèle, obligatoire pour `compatible-openai` |
| `LLM_BASE_URL` | — | racine de l'API, obligatoire pour `compatible-openai` |
| `LLM_API_KEY` | — | clé de `compatible-openai`, jamais journalisée |
| `GEMINI_MODEL` | — | identifiant du modèle Gemini disponible pour le compte |
| `GEMINI_API_KEY` | — | clé Google Gemini, jamais journalisée |
| `LLM_TEMPERATURE` | `0.2` | entre 0 et 2 |
| `LLM_MAX_TOKENS` | `600` | entre 1 et 8 192 |
| `LLM_TIMEOUT` | `12` | délai d'un appel, entre 0 exclu et 120 secondes (`LLM_TIMEOUT_S` reste accepté) |
| `LLM_MAX_RETRIES` | `1` | reprises sur erreur temporaire, entre 0 et 3 |
| `LLM_REPRISE_DELAI_S` | `0.5` | délai initial entre deux tentatives, entre 0 et 10 secondes |
| `LLM_REPRISE_DELAI_MAX_S` | `4` | plafond d'une attente, entre 0 et 60 secondes |
| `LLM_BUDGET_TOTAL_S` | `30` | budget total d'un appel, reprises comprises, entre 0 exclu et 600 secondes |

### Utilisation

```python
from app.llm.base import MessageLLM
from app.llm.fabrique import obtenir_client
from app.schemas.diagnostic import ResultatDiagnostic

client = obtenir_client()
resultat, meta = await client.generer_json(
    [MessageLLM(role="user", contenu="Évalue cette réponse…")],
    schema=ResultatDiagnostic,
)
```

```python
from app.harness.execution import Harness
from app.harness.registre import RegistreAgents

harness = Harness(RegistreAgents(), obtenir_client())
reponse = await harness.executer("diagnostic", requete)  # ReponseAgent ou ReponseErreur
```

### Vérification locale Groq (fournisseur principal)

Les scripts chargent automatiquement le `.env` racine s'il existe, sans remplacer une variable déjà définie et sans
afficher aucune valeur. Depuis `ia-service`, avec `LLM_FOURNISSEUR=compatible-openai`,
`LLM_MODELE=openai/gpt-oss-20b`, `LLM_BASE_URL=https://api.groq.com/openai/v1` et `LLM_API_KEY` renseignée dans le
`.env` racine :

```powershell
python -m scripts.verifier_groq
```

Le script vérifie le fournisseur et l'hôte Groq, envoie un prompt fixe non sensible et affiche le fournisseur, le
modèle, l'URL, la latence et la réponse. Il ne lit ni n'affiche la clé.

### Vérification locale Gemini (alternative)

```powershell
python -m scripts.verifier_gemini
```

Avec `LLM_FOURNISSEUR=gemini`, `GEMINI_MODEL` (identifiant du modèle, pas son nom d'affichage) et `GEMINI_API_KEY`
définis dans le `.env` racine ou exportés dans l'environnement. Le script envoie un prompt fixe non sensible et
affiche le fournisseur, le modèle, la latence et la réponse. Il ne lit ni n'affiche la clé, et ne journalise pas le
prompt. Ne remplacez les valeurs factices que dans l'environnement local, jamais dans le dépôt.

Avec Docker, renseignez les mêmes variables dans le `.env` à la racine (copié depuis `.env.example`), puis démarrez
le service : `docker compose up --build -d --wait ia-service`. Compose transmet au service IA uniquement les
paramètres nécessaires ; les clés LLM sont laissées vides côté Backend. Le Dockerfile ne contient aucune clé.
Après une modification de dépendances, reconstruisez l'image ; un changement de configuration seul ne requiert
qu'un redémarrage du conteneur.

L'image de production précompile le bytecode Python au build. Avec `uvicorn --workers`, le superviseur tue puis
relance un worker qui ne répond pas à son ping en 5 secondes ; une compilation à froid sur une machine lente peut
dépasser ce délai et produire des messages « Child process died » sans traceback, suivis d'un démarrage réussi
après reprise. La précompilation supprime cette course au premier démarrage.

### Erreurs fréquentes

- `LLM_CONFIGURATION` au démarrage : vérifiez `LLM_FOURNISSEUR` et les paramètres du fournisseur choisi
  (`LLM_MODELE`, `LLM_BASE_URL`, `LLM_API_KEY` pour Groq ; `GEMINI_MODEL`, `GEMINI_API_KEY` pour Gemini).
- `LLM_AUTHENTIFICATION` (401/403) : vérifiez la clé du fournisseur actif et ses droits.
- `LLM_REQUETE_INVALIDE` (400/404) : le modèle peut être indisponible ou mal nommé ; pour Groq, vérifiez
  `LLM_MODELE=openai/gpt-oss-20b` et `LLM_BASE_URL=https://api.groq.com/openai/v1` ; pour Gemini, remplacez
  `GEMINI_MODEL` par un identifiant auquel le compte a accès.
- `LLM_LIMITE_REQUETES` (429) : vérifiez le quota et la limite de débit du compte. Les reprises restent bornées et
  ne s'appliquent qu'aux erreurs temporaires.
- `LLM_TIMEOUT` : augmentez `LLM_TIMEOUT` dans sa limite configurée, tout en gardant un budget total cohérent dans
  `LLM_BUDGET_TOTAL_S`.

### Tests sans clé API

`FakeLLMClient` est déterministe et ne fait aucun appel réseau. Les scénarios sont consommés dans l'ordre, ce qui
permet de simuler un succès, un JSON invalide, un timeout ou une indisponibilité :

```python
from app.llm.adaptateurs.factice import FakeLLMClient, ScenarioLLM

client = FakeLLMClient([ScenarioLLM(reponse={"niveau_estime": "B2"})])
```

### Prompts versionnés (US70)

Le registre partagé charge et valide `diagnostic/evaluation@1.1.0` au démarrage (les ressources `1.0.0` restent
archivées, non chargées). Il expose les deux messages prêts
pour `FournisseurLLM`, la version, l'empreinte SHA-256, la température et le nombre maximal de tokens. Le template
exige exactement les sept variables déclarées et sérialise chaque valeur dynamique en JSON, en échappant les
marqueurs HTML susceptibles de fermer le bloc des données non fiables.

```python
rendu = contexte.outils.registre_prompts.rendre_evaluation_diagnostic(variables)
resultat, meta = await contexte.outils.client_llm.generer_json(
    rendu.messages,
    schema=ResultatDiagnostic,
    temperature=rendu.temperature,
    max_tokens=rendu.max_tokens,
)
```

Le prompt et ses variables sont détaillés dans
[`docs/US-70-prompt-diagnostic.md`](docs/US-70-prompt-diagnostic.md). Le score préliminaire reste celui du backend ;
en cas de preuves insuffisantes, le prompt applique une sortie prudente compatible avec le schéma Pydantic actuel.
Les points faibles justifiés et la phase Assimil sont détaillés dans
[`docs/US-30-points-faibles-phase-assimil.md`](docs/US-30-points-faibles-phase-assimil.md).

### Bibliothèque few-shot (US71)

La bibliothèque versionnée couvre les scénarios `quotidien`, `entretien` et `examen` pour les cinq langues du
référentiel. `BibliothequeFewShot.selectionner(scenario, code_langue)` valide le catalogue au démarrage puis
retourne un unique exemple exact ; il n'y a pas de repli vers une autre langue ou un autre scénario. Le rendu du
prompt sélectionne ces exemples automatiquement à partir de `VariablesEvaluationDiagnostic.scenario` et
`code_langue`.

Les exemples sont anonymes et synthétiques. Leurs descripteurs sont seulement illustratifs, pas des descripteurs
officiels : le RAG reste l'unique source de référence normative. Voir
[`docs/US-71-bibliotheque-few-shot.md`](docs/US-71-bibliotheque-few-shot.md) pour le schéma, la sélection, la
validation et les limites.

### Agent Diagnostic (US29)

`DiagnosticAgent` est le premier agent métier enregistré dans le registre partagé (`diagnostic@1.0.0`, budget
15 000 ms). Il reçoit les réponses du test (`EntreeDiagnostic`), le score et le niveau préliminaire du backend, puis :

1. interroge le port `RecuperateurRAG` (langue, référentiel, niveau, compétences, texte borné à 4 000 caractères) ;
2. filtre les descripteurs (contexte, doublons, plafond de 8) ;
3. laisse le registre sélectionner le few-shot du scénario et de la langue ;
4. rend `diagnostic/evaluation@1.1.0` et appelle le client LLM partagé ;
5. vérifie la cohérence du résultat avec le contexte, puis que chaque point faible cite une preuve directe
   disponible (US30) ;
6. signale un écart d'au moins deux niveaux avec le niveau préliminaire.

Chaque point faible porte un `domaine` (six valeurs du contrat public), l'`id_question` citée, une `observation`
factuelle et une `justification` prudente. La phase `activation` exige au moins une production libre (`texte` ou
`audio`) ; `impregnation` reste valide avec des choix seuls. Les anciennes valeurs `passive`/`active` sont refusées.

```python
reponse = await harness.executer("diagnostic", requete)  # ReponseAgent[ResultatDiagnostic] ou ReponseErreur
```

`RecuperateurVide` retourne une séquence vide tant que le corpus n'est pas branché : le prompt applique sa règle de
prudence et l'agent ne fabrique aucun descripteur. Le score objectif du backend n'est jamais recalculé, aucune
donnée n'est persistée et aucune route d'inférence n'est encore exposée. Voir
[`docs/US-29-agent-diagnostic.md`](docs/US-29-agent-diagnostic.md) et
[`docs/US-30-points-faibles-phase-assimil.md`](docs/US-30-points-faibles-phase-assimil.md) pour l'entrée, le
pipeline, les preuves, les erreurs et l'exemple complet requête/réponse.

### Corpus CECRL local (PRE-08)

Le RAG documentaire peut s'appuyer sur un corpus CECRL local, **désactivé par défaut**. Sans corpus, le service
conserve `RecuperateurVide` : le prompt applique sa règle de prudence et l'agent ne fabrique aucun descripteur.

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `RAG_CORPUS_ACTIF` | `false` | Charge le corpus au démarrage |
| `RAG_CORPUS_CHEMIN` | `corpus/cecrl` | Dossier contenant `manifeste.json` et `descripteurs.jsonl` |
| `RAG_CORPUS_VERIFIER_EMPREINTE` | `true` | Vérifie le SHA256 du fichier de descripteurs |

Seul `corpus/cecrl/manifeste.json` est versionné : les descripteurs officiels restent un artefact privé, généré
hors dépôt par `python -m scripts.ingestion_cecrl` (voir [`corpus/README.md`](corpus/README.md)). Le manifeste
porte la version, la source, le statut juridique et l'empreinte du fichier attendu.

- `CorpusCecrl.charger` valide le manifeste, chaque ligne JSONL et les comptages ; toute anomalie lève
  `ErreurCorpusIndisponible` plutôt que de servir un index partiel.
- `RecuperateurLocal` classe les descripteurs par score BM25 après filtrage par langue, niveau et compétence ;
  l'ordre de tri est total, donc reproductible.
- Les niveaux `A2+`, `B1+` et `B2+` sont normalisés vers leur niveau de base et conservent l'étiquette d'origine
  dans `sous_niveau`.
- Le mandarin (`zh`, HSK) n'a aucun descripteur CECRL : la recherche retourne une séquence vide.
- Le corpus distingue `lexique`, absent du contrat `Competence` : ces échelles restent candidates pour toute
  compétence demandée et sont étiquetées avec la compétence de la requête.
- Une requête sans terme exploitable, un corpus absent ou incohérent donnent une séquence vide, jamais une
  sélection arbitraire ; le service démarre toujours.

Voir [`docs/PRE-08-corpus-cecrl.md`](docs/PRE-08-corpus-cecrl.md) pour l'architecture, la procédure d'ingestion,
les tests et les limites liées aux droits documentaires.

### Correspondance des erreurs

Le catalogue complet (messages publics, statuts HTTP, caractère rejouable) est décrit dans
[`docs/codes-erreur-ia.md`](docs/codes-erreur-ia.md). Résumé :

| Situation | Code | Rejouable |
| --- | --- | --- |
| Agent ou version absent | `AGENT_INCONNU` | non |
| Entrée non conforme au schéma | `ENTREE_INVALIDE` | non |
| Budget dépassé ou timeout LLM | `LLM_TIMEOUT` | oui |
| Fournisseur injoignable, erreur réseau ou 5xx | `LLM_INDISPONIBLE` | oui |
| Limitation de débit du fournisseur (429) | `LLM_LIMITE_REQUETES` | oui |
| Clé refusée (401/403) | `LLM_AUTHENTIFICATION` | non |
| Requête refusée (400/404/422/3xx) | `LLM_REQUETE_INVALIDE` | non |
| Configuration LLM absente ou incohérente | `LLM_CONFIGURATION` | non |
| Prompt versionné absent | `PROMPT_INTROUVABLE` | non |
| Corpus RAG absent, en panne ou incohérent | `CORPUS_INDISPONIBLE` | oui |
| JSON LLM ou sortie d'agent invalide | `LLM_REPONSE_INVALIDE` | oui |
| Exception imprévue | `ERREUR_INTERNE` (message générique) | non |

Les messages d'erreur sont fixes : ils ne recopient ni l'entrée, ni le contexte, ni la réponse du fournisseur.

## API du chatbot (US67)

`POST /chatbot/message` reçoit l'enveloppe commune `RequeteAgent[EntreeChatbot]` (contexte apprenant, message, court
historique renvoyé par le backend) et retourne `ReponseAgent[ResultatChatbot]`. La route ne contient aucune logique :
elle confie la requête au Harness, qui exécute l'agent `chatbot` avec le client LLM partagé.

```bash
curl -X POST localhost:8001/chatbot/message -H 'Content-Type: application/json' -d '{
  "request_id": "3f1c9b7e-6a2d-4f0e-9c1a-2b7d5e8f4a10",
  "contexte": {"code_langue": "en", "referentiel": "CECRL", "niveau_preliminaire": "A2"},
  "entree": {"message": "How long I study English?", "historique": []}
}'
# → 200 {"statut": "succes", "resultat": {"reponse": "…"}, "meta": {…}, …}
```

Une erreur du Harness garde l'enveloppe `ReponseErreur` avec le statut HTTP du catalogue (504, 503, 502…). Un corps
hors contrat renvoie `422 ENTREE_INVALIDE` sans recopier le message reçu. Avec le fournisseur `factice` par défaut,
aucun scénario n'est préparé : la route répond `500 LLM_CONFIGURATION` tant qu'un vrai fournisseur n'est pas
configuré. Détails : [`docs/US-67-api-chatbot.md`](docs/US-67-api-chatbot.md).

## Gestion des erreurs et des reprises (US-154)

Trois modules portent la fiabilité du service :

- `app/core/codes_erreur.py` — catalogue unique : chaque code a un message public, un caractère rejouable et un
  statut HTTP. `retryable` est **déduit** de `CODES_RETRYABLES`, jamais saisi à la main ;
- `app/core/reprise.py` — `PolitiqueReprise` et `reessayer` : délai exponentiel plafonné, `Retry-After` respecté,
  jitter ≤ 10 %, budget vérifié avant l'attente. Seules les erreurs rejouables sont retentées ;
- `app/core/gestionnaire_erreurs.py` — traduction exception → `{code, message, retryable}`, journalisation expurgée
  et handlers FastAPI (métier et dernier recours).

L'adaptateur HTTP ne fait plus qu'**une** tentative : il lève une exception typée (`ErreurLlmTimeout`,
`ErreurLlmIndisponible`, `ErreurLlmLimiteRequetes`, `ErreurLlmAuthentification`, `ErreurLlmRequete`,
`ErreurReponseLlm`) et la boucle commune décide de la suite. `generer_json` est enveloppé dans
`asyncio.timeout(LLM_BUDGET_TOTAL_S)` : une requête rend toujours la main. `generer_flux` n'est jamais rejoué (des
morceaux ont déjà pu être affichés) et reste borné par le délai `httpx`.

Aucune réponse ne contient de trace Python, de clé d'API ni de contenu de requête. Une erreur d'authentification ou
de validation est définitive : la rejouer gaspillerait du budget sans corriger la cause.

## Contrat des modèles

[`docs/contrat-modeles-ia.md`](docs/contrat-modeles-ia.md) : valeurs autorisées, bornes, cohérences vérifiées,
exemples JSON valides et invalides, politique d'extension aux neuf agents.

Règles principales :

- `extra="forbid"` partout : aucun JSON arbitraire, y compris dans les objets imbriqués ;
- aucune donnée personnelle (ni nom, ni e-mail, ni identifiant d'apprenant) ;
- aucun accès PostgreSQL, aucune décision métier : le service propose, le backend arbitre ;
- les niveaux, langues, compétences et phases proviennent du référentiel existant, jamais d'une valeur inventée.

## Tests

```bash
cd ia-service
pip install -r requirements-dev.txt
pytest --cov=app --cov-report=term-missing --cov-fail-under=70
ruff check . && ruff format --check .
```

Les tests unitaires n'appellent aucun service externe, ne nécessitent aucune clé API et n'utilisent pas de base de
données. L'adaptateur HTTP est vérifié avec `httpx.MockTransport`. Les exemples JSON de `tests/exemples/` sont
validés par les tests : un exemple invalide doit échouer pour la raison documentée.

Le test réel Gemini de `tests/integration/` est ignoré par défaut. Pour l'activer volontairement, configurez
`LLM_FOURNISSEUR`, `GEMINI_MODEL` et `GEMINI_API_KEY`, puis définissez `TEST_GEMINI_INTEGRATION=1` :

```powershell
$env:TEST_GEMINI_INTEGRATION = "1"
$env:LLM_FOURNISSEUR = "gemini"
$env:GEMINI_MODEL = "<modèle activé pour votre compte>"
$env:GEMINI_API_KEY = "<clé fournie par Google>"
python -m pytest tests/integration/test_gemini_reel.py
```

Ce test envoie une requête réelle et peut consommer du quota ; ne l'activez pas dans la suite automatisée habituelle.

## Structure

```
app/
├── main.py              # application FastAPI, lifespan, agents enregistrés et handlers d'erreurs
├── agents/
│   └── chatbot.py       # agent chatbot : prompt de conversation + réponse JSON validée (US67)
├── api/
│   └── chatbot.py       # POST /chatbot/message (US67)
├── core/
│   ├── config.py        # configuration LLM (pydantic-settings) et politique de reprise
│   ├── codes_erreur.py  # catalogue des codes publics (message, retryable, statut HTTP)
│   ├── erreurs.py       # exceptions typées portant leur code
│   ├── reprise.py       # politique de reprise bornée (délais, budget, jitter)
│   └── gestionnaire_erreurs.py # exception → {code, message, retryable}, journalisation, handlers
├── harness/
│   ├── agent.py         # DefinitionAgent, OutilsCommuns, ContexteExecution
│   ├── registre.py      # résolution par code et version SemVer
│   └── execution.py     # pipeline commun, validation, erreurs normalisées
├── agents/
│   ├── __init__.py
│   └── diagnostic.py    # EntreeDiagnostic, DiagnosticAgent, définition enregistrée
├── rag/
│   ├── base.py          # port RecuperateurRAG et RequeteRAG
│   ├── vide.py          # RecuperateurVide (aucun corpus)
│   ├── corpus.py        # manifeste, descripteurs et chargement validé du corpus CECRL
│   ├── local.py         # RecuperateurLocal BM25 déterministe (PRE-08)
│   ├── config.py        # RAG_CORPUS_ACTIF, RAG_CORPUS_CHEMIN, RAG_CORPUS_VERIFIER_EMPREINTE
│   └── fabrique.py      # construire_recuperateur : local si activé et valide, sinon vide
├── prompts/
│   ├── registre.py      # chargement, empreinte et rendu des prompts
│   ├── bibliotheque_few_shot.py  # sélection scénario/langue
│   └── diagnostic/      # ressources versionnées du prompt
├── llm/
│   ├── base.py          # protocole FournisseurLLM et types de réponse
│   ├── fabrique.py      # sélection et instance unique du client
│   └── adaptateurs/
│       ├── factice.py           # FakeLLMClient (tests, hors ligne)
│       ├── compatible_openai.py # HTTP + SSE, sans SDK propriétaire
│       └── gemini.py            # SDK Google officiel, génération async et validation Pydantic
├── scripts/
│   └── verifier_gemini.py       # vérification locale, sans route HTTP
├── prompts/             # registre et ressources versionnées (diagnostic/, chatbot/)
└── schemas/             # modèles Pydantic du contrat interne
tests/
├── exemples/            # charges utiles valides et invalides
├── integration/         # test réel Gemini, opt-in
└── test_*.py
```

`ia-service/models/` reste réservé aux artefacts ML montés en lecture seule ; il ne contient pas de modèles Pydantic.

## Documentation

- [`docs/US-29-agent-diagnostic.md`](docs/US-29-agent-diagnostic.md) — agent Diagnostic : entrée, port RAG,
  pipeline, écart important, erreurs, exemple complet et limites.
- [`docs/US-152-jeu-cas-test-diagnostic.md`](docs/US-152-jeu-cas-test-diagnostic.md) — jeu de cas synthétiques,
  tests déterministes, critères de revue humaine et limites.
- [`docs/US-69-llm-client-harness.md`](docs/US-69-llm-client-harness.md) — bilan de la tâche, interfaces, décisions,
  tests et extension aux neuf agents.
- [`docs/US-67-api-chatbot.md`](docs/US-67-api-chatbot.md) — contrat de `POST /chatbot/message`, erreurs, décisions
  et vérifications.
- [`docs/US-154-timeouts-erreurs-llm.md`](docs/US-154-timeouts-erreurs-llm.md) — timeouts, reprises bornées,
  gestionnaire d'erreurs, tests et limites.
- [`docs/codes-erreur-ia.md`](docs/codes-erreur-ia.md) — catalogue des codes d'erreur et garanties de
  non-divulgation.
- [`docs/contrat-modeles-ia.md`](docs/contrat-modeles-ia.md) — contrat interne détaillé.
- [`docs/PRE-08-corpus-cecrl.md`](docs/PRE-08-corpus-cecrl.md) — corpus CECRL local : manifeste, chargeur,
  récupérateur BM25, configuration, procédure d'ingestion, tests et limites de droits.
