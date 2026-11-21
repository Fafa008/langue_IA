# Plan Chatbot — conforme CONTRIBUTING et ClickUp

**Centre Langues IA · La Digithèque**

Sources, dans l'ordre :

1. `CONTRIBUTING.md` (branches, commits, PR, revue, tests, CI).
2. Export ClickUp `resume_taches.csv` (218 lignes), lu depuis `C:\Users\Fana\Downloads\resume_taches.csv`, hors dépôt et non versionné.
3. `docs/Revue_Conception_et_Planification_Chatbot_v2.md` (version 2, présente).

Aucune tâche ClickUp n'a été modifiée. Les identifiants, noms exacts, statuts et responsables ci-dessous sont reproduits tels quels de l'export.

---

## 1. Table de correspondance

| ID plan | Identifiant ClickUp exact | Nom exact | Statut | Responsable | Branche CONTRIBUTING | PR |
|---|---|---|---|---|---|---|
| D1–D6 | — | — | — | Product Owner / expert IA | `docs/plan-chatbot` | `[US-67] Plan chatbot et décisions` |
| P1-1 | — | — | fait localement (`8a04142`) | Backend | `feature/US67-api-chatbot` | `[US-67] API chatbot : jeton interne et fermeture du port` |
| P1-2 | — | — | fait localement (`60eb7e2`) | Backend | `feature/US67-api-chatbot` | `[US-67] API chatbot : quota par apprenant` |
| P1-3 | `123t3hw0f45` | `[Sprint 5] PRE-S5-01 – Validation de l'expert IA des prompts du chat et du mode thème` | consigne provisoire, validation à venir | Fafa | `feature/US67-api-chatbot` | `[US-67] API chatbot : validation des prompts` |
| P1-4 | `123t3hw0f49` | `[Sprint 5] PRE-S5-05 – Confirmer que la route du jeu de rôle (US67) est appelable depuis le sprint 4` | fait localement (`b409bda`) | — | `feature/US67-api-chatbot` | `[US-67] API chatbot : appel confirmé` |
| P1-5 | `123t3hw0f50` | `[Sprint 5] DEV-ENV – Environnement de recette du chat` | fait localement : job Docker CI rejoué vert (healthchecks, contrat IA, seed idempotent, images dev) | — | `feature/US72-interface-chat` | `[US-72] Interface de chat : environnement de recette` |
| P2-1 / P2-2 | `123t3hw0f4p` | `[Sprint 5] US74-IA – Prompt de correction et schéma du bloc corrections[] (revue de l'expert IA)` | fait localement (`cfd9088`, `59c7be5`, `e8e0b20`), relecture expert IA à venir | Fafa | `feature/US74-corrections` | `[US-74] Corrections en marge : consigne et schéma` |
| P2-3 | — | — | fait localement (`59c7be5`) | Expert IA | `feature/US74-corrections` | `[US-74] Corrections en marge : réponse de démonstration` |
| P2-4 | `123t3hw0f38` | `[Sprint 4] US67-QA – Test de fumée de la route chatbot` | fait localement (`b409bda`) | — | `feature/US67-api-chatbot` | `[US-67] API chatbot : tests de l'agent` |
| P3-1 | `123t3hw0f37` | `[Sprint 4] US67-BE – Route /chatbot/message, validation et timeout` | fait localement (`b409bda`) | — | `feature/US67-api-chatbot` | `[US-67] API chatbot : route backend` |
| P3-2 | `123t3hw0f4q` | `[Sprint 5] US74-BE – Relais entre le chat et le Service IA, validation du bloc corrections[]` | fait localement (`b409bda`, `2624b56`) | — | `feature/US74-corrections` | `[US-74] Corrections en marge : relais backend` |
| P3-3 | — | — | fait localement (`b409bda`) | Backend | `feature/US72-interface-chat` | `[US-72] Interface de chat : historique de session` |
| P3-4 | — | — | fait localement (`60eb7e2`, `b409bda`, `2624b56`) | Backend | `feature/US67-api-chatbot` | `[US-67] API chatbot : contrôle du quota` |
| P3-5 | `123t3hw0f4m` | `[Sprint 5] US68-BE – Enregistrement de chaque échange dans la table de journal` | to do | — | `feature/US68-journal-echange` | `[US-68] Journal des échanges : table et enregistrement` |
| P3-5 | `123t3hw0f4h` | `[Sprint 5] US75-BE – Tables de traçabilité des appels IA et référentiel des scénarios` | to do | — | `feature/US75-tracabilite` | `[US-75] Traçabilité des appels IA` |
| P3-6 | `123t3hw0f4j` | `[Sprint 5] US132-BE – Filtre d'anonymisation avant appel et journaux (règles déterministes)` | to do | — | `feature/US132-anonymisation` | `[US-132] Anonymisation avant appel` |
| P3-7 | `123t3hw0f5m` | `[Sprint 6] US161-BE – Variable DEMO_MODE et cache des réponses IA (hash entrée + version du prompt)` | to do | — | `feature/US161-mode-demo` | `[US-161] Mode démo : réponses du chatbot` |
| P4-1 | `123t3hw0f4r` | `[Sprint 5] US72-FE – Interface de chat : texte et historique de la session` | fait localement (`1ac842c`) | — | `feature/US72-interface-chat` | `[US-72] Interface de chat : envoi réel` |
| P4-2 | `123t3hw0f4t` | `[Sprint 5] US74-FE – Affichage des corrections en marge, sans couper la conversation` | fait localement (`1ac842c`) | — | `feature/US74-corrections` | `[US-74] Corrections en marge : affichage` |
| P4-3 | `123t3hw0f4u` | `[Sprint 5] US73-FE – Liste déroulante : scénario et langue (sacrifiable)` | to do | — | `feature/US73-scenario-langue` | `[US-73] Choix du scénario et de la langue` |
| P4-4 | — | — | fait localement (`442042d`) | Frontend | `feature/US72-interface-chat` | `[US-72] Interface de chat : avertissement RG11` |
| P4-5 | — | — | fait localement (`1ac842c`) | Frontend | `feature/US72-interface-chat` | `[US-72] Interface de chat : retrait du mock` |
| P5-1 | — | — | fait localement (`c329f9b`) : test HTTP simulé du relais vers le service IA | Backend / QA | `feature/US67-api-chatbot` | `[US-67] API chatbot : test d'intégration du relais` |
| P5-2 | `123t3hw0f52` | `[Sprint 5] QA-E2E – Test de bout en bout du chat, du journal et du refus avant la leçon 50` | partiel : cible `e2e/chat.spec.ts` verte en desktop/mobile (`d331098`) ; suite complète (388 tests) interrompue après 7 tests avec 2 échecs hors chat dans `accessibilite-diagnostic.spec.ts`, journal et refus avant leçon 50 à couvrir | — | `feature/US72-interface-chat` | `[US-72] Interface de chat : E2E` |
| P5-3 | `123t3hw0f51` | `[Sprint 5] QA-LAT – Mesure de la latence du chat (moins de 2 secondes)` | fait localement : 5 appels HTTP 200, moyenne 0,406 s, maximum 0,609 s | — | `feature/US67-api-chatbot` | `[US-67] API chatbot : mesure de latence` |
| P5-4 | `123t3hw0f4k` | `[Sprint 5] US132-QA – Tests de phrases piégées à chaque PR` | to do | — | `feature/US132-anonymisation` | `[US-132] Anonymisation : phrases piégées` |
| P5-5 | `123t3hw0f4n` | `[Sprint 5] US68-QA – Test : le journal ne contient aucune donnée personnelle` | to do | — | `feature/US68-journal-echange` | `[US-68] Journal des échanges : test RG11` |
| O-1 | `123t3hw0f4v` / `123t3hw0f4w` / `123t3hw0f4x` | `[Sprint 5] US160-IA – Prompt du mode thème et trois variantes (revue de l'expert IA)` / `[Sprint 5] US160-BE – Route du mode thème et refus avant la leçon 50` / `[Sprint 5] US160-FE – Écran de saisie et affichage des trois variantes` | to do | — / — / — | `feature/US160-mode-theme` | `[US-160] Mode thème : consigne, route, écran` |
| O-2 | `123t3hw0f4y` / `123t3hw0f4z` | `[Sprint 5] BILAN-IA – Synthèse des trois erreurs récurrentes de fin de session` / `[Sprint 5] BILAN-BE – Sauvegarde du bilan de session par le Backend` | to do | — / — | `feature/US158-bilan-session` | `[US-158] Bilan de session` |

