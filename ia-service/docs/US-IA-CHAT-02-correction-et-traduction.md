# US-IA-CHAT-02 — Correction séparée et traduction en cache

Cette PR branche deux tâches LLM distinctes dans le Harness du service IA, sans modifier le contrat public
`POST /chatbot/message` consommé aujourd'hui par le backend et le frontend. La bascule vers ces routes est prévue
dans la dernière PR du programme.

## Périmètre livré

- `POST /chatbot/correction` : analyse du dernier message de l'apprenant avec l'agent `chatbot-correction@1.0.0`
  déjà défini. Le JSON strict est validé, avec une seule reprise puis une liste vide de corrections par défaut.
- `POST /chatbot/traduction` : traduction d'une réponse de l'assistant vers le français avec l'agent
  `chatbot-traduction@1.0.0`. La sortie du LLM est validée par `TraductionGeneree`, puis enveloppée dans
  `ResultatTraduction` avec l'identifiant du message et le drapeau `cache_hit`.
- Prompt versionné `chatbot/traduction@1.0.0` : la réponse de l'assistant est une donnée non fiable, la traduction et
  l'explication sont en français, sans correction ni exercice.
- Le Harness reçoit la mémoire courte injectée (`memoire=`), transmise aux agents via `OutilsCommuns`. La traduction
  consulte `session:{identifiant_session}:traduction:{id_message}` avant tout appel LLM, puis y écrit le résultat.
- `app.state.memoire` est construit au démarrage depuis `REDIS_URL`, `REDIS_TTL_S` et `REDIS_TOURS_MAX`. Une
  configuration Redis invalide journalise un avertissement et replie sur `MemoireCourteVide` : le service démarre
  quand même et la traduction fonctionne sans cache. Une panne Redis reste absorbée par `MemoireRedis`.

## Contrats

Les deux routes utilisent l'enveloppe commune `RequeteAgent[T]` et répondent `ReponseAgent[T]` ou `ReponseErreur`.

- Entrée de correction : `EntreeChatbot` (`message`, `historique`), sortie `ResultatCorrection`
  (`phrase_originale`, `corrections`).
- Entrée de traduction : `EntreeTraduction` (`identifiant_session`, `id_message`, `message`), sortie
  `ResultatTraduction` (`id_message`, `traduction`, `explication`, `cache_hit`).
- L'identifiant de session est validé avant l'accès au cache : seuls les caractères alphanumériques, `_` et `-`
  sont acceptés, sur 64 caractères maximum. Une valeur invalide répond `422 ENTREE_INVALIDE` sans appel LLM.

## Règles vérifiées par les tests

- Les deux agents sont enregistrés au démarrage, avec leur version et leur empreinte de prompt.
- Le premier appel de traduction appelle le LLM une fois et écrit le cache ; le second retourne `cache_hit: true`
  sans appel LLM.
- Sans mémoire courte, la traduction reste fonctionnelle et le drapeau `cache_hit` reste `false`.
- Le prompt de traduction injecte la langue, le niveau et le message dans un bloc de données non fiables.
- La route `/chatbot/message` conserve son comportement : un seul appel LLM et son contrat 1.2.0 inchangé.

## Dépendance

Cette branche part de `us-ia-chat-01-structures-contrats` (PR #112). Elle doit être fusionnée après la PR 1.

## Non inclus dans cette PR

- La mémoire courte des tours et le résumé Assimil injectés dans la conversation (PR 3).
- La clôture de session et la mémoire long terme PostgreSQL (PR 4).
- La bascule du frontend et du backend vers les routes séparées (PR 5).

## Contrôles

```bash
docker run --rm -v "${PWD}:/work" -w /work/ia-service centre-langues-ia-service:latest \
  sh -c "ruff check . && ruff format --check . && pytest -q -p no:cacheprovider --cov=app --cov-fail-under=70"
```
