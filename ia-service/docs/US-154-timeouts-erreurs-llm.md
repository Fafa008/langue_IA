# US-154 — Timeouts et indisponibilités LLM

| Élément | Valeur |
| --- | --- |
| User Story | US-154 |
| Branche | `feature/US154-timeouts-erreurs-llm` |
| Base | `feature/US69-llm-client-harness` (PR #25), rebasée sur `develop` après fusion |
| Statut | Implémenté, testé, documenté — en attente de revue |
| Périmètre | `ia-service/app/core/`, `app/llm/adaptateurs/`, `app/harness/execution.py`, `app/main.py` et leurs tests |
| Voir aussi | [`codes-erreur-ia.md`](codes-erreur-ia.md), [`US-69-llm-client-harness.md`](US-69-llm-client-harness.md) |

## 1. Objectif

Centraliser la gestion des erreurs du client LLM et du Harness : un catalogue unique de codes, une politique de
reprise unique, un gestionnaire qui traduit toute exception en erreur structurée, et la garantie qu'aucune réponse
ne contient de trace ni de secret.

L'US-69 avait posé les briques (timeout `httpx`, reprise sur 5xx, table de messages dans le Harness). Trois défauts
subsistaient :

1. la table des messages et le mapping exception → code vivaient **dans le Harness**, donc non réutilisables par
   les futures routes ;
2. une **erreur réseau n'était jamais rejouée** alors qu'elle est temporaire, tandis qu'une **clé refusée** était
   annoncée `LLM_INDISPONIBLE` (rejouable) ;
3. aucune borne globale : `max_retries × timeout` pouvait dépasser tout budget annoncé.

## 2. Périmètre

### Inclus

- Catalogue `CodeErreur` + messages publics + `retryable` + statuts HTTP (`app/core/codes_erreur.py`).
- Exceptions métier portant leur code (`app/core/erreurs.py`), avec de nouveaux codes LLM.
- Politique de reprise commune, bornée et testable (`app/core/reprise.py`).
- Gestionnaire d'erreurs central et handlers FastAPI (`app/core/gestionnaire_erreurs.py`).
- Adaptateur HTTP : une tentative par appel, exceptions typées, `Retry-After` lu.
- Harness : mapping délégué au gestionnaire, journalisation expurgée.
- Configuration des délais et du budget (`LLM_REPRISE_DELAI_S`, `LLM_REPRISE_DELAI_MAX_S`, `LLM_BUDGET_TOTAL_S`).
- Tests unitaires : timeout, indisponibilité, erreur réseau, limitation de requêtes, budgets, secrets, handlers.
- Documentation : présent document + [`codes-erreur-ia.md`](codes-erreur-ia.md).

### Exclu

- Routes HTTP des agents (aucune n'existe encore) : les handlers sont prêts et testés sur une application locale.
- Disjoncteur (*circuit breaker*) partagé entre requêtes, métriques, `request_id` corrélé.
- Choix du fournisseur, prompts, RAG, persistance.

## 3. Audit préalable

| Constat (état de l'US-69) | Conséquence |
| --- | --- |
| `MESSAGES_ERREUR` et le mapping vivaient dans `harness/execution.py` | Extraction dans `app/core/` |
| `CodeErreur` et `CODES_RETRYABLES` définis dans `schemas/commun.py` | Déplacés dans `app/core/codes_erreur.py`, ré-exportés pour ne rien casser |
| 401/403/400/422 → `ErreurLlmIndisponible` (rejouable) | Nouveaux codes définitifs `LLM_AUTHENTIFICATION` et `LLM_REQUETE_INVALIDE` |
| `ConnectError` levée immédiatement | Réseau traité comme temporaire, donc rejoué |
| Reprise codée dans `_poster`, en dur | Politique unique avec jitter, `Retry-After` et budget |
| Aucun plafond global | `asyncio.timeout(budget_total_s)` autour de `generer_json` |
| Aucune route, donc aucun handler FastAPI | Handlers enregistrés sur `app`, testés sur une application locale |
| 224 tests, couverture 100 % | 312 tests, couverture 100 % |

## 4. Livrables

| Fichier | Rôle |
| --- | --- |
| `app/core/codes_erreur.py` | Catalogue : codes, messages publics, codes rejouables, statuts HTTP |
| `app/core/erreurs.py` | Exceptions portant `code`, `rejouable` et `message_public` |
| `app/core/reprise.py` | `PolitiqueReprise`, `reessayer`, attente et jitter injectables |
| `app/core/gestionnaire_erreurs.py` | `code_pour`, `erreur_publique`, `reponse_erreur`, journalisation, handlers FastAPI |
| `app/core/config.py` | Délais de reprise et budget total, validés et gelés |
| `app/llm/adaptateurs/compatible_openai.py` | Une tentative, exceptions typées, `Retry-After`, budget global |
| `app/harness/execution.py` | Délègue le mapping et journalise sans contenu sensible |
| `app/main.py` | Enregistrement des handlers d'erreurs |
| `tests/test_codes_erreur.py` | Invariants du catalogue |
| `tests/test_reprise.py` | Délais, plafonds, budget, erreurs non rejouables |
| `tests/test_gestionnaire_erreurs.py` | Mapping, format, absence de secret et de trace |
| `tests/test_adaptateur_compatible_openai.py` | Timeout, réseau, 429, `Retry-After`, 401/403/4xx, budget |
| `tests/test_harness.py` | Correspondance des nouvelles exceptions |
| `tests/test_main.py` | Handlers enregistrés et comportement HTTP |
| `docs/codes-erreur-ia.md` | Documentation des codes |
| `.env.example` | Nouvelles variables de reprise |

## 5. Architecture

```text
Exception levée (client HTTP, agent, configuration)
        │
        ▼
app.core.gestionnaire_erreurs.code_pour()
        │  ErreurServiceIA → son code
        │  ValidationError → LLM_REPONSE_INVALIDE (étape sortie)
        │  tout le reste → ERREUR_INTERNE
        ▼
erreur_pour_code() → ErreurAgent { code, message public, retryable }
        │
        ├── Harness → ReponseErreur (enveloppe complète)
        └── handler FastAPI → JSON { code, message, retryable } + statut HTTP
```

La boucle de reprise est indépendante du transport :

```text
generer_json
   └── asyncio.timeout(budget_total_s)
         └── reessayer(tentative, politique)
                ├── tentative()   → _poster() : une requête, un statut traduit
                ├── erreur rejouable et tentatives restantes ?
                ├── budget restant suffisant pour le délai ?
                └── attente (Retry-After ou exponentiel, plafonné, jitter)
```

## 6. Configuration

| Variable | Défaut | Bornes | Rôle |
| --- | --- | --- | --- |
| `LLM_TIMEOUT_S` | `12` | 0 exclu à 120 | Délai `httpx` de chaque tentative |
| `LLM_MAX_RETRIES` | `1` | 0 à 3 | Reprises après le premier appel |
| `LLM_REPRISE_DELAI_S` | `0.5` | 0 à 10 | Délai initial entre deux tentatives |
| `LLM_REPRISE_DELAI_MAX_S` | `4` | 0 à 60 | Plafond d'une attente |
| `LLM_BUDGET_TOTAL_S` | `30` | 0 exclu à 600 | Durée maximale d'un `generer_json` |

Deux incohérences sont refusées au démarrage : `LLM_REPRISE_DELAI_MAX_S < LLM_REPRISE_DELAI_S` et
`LLM_BUDGET_TOTAL_S < LLM_TIMEOUT_S`. Les valeurs par défaut tiennent largement dans un budget d'agent de 15 s
(`LLM_MAX_RETRIES=1`, `LLM_TIMEOUT_S=12` → au pire 24,5 s si le budget du Harness ne coupait pas avant).

## 7. Choix de conception

| Choix | Raison |
| --- | --- |
| `retryable` déduit du code, jamais saisi | Un même code ne peut pas être annoncé rejouable puis définitif |
| Codes français (`LLM_INDISPONIBLE`) | Contrat US-151 déjà fusionné, cadrage AJ02, règle « tout le repo en français » ; l'exemple `LLM_UNAVAILABLE` de la fiche est traduit, pas copié |
| Nouveaux codes `LLM_AUTHENTIFICATION`, `LLM_REQUETE_INVALIDE`, `LLM_LIMITE_REQUETES`, `LLM_CONFIGURATION` | Distinguer le définitif du temporaire ; aucun code existant n'est modifié |
| `ErreurConfiguration` non rejouable | Une configuration invalide ne se corrige pas en réessayant |
| Reprise dans `reessayer`, pas dans l'adaptateur | Un seul endroit à auditer, testable sans HTTP |
| Jitter ≤ 10 % injectable | Évite la synchronisation des instances sans rendre les tests aléatoires |
| `Retry-After` respecté puis plafonné | Coopératif avec le fournisseur, sans lui laisser imposer une attente arbitraire |
| Streaming jamais rejoué | Des morceaux ont déjà pu être affichés |
| Message public issu du catalogue | Le fournisseur ne peut pas injecter de texte dans une réponse |
| Handler `Exception` global | Aucune trace ne fuit, même sur un bug inattendu |

## 8. Tests

### Commandes exécutées (3 novembre 2026)

```bash
cd ia-service
python -m ruff check .                                   # All checks passed!
python -m ruff format --check .                          # 41 files already formatted
python -m pytest --cov=app --cov-report=term-missing --cov-fail-under=70
```

### Résultats réels

| Indicateur | Résultat |
| --- | --- |
| Tests | **312 réussis** |
| Couverture `app/` | **100 %** |
| Seuil CI (70 %) | Atteint |
| Ruff | Conforme (`line-length = 120`) |
| Réseau réel / clé API / base | Aucun |

Environnement local : Python 3.12.10, pydantic 2.10.4, pydantic-settings 2.7.1, fastapi 0.115.6, httpx 0.27.2,
pytest 8.3.4, ruff 0.8.4. CI cible Python 3.11 ; le code n'utilise que `asyncio.timeout` et `dataclass(slots=True)`.

### Scénarios couverts

- **timeout** : délai `httpx`, reprise après timeout, budget global expiré, transport qui ne répond jamais ;
- **indisponibilité** : 500/502/503, épuisement des reprises, erreur `httpx` inattendue ;
- **erreur réseau** : `ConnectError` rejouée puis épuisée, y compris en streaming (sans rejeu) ;
- **limitation de requêtes** : 429 rejoué, `Retry-After` respecté, plafonné, ignoré s'il est invalide (date, négatif,
  texte) ;
- **erreurs définitives** : 401/403/400/404/422/3xx jamais rejouées ;
- **validation** : entrée invalide non rejouée, sortie d'agent hors schéma → `LLM_REPONSE_INVALIDE` ;
- **secret** : absence de clé dans les messages, les enveloppes et les réponses HTTP ;
- **trace** : handler métier et handler inattendu, corps JSON sans `Traceback` ni cause ;
- **journalisation** : code seul pour une erreur métier, trace pour une erreur inattendue, jamais le contenu.

### Non exécuté

- Stack Docker complète et CI GitHub : vérifiées après le push.
- Appel à un vrai fournisseur LLM : aucun fournisseur choisi, aucun secret en test.
- Tests backend et frontend : aucun fichier de ces modules n'est modifié.

## 9. Limites et suites

| Sujet | État |
| --- | --- |
| Disjoncteur partagé | Non inclus : chaque requête gère sa reprise, sans état global |
| Métriques | Aucune ; à ajouter avec les routes (`code`, `retryable`, `duree_ms`) |
| `request_id` dans les journaux | Présent dans les messages du Harness, absent des handlers (routes à venir) |
| `Retry-After` en date HTTP | Non interprété : traité comme absent, donc délai exponentiel |
| Budget du Harness vs budget client | Le plus contraignant gagne : `asyncio.timeout(budget_ms)` reste prioritaire |
| Reprise des flux | Volontairement absente ; une reprise nécessiterait un accusé de réception côté client |

## 10. Reproduire

```bash
git switch feature/US154-timeouts-erreurs-llm
cd ia-service
python -m venv .venv
# Windows : .venv\Scripts\activate    |    POSIX : source .venv/bin/activate
pip install -r requirements-dev.txt

ruff check . && ruff format --check .
pytest --cov=app --cov-report=term-missing --cov-fail-under=70
```

## 11. Références

- [`codes-erreur-ia.md`](codes-erreur-ia.md) — catalogue détaillé et garanties.
- [`US-69-llm-client-harness.md`](US-69-llm-client-harness.md) — client LLM, registre, Harness.
- [`contrat-modeles-ia.md`](contrat-modeles-ia.md) — enveloppes `ErreurAgent` / `ReponseErreur`.
- `docs/architecture/aj02-cadrage-technique-ia.md` — cadrage du service IA (§11.5).