Tâches complémentaires du lot, à intégrer ou à signaler :

- `123t3hvzezx` — `[Sprint 6] US67 – API chatbot` — complete — Finoana AVOTRINIAINA
- `123t3hvzezy` — `[Sprint 6] US75 – Tables log/scenario` — to do
- `123t3hw0f4d` — `[Sprint 5] US73 – Choix du scénario et de la langue (sacrifiable)` — to do
- `123t3hw0f4e` — `[Sprint 5] US160 – Mode thème tri-niveaux (sacrifiable en premier)` — to do
- `123t3hw0f4f` — `[Sprint 5] Bilan de fin de session (reprise de US158)` — to do
- `123t3hw0f4g` — `[Sprint 5] Tests et recette du chat (latence, refus avant leçon 50)` — to do
- `123t3hw0f4a` — `[Sprint 5] US75/US132 – Traçabilité des appels IA et anonymisation des journaux` — to do
- `123t3hw0f4b` — `[Sprint 5] US68 – Enregistrement de chaque échange` — to do
- `123t3hw0f4c` — `[Sprint 5] US72/US74 – Chat complet avec corrections en marge` — to do
- `123t3hw0f2u` — `[Sprint 4] US67/US159 – Route /chatbot/message et jeu de rôle borné` — to do
- `123t3hw0f36` — `[Sprint 4] US159-IA – Prompt du jeu de rôle borné (scénario, niveau, leçon, historique court)` — to do — Fafa
- `123t3hw0f34` — `[Sprint 4] US157-BE – Branchement du contrat v2 côté Backend et sauvegarde` — to do
- `123t3hw0f33` — `[Sprint 4] US157-IA – Schéma Pydantic v2 du feedback (phase, champs stricts)` — to do — Fafa
- `123t3hw0f35` — `[Sprint 4] US157-QA – Test de contrat à chaque PR` — to do
- `123t3hw0f2p` — `[Sprint 4] PRE-S4-03 – Vérifier la clé LLM en secret et le test de contrat dans le pipeline` — to do — Fafa
- `123t3hw0f2q` — `[Sprint 4] PRE-S4-04 – Vérifier la capacité de l'équipe (environ 21 points)` — complete
- `123t3hw0f2r` — `[Sprint 4] PRE-S4-05 – Environnement de recette prêt pour le chat` — to do
- `123t3hw0f2m` — `[Sprint 4] PRE-S4-01 – Validation PO des nouvelles US (US155, US157, US158, US159)` — to do
- `123t3hw0f2n` — `[Sprint 4] PRE-S4-02 – Solder le reliquat du Sprint 3 (US36, US41 à US46)` — confirmation — Finoana AVOTRINIAINA
- `123t3hw0f46` — `[Sprint 5] PRE-S5-02 – Décision du Product Owner sur le mode thème (absent du backlog)` — to do
- `123t3hw0f47` — `[Sprint 5] PRE-S5-03 – Liste des données personnelles à retirer avant tout appel IA et tout journal` — to do
- `123t3hw0f48` — `[Sprint 5] PRE-S5-04 – Jeu de phrases piégées pour l'anonymisation` — to do
- `123t3hw0f5c` — `[Sprint 6] US161 – Mode démo (réponses pré-enregistrées et rejeu)` — to do
- `123t3hw0f5n` — `[Sprint 6] US161-IA – Revue des réponses pré-enregistrées pour les étapes du scénario` — to do — Fafa
- `123t3hw0f5p` — `[Sprint 6] US161-DEV – Sauvegarde de la base et environnement de démo` — to do
- `123t3hw0f5q` — `[Sprint 6] US161-FE – Indication du mode démo (facultatif)` — to do
- `123t3hw0f5e` — `[Sprint 6] US162 – Validation du MVP de bout en bout et rapport` — to do
- `123t3hw0f5u` — `[Sprint 6] US162-QA – Rejeu du scénario complet (neuf étapes), en mode normal et en mode démo` — to do
- `123t3hw0f5v` — `[Sprint 6] US162-BE – Corrections des défauts backend remontés par le test` — to do
- `123t3hw0f5w` — `[Sprint 6] US162-FE – Corrections des défauts d'interface remontés par le test` — to do
- `123t3hw0f5x` — `[Sprint 6] US162-DEV – Version figée et rapport de validation du MVP` — to do

