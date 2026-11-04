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
- `app/llm/` : client LLM fournisseur-agnostique, fabrique, adaptateur `factice` et adaptateur `compatible-openai`
  (US-69).
- `app/harness/` : définition d'agent, registre et pipeline commun d'exécution (US-69).
- `app/prompts/` : registre partagé et ressources versionnées des prompts `diagnostic/evaluation@1.0.0` (US70) et
  `chatbot/conversation@1.0.0` (US67).
- `app/agents/` : agents enregistrés dans le Harness au démarrage — pour l'instant `chatbot@1.0.0` (US67).

## Client LLM et Harness (US-69)

Un seul client LLM est partagé par processus. Aucun fournisseur n'est imposé : le code métier ne connaît que le
contrat `FournisseurLLM`. Aucun accès à la base de données, aucun stockage permanent de mémoire apprenant.

### Pipeline du Harness

1. résolution de `(code, version)` dans le registre (dernière version SemVer si absente) ;
2. revalidation de l'entrée contre le schéma de l'agent ;
3. préparation des `OutilsCommuns` (client LLM partagé, registre de prompts, horloge) et du `ContexteExecution` ;
4. exécution sous budget (`asyncio.timeout`) ;
5. validation de la sortie de l'agent ;
6. enveloppe `ReponseAgent` normalisée, ou `ReponseErreur` avec un code stable.

### Configuration

Toutes les valeurs viennent de l'environnement ; aucune clé n'est écrite dans le code. `LLM_API_KEY` est un
`SecretStr` : il n'apparaît ni dans `repr`, ni dans les erreurs, ni dans les journaux.

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `ENVIRONNEMENT` | `dev` | `dev`, `test` ou `prod` ; `prod` interdit le fournisseur `factice` |
| `LLM_FOURNISSEUR` | `factice` | `factice` ou `compatible-openai` |
| `LLM_MODELE` | — | nom du modèle (obligatoire hors `factice`) |
| `LLM_BASE_URL` | — | racine de l'API, par exemple `https://api.openai.com/v1` |
| `LLM_API_KEY` | — | clé d'API (obligatoire hors `factice`) |
| `LLM_TEMPERATURE` | `0.2` | entre 0 et 2 |
| `LLM_MAX_TOKENS` | `600` | entre 1 et 8 192 |
| `LLM_TIMEOUT_S` | `12` | délai d'un appel, entre 0 exclu et 120 secondes |
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

### Tests sans clé API

`FakeLLMClient` est déterministe et ne fait aucun appel réseau. Les scénarios sont consommés dans l'ordre, ce qui
permet de simuler un succès, un JSON invalide, un timeout ou une indisponibilité :

```python
from app.llm.adaptateurs.factice import FakeLLMClient, ScenarioLLM

client = FakeLLMClient([ScenarioLLM(reponse={"niveau_estime": "B2"})])
```

### Prompts versionnés (US70)

Le registre partagé charge et valide `diagnostic/evaluation@1.0.0` au démarrage. Il expose les deux messages prêts
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

Les tests n'appellent aucun service externe, ne nécessitent aucune clé API et n'utilisent pas de base de données.
L'adaptateur HTTP est vérifié avec `httpx.MockTransport`. Les exemples JSON de `tests/exemples/` sont validés par
les tests : un exemple invalide doit échouer pour la raison documentée.

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
├── llm/
│   ├── base.py          # protocole FournisseurLLM et types de réponse
│   ├── fabrique.py      # sélection et instance unique du client
│   └── adaptateurs/
│       ├── factice.py           # FakeLLMClient (tests, hors ligne)
│       └── compatible_openai.py # HTTP + SSE, sans SDK propriétaire
├── prompts/             # registre et ressources versionnées (diagnostic/, chatbot/)
└── schemas/             # modèles Pydantic du contrat interne
tests/
├── exemples/            # charges utiles valides et invalides
└── test_*.py
```

`ia-service/models/` reste réservé aux artefacts ML montés en lecture seule ; il ne contient pas de modèles Pydantic.

## Documentation

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
