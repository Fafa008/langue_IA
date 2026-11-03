# US-69 — Client LLM et Agent Harness

| Élément | Valeur |
| --- | --- |
| User Story | US-69 |
| Branche | `feature/US69-llm-client-harness` |
| Base | `develop` (`0df9834`, après fusion de l'US-151) |
| Statut | Implémenté, testé, documenté — en attente de revue |
| Périmètre | `ia-service/app/core/`, `app/llm/`, `app/harness/`, `app/main.py` et leurs tests |
| Contrat des modèles | [`contrat-modeles-ia.md`](contrat-modeles-ia.md) (US-151) |

## 1. Objectif

Le service IA doit héberger neuf agents qui partageront un seul Harness et un seul client LLM. Le fournisseur LLM
n'étant pas encore choisi, le code métier ne doit dépendre d'aucun SDK ni d'aucune API propriétaire.

L'US livre ce socle :

- un contrat de client LLM indépendant du fournisseur (JSON structuré, streaming, configuration, clé lue dans
  l'environnement) ;
- un registre qui résout un agent par identifiant et version ;
- un Harness qui applique le même pipeline à tous les agents et retourne toujours une enveloppe standardisée ;
- un client simulé pour tester sans clé API ;
- les tests unitaires, la documentation et la configuration d'environnement.

## 2. Périmètre

### Inclus

- `FournisseurLLM` : protocole structurel, sans héritage imposé.
- `generer_json` : génération JSON validée par un schéma Pydantic.
- `generer_flux` : flux asynchrone typé, métadonnées sur le dernier morceau.
- Configuration `pydantic-settings` avec `SecretStr` et refus du factice en production.
- Fabrique et instance unique du client par processus.
- `FakeLLMClient` déterministe, avec scénarios ordonnés.
- Adaptateur HTTP `compatible-openai` (`httpx`, SSE, reprise limitée).
- `DefinitionAgent`, `ContexteExecution`, `OutilsCommuns`.
- `RegistreAgents` : doublons refusés, dernière version SemVer.
- `Harness` : résolution, revalidation, budget, validation de sortie, erreurs normalisées.
- Lifespan FastAPI : construction du client au démarrage, fermeture à l'arrêt.
- Tests unitaires, `README`, `.env.example` et présent document.

### Exclu (US suivantes)

- Routes HTTP des agents et intégration au backend.
- Choix définitif du fournisseur LLM.
- Prompts versionnés, few-shot, RAG et corpus.
- Persistance, base de données, mémoire apprenant permanente.
- Authentification, quotas et facturation.
- Adaptateur Anthropic : l'ajout d'un fournisseur se fait par un nouvel adaptateur et une valeur autorisée dans
  `ConfigLLM`.

## 3. Audit préalable

| Constat | Conséquence |
| --- | --- |
| `ia-service/` ne contenait que `/health` et `app/schemas/` (US-151) | Création de `app/core/`, `app/llm/` et `app/harness/` |
| Le cadrage AJ02 décrit déjà `LLM_*`, un adaptateur `factice` obligatoire et `httpx` seul | Aucun SDK propriétaire, variables neutres |
| `.env.example` ne proposait que `OPENAI_*` | Bloc `LLM_*` ajouté ; anciennes variables marquées dépréciées |
| Les enveloppes US-151 (`RequeteAgent`, `ReponseAgent`, `CodeErreur`) existent sur `develop` | Le Harness les réutilise sans duplication |
| Aucun test ne touchait au réseau | Adaptateur HTTP testé avec `httpx.MockTransport` |
| `pydantic 2.10.4` et `pydantic-settings 2.7.1` sont déjà utilisés par le backend | Versions alignées dans `requirements.txt` |

## 4. Livrables

| Fichier | Rôle |
| --- | --- |
| `app/core/config.py` | `ConfigLLM`, `charger_config()`, messages d'erreur sans secret |
| `app/core/erreurs.py` | Hiérarchie d'exceptions internes |
| `app/llm/base.py` | `FournisseurLLM`, `MessageLLM`, `ReponseLLM`, `MorceauFlux` |
| `app/llm/fabrique.py` | `creer_client()`, `obtenir_client()`, `reinitialiser_client()` |
| `app/llm/adaptateurs/factice.py` | `FakeLLMClient`, `ScenarioLLM` |
| `app/llm/adaptateurs/compatible_openai.py` | Adaptateur HTTP JSON + SSE |
| `app/harness/agent.py` | `DefinitionAgent`, `ContexteExecution`, `OutilsCommuns` |
| `app/harness/registre.py` | `RegistreAgents` |
| `app/harness/execution.py` | `Harness` |
| `app/main.py` | Lifespan et état partagé FastAPI |
| `tests/test_config_llm.py` | Configuration, secrets, bornes, messages |
| `tests/test_fabrique.py` | Sélection et instance unique |
| `tests/test_llm_factice.py` | Succès, erreurs, flux, journal des appels |
| `tests/test_adaptateur_compatible_openai.py` | Requête HTTP, JSON, SSE, reprises, timeouts |
| `tests/test_registre.py` | Doublons, versions SemVer, définitions invalides |
| `tests/test_harness.py` | Pipeline complet et correspondance des erreurs |
| `tests/test_main.py` | Lifespan, `/health`, démarrage refusé |
| `tests/conftest.py` | Fixture qui neutralise les variables LLM de la machine |
| `requirements.txt` | `httpx`, `pydantic-settings`, `packaging` |
| `.env.example` | Bloc `ENVIRONNEMENT` + `LLM_*` |
| `README.md` | Architecture, configuration, usage, tests |

## 5. Architecture

```text
app/main.py
   │ lifespan
   ├── obtenir_client() ──────────────► un seul client par processus
   │        ├── FakeLLMClient          (dev, test, CI)
   │        └── CompatibleOpenAI       (httpx, SSE)
   ├── RegistreAgents
   └── Harness(registre, client)

Requête ──► Harness
              1. résolution (code, version)
              2. revalidation de l'entrée
              3. OutilsCommuns + ContexteExecution
              4. exécution sous budget
              5. validation de la sortie
              6. ReponseAgent | ReponseErreur
```

Les agents ne construisent jamais de client et n'importent ni `httpx`, ni la base. Ils reçoivent le client partagé
par `ContexteExecution.outils`.

## 6. Contrat du client LLM

```python
class FournisseurLLM(Protocol):
    nom: str
    modele: str

    async def generer_json(
        self,
        messages: Sequence[MessageLLM],
        *,
        schema: type[T],
        temperature: float | None = None,
        max_tokens: int | None = None,
        delai_s: float | None = None,
    ) -> tuple[T, ReponseLLM]: ...

    def generer_flux(
        self,
        messages: Sequence[MessageLLM],
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        delai_s: float | None = None,
    ) -> AsyncIterator[MorceauFlux]: ...

    async def fermer(self) -> None: ...
```

| Élément | Responsabilité | Ne fait pas |
| --- | --- | --- |
| `generer_json` | Appeler en mode JSON et valider avec `schema` | Choisir le schéma, construire le prompt |
| `generer_flux` | Produire des morceaux de texte typés | Rejouer un flux commencé, persister |
| `ReponseLLM` | Normaliser fournisseur, modèle, durée, tokens | Exposer la clé ou le prompt |
| `MessageLLM` | Formater un message non vide | Interpréter le rôle |
| `fermer` | Libérer le client HTTP | Fermer un client injecté par l'appelant |

`generer_json` retourne l'objet **déjà validé** : le Harness valide ensuite la sortie de l'agent, pas la réponse
brute du fournisseur. `MorceauFlux.fin` porte les métadonnées du flux, ce qui évite un état mutable sur le client.

## 7. Configuration et sécurité

La configuration est gelée après construction. Elle est lue uniquement dans l'environnement, jamais dans le code.

| Variable | Défaut | Validation |
| --- | --- | --- |
| `ENVIRONNEMENT` | `dev` | `dev`, `test`, `prod` |
| `LLM_FOURNISSEUR` | `factice` | `factice`, `compatible-openai` |
| `LLM_MODELE` | — | obligatoire si fournisseur réel |
| `LLM_BASE_URL` | — | URL valide, obligatoire si fournisseur réel |
| `LLM_API_KEY` | — | `SecretStr`, obligatoire si fournisseur réel |
| `LLM_TEMPERATURE` | `0.2` | 0 à 2 |
| `LLM_MAX_TOKENS` | `600` | 1 à 8 192 |
| `LLM_TIMEOUT_S` | `12` | 0 exclu à 120 |
| `LLM_MAX_RETRIES` | `1` | 0 à 3 |

Règles de sécurité :

1. `ENVIRONNEMENT=prod` interdit `factice` : le service refuse de démarrer plutôt que de servir des réponses
   simulées.
2. Un fournisseur réel incomplet (`modele`, `base_url` ou `api_key` absent) empêche le démarrage.
3. `LLM_API_KEY` est un `SecretStr` : masqué dans `repr`, jamais recopié dans `ErreurConfiguration`.
4. Les messages de configuration ne citent que des noms de champs et des explications génériques.
5. Aucun secret, aucun `.env` réel et aucune donnée personnelle ne sont versionnés.

## 8. Registre des agents

| Règle | Comportement |
| --- | --- |
| Clé | `(code, version)` |
| Doublon | `ErreurRegistre` au démarrage, jamais d'écrasement |
| `version=None` | Dernière version selon SemVer (`packaging.version.Version`) |
| Agent inconnu | `ErreurAgentInconnu` → `AGENT_INCONNU` |
| Version inconnue | `ErreurAgentInconnu` → `AGENT_INCONNU` |
| Définition invalide | Code, SemVer, prompt, empreinte, budget ou schémas refusés |
| Après démarrage | Lecture seule ; le nombre d'agents n'est pas figé |

## 9. Pipeline du Harness et erreurs

| Étape | Action | Erreur |
| --- | --- | --- |
| 1 | Résoudre `(code_agent, version_agent)` | `AGENT_INCONNU` |
| 2 | Revalider `requete.entree` contre `schema_entree` | `ENTREE_INVALIDE` |
| 3 | Construire `OutilsCommuns` et `ContexteExecution` | — |
| 4 | Exécuter sous `asyncio.timeout(budget_ms)` | `LLM_TIMEOUT` |
| 5 | Valider le résultat contre `schema_sortie` | `LLM_REPONSE_INVALIDE` |
| 6 | Construire `ReponseAgent` typée | — |
| 7 | Traduire toute exception en `ReponseErreur` | voir ci-dessous |

| Exception interne | Code | Rejouable |
| --- | --- | --- |
| `ErreurAgentInconnu` | `AGENT_INCONNU` | non |
| `ValidationError` sur l'entrée | `ENTREE_INVALIDE` | non |
| `TimeoutError` / `ErreurLlmTimeout` | `LLM_TIMEOUT` | oui |
| `ErreurLlmIndisponible` / `ErreurConfiguration` | `LLM_INDISPONIBLE` | oui |
| `ErreurReponseLlm` / `ValidationError` sur la sortie | `LLM_REPONSE_INVALIDE` | oui |
| Exception imprévue | `ERREUR_INTERNE` | non |

Les messages sont fixes. Une erreur inattendue est journalisée avec sa trace, mais le client ne reçoit qu'un message
générique : ni entrée, ni contexte, ni réponse du fournisseur ne sont exposés.

`MetaExecution` est alimentée par le client partagé (`fournisseur`, `modele`), la définition (`empreinte_prompt`) et
l'horloge (`duree_ms`). `version_corpus` reste `None` tant que le RAG n'existe pas.

## 10. Client simulé

`FakeLLMClient` ne fait aucun appel réseau et ne nécessite aucune clé. Les scénarios sont consommés dans l'ordre :
un test peut donc enchaîner succès, JSON invalide, timeout et indisponibilité. `appels` et `flux_demandes`
enregistrent les messages reçus, ce qui permet de vérifier que le Harness transmet bien l'entrée et le contexte.
`delai_s` sert uniquement aux tests de budget ; `fermer()` est idempotent et observable.

## 11. Adaptateur compatible OpenAI

- `httpx.AsyncClient` uniquement, aucun SDK propriétaire.
- `POST {base_url}/chat/completions`, en-tête `Authorization: Bearer …`.
- Mode JSON : `response_format={"type": "json_object"}` puis validation Pydantic.
- Streaming : lecture SSE, `data: {...}`, `data: [DONE]`.
- Reprise unique par défaut sur `429/500/502/503/504` ; aucune reprise sur `400/401/403/422`.
- Le streaming n'est jamais rejoué : des morceaux ont déjà pu être affichés.
- Les corps de réponse ne sont jamais recopiés dans une erreur ; la clé n'est jamais journalisée.

## 12. Tests

### Commandes exécutées (3 novembre 2026)

```bash
cd ia-service
python -m ruff check .                                   # All checks passed!
python -m ruff format --check .                          # 35 files already formatted
python -c "from app.main import app; print(app.title)"    # import OK
python -m pytest --cov=app --cov-report=term-missing --cov-fail-under=70
```

### Résultats réels

| Indicateur | Résultat |
| --- | --- |
| Tests | **225 réussis** |
| Couverture `app/` | **100 %** |
| Seuil CI (70 %) | Atteint |
| Ruff | Conforme (`line-length = 120`) |
| Réseau / clé API / base | Aucun |

Environnement local : Python 3.12.10, pydantic 2.10.4, pydantic-settings 2.7.1, fastapi 0.115.6, httpx 0.27.2,
pytest 8.3.4, ruff 0.8.4. La CI cible Python 3.11 ; le code n'utilise que des API disponibles à partir de 3.11
(`asyncio.timeout`, `dataclass(slots=True)`).

### Couverture fonctionnelle

- configuration : défauts, variables, chaînes vides, bornes, URL, fournisseur inconnu, prod + factice, gel ;
- secret : `SecretStr`, absence de clé dans `repr` et dans les messages ;
- fabrique : sélection, instance unique, réinitialisation, fournisseur inconnu ;
- client factice : JSON (modèle, dictionnaire, chaîne), JSON invalide, champ supplémentaire, absence de scénario,
  erreur simulée, délai, flux avec ou sans morceaux, fermeture idempotente ;
- adaptateur HTTP : URL, en-tête, corps, mode JSON, tokens, SSE, `[DONE]`, lignes ignorées, erreurs 400/401/429/5xx,
  reprises, épuisement des reprises, timeout, réseau injoignable, fermeture d'un client injecté ;
- registre : enregistrement, doublon, résolution exacte, dernière version, prérelease, listing trié, neuf agents,
  définitions invalides ;
- Harness : succès, versions, agent inconnu, entrée invalide, sortie invalide, budget dépassé, timeout LLM,
  indisponibilité, configuration, JSON invalide, erreur inattendue, contexte transmis, durée bornée, horloge injectée ;
- lifespan : `/health`, état partagé, fermeture du client, démarrage refusé en prod avec `factice`.

### Non exécuté

- `make test` (pytest backend sur PostgreSQL) : aucun fichier backend modifié.
- `npm run check`, `npm run build`, E2E : aucun fichier frontend modifié.
- Stack Docker complète : sera vérifiée par la CI après le push.
- Appel à un vrai fournisseur LLM : aucun fournisseur n'est choisi et aucun secret ne doit être utilisé en test.

## 13. Extension aux neuf agents

Un agent se déclare sans modifier le Harness :

```python
async def executer_diagnostic(entree: EntreeDiagnostic, contexte: ContexteExecution) -> ResultatDiagnostic:
    resultat, meta = await contexte.outils.client_llm.generer_json(
        [MessageLLM(role="user", contenu=construire_prompt(entree))],
        schema=ResultatDiagnostic,
    )
    return resultat

registre.enregistrer(
    DefinitionAgent(
        code="diagnostic",
        version="1.0.0",
        schema_entree=EntreeDiagnostic,
        schema_sortie=ResultatDiagnostic,
        budget_ms=15_000,
        version_prompt="diagnostic/evaluation@1.0.0",
        empreinte_prompt="sha256:…",
        executer=executer_diagnostic,
    )
)
```

Le RAG, les prompts et les few-shot s'ajouteront dans `OutilsCommuns` sans changer la signature des agents ni le
pipeline. Les neuf agents peuvent être enregistrés dans le même registre, avec des versions indépendantes.

## 14. Contraintes respectées

| Contrainte | Mise en œuvre |
| --- | --- |
| Un seul client LLM partagé | `obtenir_client()` mémoïsé, injecté dans le Harness |
| Aucun fournisseur imposé | Protocole `FournisseurLLM`, adaptateurs interchangeables |
| Aucun secret dans le code | `SecretStr`, `.env.example` vide, lecture de l'environnement |
| Aucun accès à la base | Aucun import SQLAlchemy ; le service reste sans état |
| Aucun stockage permanent de mémoire | `ContexteApprenant` reçu à chaque requête, jamais persisté |
| Extensible aux neuf agents | Registre par `(code, version)`, Harness unique |

## 15. Points ouverts

| Sujet | État |
| --- | --- |
| Fournisseur LLM définitif | Non choisi ; `factice` par défaut hors production |
| `anthropic` | Volontairement absent des valeurs autorisées tant que l'adaptateur n'existe pas |
| `response_format` | Supposé disponible ; certains fournisseurs locaux exigent `format: json` ou un prompt dédié |
| Reprises | JSON uniquement ; un flux commencé n'est jamais rejoué |
| RAG et prompts | Non inclus ; `version_corpus` reste `None` |
| Streaming dans le Harness | L'interface est prête, aucune route ne l'expose encore |
| Quotas et authentification | Hors périmètre de l'US |
| Observabilité | Journalisation minimale ; métriques et `request_id` corrélé à ajouter avec les routes |

## 16. Reproduire et vérifier

```bash
git switch feature/US69-llm-client-harness
cd ia-service

python -m venv .venv
# Windows : .venv\Scripts\activate    |    POSIX : source .venv/bin/activate
pip install -r requirements-dev.txt

ruff check . && ruff format --check .
pytest --cov=app --cov-report=term-missing --cov-fail-under=70
```

Aucune base de données, aucun service externe, aucune clé API et aucun secret ne sont nécessaires.

## 17. Références

- `docs/api/contrat-frontend.md` — contrat public backend/frontend.
- [`contrat-modeles-ia.md`](contrat-modeles-ia.md) — enveloppes et règles de validation (US-151).
- `docs/architecture/aj02-cadrage-technique-ia.md` — cadrage du service IA (Harness, client LLM, erreurs).
- `backend/app/services/scoring.py` — référentiels et niveaux (non dupliqués côté IA).