---

## 2. User stories et PR

Chaque branche part de `develop`, titre `[US-XX] Description courte`, template du CONTRIBUTING, minimum 1 reviewer (2 pour l'IA), CI verte avant merge.

- `feature/US67-api-chatbot` → `[US-67] API chatbot : route backend, jeton, quota, timeout, latence`
- `feature/US68-journal-echange` → `[US-68] Journal des échanges : table, enregistrement, test RG11`
- `feature/US72-interface-chat` → `[US-72] Interface de chat : envoi réel, historique, E2E, retrait du mock`
- `feature/US73-scenario-langue` → `[US-73] Choix du scénario et de la langue`
- `feature/US74-corrections` → `[US-74] Corrections en marge : consigne, schéma, relais, affichage`
- `feature/US75-tracabilite` → `[US-75] Traçabilité des appels IA et référentiel des scénarios`
- `feature/US132-anonymisation` → `[US-132] Anonymisation avant appel et journaux`
- `feature/US157-feedback` → `[US-157] Contrat de feedback v2 (distinct des corrections)`
- `feature/US158-bilan-session` → `[US-158] Bilan de fin de session`
- `feature/US159-jeu-role` → `[US-159] Jeu de rôle borné`
- `feature/US160-mode-theme` → `[US-160] Mode thème tri-niveaux (optionnel)`
- `feature/US161-mode-demo` → `[US-161] Mode démo : réponses pré-enregistrées du chat`

Tests à faire passer pour chaque PR : `make test`, `make test-ia` (`pytest --cov=app`, seuil 70 %), `ruff check .`, `ruff format --check .`, `npm run check`, `npm run test:e2e`, `npm run build`, CI docker incluse.

Contrôles locaux rejoués après l'ouverture de Docker : backend `ruff`/`pytest` verts (366 tests, 96,41 %), IA `ruff`/`pytest` verts (96,38 %), frontend `npm run check` (381 tests Jest) et `npm run build` verts, cible E2E du chat 2/2 en desktop et mobile.

Le job Docker CI a aussi été rejoué localement : après un `down --volumes` nécessaire à cause d'une révision Alembic héritée d'une autre branche, la stack complète est healthy ; health backend/IA/frontend OK, port 8001 non exposé, formule Simple et seed de démonstration OK, `verifier_contrat_ia` conforme, second `app.seed` idempotent, images de développement buildées.

La suite E2E complète a été retentée avec un seul worker et un serveur Next lancé manuellement sur le port 3100 : 388 tests collectés, arrêt du wrapper après 7 tests, avec 2 échecs dans `e2e/accessibilite-diagnostic.spec.ts` en desktop. Ces échecs sont externes au chat ; le journal et le refus avant la leçon 50 restent à couvrir.

Le contrôle IA a été lancé avec un environnement Compose neutre et le dépôt monté en `/work` : le `.env` local injecte des variables `GEMINI_*`/`RAG_*` vides qui écrasent les alias Pydantic attendus par les tests, et le montage par défaut en `/app` fait remonter `RACINE_DEPOT` à `/`.

La latence du chat a été mesurée sur la stack dev, avec un parcours minimal créé pour le compte démo et les fichiers IA de `feature/US74-corrections` empruntés temporairement au worktree (scénario factice `demonstration` de cette branche-ci ne sachant pas encore répondre au chatbot). Cinq appels consécutifs à `POST /api/v1/chatbot/message` ont renvoyé HTTP 200, avec `version_prompt=chatbot/conversation@1.1.0` et un quota décroissant de 19 à 15 : 0,609 s, 0,594 s, 0,272 s, 0,263 s et 0,293 s. Moyenne 0,406 s, maximum 0,609 s, donc objectif < 2 s respecté. Les fichiers IA empruntés ont été restaurés immédiatement après la mesure ; aucun commit ni changement de branche de code n'a été fait pour cette mesure.

Le test d'intégration du relais (`backend/tests/test_chatbot.py`, `c329f9b`) traverse désormais la route backend, le client HTTP `app.services.ia`, un `httpx.MockTransport` et la validation de l'enveloppe IA. Il vérifie le chemin `/chatbot/message`, le contexte `en`/`CECRL`/`B1`, le message transmis, l'historique vide et la persistance des deux tours en base. Suite backend complète verte : 366 tests, couverture 96,41 %.

---

## 3. Non présentes dans ClickUp

1. `[Chatbot] Jeton interne backend↔IA et fermeture du port 8001`
2. `[Chatbot] Politique et table de quota`
3. `[Chatbot] Historique de session côté backend`
4. `[Chatbot] Réponse de démonstration`
5. `[Chatbot] Avertissement sur l'envoi de l'historique`
6. `[Chatbot] Retrait du mock du chat`
7. `[Chatbot] Test d'intégration du relais`
8. Décisions D1 à D6 validées ; valeurs fixées : quota de 20 échanges et rétention jusqu'à la fin de session.
9. Le fichier `ClickUp_Import_Chatbot_Taches_a_creer.csv` annoncé en `docs/Revue_Conception_et_Planification_Chatbot_v2.md:207` est absent du dépôt.

---

## 4. Décisions

Décisions validées :

1. D1 : l'agent Chatbot renvoie `corrections[]` (≤ 3), validé par schéma.
2. D2 : historique côté backend, borné à 20 tours, supprimé en fin de session.
3. D3 : journal sans texte brut (horodatage, scénario, durée, modèle, version, nombre de corrections).
4. D4 : scénario choisi par l'apprenant, niveau issu du diagnostic.
5. D5 : mode thème séparé et optionnel.
6. D6 : bilan de session optionnel.
7. Quota : 20 échanges par apprenant et par session.
8. Rétention de l'historique : suppression en fin de session uniquement.
9. Fenêtre du quota : par session, pas par jour ni par mois.
10. P1-3 : consigne provisoire retenue ; validation écrite de l'expert IA encore attendue avant intégration définitive.

Points restant à cadrer :

1. D1 : corrections dans l'agent Chatbot (`corrections[]`, ≤ 3) recommandé.
2. D2 : historique côté backend, borné à 20 tours, supprimé en fin de session.
3. D3 : journal sans texte brut (horodatage, scénario, durée, modèle, version, nombre de corrections).
4. D4 : scénario choisi par l'apprenant, niveau issu du diagnostic.
5. D5 : mode thème séparé et optionnel.
6. D6 : bilan de session optionnel.
7. Valeur exacte du quota : 20 échanges par apprenant (validé).
8. Durée de conservation de l'historique : fin de session (validé).
9. Jeton interne : secret partagé `IA_SERVICE_TOKEN`, en-tête `X-IA-Token`, comparaison `hmac.compare_digest`, valeur réelle hors dépôt.
10. Anonymisation conservatrice : masquage e-mails/téléphones, avertissement factuel avant le premier message, validation relecture.
11. Branche du document de plan : option A retenue, `docs/plan-chatbot`, exception au CONTRIBUTING documentée dans la PR.
12. Rattachement des tâches sans numéro d'US (`PRE-*`, `QA-*`, `DEV-ENV`, `BILAN-*`) à une US existante pour respecter `feature/US<numéro>-<nom-court>`.
13. Résolution du décompte : la v2 annonce 43 tâches / 42 à faire / 1 terminée / 5 assignées, mais l'export montre davantage de tâches assignées et une seconde tâche `complete` (`123t3hw0f2q`).

---

## 5. Incohérences à signaler

- `123t3hvzezx` est « complete » dans l'export alors que seule la route IA existait ; route backend implémentée localement (`b409bda`), non encore fusionnée.
- Doublon US75 : `123t3hw0f4h` (S5) et `123t3hvzezy` (S6, priorité basse).
- Parent `123t3hw0f4d` et tâche `123t3hw0f4u` redondants.
- `123t3hw0f4q` nommée « US74-BE » alors qu'elle couvre tout le relais chat.
- Port 8001 déjà non publié dans Compose/CI : `.env.example` et Compose corrigés localement (`8a04142`).
- Sortie IA `{"reponse": ...}` (`chatbot/conversation@1.0.0`) sans corrections : contrat 1.1.0 et démonstration implémentés localement (`cfd9088`, `59c7be5`).
- Chat frontend encore mocké dans l'export : retrait local et affichage des corrections implémentés (`1ac842c`), avertissement RG11 ajouté (`442042d`).
- Latence < 2 s mesurée localement à 0,609 s au maximum sur cinq appels ; reste à rejouer avec le fournisseur LLM retenu en recette.
- `CONTRIBUTING.md` n'autorise que `feature/`, `bugfix/`, `hotfix/` : pas de branche documentation standard.

---

## 6. Branche documentation retenue

Option A : branche `docs/plan-chatbot` depuis `develop`, PR `[US-67] Plan chatbot et décisions`, commit `docs(chatbot): plan conforme CONTRIBUTING`. L'exception au CONTRIBUTING est explicitement documentée dans la description de la PR. Aucun test code n'est requis pour cette PR docs ; la CI doit néanmoins être verte avant merge, avec 1 reviewer minimum.

Ce plan a été rédigé sur la branche locale `docs/plan-chatbot`, sans push ni Pull Request. Aucune modification de ClickUp n'a été faite.
