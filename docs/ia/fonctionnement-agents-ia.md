# Fonctionnement actuel des agents IA — déroulement séquentiel

> **État décrit** : code au commit `f903d62` (`develop` mis à jour le 23 novembre 2026). Le `develop` local était auparavant en retard de 37 commits ; 27 commits sont venus depuis notre dernière analyse (`b8a9dd7`), dont l'intégration complète du chatbot (#97, #98) et le socle de démonstration (#99).
> **Périmètre** : `ia-service/`, puis les consommateurs `backend/` et `frontend/`.
> **Source de vérité** : le code au HEAD et `docs/demo-general-etat.md`. Une version antérieure de ce document (branche `PRE-15` non fusionnée) décrivait `b8a9dd7` et contenait deux affirmations désormais fausses : « relais chatbot absent » et « routes GET du parcours absentes ». Elles sont corrigées ici.

---

## 1. Ce qu'il faut retenir

Le service IA est un **calculateur isolé** : il reçoit une requête typée, produit une réponse typée, ne touche jamais PostgreSQL et ne prend aucune décision pédagogique définitive. Le backend est l'autorité : authentification, score officiel, garde-fous, persistance et statuts HTTP publics.

Au HEAD, **quatre agents** sont enregistrés derrière un seul Harness et **cinq routes** sont exposées (`GET /health` + quatre `POST`).

| Agent | Code @ version | Prompt versionné | Budget | Route IA |
| --- | --- | --- | --- | --- |
| Diagnostic | `diagnostic@1.0.0` | `diagnostic/evaluation@1.1.0` | 45 s | `POST /diagnostic/evaluer` |
| Correction | `correction@1.0.0` | `correction/reponse-libre@1.0.0` | 45 s | `POST /correction/reponse-libre` |
| Recommandation | `recommandation@1.0.0` | `recommandation/actions@1.0.0` | 30 s | `POST /recommandation/actions` |
| Chatbot (tuteur IA) | **`chatbot@1.2.0`** | **`chatbot/conversation@1.2.0`** | 30 s | `POST /chatbot/message` |

Hiérarchie des responsabilités :

```text
frontend/  →  backend/  →  ia-service/  →  LLM (Groq / Gemini / factice)
                ↕
            PostgreSQL   (jamais accédé par ia-service)
```

Les **quatre** chaînes sont maintenant câblées : diagnostic, correction, recommandation et chatbot. Le navigateur ne parle qu'au backend : les quatre routes IA sont internes et protégées par `X-IA-Token` (`ia-service/app/core/securite.py`).

Deux limites restent à garder en tête : en `npm run dev`, `NEXT_PUBLIC_API_MOCK=true` désactive tous les appels réels, et le seed de démonstration ne permet pas d'atteindre la phase active de la correction (§11).

---

## 2. Vue séquentielle d'ensemble

```text
1. Apprenant agit dans l'UI
2. Frontend → POST/GET /api/v1/...        (JWT via api-client.ts)
3. Backend  → contrôle rôle + données, libère la session DB
4. Backend  → httpx POST vers ia-service  (enveloppe RequeteAgent[T] + X-IA-Token)
5. Middleware IA → vérification du jeton interne
6. Route IA → validation Pydantic de l'enveloppe
7. Harness  → résolution agent + revalidation entrée + outils + budget
8. Agent    → prompt versionné + RAG éventuel + appel LLM
9. Agent    → vérification de cohérence (extraits, langue, niveau, phase)
10. Harness → validation sortie + MetaExecution + enveloppe ReponseAgent[T]
11. Backend → revalidation → persistance → DTO public
12. Frontend→ mapper DTO → écran
```

Trois règles transversales :

- le backend **ferme sa session PostgreSQL avant l'appel HTTP** (`routes/diagnostic.py:224-227`, `routes/parcours.py:131,150`) : une attente de 30 à 45 s ne bloque pas une connexion ;
- le service IA ne journalise ni prompt, ni contenu d'apprenant, ni secret ; les messages d'erreur sont génériques ;
- une panne IA est dégradée pour le diagnostic et la recommandation, mais **remontée explicitement** pour la correction et le chat.

---

## 3. Démarrage du service IA (une seule fois)

Le lifespan de `ia-service/app/main.py:34-66` prépare toutes les ressources partagées :

