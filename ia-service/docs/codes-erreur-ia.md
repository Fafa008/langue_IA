# Codes d'erreur du service IA (US-154)

| Élément | Valeur |
| --- | --- |
| User Story | US-154 |
| Périmètre | `ia-service/app/core/codes_erreur.py`, `app/core/erreurs.py`, `app/core/gestionnaire_erreurs.py`, `app/core/reprise.py` |
| Contrat d'enveloppe | [`contrat-modeles-ia.md`](contrat-modeles-ia.md) (`ErreurAgent`, `ReponseErreur`) |
| Voir aussi | [`US-69-llm-client-harness.md`](US-69-llm-client-harness.md), [`US-154-timeouts-erreurs-llm.md`](US-154-timeouts-erreurs-llm.md) |

## 1. Principe

Un seul catalogue décide de tout ce qui sort du service. Ajouter un code se fait **uniquement** dans
`app/core/codes_erreur.py`, avec son message public, son caractère rejouable et son statut HTTP ; partout ailleurs,
le code est importé.

Trois règles en découlent :

1. **Aucun message libre vers l'extérieur.** La réponse utilise `MESSAGES_PUBLICS[code]`, jamais `str(exception)`.
   Le message interne (statut HTTP, cause technique) reste dans les journaux.
2. **`retryable` n'est jamais saisi à la main.** Il est déduit de `CODES_RETRYABLES`, donc un même code ne peut pas
   être annoncé rejouable à un endroit et définitif à un autre. `ErreurAgent` refuse d'ailleurs l'incohérence.
3. **Aucun détail sensible.** Ni entrée apprenant, ni prompt, ni corps de réponse du fournisseur, ni clé d'API
   n'apparaissent dans un message public, une trace HTTP ou une ligne de journal.

## 2. Format de réponse

Une route qui échoue renvoie exactement :

```json
{
  "code": "LLM_INDISPONIBLE",
  "message": "Le fournisseur LLM est momentanément indisponible.",
  "retryable": true
}
```

Dans le Harness, la même information est encapsulée dans l'enveloppe commune :

```json
{
  "request_id": "3f1c9b7e-6a2d-4f0e-9c1a-2b7d5e8f4a10",
  "agent": "diagnostic",
  "statut": "erreur",
  "erreur": {
    "code": "LLM_TIMEOUT",
    "message": "Le fournisseur LLM n'a pas répondu dans le délai imparti.",
    "retryable": true
  }
}
```

## 3. Catalogue

| Code | Sens | `retryable` | HTTP | Message public |
| --- | --- | --- | --- | --- |
| `ENTREE_INVALIDE` | L'entrée ne respecte pas le schéma de l'agent | non | 422 | L'entrée ne respecte pas le contrat attendu par l'agent. |
| `AGENT_INCONNU` | Code ou version d'agent inconnu | non | 404 | L'agent demandé n'existe pas ou sa version est inconnue. |
| `TAILLE_DEPASSEE` | Charge utile trop volumineuse | non | 413 | La requête dépasse la taille autorisée. |
| `QUOTA_DEPASSE` | Quota d'appels de l'appelant atteint | oui | 429 | Le quota de requêtes est atteint, réessayez plus tard. |
| `LLM_INDISPONIBLE` | Fournisseur injoignable ou erreur serveur transitoire | oui | 503 | Le fournisseur LLM est momentanément indisponible. |
| `LLM_TIMEOUT` | Budget d'exécution ou délai d'appel dépassé | oui | 504 | Le fournisseur LLM n'a pas répondu dans le délai imparti. |
| `LLM_LIMITE_REQUETES` | Limitation de débit du fournisseur (HTTP 429) | oui | 429 | Le fournisseur LLM a atteint sa limite de requêtes. |
| `LLM_AUTHENTIFICATION` | Clé absente, refusée ou révoquée (HTTP 401/403) | non | 502 | Le fournisseur LLM a refusé l'authentification. |
| `LLM_REQUETE_INVALIDE` | Requête refusée par le fournisseur (400/404/422/3xx) | non | 502 | Le fournisseur LLM a refusé la requête. |
| `LLM_CONFIGURATION` | Configuration LLM absente ou incohérente | non | 500 | La configuration du fournisseur LLM est invalide. |
| `LLM_REPONSE_INVALIDE` | Réponse vide, mal formée ou hors schéma | oui | 502 | Le fournisseur LLM a renvoyé une réponse inexploitable. |
| `CORPUS_INDISPONIBLE` | Corpus documentaire (RAG) indisponible | oui | 503 | Le corpus documentaire est momentanément indisponible. |
| `PROMPT_INTROUVABLE` | Prompt versionné absent | non | 500 | Le prompt de l'agent est introuvable. |
| `ERREUR_INTERNE` | Exception imprévue | non | 500 | Une erreur interne est survenue pendant l'exécution de l'agent. |

Les codes `TAILLE_DEPASSEE`, `QUOTA_DEPASSE`, `CORPUS_INDISPONIBLE` et `PROMPT_INTROUVABLE` viennent du cadrage
AJ02 : ils sont déclarés pour que les US suivantes n'inventent pas de doublon, mais aucune route ne les produit
encore.

## 4. Correspondance exceptions → codes

