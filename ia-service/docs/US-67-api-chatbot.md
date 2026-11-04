# US67 — API REST du chatbot

| Élément | Valeur |
| --- | --- |
| User Story | US67 — « En tant que système, je veux exposer une API REST chatbot, afin d'intégrer l'IA. » |
| Branche | `feature/US67-api-chatbot` |
| Base | `develop` (`2e29112`, après fusion de l'US70) |
| Dépendances | US69 (client LLM et Harness), US70 (registre de prompts versionnés) |
| Statut | Implémenté, testé, documenté — en attente de revue |
| Périmètre | `ia-service/` uniquement : l'appel par le backend et l'écran du frontend font l'objet de la liaison |

## 1. Critères d'acceptation

| Critère | Réalisation |
| --- | --- |
| Endpoint `/chatbot/message` | `POST /chatbot/message`, déclaré dans `app/api/chatbot.py` et documenté dans `/docs` (OpenAPI) |
| Endpoint connecté au modèle | La route exécute l'agent `chatbot` dans le Harness, qui appelle le client LLM partagé (US69) avec le prompt `chatbot/conversation@1.0.0` (US70) |
| Tests | `tests/test_chatbot.py` : 22 tests (contrat, prompt, agent, route, erreurs), sans clé API ni réseau |
| Doc | ce document, `README.md` du service |

## 2. Ce qui a été ajouté

| Fichier | Rôle |
| --- | --- |
| `app/schemas/chatbot.py` | `EntreeChatbot`, `MessageHistorique`, `ResultatChatbot` (modèles stricts, bornés) |
| `app/prompts/chatbot/conversation@1.0.0.*.md` | prompt système et template de données, versionnés et immuables |
| `app/prompts/registre.py` | chargement du prompt chatbot, `rendre_conversation_chatbot()` et `definition()` |
| `app/prompts/variables.py` | `VariablesConversationChatbot`, validées avant tout rendu |
| `app/agents/chatbot.py` | agent `chatbot@1.0.0` : rend le prompt puis appelle `generer_json(schema=ResultatChatbot)` |
| `app/api/chatbot.py` | route `POST /chatbot/message` : confie la requête au Harness, traduit l'erreur en statut HTTP |
| `app/core/gestionnaire_erreurs.py` | `gerer_erreur_validation` : corps hors contrat → `ENTREE_INVALIDE` sans recopier la valeur |
| `app/main.py` | enregistrement de l'agent au démarrage, du routeur et du handler de validation |

Le registre de prompts n'a pas changé de comportement pour le diagnostic : `_valider_template` reçoit désormais la
liste des variables attendues (celle du diagnostic par défaut).

## 3. Contrat HTTP

La requête utilise l'enveloppe commune du Harness (`RequeteAgent[EntreeChatbot]`, voir
[`contrat-modeles-ia.md`](contrat-modeles-ia.md)).

```http
POST /chatbot/message
Content-Type: application/json
```

```json
{
  "request_id": "3f1c9b7e-6a2d-4f0e-9c1a-2b7d5e8f4a10",
  "contexte": { "code_langue": "en", "referentiel": "CECRL", "niveau_preliminaire": "A2" },
  "entree": {
    "message": "How long I study English?",
    "historique": [
      { "role": "assistant", "contenu": "Hello! How can I help you today?" }
    ]
  }
}
```

| Champ | Règle |
| --- | --- |
| `entree.message` | obligatoire, 1 à 2 000 caractères après suppression des espaces superflus |
| `entree.historique` | facultatif, 20 tours au maximum, ordre chronologique |
| `historique[].role` | `apprenant` ou `assistant` uniquement : un rôle `system` est refusé |
| `historique[].contenu` | 1 à 4 000 caractères |
| `contexte` | `ContexteApprenant` : langue, référentiel cohérent, niveau, mémoire pédagogique facultative |

Réponse `200` (`ReponseAgent[ResultatChatbot]`) :

```json
{
  "request_id": "3f1c9b7e-6a2d-4f0e-9c1a-2b7d5e8f4a10",
  "agent": "chatbot",
  "version_agent": "1.0.0",
  "version_prompt": "chatbot/conversation@1.0.0",
  "statut": "succes",
  "resultat": { "reponse": "On dit : « I have been studying English for two years. »" },
  "meta": {
    "duree_ms": 204,
    "fournisseur": "compatible-openai",
    "modele": "modele-local",
    "version_corpus": null,
    "empreinte_prompt": "sha256:…"
  }
}
```

