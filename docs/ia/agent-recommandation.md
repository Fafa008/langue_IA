# Agent Recommandation — documentation générale

**Date :** 21 novembre 2026  
**Identité :** `recommandation@1.0.0` · prompt `recommandation/actions@1.0.0`  
**État :** livré et actif sur `develop` (PR #93 `586ac82` + PR #94 `92b118c`)  
**Public concerné :** apprenant, backend, service IA, QA, maintenance

> Ce document décrit **ce que fait l'agent et comment l'utiliser**. Pour l'analyse de l'implémentation dans le Harness (déroulement interne, identités, validation détaillée), voir [`analyse-agent-recommandation-harness.md`](analyse-agent-recommandation-harness.md). Le contrat machine à machine est dans [`contrats/ia/recommandation-parcours/`](../../contrats/ia/recommandation-parcours/).

---

## 1. Rôle

L'agent Recommandation produit, à partir des **points faibles déjà détectés par le diagnostic** et du **niveau visé** du parcours, une liste courte d'**actions de remédiation** : quoi refaire, pourquoi, dans quel ordre, et avec quel type d'exercice.

Il s'agit d'une **proposition pédagogique**, pas d'une décision :

- le service IA **ne persiste rien**, n'accède à aucune base et ne connaît pas l'apprenant ;
- le **backend seul** décide : il prépare la requête, appelle l'IA, revalide la réponse, la persiste et l'expose ;
- le **frontend** affiche le résultat, sans recalculer ni deviner.

**En une phrase :** le diagnostic dit *ce qui ne va pas*, la recommandation dit *ce qu'on fait ensuite*, le parcours décide *ce qui est réellement proposé à l'apprenant*.

---

## 2. Périmètre de la v1

### Inclus

- Une action par domaine faible transmis (5 domaines maximum).
- Un type d'exercice **imposé par le domaine**, jamais choisi librement par le modèle.
- Une justification courte et une priorité pour chaque action.
- Un résumé et un score de confiance.
- Dégradation propre en `PARTIEL` si l'IA n'est pas exploitable.
- Idempotence : une demande identique ne rappelle pas l'IA.

### Explicitement hors périmètre

| Hors périmètre | Raison |
| --- | --- |
| Classement d'identifiants d'exercices candidats (RG08 au sens strict) | la v1 renvoie des **actions** et des **types**, pas des IDs |
| RAG documentaire, corpus, embedding | `RAG_CORPUS_ACTIF=false` par défaut ; aucun artefact ajouté |
| Mémoire pédagogique (`MemoirePedagogique`) | l'agent est sans état |
| Modèle dédié, changement de fournisseur, entraînement | aucun artefact versionné |
| Génération automatique d'exercices à partir des recommandations | étape suivante, à cadrer |
| Liens directs vers un exercice ciblé | affichage enrichi non livré |

---

## 3. Identité et configuration

| Paramètre | Valeur | Source |
| --- | --- | --- |
| Code agent | `recommandation` | `ia-service/app/schemas/recommandation.py` |
| Version agent | `1.0.0` | idem |
| Version prompt | `recommandation/actions@1.0.0` | `ia-service/app/prompts/registre.py` |
| Budget d'exécution | `30 000 ms` | `BUDGET_MS` |
| Actions maximales | `5` | `RECOMMANDATIONS_MAX` |
| Route IA | `POST /recommandation/actions` | `ia-service/app/api/recommandation.py` |
| Route backend | `POST /api/v1/parcours/{id}/recommandations` | `backend/app/api/routes/parcours.py` |
| Timeout frontend | `45 000 ms` | `frontend/src/services/parcours-personnalise.service.ts` |
| Fournisseur LLM par défaut | `factice` (`LLM_FACTICE_SCENARIO=demonstration`) | `ia-service/app/core/config.py` |
| Autres fournisseurs | `compatible-openai` (Groq), `gemini` | idem |
| `ENVIRONNEMENT=prod` | interdit `factice` (le démarrage échoue) | idem |
| `RAG_CORPUS_ACTIF` | `false` par défaut, sans effet sur cet agent | `.env.example` |
| `IA_SERVICE_URL` vide ou service en panne | réponse `PARTIEL`, sans erreur pour l'apprenant | `backend/app/services/ia.py` |

Le service IA est sur `back-tier`, **sans port hôte**. Pour l'appeler depuis un conteneur :

```bash
docker compose exec -T backend python -c "import urllib.request; urllib.request.urlopen('http://ia-service:8001/health', timeout=3)"
```

---

## 4. Données d'entrée

### 4.1 Requête envoyée au service IA

```json
{
  "request_id": "9c5f0f0a-6b0c-4bd4-9a1f-9b4d6b9a1234",
  "contexte": {
    "code_langue": "en",
    "referentiel": "CECRL",
    "niveau_preliminaire": "B1",
    "lecon_atteinte": 18
  },
  "entree": {
    "points_faibles": [
      {
        "domaine": "grammaire",
        "id_question": "q-12",
        "observation": "Le prétérit manque dans « yesterday I go ».",
        "justification": "Le repère temporel situe l'action dans le passé."
      },
      {
        "domaine": "vocabulaire",
        "id_question": "q-18",
        "observation": "Le mot « marchandise » est employé à la place de « goods ».",
        "justification": "Le champ lexical des achats reste imprécis."
      }
    ],
    "niveau_vise": "B2"
  }
}
```

- `points_faibles` : **1 à 5** éléments, un seul par domaine.
- `niveau_vise` : niveau cible calculé par le backend, jamais deviné par l'IA.
- Aucune donnée identifiante (ni nom, ni e-mail, ni ID utilisateur).

### 4.2 Correspondance domaine → type d'exercice

| Domaine | Type imposé |
| --- | --- |
| `grammaire` | `GRAMMAIRE` |
| `vocabulaire` | `VOCABULAIRE` |
| `comprehension_ecrite` | `COMPREHENSION` |
| `comprehension_orale` | `ECOUTE` |
| `expression_orale` | `ORAL` |
| `expression_ecrite` | **aucun** : domaine écarté, aucune proposition |

Cette table est définie côté IA (`TYPE_PAR_DOMAINE`) et mirrorée côté backend (`TYPE_EXERCICE_PAR_DOMAINE_IA`). Tout changement doit être fait des deux côtés.

---

## 5. Données de sortie

Enveloppe standard du Harness : `request_id`, `agent`, `version_agent`, `version_prompt`, `statut` (`succes` ou `erreur`), `resultat`, `meta`.

```json
{
  "request_id": "9c5f0f0a-6b0c-4bd4-9a1f-9b4d6b9a1234",
  "agent": "recommandation",
  "version_agent": "1.0.0",
  "version_prompt": "recommandation/actions@1.0.0",
  "statut": "succes",
  "resultat": {
    "code_langue": "en",
    "referentiel": "CECRL",
    "niveau_cible": "B2",
    "recommandations": [
      {
        "domaine": "grammaire",
        "type_exercice": "GRAMMAIRE",
        "action": "Refaire un exercice de conjugaison au prétérit sur des récits au passé.",
        "justification": "Le point faible porte sur le prétérit après un repère temporel explicite.",
        "priorite": 1
      },
      {
        "domaine": "vocabulaire",
        "type_exercice": "VOCABULAIRE",
        "action": "Réviser la liste de vocabulaire des achats, puis la réemployer dans une phrase.",
        "justification": "Le terme employé est proche mais imprécis ; un réemploi contextualisé est utile.",
        "priorite": 2
      }
    ],
    "resume": "Deux actions courtes : consolider le prétérit, puis préciser le vocabulaire des achats.",
    "confiance": 0.72
  },
  "meta": {
    "duree_ms": 1240,
    "fournisseur": "factice",
    "modele": "factice-1",
    "version_corpus": null,
    "empreinte_prompt": "sha256:…"
  }
}
```

| Champ | Type / contrainte |
| --- | --- |
| `code_langue` | code langue du contexte |
| `referentiel` | `CECRL` ou `HSK`, imposé par la langue |
| `niveau_cible` | doit être **égal** à `entree.niveau_vise` |
| `recommandations[]` | 0 à 5 actions |
| `domaine` | doit figurer parmi les points faibles transmis |
| `type_exercice` | imposé par le domaine (table ci-dessus) |
| `action`, `justification` | 1 à 240 caractères, espaces normalisés |
| `priorite` | entier strict de 1 à 5, **contigu** (1..N sans trou) |
| `resume` | 1 à 240 caractères |
| `confiance` | nombre de `0.0` à `1.0` (ni booléen ni texte) |

---

## 6. Règles de validation

Trois validations successives ont lieu : **API IA → Harness → backend**. Toute règle violée est refusée avant l'apprenant.

1. Un seul point faible par domaine en entrée.
2. `niveau_cible == entree.niveau_vise`.
3. `referentiel` cohérent avec `code_langue` (`CECRL`/`HSK`) et niveau membre du référentiel.
4. Chaque domaine proposé figure parmi les points faibles demandés.
5. `type_exercice` conforme à la table domaine → type.
6. pas de doublon de domaine dans les recommandations.
7. priorités contiguës de 1 à N.
8. `confiance = 0` ⇒ liste de recommandations **vide**.
9. Aucun domaine exploitable ⇒ réponse déterministe vide, `confiance = 0`, **sans appel LLM**.
10. Le backend rejette toute réponse incohérente avec la requête envoyée.

---

## 7. Architecture et responsabilités

```mermaid
sequenceDiagram
    participant A as Apprenant (Next.js)
    participant B as Backend FastAPI
    participant DB as PostgreSQL
    participant IA as ia-service (Harness)
    participant L as LLM / répondeur factice

    A->>B: POST /api/v1/parcours/{id}/recommandations (JWT)
    B->>B: vérifie rôle apprenant + propriété du parcours
    B->>B: lit analyse_ia, prépare une requête sans donnée identifiante
    B->>B: calcule l'empreinte ; si COMPLET en cache → retour direct
    B->>B: ferme la session PostgreSQL
    B->>IA: POST /recommandation/actions
    IA->>IA: valide l'entrée, rend le prompt, exécute le Harness
    IA->>L: generer_json(schema=ResultatRecommandation)
    L-->>IA: proposition JSON
    IA->>IA: valide + vérifie la cohérence
    IA-->>B: enveloppe ReponseAgent[ResultatRecommandation]
    B->>B: revalide contre la requête envoyée
    B->>DB: persiste parcours.recommandation_ia (JSONB)
    B-->>A: RecommandationParcoursOut (COMPLET ou PARTIEL)
```

| Couche | Responsabilité | Interdit |
| --- | --- | --- |
| `frontend/` | bouton « Afficher mes recommandations », affichage, relecture après rechargement | `fetch` direct, recalcul métier |
| `backend/` | JWT, propriété du parcours, préparation, appel hors session, revalidation, persistance, statut public | exposer un code technique IA |
| `ia-service/` | proposition sans état via le Harness, validation Pydantic, cohérence | accès DB, persistance, décision finale |
| `Harness` | exécution, budget, versions, empreinte du prompt — **inchangé** | logique métier spécifique |

---

## 8. API et intégration

### 8.1 Service IA (interne)

`POST /recommandation/actions` — route interne du `back-tier`, sans port hôte. Elle traduit les erreurs Harness en statuts HTTP et n'a pas de logique pédagogique.

### 8.2 Backend (apprenant)

`POST /api/v1/parcours/{id_parcours}/recommandations`

- authentification JWT requise (`401` sinon) ;
- réservé aux apprenants (`403` sinon) ;
- `404` si le parcours n'appartient pas à l'apprenant ;
- la connexion PostgreSQL est fermée avant l'appel HTTP vers l'IA ;
- réponse : `RecommandationParcoursOut` (`COMPLET` ou `PARTIEL`).

Le champ `recommandation` est également exposé dans `GET /api/v1/parcours/en-cours`, ce qui permet au frontend de réafficher le dernier résultat sans rappel.

### 8.3 Frontend

- endpoint source de vérité : `ENDPOINTS.parcours.recommandations(idParcours)` (`endpoints.ts`) ;
- service : `parcours-personnalise.service.ts` (timeout `45 s`, mode mock inclus) ;
- mapper : `parcours-personnalise.mapper.ts` — refuse une énumération inconnue ou des priorités non contiguës au lieu d'afficher une action incohérente ;
- hook : `useRecommandationsParcours` ;
- UI : section « Mes recommandations » dans `MonParcours.tsx`, **déclenchement explicite** par l'apprenant.

### 8.4 Idempotence

L'empreinte est un `sha256` canonique de `{contexte, entree}` (sans `request_id` aléatoire ni version d'agent). Elle est stockée dans `parcours.recommandation_ia`.

