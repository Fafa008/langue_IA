# US-IA-CHAT-01 — Structures, contrats et prompts du tuteur chatbot

Cette PR pose les fondations du tuteur IA sans changer le comportement observable de `POST /chatbot/message`. Le contrat
actuel (`reponse`, `corrections`, `traduction`, `explication`) reste celui consommé par le backend et le frontend.

## Périmètre livré

- `app/agent/` : définition définitive de l'agent conversationnel (`1.2.0`) et de la tâche de correction séparée
  (`chatbot-correction@1.0.0`). Les anciens modules `app/agents/` et `app/api/` réexportent les symboles pour éviter
  toute rupture d'import.
- `app/memory/` : clés Redis, port de mémoire courte, implémentation Redis dégradée et charge utile de mémoire long
  terme. Aucun accès SQLAlchemy n'est ajouté au service IA : PostgreSQL appartient au backend.
- `app/cecrl/` : résolution du niveau effectif (A1/HSK 1 par défaut si le niveau n'est pas confirmé), sélection d'un
  descripteur via le RAG existant avec repli synthétique étiqueté, et calcul de la phase Assimil.
- `app/routes/` : emplacement source de la route chatbot ; `app/api/chatbot.py` devient un simple re-export.
- Contrats Pydantic v2 ajoutés dans `app/schemas/chatbot.py` : correction détaillée, tours et résumé de session,
  traduction en cache, profil/erreurs/sessions pour la mémoire long terme et exercices ciblés.
- Prompts versionnés : `chatbot/conversation@1.3.0` (CECRL + Assimil) et `chatbot/correction@1.0.0` (JSON strict).
- Configuration Redis : `REDIS_URL`, `REDIS_TTL_S` (24 h), `REDIS_TOURS_MAX` (20). La dépendance `redis==5.2.1` est
  ajoutée aux dépendances du service.

## Règles vérifiées par les tests

- Toutes les clés Redis sont préfixées par `session:{identifiant_session}` ; l'identifiant est validé.
- La liste des tours est bornée à 20 et le TTL de 24 h est renouvelé à chaque accès.
- Une panne Redis ne propage jamais d'erreur au chat : la lecture retourne une valeur vide et l'écriture est ignorée,
  avec un log sans identifiant ni contenu d'apprenant.
- Le JSON de correction est strict : type parmi `grammaire`/`orthographe`/`syntaxe`, au plus 3 corrections, liste vide
  si la phrase est correcte, reprise unique puis valeur par défaut.
- Le niveau injecté dans le prompt est ramené à A1/HSK 1 tant qu'il n'est pas confirmé, et l'étape de diagnostic est
  signalée ; le descripteur RAG est filtré par langue, référentiel et niveau.
- Les prompts 1.3.0 et de correction sont rendus avec des variables validées et une empreinte stable.

## Non inclus dans cette PR

- Le branchement de Redis dans `app/main.py` et l'enregistrement de `chatbot-correction` dans le Harness (PR 2 et 3).
- Les routes de correction, de traduction et de clôture de session (PR 2 à 4).
- Les migrations et tables backend de mémoire long terme (PR 4).
- La bascule du frontend vers les nouveaux champs (PR 5).

## Contrôles

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --build --rm --no-deps ia-service ruff format --check .
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --build --rm --no-deps ia-service ruff check .
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --build --rm --no-deps ia-service pytest -p no:cacheprovider
```