1. **Contrôle de sécurité** : en production, `IA_SERVICE_TOKEN` est obligatoire, sinon `ErreurConfiguration` empêche le démarrage (`main.py:37-38`).
2. `RegistrePrompts()` charge et valide les prompts ; un prompt introuvable empêche le démarrage.
3. `obtenir_client()` crée **un seul client LLM** pour le processus ; une configuration invalide empêche le démarrage (`app/llm/fabrique.py:21-49`).
4. `RegistreAgents()` est créé (index `code → version → définition`, doublons refusés).
5. `construire_recuperateur()` choisit le récupérateur documentaire (§5.3).
6. Les quatre agents sont enregistrés : diagnostic, chatbot, correction, recommandation (`main.py:45-48`).
7. Le `Harness` reçoit le registre, le client LLM, le registre de prompts et le récupérateur, puis est placé dans `app.state.harness`.
8. Le middleware `verifier_jeton_interne` est installé (`main.py:76`) : toute requête hors `/health` doit porter `X-IA-Token` conforme, avec comparaison `hmac.compare_digest` ; sinon `ACCES_REFUSE` (401).
9. Les routeurs sont inclus (`main.py:95-98`) : chatbot, correction, diagnostic, recommandation.
10. À l'arrêt, client LLM et récupérateur sont fermés proprement.

Côté backend, `backend/app/services/ia.py:55-58` ajoute automatiquement l'en-tête `X-IA-Token` à chaque appel. Le service IA reste sur le réseau interne `back-tier`, sans port hôte.

---

## 4. Le pipeline commun : le Harness

Toute requête métier passe par `Harness.executer()` (`app/harness/execution.py:58-130`). Aucun agent ne le contourne.

1. **Résolution** : `version_agent` explicite prime sur celle de l'enveloppe ; sans version, la dernière est retenue. Agent inconnu → `AGENT_INCONNU`.
2. **Revalidation de l'entrée** : `schema_entree.model_validate(requete.entree)` ; champ hors contrat → `ENTREE_INVALIDE`.
3. **Outils injectés** : `OutilsCommuns(client_llm, registre_prompts, recuperateur_rag, horloge)` et `ContexteExecution(request_id, contexte apprenant, SignalementRAG)`.
4. **Budget** : `asyncio.timeout(budget_ms / 1000)` couvre tout l'agent, reprises LLM comprises. Dépassement → `LLM_TIMEOUT`.
5. **Exécution de l'agent** : rendu du prompt, RAG éventuel, appel au modèle.
6. **Traduction des exceptions** : code stable du catalogue `app/core/codes_erreur.py`, message générique, `retryable` cohérent, journalisation sans données sensibles.
7. **Validation de sortie** : `schema_sortie.model_validate(resultat_brut)` ; objet hors schéma → `LLM_REPONSE_INVALIDE`.
8. **Métadonnées** : `MetaExecution` (durée, fournisseur, modèle, version du corpus, empreinte SHA-256 du prompt) ; non transmise au frontend.
9. **Enveloppe** : succès → `ReponseAgent[T]` ; échec → `ReponseErreur`. La route convertit l'erreur en statut HTTP via `STATUTS_HTTP`.
10. **Pas de relance automatique** : `retryable` informe l'appelant, le Harness ne réessaie jamais seul.

Le Harness ne persiste rien et ne contient aucune règle pédagogique. Les vérifications métier sont faites par chaque agent avant la validation de sortie.

---

## 5. Le socle partagé

### 5.1 Prompts versionnés

`ia-service/app/prompts/registre.py` charge les templates et calcule une empreinte `sha256:` du texte utilisé :

- `diagnostic/evaluation@1.1.0` — sept variables + few-shot ;
- `correction/reponse-libre@1.0.0` — `contexte_apprenant`, `phase`, `exercice`, `descripteurs_rag` ;
- `recommandation/actions@1.0.0` — `contexte_apprenant`, `points_faibles`, `niveau_vise` ;
- `chatbot/conversation@1.2.0` — `contexte_apprenant`, `historique`, `message` ; les fichiers `@1.0.0` et `@1.1.0` restent sur disque mais ne sont plus chargés (`registre.py:292-309`).

