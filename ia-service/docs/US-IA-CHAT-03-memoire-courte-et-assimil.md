# US-IA-CHAT-03 — Mémoire courte Redis et dialogue CECRL/Assimil

Cette PR branche la mémoire courte et la pédagogie CECRL/Assimil dans la conversation du tuteur, sans changer la
forme du résultat public `POST /chatbot/message` (`reponse`, `corrections`, `traduction`, `explication`). La bascule
du frontend vers les routes séparées reste prévue dans la dernière PR du programme.

## Périmètre livré

- Agent `chatbot@2.0.0` (`app/agent/conversation.py`, prompt `chatbot/conversation@1.3.0`) enregistré à côté de la
  v1.2.0 : le Harness résout la dernière version SemVer, donc `/chatbot/message` bascule sur la v2 ; un appel
  explicite `version_agent: "1.2.0"` continue de fonctionner.
- `EntreeConversation` étend `EntreeChatbot` avec `identifiant_session` et `phase_assimil` optionnels : les anciens
  payloads restent valides. L'identifiant de session est validé avant tout accès Redis (`422 ENTREE_INVALIDE`).
- `ContexteApprenant` (IA) et `ContexteApprenantIA` (backend) gagnent `niveau_confirme: bool = False`. Le backend le
  calcule depuis le parcours : `test_diagnostic.niveau_final is not None`.
- Niveau effectif : tant que le diagnostic n'est pas clos, le tuteur raisonne au premier niveau du référentiel
  (A1 pour le CECRL, HSK 1 pour le HSK) et le prompt ouvre la conversation par une courte question de diagnostic.
- Phase Assimil : `phase_pour_tours` (imprégnation avant 4 tours, activation ensuite), surchargeable par
  `phase_assimil` explicite.
- Mémoire courte : les tours Redis (`session:{id}:turns`, 20 max) priment sur l'historique transmis par le backend ;
  sans session ou sans tours, repli sur `entree.historique`. Après la réponse, les deux tours de l'échange sont
  écrits (`rpush` + `ltrim`) et le résumé glissant (`session:{id}:summary`) est rafraîchi
  (`compteur_tours = min(1000, n + 2)`). TTL 24 h renouvelé à chaque accès.
- Descripteur CECRL/HSK : sélection via le RAG existant (compétence `oral`, limite 1) ; le repli synthétique est
  signalé `synthetique_fallback` / `A_VERIFIER` dans les métadonnées et journalisé sans contenu d'apprenant.
- Backend : `services/chatbot.py` transmet `identifiant_session` et `niveau_confirme` au service IA ; le contrat
  frontend est inchangé.
- Dégradation : Redis absent ou en panne → `MemoireRedis` absorbe l'erreur, la conversation continue avec
  l'historique backend ; configuration Redis invalide → `MemoireCourteVide` dès le démarrage.

## Règles vérifiées par les tests

- `ia-service/tests/test_conversation_v2.py` : niveau A1 non confirmé injecté avec `niveau_confirme: false`, phase
  activation déduite des tours, priorité des tours Redis sur l'historique, écriture des 2 tours et du résumé,
  niveau confirmé conservé sans session, identifiant de session invalide refusé sans appel LLM.
- `ia-service/tests/test_routes_chatbot_v2.py` : `/chatbot/message` répond `2.0.0` / `conversation@1.3.0` avec la
  mémoire branchée ; session invalide → 422 sans appel LLM ; `version_agent: "1.2.0"` sert encore l'ancien prompt.
- `backend/tests/test_chatbot.py` : le payload IA porte `niveau_confirme: false` (parcours sans diagnostic clos) et
  `identifiant_session`.
- `backend/tests/test_diagnostic_analyse.py` : le garde-fou d'anonymat inclut `niveau_confirme` (booléen du contrat
  de contexte, pas une identité).
- `backend/tests/test_parcours_correction.py` : le contexte transmis à la correction contient
  `niveau_confirme: false` tant que le diagnostic n'a pas de niveau final.

## Dépendance

Cette branche part de `us-ia-chat-02-correction-traduction` (PR #113) : elle doit être fusionnée après la PR 2.

## Non inclus dans cette PR

- La clôture de session, la mémoire long terme PostgreSQL et les exercices ciblés (PR 4).
- La bascule du frontend vers les routes séparées (PR 5).

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