- même demande + résultat `COMPLET` en cache ⇒ réponse immédiate, aucun appel IA ;
- résultat `PARTIEL` **jamais mis en cache** : un rafraîchissement explicite retente ;
- changement du diagnostic ou du niveau visé ⇒ nouvelle empreinte ⇒ nouveau calcul.

---

## 9. Dégradation et erreurs

Aucun code technique IA n'est exposé à l'apprenant. Les codes internes (`non_configure`, `timeout`, `indisponible`, `reponse_invalide`, `http_<statut>`, `sans_appel`, `requete_invalide`) restent dans `parcours.recommandation_ia.code_technique` pour le diagnostic serveur.

| Situation | Résultat public |
| --- | --- |
| Aucun domaine exploitable (`expression_ecrite` seul, par ex.) | `PARTIEL`, liste vide, `confiance = 0` |
| Langue ou niveau hors contrat | `PARTIEL`, liste vide, **sans appel IA** |
| `IA_SERVICE_URL` vide, service en panne ou timeout | `PARTIEL`, liste vide |
| Réponse IA incohérente ou hors schéma | `PARTIEL`, liste vide |
| Confiance nulle renvoyée par le modèle | liste vide (règle de validation) |

Message public : *« Les recommandations personnalisées ne sont pas disponibles pour le moment. »*  
Aucun message d'erreur technique, aucun code HTTP IA dans l'interface.