| Exception (`app/core/erreurs.py`) | Code | `retryable` |
| --- | --- | --- |
| `ErreurConfiguration` | `LLM_CONFIGURATION` | non |
| `ErreurLlmAuthentification` | `LLM_AUTHENTIFICATION` | non |
| `ErreurLlmRequete` | `LLM_REQUETE_INVALIDE` | non |
| `ErreurLlmLimiteRequetes` | `LLM_LIMITE_REQUETES` | oui |
| `ErreurLlmTimeout` | `LLM_TIMEOUT` | oui |
| `ErreurLlmIndisponible` | `LLM_INDISPONIBLE` | oui |
| `ErreurReponseLlm` | `LLM_REPONSE_INVALIDE` | oui |
| `ErreurRegistre` | `ERREUR_INTERNE` | non |
| `ErreurAgentInconnu` | `AGENT_INCONNU` | non |
| `ValidationError` sur l'entrée | `ENTREE_INVALIDE` | non |
| `ValidationError` sur la sortie (ou levée par l'agent) | `LLM_REPONSE_INVALIDE` | oui |
| `TimeoutError` (`asyncio.timeout`) | `LLM_TIMEOUT` | oui |
| Toute autre exception | `ERREUR_INTERNE` | non |

`ValidationError` est interprétée selon l'étape : une entrée refusée est définitive, une sortie refusée est une
réponse LLM inexploitable et reste rejouable.

## 5. Statuts HTTP du fournisseur

| Statut reçu | Exception | Rejoué ? |
| --- | --- | --- |
| 2xx | — | — |
| 401, 403 | `ErreurLlmAuthentification` | non |
| 429 | `ErreurLlmLimiteRequetes` (+ `Retry-After`) | oui |
| 3xx | `ErreurLlmRequete` | non |
| 400, 404, 422 (autres 4xx) | `ErreurLlmRequete` | non |
| 5xx | `ErreurLlmIndisponible` | oui |
| Délai dépassé | `ErreurLlmTimeout` | oui |
| Erreur réseau (`ConnectError`, `ReadError`, …) | `ErreurLlmIndisponible` | oui |
| Corps illisible ou hors schéma | `ErreurReponseLlm` | oui |

Une erreur d'authentification ou de requête est **définitive** : rejouer une clé refusée gaspille du budget et
retarde le diagnostic. Une panne réseau, un 5xx, un 429, un délai dépassé ou un JSON inexploitable sont
**temporaires** et relèvent de la politique de reprise.

## 6. Politique de reprise

| Paramètre | Variable | Défaut | Effet |
| --- | --- | --- | --- |
| Reprises | `LLM_MAX_RETRIES` | `1` | Appels supplémentaires après le premier (0 à 3) |
| Délai initial | `LLM_REPRISE_DELAI_S` | `0.5` s | Attente après le premier échec (0 à 10 s) |
| Délai maximal | `LLM_REPRISE_DELAI_MAX_S` | `4` s | Plafond d'une attente (0 à 60 s) |
| Budget total | `LLM_BUDGET_TOTAL_S` | `30` s | Durée maximale d'un `generer_json`, reprises comprises |
| Délai d'un appel | `LLM_TIMEOUT_S` | `12` s | Délai `httpx` de chaque tentative |

Règles :

- le délai **double** à chaque échec (`0.5`, `1`, `2`, `4`) et reste plafonné par `LLM_REPRISE_DELAI_MAX_S` ;
- l'en-tête `Retry-After` du fournisseur est respecté s'il dépasse le délai calculé, puis plafonné : un fournisseur
  ne peut pas imposer une attente arbitraire ;
- un petit décalage aléatoire (≤ 10 %) évite que plusieurs instances retentent au même instant ;
- le budget est vérifié **avant** l'attente : si le délai restant ne suffit pas, l'erreur remonte immédiatement ;
- `generer_json` est enveloppé dans `asyncio.timeout(budget_total_s)` : même un fournisseur qui ne répond jamais rend
  la main avec `LLM_TIMEOUT` ;
- `generer_flux` n'est **jamais** rejoué : des morceaux ont déjà pu être affichés. Chaque lecture est bornée par le
  délai `httpx`, donc une connexion qui se fige est interrompue.

## 7. Garanties de non-divulgation

| Risque | Mesure |
| --- | --- |
| Trace Python dans la réponse | Les handlers FastAPI ne renvoient que `{code, message, retryable}` ; la trace reste dans les journaux |
| Clé d'API exposée | `SecretStr`, jamais recopiée dans un message ; tests dédiés sur les réponses et les journaux |
| Contenu de requête dans les journaux | Seuls le code, l'agent et le `request_id` sont journalisés |
| Corps de réponse du fournisseur recopié | `_verifier_statut` ne cite que le statut HTTP |
| Message de fournisseur falsifié | Les messages publics viennent du catalogue, pas du fournisseur |
| Attente infinie | Trois bornes : tentatives, délai plafonné, budget total |

## 8. Vérifier

```bash
cd ia-service
pytest tests/test_codes_erreur.py tests/test_gestionnaire_erreurs.py tests/test_reprise.py -q
pytest --cov=app --cov-fail-under=70 -q
ruff check . && ruff format --check .
```