La version chatbot 1.1.0 ajoute les « corrections en marge (US74) » : uniquement sur le dernier message, trois corrections maximum, `reponse` toujours non vide, JSON strict. Le prompt utilisateur place contexte, historique et message dans `<donnees_conversation_non_fiables>`.

La version 1.2.0 renomme la persona en **tuteur IA** et impose, pour chaque réponse, une `traduction` et une `explication` en français : la traduction porte l'expression utile de la réponse, l'explication en donne le sens et l'usage. Les deux champs sont obligatoires, non vides, et affichés à côté de la réponse côté frontend.

### 5.2 Fournisseur LLM

`app/llm/fabrique.py:21-39` propose trois adaptateurs :

| `LLM_FOURNISSEUR` | Comportement |
| --- | --- |
| `factice` (défaut en dev) | Aucun réseau. `LLM_FACTICE_SCENARIO=demonstration` fournit des réponses déterministes pour **les quatre agents**, y compris le chatbot. |
| `compatible-openai` | Client HTTP compatible OpenAI (Groq notamment). |
| `gemini` | SDK `google-genai`, importé paresseusement. |

En production, le fournisseur `factice` est interdit. Le client est partagé et fermé à l'arrêt. Les démonstrations sont calculées depuis les balises JSON du prompt (`app/llm/demonstration.py`) : niveau estimé et points faibles pour le diagnostic, majuscule/point/longueur pour la correction, une action par domaine pour la recommandation, et pour le chatbot majuscule initiale, ponctuation finale et espaces doubles (`:289-320`). Chaque réponse annonce explicitement son origine « sans modèle de langue ».

### 5.3 RAG et repli documentaire

`app/rag/fabrique.py:31-81` construit le récupérateur au démarrage :

1. `RAG_CORPUS_ACTIF` faux (**défaut**) → `RecuperateurVide` ;
2. corpus `experimental` → `RecuperateurExperimental` (repères non officiels) ;
3. corpus CECRL officiel uniquement si `RAG_CORPUS_OFFICIEL_AUTORISE=true` → `RecuperateurLocal` ;
4. corpus absent ou incohérent → journalisation puis `RecuperateurVide`, sans bloquer le démarrage.

Le Harness enveloppe ce récupérateur dans `RecuperateurAvecRepli` (`execution.py:55`) : si rien n'est renvoyé, des repères synthétiques sont fournis pour `fr`, `en`, `it`, `de` en CECRL. **Aucun repère HSK n'est inventé** : la requête est signalée `A_VERIFIER` (`app/rag/repli.py:58-66`).

Provenances tracées dans `meta.version_corpus` : `officiel`, `experimental`, `synthetique`, `A_VERIFIER`. Seuls le **diagnostic** et la **correction** utilisent le RAG ; chatbot et recommandation n'y ont pas accès.

---

## 6. Agent 1 — Diagnostic (test de positionnement)

But : proposer une estimation de niveau et des points faibles **après** le calcul du score officiel par le backend.

1. L'apprenant répond au test ; le frontend envoie les réponses, puis `POST /api/v1/diagnostic/tentatives/{id}/terminer`.
2. `routes/diagnostic.py:205-239` appelle `terminer_tentative_service` : score déterministe, niveau, référentiel (`CECRL`, `HSK` pour le chinois), statut `TERMINE`.
3. Le backend **ferme la session DB**, puis appelle `analyser_tentative(id_test)`.
4. `services/analyse_diagnostic.py:207-252` vérifie si `analyse_ia` est déjà persistée : si oui, clôture idempotente, aucun nouvel appel.
5. Garde-fous : langue supportée, niveau du référentiel, score renseigné, réponses exploitables ; sinon `None` (partiel).
6. `evaluer_diagnostic()` envoie `POST /diagnostic/evaluer` avec `request_id`, contexte et preuves + score.
7. Route IA → middleware jeton → Harness (§4).
8. L'agent construit la `RequeteRAG` depuis les preuves, valide les descripteurs et signale la provenance (`agents/diagnostic.py:120-194`).
9. Variables du prompt, few-shot adapté, LLM (`temperature=0.2`, `max_tokens=900`), vérification de cohérence et signalement des écarts (`:240-268`).
10. Le backend persiste l'enveloppe dans `test_diagnostic.analyse_ia`, construit `AnalyseDiagnostic` (compétences calculées côté backend) puis `generer_parcours_pour_tentative(id_test)`.
11. En cas de panne IA : résultat partiel, score/niveau/parcours quand même renvoyés, aucune erreur visible.