---

## 10. Persistance

Colonne `parcours.recommandation_ia` (JSONB), migration `backend/alembic/versions/20261121_rec_recommandation_ia.py`.

```json
{
  "empreinte": "sha256:…",
  "public": { "statut": "COMPLET", "code_langue": "en", "referentiel": "CECRL", "niveau_cible": "B2", "recommandations": [], "resume": "…", "confiance": 0.72 },
  "enveloppe_ia": { "…": "enveloppe complète telle que reçue" },
  "code_technique": null
}
```

`public` est la partie lue par l'API ; `enveloppe_ia` conserve l'enveloppe complète pour audit ; `code_technique` n'est jamais exposé.

---

## 11. Sécurité et vie privée

- requête **sans donnée identifiante** : langue, référentiel, niveau, leçon atteinte, points faibles ;
- aucun appel IA avec une session PostgreSQL ouverte ;
- contrôle d'appartenance du parcours avant tout calcul ;
- aucune donnée de l'apprenant dans `meta` (durée, fournisseur, modèle, corpus, empreinte du prompt uniquement) ;
- GitGuardian : `No secrets detected ✅` sur le commit de livraison.

---

## 12. Validation et tests

| Couche | Tests | Résultat |
| --- | --- | --- |
| IA | `ia-service/tests/test_agent_recommandation.py`, `test_api_recommandation.py`, `test_contrat_recommandation.py` | couverture IA 96,20 % en #93 |
| Backend | `backend/tests/test_recommandation.py` (401/403/404, succès, idempotence, panne IA, réponse incohérente, absence de domaine, langue hors contrat), `test_contrat_ia.py` | couverture backend 95,87 % |
| Frontend | Jest (mapper, mock, service HTTP), E2E `e2e/mon-parcours.spec.ts` | verts en ciblé |
| CI | 6 checks sur `61058ed` | **tous `success`** (backend, IA, frontend check/build, E2E, Docker, GitGuardian) |

