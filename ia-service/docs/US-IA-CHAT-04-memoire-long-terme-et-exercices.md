# US-IA-CHAT-04 — Mémoire long terme et exercices ciblés

Cette PR ajoute la mémoire pédagogique persistée à la clôture d'une session de chat et la génération d'exercices
ciblés. Le service IA reste sans base : il produit des charges utiles typées ; **le backend seul persiste**. Le
contrat public `POST /chatbot/message` n'est pas modifié : la bascule du frontend vers les routes séparées reste
prévue dans la PR 5.

## Périmètre livré

### Service IA

- Agent `chatbot-memoire@1.0.0` (`app/agent/memoire.py`, prompt `chatbot/memoire@1.0.0`) : relit les tours et le
  résumé Redis, demande au LLM un résumé court et des erreurs récurrentes, puis renvoie `ChargeMemoireLongTerme`.
  Sans tour ni résumé, aucun appel LLM n'est fait et le résumé vaut `Session sans échange enregistré.`.
- Agent `chatbot-exercice@1.0.0` (`app/agent/exercice.py`, prompt `chatbot/exercice@1.0.0`) : traduit le type
  d'erreur en compétence documentaire, sélectionne un descripteur via le RAG existant (limite 1) et génère un seul
  exercice. L'identifiant du descripteur est ajouté par le service IA, jamais par le modèle ; aucun score ni
  correction n'est produit. Le repli synthétique reste signalé `synthetique_fallback` / `A_VERIFIER`.
- Routes internes `POST /chatbot/session/close` et `POST /chatbot/exercice`, enregistrées dans le Harness au
  démarrage. Un identifiant de session invalide est refusé (`422 ENTREE_INVALIDE`) avant tout appel LLM.

### Backend

- Trois tables PostgreSQL et la migration Alembic `e4b1c7a92d35` : `profil_memoire_chatbot` (profil pseudonyme),
  `erreur_recurrente_chatbot` (agrégat par type et extrait) et `session_memoire_chatbot` (bilan par session).
- `services/memoire_chatbot.py` est le seul point d'écriture : les erreurs sont additionnées par fréquence et la
  date de dernière occurrence est conservée ; le profil reste pseudonyme, aucun nom ni e-mail ne traverse la
  frontière IA. L'identifiant pseudonyme est recalculé par le backend (`HMAC(SECRET_KEY, id_user)`) : la valeur
  renvoyée par l'IA n'est jamais persistée telle quelle.
- `DELETE /api/v1/chatbot/session/{id}` appelle la clôture IA puis persiste la charge **avant** de supprimer
  l'historique et le quota. Si le service IA échoue, la session est quand même fermée et seule la mémoire long
  terme est absente.
- Nouveau contrat public `POST /api/v1/chatbot/exercice` : `ExerciceCibleChatbotIn` /
  `ExerciceCibleChatbotOut`. L'exercice est enregistré dans la banque unique avec `statut="brouillon"`,
  `origine="systeme:ia_chat"` et `auteur="systeme:ia_chat"` ; la contrainte `ck_exercice_origine` est étendue par
  la migration. La réponse expose `id_exercice`, `enonce`, `consigne`, `descripteur_id` et `niveau`.

## Règles vérifiées par les tests

- `ia-service/tests/test_memoire_exercice_v2.py` : définitions des agents, synthèse sans identité dans le prompt,
  absence d'appel LLM sur une session vide, refus d'un identifiant de session invalide, descripteur ajouté par le
  service et non par le modèle, et contrat HTTP des deux nouvelles routes.
- `backend/tests/test_chatbot.py` : persistance du profil, des erreurs et du bilan à la clôture ; absence de données
  personnelles dans la requête envoyée à l'IA ; agrégation des fréquences sur deux sessions ; fermeture sans IA ;
  génération d'un exercice brouillon `systeme:ia_chat` ; refus d'un niveau hors référentiel ; `404` sans parcours ;
  contrainte d'origine `systeme:ia_chat` acceptée et origine inconnue refusée par PostgreSQL.
- Les journaux restent sans texte brut : seuls des comptes et des identifiants techniques sont journalisés.

## Dépendance

Cette branche part de `us-ia-chat-03-memoire-assimil` (PR #114), elle-même issue de la PR #113 : elle doit être
fusionnée après ces deux PR. Le miroir `ResultatChatbotIA` reste en `extra="forbid"`, aucun champ public n'est ajouté
avant la PR 5.

## Non inclus dans cette PR

- La bascule du frontend vers `POST /chatbot/correction`, `POST /chatbot/traduction` et `POST /chatbot/exercice`
  (PR 5).
- L'affichage d'un score ou d'une correction dans l'exercice généré.

## Contrôles

```bash
# Service IA (CI-like)
docker run --rm -v "${PWD}:/work" -w /work/ia-service centre-langues-ia-service:latest \
  sh -c "ruff check . && ruff format --check . && pytest -q -p no:cacheprovider --cov=app --cov-fail-under=70"

# Backend ciblé (DB de test PostgreSQL via Compose)
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm --no-deps backend \
  pytest tests/test_chatbot.py tests/test_diagnostic_analyse.py tests/test_ia_service.py \
         tests/test_parcours_correction.py tests/test_recommandation.py -q -p no:cacheprovider
```