---

## 7. Agent 2 — Correction d'une réponse libre (rédaction)

But : un feedback adapté à la phase du parcours, sans inventer d'extrait ni remplacer le score officiel.

1. Le frontend envoie `POST /api/v1/parcours/{id}/exercices/{id}/reponse` (timeout 45 s) ; le backend contrôle le rôle et **ferme la session DB** (`routes/parcours.py:138-155`).
2. `services/correction_exercice.py:167-172` : formats automatiques → correction déterministe, **aucun appel IA** ; rédaction → chemin IA.
3. `_preparer()` (`:125-155`) vérifie parcours, exercice, leçon atteinte, format, contenu JSON, langue et niveau ; construit le contexte avec `lecon_atteinte` et l'entrée avec consigne, énoncé, `mots_minimum` et réponse.
4. `POST /correction/reponse-libre` → Harness.
5. L'agent exige `lecon_atteinte`, interroge le RAG sur `ecrit`, déduit la phase (**PASSIVE < 50**, **ACTIVE ≥ 50**), rend le prompt et appelle le LLM (`temperature=0.2`, `max_tokens=1500`).
6. Validations : phase cohérente ; 3 erreurs max et aucune reformulation en passif ; 8 erreurs max et reformulation obligatoire en actif ; chaque extrait doit figurer dans la réponse.
7. Le backend refait son contrôle (`verifier_feedback`) puis persiste score, réponse, `feedback_ia`, date et progression. Réponse publique : `REUSSI`/`A_REVOIR`, `mode_correction="IA"`, erreurs, conseil, phase, leçon, `reformulation`.
8. Échec IA → 504 (timeout), 503 (indisponible) ou 502 (réponse invalide), aucun feedback enregistré.
9. **Les routes GET du parcours existent** (`routes/parcours.py:76-115`) : contrairement à l'ancienne analyse, l'écran de retour est atteignable en API réelle dès que l'apprenant a un parcours avec exercices. Un 404 signifie « aucun parcours en cours », pas une route manquante.
10. La « Version corrigée » (`RetourCorrection.tsx:79-87`) exige la phase active, donc la leçon 50. Le seed ne va pas au-delà de la leçon 7 (§11) : avec l'API réelle de démo, cette version n'est pas affichable. Seul le mock « actif » (leçon 56) la montre.

---

## 8. Agent 3 — Recommandation d'actions

But : proposer jusqu'à cinq actions de remédiation à partir des points faibles du diagnostic.

1. Le frontend appelle explicitement `POST /api/v1/parcours/{id}/recommandations` (timeout 45 s).
2. `routes/parcours.py:118-135` exige le rôle apprenant, vérifie le parcours, libère la session DB, appelle `recommander_pour_parcours()`.
3. `services/recommandation.py:100-131` lit `test_diagnostic.analyse_ia`, garde cinq points faibles max, un par domaine, écarte `expression_ecrite` ; langue/niveau hors contrat ou aucun point → **aucun appel IA**.
4. Empreinte SHA-256 canonique du contexte et de l'entrée (sans `request_id`). Même empreinte + statut `COMPLET` persisté → réponse servie depuis la base. Un `PARTIEL` n'est jamais mis en cache.
5. Sinon `POST /recommandation/actions` → Harness. Sans domaine valide, l'agent n'appelle pas le LLM : `[]`, confiance 0, `RESUME_SANS_DOMAINE`.
6. Sinon : prompt, LLM (`temperature=0.2`, `max_tokens=900`), vérification langue/référentiel/niveau/domaines. Contraintes : 5 actions max, type imposé par domaine, priorités contiguës, confiance bornée et non nulle avec actions (`schemas/recommandation.py:52-161`).
7. Le backend revalide, produit `COMPLET` ou `PARTIEL` (`RESUME_PARTIEL`, liste vide), persiste `{empreinte, public, enveloppe_ia, code_technique}` dans `parcours.recommandation_ia`.
8. Le frontend mappe le DTO ; depuis `06a091b`, l'écran affiche explicitement le statut `PARTIEL`, le message « Aucune action ciblée cette fois » et un lien vers la leçon.

---

