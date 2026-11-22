# Architecture du Harness d’agents — description, fonctionnement et état

**Date :** 18 novembre 2026 — **état des agents actualisé le 21 novembre 2026** (fusions #93 et #94).

**Branche :** `feature/PRE-14-architecture-agent-harness`, créée depuis `develop` à `86c529fa7f9845c921604803ac90f31f333c0a87`. La bascule initiale de la session sur `develop` a été corrigée avant toute rédaction ; tous les fichiers non suivis préexistants ont été préservés.

**Statut :** document d’architecture descriptif, **en attente de validation**. Aucun fichier applicatif n’a été modifié, aucune dépendance installée, aucun prompt modifié, aucune base de données touchée. La section 1.1 ajoute l’état des agents au 21 novembre, sans modifier le Harness.

**Périmètre :** `ia-service/app/harness/`, les contrats communs, le catalogue d’erreurs, les routes qui appellent le Harness, les quatre agents actuellement enregistrés (`diagnostic`, `chatbot`, `correction`, `recommandation`) et les tests correspondants. Le backend n’est évoqué que comme consommateur de l’enveloppe, sauf pour l’état de livraison de la recommandation (§1.1).

**Source de vérité :** le code exécutable (`app/main.py` et `app/api/*.py`), conformément à `AGENTS.md`. Les README du service contiennent encore plusieurs affirmations obsolètes, signalées dans la section 6.2.

---

## 1. Synthèse exécutive

Le Harness est le **point d’entrée unique et uniforme** de tous les agents du service IA. Il ne contient aucune logique pédagogique : il résout un agent enregistré, revalide son entrée, lui injecte des outils partagés, borne son exécution dans le temps, valide sa sortie et retourne toujours une enveloppe JSON standardisée — succès ou erreur.

| Domaine | État vérifié | Commentaire |
| --- | --- | --- |
| Noyau `Harness.executer()` | ✅ Terminé | Flux nominal, timeout, validation sortie, métadonnées. |
| `DefinitionAgent` | ✅ Terminé | Validation stricte de la définition au démarrage. |
| `RegistreAgents` | ✅ Terminé | Index `code → version → définition`, résolution SemVer. |
| Injection des outils | ✅ Terminé | LLM, prompts, RAG, horloge. |
| Enveloppes communes | ✅ Terminé | `RequeteAgent`, `ReponseAgent`, `ReponseErreur`, `ErreurAgent`, `MetaExecution`. |
| Catalogue d’erreurs | ✅ Terminé | Code public, message sûr, `retryable`, statut HTTP. |
| Agents enregistrés | ✅ Terminé | `diagnostic@1.0.0`, `chatbot@1.0.0`, `correction@1.0.0` et `recommandation@1.0.0` (`app/main.py:41-44`). |
| Agent Recommandation | ✅ Livré (PR #93 + #94) | Proposition sans état, route `POST /recommandation/actions`, relais et persistance backend, affichage apprenant. Détail en §1.1. |
| Traçabilité de l’empreinte prompt | ⚠️ Partielle | L’empreinte rendue avec le few-shot n’est pas celle exposée dans `meta`. |
| Provenance RAG dans `meta` | ⚠️ Partielle | `version_corpus` porte l’étiquette, mais pas le mode lexical/hybride. |
| Reprise automatique | ❌ Absente | `retryable` est produit mais pas exploité par le Harness ni par le backend. |
| Métriques / traçage distribué | ❌ Absent | Journaux structurés uniquement. |
| Registre dynamique après démarrage | ❌ Volontairement absent | Le registre est rempli au lifespan puis lu seul. |

**Verdict :** l’architecture actuelle est **complète, cohérente et suffisante pour la démonstration**. Elle est conçue pour accepter un nouveau récupérateur RAG sans modifier les agents. Les travaux restants concernent surtout la traçabilité, la provenance documentaire et quelques écarts documentaires — pas une refonte du Harness.

### 1.1 État de l’agent Recommandation (21 novembre 2026)

| Composant | État | Preuve |
| --- | --- | --- |
| Agent IA `recommandation@1.0.0` | ✅ Enregistré et actif | `app/main.py:44` ; budget 30 000 ms ; prompt `recommandation/actions@1.0.0`. |
| Route IA `POST /recommandation/actions` | ✅ Opérationnelle | `app/api/recommandation.py` ; enveloppe `ReponseAgent[ResultatRecommandation]`. |
| Contrat partagé | ✅ Versionné | `contrats/ia/recommandation-parcours/` (requête, réponse, exemples valides et invalides). |
| Relais backend | ✅ Fusionné | `CHEMIN_RECOMMANDATION` (`backend/app/services/ia.py:28`) ; appel hors session PostgreSQL. |
| Décision et persistance | ✅ Fusionnées | `backend/app/services/recommandation.py` ; colonne JSONB `parcours.recommandation_ia` ; migration `20261121_rec_recommandation_ia`. |
| Route apprenant | ✅ Fusionnée | `POST /api/v1/parcours/{id}/recommandations` ; 401/403/404 ; statut public `COMPLET`/`PARTIEL`. |
| Frontend | ✅ Fusionné | endpoint `recommandations` (`endpoints.ts`) ; section « Mes recommandations » dans `MonParcours.tsx`. |
| CI | ✅ 6/6 au vert | Backend, service IA, frontend check/build, E2E, Docker, GitGuardian sur le commit `61058ed`. |
| RAG, mémoire pédagogique, modèle dédié | ❌ Hors périmètre v1 | Aucun artefact ajouté ; l’agent reste sans état. |

**Verdict agent :** opérationnel de bout en bout sur `develop` (fusions `586ac82` et `92b118c`). Aucune modification du Harness n’a été nécessaire. Documentation générale : [`agent-recommandation.md`](agent-recommandation.md).

---

## 2. Rôle et frontières du Harness

### 2.1 Ce que fait le Harness

Le Harness (`ia-service/app/harness/execution.py`) est une couche d’orchestration technique. Pour chaque requête, il :

1. résout la définition de l’agent demandé ;
2. revalide l’entrée contre le schéma de l’agent ;
3. crée le contexte d’exécution et injecte les outils ;
4. applique un budget temps via `asyncio.timeout` ;
5. traduit les exceptions en codes publics sûrs ;
6. revalide la sortie de l’agent :
7. construit les métadonnées d’exécution ;
8. retourne `ReponseAgent[T]` ou `ReponseErreur`.

### 2.2 Ce que le Harness ne fait pas

Le Harness ne :

- calcule aucun score pédagogique ;
- ne choisit aucun niveau ;
- ne construit aucun prompt ;
- n’appelle directement aucun fournisseur LLM ;
- n’accède à PostgreSQL ;
- ne persiste aucune donnée ;
- ne décide d’aucune politique métier ;
- ne réessaie pas automatiquement une requête.

Ces responsabilités restent réparties ainsi :

| Responsabilité | Propriétaire |
| --- | --- |
| Score officiel, niveau officiel, persistance | `backend/` |
| Décision pédagogique et prompts | agents + `app/prompts/` |
| Appel LLM | `app/llm/` via outil injecté |
| Recherche documentaire | `app/rag/` via port injecté |
| Orchestration technique et contrat d’enveloppe | `app/harness/` |

Cette séparation est la garantie principale de l’architecture : un changement de fournisseur LLM, de corpus ou de prompt ne doit pas modifier le Harness.

---

## 3. Vue d’architecture

### 3.1 Diagramme de composants

```text
                         ┌──────────────────────────┐
                         │ Routes FastAPI           │
                         │ /health                  │
                         │ /chatbot/message         │
                         │ /diagnostic/evaluer      │
                         └────────────┬─────────────┘
                                      │ RequeteAgent[T]
                                      ▼
      ┌──────────────────────────────────────────────────────────────┐
      │ Harness (app/harness/execution.py)                            │
      │                                                              │
      │  RegistreAgents ──► DefinitionAgent                          │
      │  revalidation entrée                                         │
      │  OutilsCommuns + ContexteExecution                           │
      │  asyncio.timeout(budget_ms / 1000)                           │
      │  validation sortie                                           │
      │  MetaExecution + enveloppe                                    │
      └───────┬──────────────────────────────────────┬───────────────┘
              │ executer(entree, contexte)           │
              ▼                                      │
      ┌───────────────────────────────┐               │
      │ Agents enregistrés            │               │
      │  diagnostic@1.0.0 (45 s)      │               │
      │  chatbot@1.0.0    (30 s)      │               │
      └───────┬───────────────────────┘               │
              │                                       │
              ├─► RegistrePrompts                     │
              ├─► FournisseurLLM (injecté)            │
              └─► RecuperateurRAG (injecté + repli)   │
                                                      │
                                                      ▼
                                       ReponseAgent[T] / ReponseErreur
```

### 3.2 Fichiers et responsabilités

| Fichier | Rôle essentiel |
| --- | --- |
| `app/harness/execution.py` | Orchestration : `Harness.__init__()` (lignes 43-56), `Harness.executer()` (lignes 58-130), traduction d’erreurs (lignes 143-160). |
| `app/harness/agent.py` | Contrats : `OutilsCommuns`, `SignalementRAG`, `ContexteExecution`, `DefinitionAgent` et sa validation (lignes 27-110). |
| `app/harness/registre.py` | `RegistreAgents` : enregistrement, résolution SemVer, listing (lignes 15-53). |
| `app/schemas/commun.py` | Enveloppes : `MetaExecution` (29-36), `RequeteAgent` (39-49), `ReponseAgent` (52-61), `ErreurAgent` (67-110), `ReponseErreur` (113-119). |
| `app/core/erreurs.py` | Exceptions typées porteuses d’un `CodeErreur`. |
| `app/core/codes_erreur.py` | Catalogue : codes, messages publics, codes rejouables, statuts HTTP. |
| `app/core/gestionnaire_erreurs.py` | Traduction exception → `ErreurAgent` et handlers FastAPI. |
| `app/main.py` | Câblage au lifespan et inclusion des routeurs (lignes 29-56, 84-85). |
| `app/api/diagnostic.py` | Route `POST /diagnostic/evaluer` (lignes 19-42). |
| `app/api/chatbot.py` | Route `POST /chatbot/message` (lignes 19-42). |

### 3.3 Câblage au démarrage

`app/main.py:29-56` construit une seule fois :

```python
registre_prompts = RegistrePrompts()
client_llm = obtenir_client()
registre_agents = RegistreAgents()
recuperateur_rag = construire_recuperateur()

registre_agents.enregistrer(construire_definition(registre_prompts))
registre_agents.enregistrer(definir_agent_chatbot(registre_prompts))
registre_agents.enregistrer(definir_agent_correction(registre_prompts))
registre_agents.enregistrer(definir_agent_recommandation(registre_prompts))

app.state.harness = Harness(
    registre_agents,
    client_llm,
    registre_prompts=registre_prompts,
    recuperateur_rag=recuperateur_rag,
)
```

Points structurants :

- la configuration LLM invalide empêche le démarrage : `obtenir_client()` est appelé dans le lifespan ;
- le registre est immuable en production : aucune inscription après le démarrage ;
- le Harness reçoit le client LLM partagé, pas un client par requête ;
- le récupérateur RAG est **toujours enveloppé** dans `RecuperateurAvecRepli` (`execution.py:55`) ;
- l’horloge est injectable (`horloge: Callable[[], float] = time.monotonic`) pour rendre les tests de durée déterministes.

À l’arrêt, `client_llm.fermer()`, `recuperateur_rag.fermer()` et `reinitialiser_client()` sont appelés (`main.py:53-56`).

### 3.4 Agents actuellement enregistrés

| Agent | Version | Budget | Schéma de sortie | RAG utilisé |
| --- | --- | --- | --- | --- |
| `diagnostic` | `1.0.0` | 45 000 ms | `ResultatDiagnostic` | Oui, via `RequeteRAG`. |
| `chatbot` | `1.0.0` | 30 000 ms | `ResultatChatbot` | Non, mais l’outil reste injecté. |
| `correction` | `1.0.0` | 45 000 ms | `ResultatCorrection` | Non. |
| `recommandation` | `1.0.0` | 30 000 ms | `ResultatRecommandation` | Non (hors périmètre v1). |

Le commentaire de `registre.py` mentionne « les neuf agents » comme horizon de conception ; le code en enregistre quatre au 21 novembre 2026. Il ne faut donc pas considérer les cinq autres comme opérationnels. L’état de livraison de `recommandation` est détaillé en §1.1.

---

## 4. Contrats du Harness

### 4.1 `DefinitionAgent`

`DefinitionAgent` (`harness/agent.py:60-110`) est une déclaration immuable :

| Champ | Rôle | Validation au démarrage |
| --- | --- | --- |
| `code` | Identifiant public de l’agent | minuscules/chiffres/tirets, 32 caractères max. |
| `version` | Version SemVer de l’agent | motif SemVer + `packaging.version.Version`. |
| `schema_entree` | Modèle Pydantic d’entrée | doit être une classe `BaseModel`. |
| `schema_sortie` | Modèle Pydantic de sortie | doit être une classe `BaseModel`. |
| `budget_ms` | Budget d’exécution | entier strict de 1 à 600 000 ; booléen refusé. |
| `version_prompt` | Identifiant du prompt | format `agent/tache@x.y.z`. |
| `empreinte_prompt` | Empreinte publiée | `sha256:<64 hexadécimaux>`. |
| `executer` | Coroutine de l’agent | doit être appelable. |

Toute définition invalide lève `ErreurRegistre` **à l’enregistrement**, jamais à la première requête. C’est un choix important : une mauvaise déclaration casse le démarrage plutôt que de produire des erreurs intermittentes en production.

### 4.2 `RegistreAgents`

`RegistreAgents` (`harness/registre.py`) est un index `code → version → définition` :

- `enregistrer()` refuse un doublon `(code, version)` au lieu de l’écraser (lignes 22-28) ;
- `resoudre()` retourne la version demandée ou, à défaut, la plus récente selon SemVer (lignes 30-42) ;
- `lister()` trie par code puis version croissante (lignes 44-47) ;
- `__len__` et `__contains__` facilitent les tests et la supervision ;
- un verrou protège uniquement l’écriture : le registre est rempli au démarrage puis lu sans verrou.

Une version inconnue et un code inconnu produisent le même code public `AGENT_INCONNU`, afin de ne pas révéler quels agents existent.

### 4.3 Contexte et outils injectés

`OutilsCommuns` (`agent.py:27-34`) contient quatre dépendances :

| Outil | Usage typique |
| --- | --- |
| `client_llm` | Appels `generer_json()` / `generer_texte()` des agents. |
| `registre_prompts` | Rendu des prompts versionnés et sélection du few-shot. |
| `recuperateur_rag` | Recherche documentaire, déjà décoré par le repli. |
| `horloge` | Mesure de durée, injectable pour les tests. |

`ContexteExecution` (`agent.py:50-57`) est immuable et porte :

- `request_id` ;
- `contexte: ContexteApprenant` ;
- `outils: OutilsCommuns` ;
- `signalement: SignalementRAG`.

`SignalementRAG` (`agent.py:37-47`) est le seul objet mutable du flux. Il reste **interne** : ses champs (`provenance`, `statut_verification`, `version_corpus_effective`) ne sont pas sérialisés dans le contrat public. L’agent Diagnostic l’utilise pour indiquer au Harness si le corpus réel, le repli synthétique ou l’absence de descripteurs doit apparaître dans `meta.version_corpus`.

### 4.4 Enveloppes publiques

Succès (`ReponseAgent[T]`) :

```json
{
  "request_id": "3f1c9b7e-6a2d-4f0e-9c1a-2b7d5e8f4a10",
  "agent": "diagnostic",
  "version_agent": "1.0.0",
  "version_prompt": "diagnostic/evaluation@1.1.0",
  "statut": "succes",
  "resultat": {},
  "meta": {
    "duree_ms": 1840,
    "fournisseur": "factice",
    "modele": "modele-test",
    "version_corpus": "cecrl-2020.1",
    "empreinte_prompt": "sha256:..."
  }
}
```

Erreur (`ReponseErreur`) :

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

`retryable` n’est jamais libre : `ErreurAgent` le vérifie contre `CODES_RETRYABLES` (`schemas/commun.py:102-110`).

---

## 5. Fonctionnement détaillé

### 5.1 Flux nominal

1. **Requête HTTP.** La route FastAPI valide le corps comme `RequeteAgent[EntreeDiagnostic]` ou `RequeteAgent[EntreeChatbot]`.
2. **Appel Harness.** La route appelle `request.app.state.harness.executer(CODE_AGENT, requete)` (`api/diagnostic.py:36`, `api/chatbot.py:36`).
3. **Version demandée.** `version_agent` passé explicitement à `executer()` prime sur `requete.version_agent` ; sinon le registre choisit la dernière version SemVer.
4. **Affichage sûr.** `_agent_affiche()` ne recopie qu’un identifiant valide ; sinon l’enveloppe d’erreur affiche `inconnu` (`execution.py:132-141`).
5. **Résolution.** `RegistreAgents.resoudre()` retourne la `DefinitionAgent` ; un échec donne `AGENT_INCONNU`.
6. **Revalidation d’entrée.** `definition.schema_entree.model_validate(requete.entree)` : défense en profondeur même si FastAPI a déjà validé (`execution.py:79-82`).
7. **Injection.** `OutilsCommuns` et `ContexteExecution` sont créés avec le `request_id`, le contexte apprenant et un `SignalementRAG` neuf (`execution.py:84-95`).
8. **Exécution bornée.** `asyncio.timeout(definition.budget_ms / 1000)` enveloppe toute la coroutine de l’agent (`execution.py:99-100`). Cela couvre le RAG, le rendu du prompt, l’appel LLM et ses reprises internes éventuelles.
9. **Validation de sortie.** Le résultat brut est revalidé contre `definition.schema_sortie` (`execution.py:108-111`).
10. **Métadonnées.** `MetaExecution` est construite avec durée bornée, fournisseur, modèle, provenance corpus et empreinte prompt (`execution.py:113-121`).
11. **Enveloppe.** `ReponseAgent[definition.schema_sortie]` est retournée (`execution.py:122-130`).
12. **Réponse HTTP.** La route renvoie l’enveloppe directement, avec le statut 200.

### 5.2 Flux d’erreur

Le Harness ne laisse jamais remonter d’exception Python à la route.

| Situation | Code public | Rejouable | Statut HTTP |
| --- | --- | --- | --- |
| Code agent inconnu ou version inconnue | `AGENT_INCONNU` | Non | 404 |
| Entrée revalidée invalide | `ENTREE_INVALIDE` | Non | 422 |
| Champ supplémentaire dans l’entrée | `ENTREE_INVALIDE` | Non | 422 |
| Sortie agent hors schéma | `LLM_REPONSE_INVALIDE` | Oui | 502 |
| Budget dépassé | `LLM_TIMEOUT` | Oui | 504 |
| `ErreurLlmTimeout` | `LLM_TIMEOUT` | Oui | 504 |
| `ErreurLlmIndisponible` | `LLM_INDISPONIBLE` | Oui | 503 |
| `ErreurLlmLimiteRequetes` | `LLM_LIMITE_REQUETES` | Oui | 429 |
| `ErreurLlmAuthentification` | `LLM_AUTHENTIFICATION` | Non | 502 |
| `ErreurLlmRequete` | `LLM_REQUETE_INVALIDE` | Non | 502 |
| `ErreurConfiguration` | `LLM_CONFIGURATION` | Non | 500 |
| `ErreurCorpusIndisponible` | `CORPUS_INDISPONIBLE` | Oui | 503 |
| `ErreurPromptIntrouvable` | `PROMPT_INTROUVABLE` | Non | 500 |
| Exception inattendue | `ERREUR_INTERNE` | Non | 500 |

Deux mécanismes complémentaires :

- `_code_pour()` (`execution.py:148-152`) considère une `ValidationError` de sortie comme `LLM_REPONSE_INVALIDE`, pas comme un bug interne ;
- `code_pour()` (`gestionnaire_erreurs.py:26-30`) déduit le code de l’exception typée, sinon `ERREUR_INTERNE`.

Les messages publics sont tous issus de `MESSAGES_PUBLICS` (`codes_erreur.py:41-56`). Le message interne d’une exception n’est jamais renvoyé au client ; seuls les journaux peuvent le contenir.

### 5.3 Timeout et annulation

Le budget est porté par la définition de l’agent, pas par la configuration globale :

- diagnostic : 45 s ;
- chatbot : 30 s ;
- borne maximale acceptée par `DefinitionAgent` : 600 000 ms.

Quand le délai expire, `asyncio.TimeoutError` est converti en `LLM_TIMEOUT`. La coroutine de l’agent est annulée. Comme `ia-service` ne persiste rien et que le RAG est en lecture seule, il n’y a pas d’effet de bord métier à compenser.

Le test `test_budget_depasse_asyncio_timeout()` vérifie que le code situé après un `await asyncio.sleep(10)` n’est jamais exécuté quand le budget est de 10 ms.

### 5.4 Validation en profondeur

Il existe trois niveaux de validation, volontairement redondants :

1. **FastAPI / Pydantic** sur l’enveloppe complète, avant le Harness.
2. **Harness** sur `requete.entree` et sur le résultat brut de l’agent.
3. **Agents et clients LLM** sur la réponse du fournisseur, via le `schema` passé à `generer_json()`.

Le test `test_entree_refuse_un_champ_supplementaire()` construit une requête non validée avec un champ inconnu et vérifie que le Harness la refuse quand même. C’est la démonstration directe de la défense en profondeur.

### 5.5 Provenance et métadonnées

`MetaExecution.version_corpus` est choisi ainsi (`execution.py:114`) :

```python
version_corpus = contexte.signalement.version_corpus_effective or self._recuperateur_rag.version_corpus
```

Donc :

- si l’agent Diagnostic a détecté un repli synthétique, `synthetique_fallback` est exposé ;
- s’il n’a trouvé aucun descripteur, `A_VERIFIER` est exposé ;
- sinon, la version du récupérateur principal est exposée.

Cette mécanique fonctionne, mais elle ne dit pas si la recherche était lexicale, hybride, ou issue d’un reranker. Le champ est une étiquette de corpus, pas un mode de récupération.

---

## 6. État actuel

### 6.1 Ce qui est terminé et fiable

- Le Harness exécute les deux agents réels via une seule API.
- Le registre refuse les doublons et résout correctement les versions SemVer.
- Les définitions d’agents sont validées au démarrage.
- Le budget est appliqué de manière uniforme.
- Les entrées et sorties sont revalidées par Pydantic.
- Les erreurs sont centralisées, sûres et rejouables de façon cohérente.
- Les métadonnées d’exécution sont produites pour chaque succès.
- Le Harness est testé isolément avec des agents factices, une horloge injectée et des exceptions variées.
- Les routes diagnostic et chatbot utilisent exactement le même mécanisme.
- Le backend peut consommer l’enveloppe et dégrader en résultat partiel sans faire échouer le parcours apprenant.

### 6.2 Limites et écarts détectés

| # | Limite | Impact | Priorité |
| --- | --- | --- | --- |
| 1 | `meta.empreinte_prompt` reprend l’empreinte statique de la définition, alors que `rendre_evaluation_diagnostic()` calcule une empreinte dynamique incluant le few-shot sélectionné. | Impossible d’identifier exactement quel exemple a été injecté pour une requête donnée. | P1 |
| 2 | `meta.version_corpus` ne distingue pas `lexical`, `hybride`, `synthetique_fallback` et `A_VERIFIER` de façon structurée. | La provenance est partielle dès qu’un mode hybride sera ajouté. | P1 |
| 3 | `retryable` est correctement produit, mais le Harness ne réessaie rien et le backend n’exploite pas ce champ pour une reprise. | Une erreur transitoire reste une erreur consommée en résultat partiel. | P2 |
| 4 | Le backend n’envoie ni `scenario` ni `memoire_pedagogique`. | Le diagnostic tourne toujours avec `scenario="quotidien"` et sans mémoire, malgré un contrat IA qui les accepte. | P2 |
| 5 | `registre.py` commente « les neuf agents », mais `main.py` n’en enregistre que deux. | Risque de penser que d’autres agents sont opérationnels. | P2 |
| 6 | Documentation obsolète dans `ia-service/README.md` : budget 15 000 ms au lieu de 45 000 ms, aucune route d’inférence annoncée alors que deux routes existent, affichage d’un port hôte contradictoire avec Compose. | Mauvais référentiel pour un développeur qui démarre. | P2 |
| 7 | Le repli RAG synthétique est appliqué par le Harness, pas par l’agent. Le README affirme que l’agent « ne fabrique aucun descripteur », ce qui est vrai uniquement au niveau agent. | Malentendu sur l’origine des repères injectés dans le prompt. | P2 |
| 8 | Aucune métrique, aucun identifiant de trace, aucun histogramme de durée par agent. | Supervision limitée aux journaux. | P2 |

### 6.3 Ce qui n’existe pas encore

Ces éléments ne sont pas des régressions : ils n’ont jamais été implémentés et ne sont pas nécessaires à la démonstration actuelle.

- file d’attente ou limitation de concurrence par apprenant ;
- politique de retry avec backoff inside Harness ;
- circuit breaker par fournisseur LLM ;
- registre reconfigurable à chaud ;
- middleware générique de traçage OpenTelemetry ;
- support de plusieurs versions de prompt sélectionnées par requête ;
- orchestration de plusieurs agents en chaîne ;
- fusion RAG hybride et index vectoriel.

### 6.4 Verdict

L’état du Harness peut être résumé ainsi :

> **Socle d’orchestration complet et robuste, prêt pour recevoir de nouveaux agents ou un récupérateur hybride sans changement de l’agent. Les limites actuelles portent sur la traçabilité et l’exploitation aval, pas sur le fonctionnement du pipeline.**

Aucune modification du Harness n’est nécessaire pour activer un RAG hybride : il suffit de fournir une autre implémentation de `RecuperateurRAG` à la fabrique. Les seules évolutions recommandées concernent les métadonnées de provenance.

---

## 7. Tests et résultats réellement obtenus

### 7.1 Commandes exécutées

Depuis `ia-service/` avec l’environnement virtuel présent :

```powershell
& '.venv/Scripts/python.exe' -m pytest --disable-warnings
```

Résultat :

```text
608 passed, 2 skipped, 1 warning in 16.63s
```

Puis, ciblage des fichiers directement liés au Harness :

```powershell
& '.venv/Scripts/python.exe' -m pytest -o addopts="" --disable-warnings `
  tests/test_harness.py tests/test_registre.py tests/test_commun.py `
  tests/test_codes_erreur.py tests/test_gestionnaire_erreurs.py `
  tests/test_api_diagnostic.py tests/test_main.py tests/test_chatbot.py
```

Résultat :

```text
collected 173 items
173 passed, 1 warning in 7.09s
```

Le deuxième avertissement provient de Starlette (`anyio.abc.BlockingPortal` déprécié) et n’est pas lié au Harness.

### 7.2 Cartographie des tests

| Fichier | Ce qui est vérifié |
| --- | --- |
| `tests/test_harness.py` | Succès, versions, priorité du paramètre, agent inconnu, code invalide, entrée invalide, champ supplémentaire, sortie invalide, timeout réel, erreurs LLM, mapping central, erreur inattendue, métadonnées client, borne de durée, transmission du contexte, horloge injectée. |
| `tests/test_registre.py` | Enregistrement, doublons, résolution par version, dernière version, listing. |
| `tests/test_commun.py` | Enveloppes, motifs, `retryable`, détails d’erreur. |
| `tests/test_codes_erreur.py` | Cohérence du catalogue. |
| `tests/test_gestionnaire_erreurs.py` | Traduction exception → code public, handlers HTTP, absence de fuite de message interne. |
| `tests/test_api_diagnostic.py` | Route `POST /diagnostic/evaluer`, statuts, enveloppe. |
| `tests/test_main.py` | Initialisation lifespan et inclusion des routeurs. |
| `tests/test_chatbot.py` | Agent chatbot et son contrat. |

### 7.3 Ce que les tests prouvent

- le flux nominal retourne bien une `ReponseAgent` avec les bonnes version, prompt, fournisseur et modèle ;
- la validation d’entrée du Harness rejette les champs inconnus même si la requête a été construite sans validation ;
- une sortie d’agent invalide devient `LLM_REPONSE_INVALIDE`, pas `ERREUR_INTERNE` ;
- le timeout est réellement appliqué et empêche la suite de la coroutine ;
- les erreurs typées produisent le code public attendu et le bon indicateur `retryable` ;
- une exception inattendue est journalisée mais remplacée par `ERREUR_INTERNE` dans la réponse ;
- le message interne, même s’il contient une donnée sensible de test, n’est jamais renvoyé ;
- les métadonnées utilisent bien le client partagé et l’horloge injectée.

### 7.4 Limites de la validation

Les tests ne couvrent pas :

- un registre rempli après le démarrage ;
- plusieurs agents chaînés ;
- une reprise automatique sur erreur rejouable ;
- un RAG hybride ou un index vectoriel ;
- une montée en charge concurrente prolongée ;
- les fournisseurs LLM réels, qui restent opt-in hors suite automatisée.

---

## 8. Évolutions minimales recommandées

Aucune refonte générale n’est proposée.

### P0 — Aucune action bloquante sur le Harness

1. Conserver le Harness tel quel pour la démonstration.
2. Brancher un futur RAG hybride uniquement par la fabrique `construire_recuperateur()`.
3. Ne pas déplacer de logique pédagogique ou d’appel LLM dans le Harness.

### P1 — Traçabilité

4. Ajouter un champ optionnel `mode_rag` à `MetaExecution`, avec des valeurs bornées : `lexical`, `hybride`, `synthetique_fallback`, `a_verifier`.
5. Faire remonter l’empreinte réellement rendue par `RegistrePrompts.rendre_evaluation_diagnostic()` jusque dans l’enveloppe, sans écraser l’empreinte statique publiée.
6. Documenter explicitement que `version_corpus` est une étiquette de corpus et `mode_rag` un mode de recherche.

### P2 — Industrialisation légère

7. Exploiter `retryable` côté backend pour les codes transitoires, avec un nombre de tentatives borné.
8. Faire remonter `scenario` et `memoire_pedagogique` depuis le backend lorsque disponibles.
9. Corriger les affirmations obsolètes du README : budget 45 s, routes actives, absence de port hôte, réalité du repli synthétique.
10. Corriger le commentaire « neuf agents » ou enregistrer effectivement les agents manquants ; ne pas laisser les deux états coexister.
11. Ajouter des tests ciblés pour `mode_rag`, l’empreinte rendue et une reprise bornée si elle est implémentée.

### À ne pas faire

- Ne pas introduire de retry infini dans le Harness.
- Ne pas rendre le registre mutable en production sans besoin identifié.
- Ne pas exposer les messages internes d’exception.
- Ne pas faire dépendre le Harness d’un fournisseur LLM concret ou d’une base de données.
- Ne pas supprimer la revalidation d’entrée au motif que FastAPI valide déjà.

---

## 9. Références principales

- `ia-service/app/harness/execution.py`
- `ia-service/app/harness/agent.py`
- `ia-service/app/harness/registre.py`
- `ia-service/app/schemas/commun.py`
- `ia-service/app/core/erreurs.py`
- `ia-service/app/core/codes_erreur.py`
- `ia-service/app/core/gestionnaire_erreurs.py`
- `ia-service/app/main.py`
- `ia-service/app/api/diagnostic.py`
- `ia-service/app/api/chatbot.py`
- `ia-service/app/agents/diagnostic.py`
- `ia-service/app/agents/chatbot.py`
- `ia-service/tests/test_harness.py`
- `ia-service/tests/test_registre.py`
- `ia-service/tests/test_commun.py`
- `ia-service/tests/test_codes_erreur.py`
- `ia-service/tests/test_gestionnaire_erreurs.py`
- `AGENTS.md`