Commandes utiles (depuis la racine, sous Git Bash/WSL sur Windows) :

```bash
make check
cd frontend && npm run build && npm run test:e2e
```

---

## 13. Utilisation pratique

**Côté apprenant :** ouvrir « Mon parcours », cliquer sur **« Afficher mes recommandations »**. Le résultat reste affiché après rechargement. Le bouton devient « Actualiser les recommandations » après un premier calcul.

**Côté développeur :**

- vérifier la santé du service IA : voir §3 ;
- avec le fournisseur `factice` et `LLM_FACTICE_SCENARIO=demonstration`, la réponse est déterministe ;
- en environnement de développement, `NEXT_PUBLIC_API_MOCK=true` fait répondre les services depuis `src/mocks` : **aucun `fetch`** n'est effectué. Compose force `false` par défaut ;
- si le RAG semble ne rien renvoyer, vérifier d'abord `RAG_CORPUS_ACTIF` : ce n'est pas un bug de recommandation.

---

## 14. Évolutions possibles (non livrées)

Personnalisation fine par type d'exercice, classement réel d'exercices candidats (RG08), propagation vers la génération automatique d'exercices, RAG documentaire, mémoire pédagogique, affichage enrichi avec liens directs, suppression de l'empreinte lors d'un changement de diagnostic sans demande explicite.

---

## 15. Références

- Contrat partagé : [`contrats/ia/recommandation-parcours/`](../../contrats/ia/recommandation-parcours/)
- IA : `ia-service/app/agents/recommandation.py`, `app/api/recommandation.py`, `app/schemas/recommandation.py`, `app/main.py`
- Harness : `ia-service/app/harness/execution.py`, `app/harness/agent.py`
- Backend : `backend/app/services/recommandation.py`, `app/services/ia.py`, `app/api/routes/parcours.py`, `app/schemas/ia.py`, `app/schemas/parcours.py`, `app/models/parcours.py`
- Migration : `backend/alembic/versions/20261121_rec_recommandation_ia.py`
- Frontend : `frontend/src/services/endpoints.ts`, `parcours-personnalise.service.ts`, `parcours-personnalise.mapper.ts`, `src/hooks/useParcoursPersonnalise.ts`, `src/components/pedagogie/parcours/MonParcours.tsx`
- Contrat frontend : [`docs/api/contrat-frontend.md`](../api/contrat-frontend.md)
- Analyse d'implémentation : [`docs/ia/analyse-agent-recommandation-harness.md`](analyse-agent-recommandation-harness.md)
- PR : [#93](https://github.com/Fafa008/langue_IA/pull/93) (service IA), [#94](https://github.com/Fafa008/langue_IA/pull/94) (intégration)