## 9. Agent 4 — Chatbot (tuteur IA conversationnel)

But : répondre à un message avec corrections en marge, puis afficher à côté de chaque réponse sa traduction et son explication en français. **La chaîne est désormais complète**, contrairement à l'état `b8a9dd7`.

### 9.1 Séquence complète

1. L'apprenant écrit dans `ExerciceConversation.tsx` ; `useChatbot()` appelle `service.chatbot(message, historique, identifiant_session)`.
2. `parcours-personnalise.service.ts:91-101` envoie `POST /api/v1/chatbot/message` avec un identifiant de session, l'historique tronqué à 20 tours et un timeout de 45 s.
3. `backend/app/api/router.py:31` inclut le routeur chatbot ; `routes/chatbot.py:47-65` exige le rôle `APPRENANT` et expose aussi `DELETE /chatbot/session/{id}`.
4. `services/chatbot.py:77-147` :
   - lit le **parcours en cours** ; absent → `PARCOURS_INCONNU` (404). La langue et le niveau viennent du parcours, pas du message ;
   - lit l'historique puis **consomme le quota avant l'appel IA** (20 échanges par défaut, `quota_chatbot.py`) — un échec IA consomme donc un échange ;
   - construit `RequeteChatbotIA` avec `uuid4`, contexte, message et historique ;
   - appelle `envoyer_message_chatbot` hors transaction ; le client IA ajoute `X-IA-Token` ;
   - **revalide les corrections** : 3 max et chaque `extrait` doit figurer dans le message (`verifier_corrections`) ;
   - persiste les deux tours et un `JournalChatbot` **sans texte brut** (durée, modèle, version du prompt, nombre de corrections) ;
   - renvoie `reponse`, `corrections`, `traduction`, `explication`, `quota_restant`, `version_prompt`.
5. Le middleware IA vérifie le jeton, la route appelle le Harness, qui exécute `chatbot@1.2.0` : prompt `conversation@1.2.0` (`temperature=0.5`, `max_tokens=900`), `generer_json(schema=ResultatChatbot)`.
6. Contrat `schemas/chatbot.py` : message 1–2 000 car., réponse 1–4 000 car., historique 20 tours max, corrections 3 max, extrait 120 car., explication de correction 300 car. ; `traduction` et `explication` obligatoires, 1–4 000 car. chacune.
7. En fin de session, `terminer_session_chat` supprime historique et quota ; le journal anonymisé reste (`services/chatbot.py:150-156`).

### 9.2 Particularités

- **Réponse factice disponible** : `LLM_FACTICE_SCENARIO=demonstration` produit un `ResultatChatbot` déterministe (majuscule, ponctuation, espaces doubles, ≤ 3 corrections) avec une traduction et une explication françaises indicatives, et annonce son origine non fiable (`demonstration.py:296-336`).
- **Dégradation stricte** : contrairement au diagnostic, aucun repli silencieux côté backend. `IA_SERVICE_URL` vide, panne IA ou corrections incohérentes → 502/503/504 visibles par l'apprenant ; quota dépassé → 429.
- **Langue alignée** : `ChatView.tsx` lit la langue dans `GET /parcours/en-cours` (plus de sélecteur manuel) et le backend dérive la même langue du parcours (`services/chatbot.py:84-88`).
- **Persona et affichage** : le menu, la page et les bulles présentent le **tuteur IA** ; chaque réponse générée est accompagnée de `traduction` et `explication` dans une marge dédiée (`ExerciceConversation.tsx`).
- **Preuve E2E indirecte** : `frontend/e2e/chat.spec.ts` intercepte l'API et renvoie une réponse codée en dur ; les tests valident le branchement frontend et le contrat, pas un appel réel jusqu'au LLM.

---

## 10. Ce qui n'est pas un agent IA

- **La prononciation** : aucun agent ni route `/prononciation/*` dans `ia-service/app/main.py`.
- **Le score du test** : calculé par le backend avant tout appel IA.
- **La décision finale** : le backend seul décide de la persistance, des exercices retenus et du statut public.

---

## 11. Matrice d'intégration et limites de la démonstration

