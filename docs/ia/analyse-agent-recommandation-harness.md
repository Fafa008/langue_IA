# Agent Recommandation — déroulement, architecture, état, résultats et validation dans le Harness

**Date :** 21 novembre 2026
**Base :** `develop` (HEAD `586ac82c0813c38cb45e087dc797fc48ada60705`, fusion de PR #93)
**Statut global :** **implémenté et testé**, en deux livraisons successives : PR #93 (contrat + service IA, commit `8b103b6`) **fusionnée dans `develop`** le 21 novembre 2026 (fusion `586ac82`) puis l’intégration backend/frontend décrite ici, encore en préparation. Aucune autre fusion n’est effectuée sans accord explicite.
**Périmètre :** `ia-service` produit une **proposition sans état** ; le backend est le seul propriétaire de la décision, du scoring et de PostgreSQL ; le frontend ne fait que consommer l’API. Le code exécutable et `contrats/ia/recommandation-parcours/` sont les sources de vérité — la version antérieure de ce document (18 novembre, HEAD `86c529f`) décrivait un état « à implémenter » et n’est plus valable.

---

## 1. Synthèse exécutive

| Élément | État vérifié |
| --- | --- |
| Identité de l’agent | `recommandation@1.0.0`, prompt `recommandation/actions@1.0.0`, budget `30 000 ms` (`ia-service/app/schemas/recommandation.py:29-32`). |
| Point d’entrée IA | `POST /recommandation/actions`, enregistrée dans `ia-service/app/main.py:44` aux côtés de diagnostic, chatbot et correction. |
| Exécution | `Harness.executer(CODE_AGENT, requete)` : résolution, revalidation d’entrée, outils communs, `asyncio.timeout`, validation de sortie, `ReponseAgent` / `ReponseErreur`. **Le Harness n’a pas été modifié.** |
| Contrats | `ia-service/app/schemas/recommandation.py` (`EntreeRecommandation`, `ResultatRecommandation`, `ActionRecommandee`) ; miroir strict côté backend dans `backend/app/schemas/ia.py`. |
| Contrat partagé | `contrats/ia/recommandation-parcours/` : `requete.json`, `reponse.json`, 10 exemples `invalides/` ; testés des deux côtés (`test_contrat_ia.py`, `tests/test_contrat_recommandation.py`). |
| Répondeur factice | Scénario `demonstration` déterministe, sans clé ni réseau ; aucun modèle, embedding ou fournisseur ajouté. |
| Relais backend | `CHEMIN_RECOMMANDATION = "/recommandation/actions"` et `recommander_actions()` dans `backend/app/services/ia.py`. |
| Route backend | `POST /api/v1/parcours/{id_parcours}/recommandations` (`backend/app/api/routes/parcours.py`), authentifiée, réservée aux apprenants. |
| Persistance | `parcours.recommandation_ia` (JSONB, nullable), migration `20261121_rec_recommandation_ia`. Le service IA n’écrit jamais dans la base. |
| Idempotence | Empreinte SHA-256 de la requête stockée avec la réponse : une demande identique ne déclenche pas d’appel IA supplémentaire. |
| Frontend | Endpoint unique dans `endpoints.ts`, service/mapper/hook typés, section minimale « Mes recommandations » dans `MonParcours.tsx`, contrat mis à jour dans `docs/api/contrat-frontend.md`. |
| Dégradation | `PARTIEL` + liste vide + `confiance = 0`, jamais d’erreur ni de code technique visible par l’apprenant. |
| Verdict | **Livré**. Les choix volontairement exclus de v1 (RAG, mémoire pédagogique, modèle entraîné) ne doivent pas être réintroduits sans décision explicite. |

Formulation courte : **l’agent existe, est branché de bout en bout et reste sans état ; c’est le backend qui décide et qui persiste.**

---

## 2. Déroulement réel

### 2.1 Chaîne complète

1. L’apprenant ouvre « Mon parcours » et clique sur **Afficher / Actualiser mes recommandations** (déclencheur explicite : aucun calcul automatique à l’ouverture).
2. Le frontend appelle `POST /api/v1/parcours/{id}/recommandations` via `apiRequest` (JWT, timeout 45 s) ; le hook place la réponse dans le cache React Query du parcours.
3. Le backend contrôle le rôle (`APPRENANT`) et l’appartenance du parcours (403 / 404), puis libère la session PostgreSQL **avant** l’appel IA, comme pour la correction de réponse libre.
4. `backend/app/services/recommandation.py` prépare la requête depuis :
   - `parcours.langue.code` et `parcours.niveau_vise.code` ;
   - `test_diagnostic.analyse_ia.resultat.points_faibles` (points faibles déjà validés par l’agent Diagnostic) ;
   - `parcours.lecon_atteinte` et le niveau estimé déterministe.
5. Garde-fous avant appel : langue dans `fr, en, zh, it, de`, niveau dans le référentiel, au moins un domaine exploitable. `expression_ecrite` est écarté : aucun type d’exercice ne lui est associé dans `services/parcours.py`.
6. Le backend appelle `POST /recommandation/actions` avec `RequeteRecommandationIA` (sans donnée identifiante) et reçoit une `ReponseRecommandationIA` validée par Pydantic.
7. Le Harness exécute `recommandation@1.0.0` dans le budget de 30 s ; le client LLM factice produit une enveloppe déterministe en mode `demonstration`.
8. Le backend **revalide** la proposition : langue, référentiel, `niveau_cible == niveau_vise`, domaines ⊆ points faibles reçus, type d’exercice imposé par le domaine, priorités contiguës, unicité des domaines, au plus 5 actions, `confiance > 0` si la liste est non vide.
9. Le backend persiste `{empreinte, public, enveloppe_ia, code_technique}` dans `parcours.recommandation_ia` et renvoie la partie publique.
10. `GET /parcours/en-cours` expose le champ `recommandation` : la page relit donc la même réponse après rechargement.

### 2.2 Requête et réponse (extraits)

```json
{
  "request_id": "<uuid>",
  "contexte": {
    "code_langue": "en", "referentiel": "CECRL",
    "niveau_preliminaire": "B1", "lecon_atteinte": 23
  },
  "entree": {
    "points_faibles": [
      {
        "domaine": "grammaire", "id_question": "q-12",
        "observation": "…", "justification": "…"
      }
    ],
    "niveau_vise": "B1"
  }
}
```

```json
{
  "request_id": "<uuid>",
  "agent": "recommandation", "version_agent": "1.0.0",
  "version_prompt": "recommandation/actions@1.0.0", "statut": "succes",
  "resultat": {
    "code_langue": "en", "referentiel": "CECRL", "niveau_cible": "B1",
    "recommandations": [
      {
        "domaine": "grammaire", "type_exercice": "GRAMMAIRE",
        "action": "Refaire un exercice de conjugaison au prétérit.",
        "justification": "Le point faible porte sur le prétérit.", "priorite": 1
      }
    ],
    "resume": "Une action courte : conjugaison.", "confiance": 0.72
  },
  "meta": { "duree_ms": 120, "fournisseur": "factice", "modele": "…", "version_corpus": null, "empreinte_prompt": "sha256:…" }
}
```

### 2.3 Dégradation et idempotence

| Situation | Comportement |
| --- | --- |
| Service IA en panne, timeout, réponse hors contrat ou incohérente | HTTP 200, `statut: PARTIEL`, `recommandations: []`, `confiance: 0`, message générique. Le code technique est journalisé côté backend (`code_technique`) mais jamais exposé. |
| Langue/niveau hors contrat, aucun domaine exploitable | Aucun appel IA ; même résultat `PARTIEL`. |
| Demande identique à la dernière (même empreinte) | Réponse persistée `COMPLET` renvoyée sans nouvel appel. |
| Résultat `PARTIEL` | Non mis en cache : le rafraîchissement explicite retente l’appel. |

---

## 3. Architecture

```mermaid
flowchart TD
    F[Frontend Next.js\nMonParcours] -->|POST /parcours/:id/recommandations| B[Backend FastAPI]
    B -->|contexte minimal, hors session DB| API[ia-service\nPOST /recommandation/actions]
    API --> H[Harness.executer\ninchangé]
    H --> R[RegistreAgents\ndiagnostic + chatbot + correction + recommandation]
    R --> A[RecommandationAgent]
    H --> O[OutilsCommuns\nLLM + prompts]
    A --> P[recommandation/actions@1.0.0]
    A --> L[Client LLM factice / Groq / Gemini]
    A --> S[Validations déterministes\nconfiance, niveau, domaines, priorités]
    H --> ENV[ReponseAgent]
    ENV --> B
    B -->|revalidation + empreinte| DB[(PostgreSQL\nparcours.recommandation_ia)]
    DB -->|GET /parcours/en-cours| F
```

### 3.1 Responsabilités par couche

| Couche | Fichiers principaux | Rôle |
| --- | --- | --- |
| Frontend | `frontend/src/services/endpoints.ts`, `parcours-personnalise.service.ts`, `.mapper.ts`, `hooks/useParcoursPersonnalise.ts`, `MonParcours.tsx` | Déclencheur explicite, conversion snake_case, affichage minimal ; aucun `fetch` direct. |
| Backend — route | `backend/app/api/routes/parcours.py` | Authentification, rôle, appartenance, traduction des erreurs. |
| Backend — orchestration | `backend/app/services/recommandation.py` | Préparation, appel hors DB, revalidation, empreinte, persistance, dégradation. |
| Backend — relais | `backend/app/services/ia.py`, `backend/app/schemas/ia.py` | Client HTTP borné et miroir strict du contrat IA. |
| PostgreSQL | `backend/app/models/parcours.py`, `alembic/versions/20261121_rec_recommandation_ia.py` | Seule persistance ; le service IA n’y accède jamais. |
| API IA | `ia-service/app/api/recommandation.py`, `app/main.py` | Validation d’entrée, appel Harness, traduction des erreurs. |
| Agent | `ia-service/app/agents/recommandation.py`, `app/schemas/recommandation.py` | Proposition bornée et validée, sans état ni décision finale. |
| Prompt | `ia-service/app/prompts/registre.py` | Version `recommandation/actions@1.0.0`, empreinte, messages. |
| Harness | `app/harness/execution.py`, `agent.py`, `registre.py` | Générique et inchangé : résolution, budget, validation d’entrée/sortie, enveloppes. |

### 3.2 Câblage au démarrage

`ia-service/app/main.py` enregistre quatre agents : diagnostic, chatbot, correction, recommandation. Une `DefinitionAgent` invalide est refusée au démarrage (`lifespan`), pas à la première requête. Le registre de prompts expose `recommandation/actions@1.0.0` avec son empreinte.

### 3.3 Identité et contrat

```python
CODE_AGENT = "recommandation"
VERSION_AGENT = "1.0.0"
VERSION_PROMPT = "recommandation/actions@1.0.0"
BUDGET_MS = 30_000
```

Entrée : `RequeteAgent[EntreeRecommandation]` (contexte apprenant + points faibles + niveau visé).
Sortie : `ReponseAgent[ResultatRecommandation]` validée deux fois (service IA puis backend), sans champ inconnu.
Aucune donnée identifiante, aucun mot de passe, aucun contenu de journal applicatif dans le prompt.

### 3.4 Choix explicitement hors de v1

- **Pas de RAG ni d’embedding** : le port existe dans le service IA mais n’est pas utilisé par cet agent ; `RAG_CORPUS_ACTIF` reste à sa valeur par défaut.
- **Pas de `MemoirePedagogique`** : la requête se limite aux points faibles du diagnostic déjà persistés.
- **Pas de modèle ni de nouveau fournisseur** : le client LLM existant est réutilisé ; aucun artefact n’est ajouté.
- **Pas de modification du Harness** : seule une `DefinitionAgent` supplémentaire est enregistrée.
- **Pas de calcul automatique** : l’apprenant demande explicitement le rafraîchissement.

---

## 4. Tests et validation

### 4.1 Service IA (PR #93)

Depuis `ia-service/`, sans clé API ni réseau :

```powershell
python -m pytest --cov=app --cov-report=term --cov-fail-under=70 -p no:cacheprovider --disable-warnings --tb=no
```

Résultat observé : **couverture 96,20 %**, suite verte. Tests dédiés : `tests/test_agent_recommandation.py`, `tests/test_api_recommandation.py`, `tests/test_contrat_recommandation.py`, plus `tests/test_llm_demonstration.py` (scénario factice) et `tests/test_prompts.py` (version du prompt).

### 4.2 Backend

Depuis la racine (Docker + PostgreSQL de test) :

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --build --rm backend \
  pytest -q -p no:cacheprovider tests/test_recommandation.py tests/test_contrat_ia.py
```

Résultat observé : **40 passed, 1 skipped** ; la migration `20261121_rec_recommandation_ia` est appliquée par la fixture de test. `ruff check` et `ruff format --check` sont propres avec `ruff 0.8.4`.

Couverture : `tests/test_recommandation.py` couvre 401/403/404, le succès persistant, l’idempotence, la panne IA, la réponse incohérente, l’absence de domaine exploitable, la langue hors contrat et la stabilité de l’empreinte. `tests/test_contrat_ia.py` rejoue les exemples partagés du contrat.

### 4.3 Commandes canoniques avant PR

```bash
make check        # ruff + pytest --cov-fail-under=70 (backend et IA) + npm run check
cd frontend && npm run build && npm run test:e2e
```

Le job Docker complet de la CI (healthchecks, seed idempotent, images dev) doit également être relancé. Sous Windows, les cibles `make` utilisent `sh -c` et `id -u` : les lancer depuis Git Bash/WSL, pas PowerShell natif.

**Bilan du run complet du 21 novembre 2026 :** la suite backend passe `ruff` et `ruff format --check` et atteint 95,87 % de couverture, mais quatre tests de `tests/test_utilisateurs.py` échouent en setup (`relation "roles" does not exist`, puis doublon de `permissions`) : ces erreurs d'état de la base de test sont sans lien avec le chemin recommandation et restent à rejouer isolément. La suite E2E complète (390 tests, 2 workers) a aussi montré des échecs sur des specs non liées (`accessibilite-diagnostic.spec.ts`, `admin-dashboard.spec.ts`) ; les deux scénarios E2E dédiés à la recommandation étaient verts en exécution ciblée. Le démon Docker étant arrêté après le redémarrage de la session, le re-jeu isolé de ces cas n'a pas pu être lancé ici.

### 4.4 Ce que la validation garantit

- Toute requête passe par deux validations Pydantic (API IA puis Harness) et une troisième côté backend.
- Aucune connexion PostgreSQL n’est ouverte pendant l’appel IA.
- Une réponse LLM hors schéma est rejetée avant le backend.
- Une panne IA est traduite en `PARTIEL`, jamais en erreur visible.
- Les métadonnées d’exécution sont standardisées et sans secret.

---

## 5. État des livraisons et suite

| Livraison | Contenu | Cible | État |
| --- | --- | --- | --- |
| PR #93 | Contrat partagé, schémas, prompt, agent, route IA, répondeur factice, tests IA | `develop` | **Fusionnée** le 21 novembre 2026 (fusion `586ac82`, 2 reviewers IA). |
| PR 2 | Relais et revalidation backend, migration, route authentifiée, exposition frontend, docs | `develop` | En préparation (non ouverte) ; la dépendance sur #93 est levée par sa fusion, mais aucune fusion sans accord explicite. |

La PR 2 mentionnait explicitement sa dépendance sur #93 : les exemples de `contrats/ia/recommandation-parcours/` et la route `POST /recommandation/actions` viennent de la première, désormais présents sur `develop`.

### Ce qui reste hors périmètre

Évolutions possibles mais **non incluses** et à cadrer séparément : personnalisation fine par type d’exercice, propagation des recommandations vers la génération automatique d’exercices, RAG documentaire, mémoire pédagogique, modèle dédié, affichage enrichi (liens directs vers les exercices ciblés), suppression de l’empreinte en cas de changement de diagnostic sans demande explicite.

---

## Références principales

- `contrats/ia/recommandation-parcours/`
- `ia-service/app/main.py`, `app/api/recommandation.py`, `app/agents/recommandation.py`, `app/schemas/recommandation.py`, `app/prompts/registre.py`
- `ia-service/app/harness/execution.py`, `app/harness/agent.py`, `app/harness/registre.py`
- `backend/app/api/routes/parcours.py`, `app/services/recommandation.py`, `app/services/ia.py`, `app/schemas/ia.py`
- `backend/app/models/parcours.py`, `alembic/versions/20261121_rec_recommandation_ia.py`
- `backend/tests/test_recommandation.py`, `backend/tests/test_contrat_ia.py`
- `frontend/src/services/endpoints.ts`, `parcours-personnalise.service.ts`, `parcours-personnalise.mapper.ts`, `hooks/useParcoursPersonnalise.ts`
- `frontend/src/components/pedagogie/parcours/MonParcours.tsx`
- `docs/api/contrat-frontend.md`
