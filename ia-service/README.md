# Service IA — Centre de Langues IA

Microservice FastAPI interne (`ia-service/`). Le backend reste propriétaire des sessions, du scoring et du contrat
public ; ce service ne fait que produire des estimations pédagogiques (diagnostic linguistique, puis les autres
agents du Harness).

## État

- `GET /health` : squelette de déploiement conservé (healthcheck Docker et CI).
- `app/schemas/` : contrat interne validé par Pydantic (US-151) — enveloppes du Harness, contexte apprenant, résultat
  du diagnostic et erreurs standardisées.
- `app/core/` : configuration du client LLM (`SecretStr`, variables d'environnement) et exceptions internes (US-69).
- `app/llm/` : client LLM fournisseur-agnostique, fabrique, adaptateur `factice` et adaptateur `compatible-openai`
  (US-69).
- `app/harness/` : définition d'agent, registre et pipeline commun d'exécution (US-69).

## Client LLM et Harness (US-69)

Un seul client LLM est partagé par processus. Aucun fournisseur n'est imposé : le code métier ne connaît que le
contrat `FournisseurLLM`. Aucun accès à la base de données, aucun stockage permanent de mémoire apprenant.

### Pipeline du Harness

1. résolution de `(code, version)` dans le registre (dernière version SemVer si absente) ;
2. revalidation de l'entrée contre le schéma de l'agent ;
3. préparation des `OutilsCommuns` (client LLM partagé, horloge) et du `ContexteExecution` ;
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
| `LLM_TIMEOUT_S` | `12` | entre 0 et 120 secondes |
| `LLM_MAX_RETRIES` | `1` | reprises sur `429/500/502/503/504`, entre 0 et 3 |

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

### Correspondance des erreurs

| Situation | Code | Rejouable |
| --- | --- | --- |
| Agent ou version absent | `AGENT_INCONNU` | non |
| Entrée non conforme au schéma | `ENTREE_INVALIDE` | non |
| Budget dépassé ou timeout LLM | `LLM_TIMEOUT` | oui |
| Fournisseur injoignable ou configuration invalide | `LLM_INDISPONIBLE` | oui |
| JSON LLM ou sortie d'agent invalide | `LLM_REPONSE_INVALIDE` | oui |
| Exception imprévue | `ERREUR_INTERNE` (message générique) | non |

Les messages d'erreur sont fixes : ils ne recopient ni l'entrée, ni le contexte, ni la réponse du fournisseur.

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
├── main.py              # application FastAPI et lifespan (client partagé)
├── core/
│   ├── config.py        # configuration LLM (pydantic-settings)
│   └── erreurs.py       # exceptions internes
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
└── schemas/             # modèles Pydantic du contrat interne
tests/
├── exemples/            # charges utiles valides et invalides
└── test_*.py
```

`ia-service/models/` reste réservé aux artefacts ML montés en lecture seule ; il ne contient pas de modèles Pydantic.

## Documentation

- [`docs/US-69-llm-client-harness.md`](docs/US-69-llm-client-harness.md) — bilan de la tâche, interfaces, décisions,
  tests et extension aux neuf agents.
- [`docs/contrat-modeles-ia.md`](docs/contrat-modeles-ia.md) — contrat interne détaillé.