| Agent | Route IA | Relais backend | Visibilité frontend | Mode factice |
| --- | --- | --- | --- | --- |
| Diagnostic | `POST /diagnostic/evaluer` | `POST /diagnostic/tentatives/{id}/terminer` | Oui (score, points faibles, phase) | Oui |
| Correction | `POST /correction/reponse-libre` | `POST /parcours/{id}/exercices/{id}/reponse` | Oui en API réelle, sauf « Version corrigée » (§7) | Oui |
| Recommandation | `POST /recommandation/actions` | `POST /parcours/{id}/recommandations` | Oui, avec statut `COMPLET`/`PARTIEL` | Oui |
| Chatbot | `POST /chatbot/message` | `POST /chatbot/message` + `DELETE /chatbot/session/{id}` | Oui, mais exige un parcours en cours | Oui |

Limites constatées dans la configuration de démonstration :

1. **Mode mock en local** : `frontend/.env.development` pose `NEXT_PUBLIC_API_MOCK=true`, donc `PARCOURS_MOCK=true` (`src/lib/env.ts`) : aucun `fetch`, y compris pour le chat. Docker et la CI forcent `false`.
2. **Parcours requis** : sans diagnostic terminé, `GET /parcours/en-cours` répond 404 (« Passez le test de positionnement ») et le chat répond 404 (`PARCOURS_INCONNU`).
3. **Seed limité** : `backend/app/seed_parcours.py:67-252` fournit 7 leçons × 3 exercices = 21 exercices dans la table `exercice`, uniquement en **anglais A1**. Les lignes `parcours_exercice` sont créées à la génération du parcours (`services/parcours.py`), au plus 8 par leçon. Seuls les parcours anglais A1 reçoivent 3 exercices ; les autres niveaux n'en reçoivent aucun.
4. **« Version corrigée » hors d'atteinte en réel** : phase active à partir de la leçon 50 (`phase_parcours.py:17`), alors que le seed s'arrête à la leçon 7 et que la leçon de départ calculée plafonne à 36. Le mock actif est nécessaire pour cette démonstration.
5. **Progression plafonnée** : aucun exercice semé pour la leçon 8 (`progression_lecon.py:61-65`).
6. **Routes encore absentes** : reprise et abandon du diagnostic (`GET /diagnostic/tentatives/en-cours`, `POST /.../abandonner`) ; voir `docs/demo-general-etat.md:26`.
7. **Écrans simulés** : progression complémentaire, apprenants et synthèse d'erreurs formateur portent un badge ; le suivi formateur réel est bloqué par le backend (`demo-general-etat.md:46-47`).

---

## 12. Erreurs et dégradation

Catalogue unique : `ia-service/app/core/codes_erreur.py`. La route IA traduit le code en statut HTTP, le backend applique sa politique.

| Famille | Codes | Statut IA | Traitement backend |
| --- | --- | --- | --- |
| Sécurité | `ACCES_REFUSE` | 401 | Jeton interne invalide, jamais exposé au frontend |
| Entrée / routage | `ENTREE_INVALIDE`, `AGENT_INCONNU`, `TAILLE_DEPASSEE` | 422 / 404 / 413 | Rejet technique, sans recopie de contenu |
| Quota | `QUOTA_DEPASSE`, `LLM_LIMITE_REQUETES` | 429 | Diagnostic/recommandation partiels ; chat → 429 |
| Fournisseur | `LLM_INDISPONIBLE`, `CORPUS_INDISPONIBLE` | 503 | Diagnostic partiel ; correction et chat → 503 ; recommandation → `PARTIEL` |
| Délai | `LLM_TIMEOUT` | 504 | Diagnostic partiel ; correction et chat → 504 ; recommandation → `PARTIEL` |
| Réponse inexploitable | `LLM_AUTHENTIFICATION`, `LLM_REQUETE_INVALIDE`, `LLM_REPONSE_INVALIDE` | 502 | Refus de la proposition ; correction et chat → 502 |
| Configuration interne | `LLM_CONFIGURATION`, `PROMPT_INTROUVABLE`, `ERREUR_INTERNE` | 500 | Journalisé sans secret ni donnée d'apprenant |

Seuls `QUOTA_DEPASSE`, `LLM_INDISPONIBLE`, `LLM_TIMEOUT`, `LLM_LIMITE_REQUETES`, `LLM_REPONSE_INVALIDE` et `CORPUS_INDISPONIBLE` sont `retryable`, et le Harness ne relance rien automatiquement.

---