### Erreurs

| Situation | Statut | Corps |
| --- | --- | --- |
| Corps hors contrat (champ inconnu, message vide, contexte incohérent…) | 422 | `{code: "ENTREE_INVALIDE", message, retryable: false}` |
| Délai dépassé | 504 | enveloppe `ReponseErreur`, code `LLM_TIMEOUT`, `retryable: true` |
| Fournisseur injoignable ou 5xx | 503 | `LLM_INDISPONIBLE`, `retryable: true` |
| Limite de débit du fournisseur | 429 | `LLM_LIMITE_REQUETES`, `retryable: true` |
| Réponse du modèle non conforme à `ResultatChatbot` | 502 | `LLM_REPONSE_INVALIDE`, `retryable: true` |
| Clé refusée / requête refusée par le fournisseur | 502 | `LLM_AUTHENTIFICATION` / `LLM_REQUETE_INVALIDE`, `retryable: false` |
| Configuration LLM invalide (ex. : `factice` sans scénario) | 500 | `LLM_CONFIGURATION`, `retryable: false` |

Les erreurs du Harness gardent l'enveloppe `ReponseErreur` (`request_id`, `agent`, `erreur`) pour que le backend
puisse corréler et décider de rejouer. La réponse 422 par défaut de FastAPI recopie la valeur refusée, donc le
message de l'apprenant : elle est remplacée, et seuls les emplacements des champs fautifs sont journalisés.

## 4. Décisions

- **Service sans état.** Le service IA ne stocke aucune conversation : le backend, propriétaire des données,
  renvoie l'historique récent à chaque appel. La borne de 20 tours garde un prompt de taille prévisible.
- **Historique dans le bloc de données, pas en messages `assistant`.** Le modèle reçoit toujours deux messages
  (système + données). Un historique fourni par l'appelant ne peut donc pas se faire passer pour une consigne ou une
  réponse antérieure du modèle ; les chevrons sont échappés comme pour le diagnostic.
- **Réponse JSON plutôt que flux.** `generer_json` bénéficie des reprises bornées (US-154) et de la validation par
  schéma ; le streaming (`generer_flux`) pourra faire l'objet d'une route dédiée si l'interface en a besoin.
- **Température 0,5.** Plus haute que le diagnostic (0,2) : une conversation gagne à varier ses formulations.
- **Pas de niveau ni de note.** Le prompt interdit au chatbot d'attribuer un niveau : il relève du diagnostic.

## 5. Vérifications

```bash
cd ia-service
pip install -r requirements-dev.txt
pytest --cov=app --cov-report=term-missing --cov-fail-under=70
ruff check . && ruff format --check .
```

Résultat mesuré le 3 novembre 2026 : **343 tests réussis**, couverture **99 %**, ruff 0.8.4 sans erreur.

Vérification de bout en bout : le service a été lancé avec `LLM_FOURNISSEUR=compatible-openai` pointant vers un
serveur local imitant `/v1/chat/completions`. `POST /chatbot/message` a renvoyé `200` avec la réponse du modèle ;
le serveur a bien reçu `response_format=json_object`, la température `0.5` et le bloc
`<donnees_conversation_non_fiables>`. Un message vide a renvoyé `422 ENTREE_INVALIDE`, et un modèle
injoignable `503 LLM_INDISPONIBLE` (enveloppe `ReponseErreur`).

Essai manuel avec un vrai fournisseur :

```bash
LLM_FOURNISSEUR=compatible-openai LLM_MODELE=<modèle> LLM_BASE_URL=<url>/v1 LLM_API_KEY=<clé> \
  uvicorn app.main:app --port 8001
curl -X POST localhost:8001/chatbot/message -H 'Content-Type: application/json' -d @requete.json
```

Avec le fournisseur `factice` par défaut, aucun scénario n'est préparé : la route répond `500 LLM_CONFIGURATION`.

## 6. Hors périmètre (suite)

- Route du backend (`/api/v1/...`) authentifiée qui construit le contexte apprenant, conserve l'historique et
  appelle `IA_SERVICE_URL/chatbot/message`.
- Écran de conversation du frontend.
- Réponse en flux (SSE) si l'expérience utilisateur l'exige.