## 13. Documentation existante et état

| Document | État par rapport au HEAD |
| --- | --- |
| `docs/demo-general-etat.md`, `docs/demo-general-script.md`, `docs/demo-general-configuration.md` | **Courants** : point d'entrée opérationnel, script de démo et configuration. |
| `docs/api/contrat-frontend.md`, `frontend/src/services/endpoints.ts` | **Courants** : contrat et routes réellement appelées. |
| `docs/ia/agent-recommandation.md`, `docs/ia/analyse-agent-recommandation-harness.md` | Alignés sur les fusions #93/#94. |
| `docs/ia/analyse-agent-chatbot-harness.md` | **Obsolète** : « relais backend absent », `chatbot@1.0.0`, prompt `1.0.0`, `ENDPOINTS.chatbotMessage`. Tout est contredit au HEAD. |
| `docs/ia/rapport-US157-IA.md` | **Obsolète** : « en attente de revue et de fusion » et « le backend n'appelle pas encore cette route ». |
| `docs/ia/analyse-agent-prononciation-harness.md` | Obsolète : deux agents, deux routes ; le fond (pas d'agent prononciation) reste vrai. |
| `docs/ia/analyse-agent-diagnostique-harness.md`, `docs/ia/audit-agent-diagnostique-avant-rag.md`, `docs/ia/US150-*.md` | Antérieurs au RAG/repli actuel ou encore marqués « en attente ». |
| `docs/ia/architecture-agent-harness.md`, `docs/architecture/03-ia-service.md`, `docs/architecture/README.md`, `docs/architecture/06-guide-fonctions.md` | Partiellement obsolètes : comptages d'agents/routes et consommateurs_backend incomplets. |
| `docs/Revue_Conception_et_Planification_Chatbot{,_v2}.md` | Classés historiques par `demo-general-etat.md:12-20`. |
| `docs/ia/etat-integration-agent-chatbot.md` | Cité comme source de vérité dans `demo-general-etat.md:19` mais **non versionné**. |
| Ce document | Remplace la version `PRE-15` non fusionnée, qui décrivait `b8a9dd7`. |

---

## 14. Références de code utiles

| Sujet | Fichiers |
| --- | --- |
| Enregistrement, sécurité, lifespan | `ia-service/app/main.py`, `app/core/securite.py` |
| Harness | `ia-service/app/harness/execution.py`, `agent.py`, `registre.py` |
| Enveloppes et erreurs | `ia-service/app/schemas/commun.py`, `app/core/codes_erreur.py`, `erreurs.py`, `gestionnaire_erreurs.py` |
| Agents | `ia-service/app/agents/diagnostic.py`, `correction.py`, `recommandation.py`, `chatbot.py` |
| Prompts | `ia-service/app/prompts/registre.py`, `app/prompts/chatbot/conversation@1.2.0.*.md` |
| LLM | `ia-service/app/llm/fabrique.py`, `demonstration.py`, `adaptateurs/` |
| RAG | `ia-service/app/rag/fabrique.py`, `repli.py`, `vide.py`, `local.py`, `experimental.py` |
| Routes IA | `ia-service/app/api/diagnostic.py`, `correction.py`, `recommandation.py`, `chatbot.py` |
| Client et relais backend | `backend/app/services/ia.py`, `chatbot.py`, `quota_chatbot.py`, `historique_chatbot.py`, `routes/chatbot.py` |
| Orchestration backend | `backend/app/services/analyse_diagnostic.py`, `correction_exercice.py`, `recommandation.py`, `parcours.py`, `phase_parcours.py` |
| Persistance | `backend/app/models/chatbot.py`, `alembic/versions/20261121_p1_2_quota_chatbot.py`, `20261121_p3_3_historique_chatbot.py`, `20261122_dfbf0715302a_fusion_*.py` |
| Seed de démo | `backend/app/seed_parcours.py`, `backend/app/seed.py` |
| Frontend | `frontend/src/services/endpoints.ts`, `parcours-personnalise.service.ts`, `components/apprenant/chat/ChatView.tsx`, `ExerciceConversation.tsx`, `lib/session-chatbot.ts`, `src/mocks/parcours-personnalise.mock.ts` |
| Documentation de démo | `docs/demo-general-etat.md`, `demo-general-script.md`, `demo-general-configuration.md` |
