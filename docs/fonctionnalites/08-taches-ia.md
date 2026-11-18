# 08 — Les tâches IA, couche par couche

> Référence : `backend/app/services/ia.py`, `backend/app/services/analyse_diagnostic.py`,
> `backend/app/schemas/ia.py`, `backend/app/api/routes/diagnostic.py`,
> `frontend/src/services/test-diagnostic.service.ts`,
> `frontend/src/components/pedagogie/testDiagnostic/TestResult.tsx`,
> `docker-compose.yml`, `ia-service/Dockerfile`, `.github/workflows/ci.yml`.
> Constat du **15 novembre 2026**, branche `develop` (`95543db`).
>
> Ce chapitre est un **backlog technique**, pas un état des lieux de fonctionnalités : l'état des lieux est dans
> [`05-ia-service.md`](05-ia-service.md) et la synthèse dans [`06-matrice-fonctionnalites.md`](06-matrice-fonctionnalites.md).
> Ici, chaque élément est une **tâche** : ce qu'il faut faire, où, dans quel ordre, et à quoi on reconnaît qu'elle
> est terminée.

---

## 1. Comment lire ce chapitre

### 1.1 Pourquoi séparer les couches

L'IA du projet n'est pas un bloc : c'est une **chaîne de quatre couches**. Une tâche mal placée échoue toujours
au même endroit :

| Couche | Rôle dans la chaîne IA | Ce qui casse si on l'oublie |
| --- | --- | --- |
| **Backend** | construit la requête, borne l'attente, valide la réponse, persiste l'analyse | l'IA devient une source de vérité ou une panne bloquante |
| **Frontend** | affiche ce qui existe, signale ce qui manque | l'écran invente une analyse ou promet l'impossible |
| **Docker / infra** | configure le fournisseur, isole le service, outille la CI | la démo échoue sans message, les clés fuient |
| **Service IA** | exécute l'agent sous budget, produit `points_faibles` et `phase_assimil` | le contrat n'a rien à valider |

Une tâche qui touche deux couches est **une seule tâche**, listée dans la couche qui la porte, avec la dépendance
explicite. Exemple : « afficher la justification du niveau » n'est pas une tâche frontend, c'est une tâche IA
(`I-02`) qui débloque une tâche backend (`B-02`) qui débloque une tâche frontend (`F-01`).

### 1.2 Les trois notations

**État** — la même légende que le reste du dossier :

| Verdict | Sens dans ce chapitre |
| --- | --- |
| ✅ **Fait** | La tâche est déjà réalisée dans le code ; elle est listée pour mémoire ou pour être vérifiée |
| 🟡 **Partiel** | Une partie existe, il manque un maillon nommé |
| 🔌 **Non branché** | Le code existe mais rien ne l'appelle, ou l'appel échoue systématiquement |
| ⛔ **Absent** | Aucun code |
| 🧪 **Simulé** | Ne fonctionne qu'avec `NEXT_PUBLIC_API_MOCK=true` |

**Priorité** :

| Niveau | Critère | Conséquence si on ne le fait pas |
| --- | --- | --- |
| **P0** | bloque une démonstration honnête ou expose un coût/secret | on ment au jury, ou on paie des appels inutiles |
| **P1** | contrat incohérent entre deux couches | un écran attend un champ que personne n'envoie |
| **P2** | qualité, dette, extension | rien ne casse, mais le projet stagne |

**Effort** (ordre de grandeur, pas un engagement) : **S** < 1 jour · **M** 1 à 3 jours · **L** > 3 jours.

### 1.3 Le point de départ : ce qui tourne déjà

Il faut le connaître avant de toucher à quoi que ce soit, parce que **la chaîne fonctionne** — elle est seulement
incomplète.

```
POST /diagnostic/tentatives/{id}/terminer        (apprenant, JWT)
        │
        ▼
backend : scoring déterministe  ──►  score, niveau, cadre   (seule autorité)
        │  db.close()  ← la connexion PostgreSQL est libérée
        ▼
backend : analyse_diagnostic.analyser_tentative()
        │  garde-fous : langue, niveau, score, réponses exploitables
        ▼
backend : services/ia.py  ── HTTP 55 s ──►  ia-service :8001 /diagnostic/evaluer
        │                                        Harness → agent diagnostic@1.0.0
        │                                        prompt evaluation@1.1.0, budget 45 s
        │                                        LLM 12 s/appel, 30 s total, 1 reprise
        ▼
backend : validation stricte (extra="forbid") + persistance test_diagnostic.analyse_ia (JSONB)
        │
        ▼
réponse 200 : competences (recalcul backend) + points_faibles + phase_assimil
        │        ou rien du tout → le frontend affiche « Résultat partiel »
        ▼
frontend : TestResult → bandeau, cartes, points faibles, justification (absente)
```

| Étape | Fichier | État |
| --- | --- | --- |
| 1. Clôture de la tentative, score déterministe | `backend/app/services/scoring.py` | ✅ |
| 2. Libération de la connexion avant l'appel HTTP | `backend/app/api/routes/diagnostic.py` (`db.close()`) | ✅ |
| 3. Garde-fous et construction de la requête | `backend/app/services/analyse_diagnostic.py` | ✅ |
| 4. Client HTTP borné, codes d'erreur courts | `backend/app/services/ia.py` | ✅ |
| 5. Agent, prompt, budget, reprises | `ia-service/app/agents/diagnostic.py` | ✅ |
| 6. Validation de la réponse à la frontière | `backend/app/schemas/ia.py` | ✅ |
| 7. Persistance et idempotence | `analyse_ia` + `with_for_update()` | ✅ |
| 8. Affichage et dégradation | `TestResult.tsx`, `resultatDiagnostic.ts` | 🟡 |
| 9. Justification et sources | — | ⛔ de bout en bout |

### 1.4 Qui décide quoi (à ne jamais inverser)

| Information | Producteur | Le backend peut-il la contredire ? |
| --- | --- | --- |
| `score`, `percentage` | backend (scoring) | non : c'est la seule autorité |
| `level`, `framework` | backend (scoring) | non |
| `competences` | backend, recalculées sur les QCM | non : l'IA n'en produit pas |
| `points_faibles` | IA | oui : le backend peut les ignorer |
| `phase_assimil` | IA | oui |
| `justification` | **personne** | — |

La règle est écrite dans le code, pas seulement dans la doc :

```python
# backend/app/services/analyse_diagnostic.py — l'analyse ne contient jamais de score
@dataclass(frozen=True)
class AnalyseDiagnostic:
    competences: list[CompetenceResultatOut]   # recalculées, pas reçues
    points_faibles: list[PointFaibleOut]
    phase_assimil: str
```

Toute tâche qui ferait remonter `niveau_estime` ou `score_confiance` de l'IA vers le frontend **casserait** cette
règle : le service IA doit rester une proposition, jamais un verdict.

---

## 2. Le backlog en une table

| ID | Tâche | Couche | Priorité | Effort | Dépend de |
| --- | --- | --- | :-: | :-: | --- |
| `B-01` | Reprise et abandon d'une tentative | Backend | P1 | M | — |
| `B-02` | Justification et sources du niveau | Backend | P1 | L | `I-02` |
| `B-03` | Plafonner les analyses IA par apprenant | Backend | **P0** | S | — |
| `B-04` | Corriger ou exclure les réponses libres | Backend | P1 | M | `I-03` |
| `B-05` | Tracer l'exécution IA (`meta`) | Backend | P1 | S | — |
| `B-06` | Trancher : analyse synchrone ou `202` | Backend | P2 | M | — |
| `B-07` | Historique des tentatives | Backend | P2 | M | — |
| `B-08` | Santé de l'IA sans bloquer le backend | Backend | P2 | S | — |
| `B-09` | Réponses audio : stockage et transcription | Backend | P2 | L | — |
| `B-10` | Route backend du chatbot (relais authentifié) | Backend | P2 | L | — |
| `F-01` | Trancher la promesse « justification » | Frontend | P1 | S | `B-02` |
| `F-02` | Brancher la reprise sur le vrai backend | Frontend | P1 | S | `B-01` |
| `F-03` | Aligner les délais d'attente | Frontend | P1 | S | — |
| `F-04` | Retirer le `202` mort ou l'implémenter | Frontend | P2 | S | `B-06` |
| `F-05` | Rendre l'attente lisible | Frontend | P2 | M | — |
| `F-06` | Supprimer `NEXT_PUBLIC_IA_URL` | Frontend | P1 | S | — |
| `F-07` | Rendre le mock honnête | Frontend | P2 | S | — |
| `F-08` | Écran de chatbot | Frontend | P2 | L | `B-10` |
| `D-01` | Analyse complète dès `docker compose up` | Docker | **P0** | M | `I-01` |
| `D-02` | Ne pas exposer le service IA | Docker | P1 | S | — |
| `D-03` | Périmètre des clés LLM | Docker | P1 | S | — |
| `D-04` | Retirer la dépendance Redis inutile | Docker | P2 | S | — |
| `D-05` | Volumes `models` / `corpus` | Docker | P2 | S | — |
| `D-06` | Tester l'IA de bout en bout en CI | Docker | P1 | M | `I-01` |
| `D-07` | Hygiène des journaux et des ressources | Docker | P2 | S | — |
| `I-01` | Scénario `factice` pour le diagnostic | Service IA | **P0** | S | — |
| `I-02` | Ajouter `justification` et `sources` au résultat | Service IA | P1 | L | — |
| `I-03` | Évaluer les réponses libres | Service IA | P1 | M | — |
| `I-04` | Activer le RAG CECRL | Service IA | P2 | M | — |

> `B-10` est listée uniquement pour que la dépendance de `F-08` soit résolvable : c'est une fonctionnalité
> **absente du produit**, pas une tâche IA inachevée, et elle n'est donc pas détaillée ici. Voir
> [`06-matrice-fonctionnalites.md`](06-matrice-fonctionnalites.md).

**Lecture immédiate** : deux tâches sont **P0** et coûtent peu (`B-03`, `I-01` → `D-01`). Ce sont elles qui
transforment une démonstration « partielle » en démonstration maîtrisée.

---

## 3. Tâches backend

Le backend est la couche la plus avancée de la chaîne. Les tâches restantes ne concernent pas le calcul, mais
**le contrat**, **le coût** et **l'observabilité**. La seule exception est `B-10` (route backend du chatbot), qui
crée une fonctionnalité absente et n'est donc pas détaillée ici (voir la note du §2).

### B-01 — Reprise et abandon d'une tentative

**Priorité** P1 · **État** ⛔ (routes absentes) · **Effort** M · **Dépend de** —

**Objectif.** Permettre à un apprenant qui ferme son onglet de retrouver sa tentative, et d'en abandonner une.

**État actuel.** Le frontend appelle deux routes qui **n'existent pas** :

```ts
// frontend/src/services/endpoints.ts
tentativeEnCours: `${API}/diagnostic/tentatives/en-cours`,
abandonnerTentative: (idTentative: number) => `${API}/diagnostic/tentatives/${idTentative}/abandonner`,
```

Le backend expose `POST /diagnostic/tentatives/{id_tentative}/terminer` et rien d'autre autour des tentatives.
Résultat : `404`. Le test E2E `reprise-test.spec.ts` passe uniquement parce que Playwright **simule** les deux
routes — c'est un faux positif de plus dans la matrice.

Les données, elles, existent : `test_diagnostic.statut` vaut `EN_COURS`, `TERMINE` ou `ANNULE`, et les réponses
sont déjà en base.

**Fichiers.** `backend/app/api/routes/diagnostic.py`, `backend/app/services/diagnostic.py`,
`backend/app/schemas/diagnostic.py`, `docs/api/contrat-frontend.md`, `frontend/src/services/endpoints.ts`,
`frontend/src/services/test-diagnostic.service.ts`.

**À faire.**

1. `GET /diagnostic/tentatives/en-cours` — la dernière tentative `EN_COURS` de l'apprenant connecté, avec
   `id_tentative`, `code_langue`, `code_niveau`, `date_debut` et `reponses[]` (`id_question`, `reponse_fournie`).
   `204` s'il n'y en a pas : c'est ce que le service frontend attend (`if (!dto) return null`).
2. `POST /diagnostic/tentatives/{id_tentative}/abandonner` — passe la tentative à `ANNULE`, `204`. Refuser une
   tentative d'un autre apprenant (`404`, pas `403`, pour ne pas révéler son existence).
3. Vérifier la cohérence avec `POST /diagnostic/tentatives` : aujourd'hui chaque appel crée une **nouvelle**
   tentative. Décider si la création doit d'abord proposer la reprise (`409` ou réutilisation) ou si le frontend
   reste seul responsable de l'ordre des appels.

**Critères d'acceptation.**

- [ ] un apprenant qui recharge la page retrouve sa question et ses réponses déjà données ;
- [ ] une tentative abandonnée n'est plus proposée et ne peut plus être terminée ;
- [ ] les deux routes sont dans le contrat **et** dans `endpoints.ts` **et** couvertes par
      `frontend/src/services/__tests__/services.test.ts` ;
- [ ] `reprise-test.spec.ts` passe **sans** interception de route.

### B-02 — Justification et sources du niveau

**Priorité** P1 · **État** ⛔ (le champ n'existe nulle part) · **Effort** L · **Dépend de** `I-02` —

**Objectif.** Répondre à « pourquoi ce niveau ? » avec un résumé et des descripteurs du référentiel.

**État actuel.** C'est le point le plus mal compris du projet. On lit souvent que « le backend n'envoie jamais
`justification` », comme s'il oubliait un champ existant. En réalité **le champ n'existe pas dans le contrat IA** :

```python
# ia-service/app/schemas/diagnostic.py — ResultatDiagnostic
niveau_estime: str
phase_assimil: PhaseAssimil
points_faibles: list[PointFaible]
score_confiance: float
niveau_preliminaire: str
ecart_avec_niveau_preliminaire: int
```

Pas de `justification`, pas de `sources`. Le backend ne peut donc pas la transmettre, et le frontend affiche un
texte d'attente permanent :

```tsx
// frontend/src/components/pedagogie/testDiagnostic/resultat/JustificationNiveau.tsx
La justification détaillée, appuyée sur les descripteurs du référentiel, sera disponible après l'analyse complète.
```

Le frontend, lui, est **prêt** : `lireJustification()` valide `resume`, déduplique les sources, refuse les liens
non `http(s)` et écarte les sources incomplètes.

**Fichiers.** `ia-service/app/schemas/diagnostic.py`, `ia-service/app/prompts/diagnostic/evaluation@1.1.0.*`,
`backend/app/schemas/ia.py`, `backend/app/schemas/diagnostic.py`,
`backend/app/services/analyse_diagnostic.py`, `docs/api/contrat-frontend.md`.

**À faire.**

1. `I-02` d'abord : ajouter au résultat IA `justification: {resume, sources[]}` (voir §6).
2. Ajouter `JustificationIA` / `SourceReferentielIA` à `backend/app/schemas/ia.py`, en `extra="forbid"`.
3. Ajouter `justification: JustificationOut | None = None` à `ScoreDiagnosticOut`.
4. Remonter le champ dans `_analyser_document()` — aujourd'hui elle ne lit que `points_faibles` et
   `phase_assimil`, et jette tout le reste de l'enveloppe.
5. Documenter dans le contrat que les `url` absentes sont normales : toutes les sources n'ont pas de lien public.

**Critères d'acceptation.**

- [ ] avec un vrai fournisseur, la réponse de clôture contient `justification.resume` non vide et au moins une
      source avec `referentiel`, `niveau`, `titre`, `extrait` ;
- [ ] une enveloppe IA avec un champ `justification` non conforme est **refusée** (`reponse_invalide`), pas relayée ;
- [ ] `JustificationNiveau` n'affiche plus le texte d'attente quand le champ est présent ;
- [ ] un test backend couvre la présence **et** l'absence du champ.

### B-03 — Plafonner les analyses IA par apprenant

**Priorité** **P0** · **État** ⛔ · **Effort** S · **Dépend de** —

**Objectif.** Empêcher qu'un apprenant — ou un script — déclenche un nombre illimité d'appels LLM facturés.

**État actuel.** Chaque `POST /diagnostic/tentatives` crée une **nouvelle** tentative, sans quota. Chaque
`POST /diagnostic/tentatives/{id}/terminer` sur une tentative non encore analysée déclenche un appel au service IA.
Il n'existe ni limite par utilisateur, ni limite par jour, ni vérification d'abonnement au moment de l'analyse.

La seule protection actuelle est l'**idempotence par tentative** :

```python
# backend/app/services/analyse_diagnostic.py
if tentative.analyse_ia:
    analyse = _analyser_document(tentative.analyse_ia)   # réutilisation, aucun appel
```

Elle protège la **deuxième** clôture de la **même** tentative, pas la création de 500 tentatives.

Aggravant : `POST /auth/login` n'a pas de limitation de débit (aucun `RATE_LIMIT_PER_MINUTE` lu par le code), donc
rien ne freine un script qui créerait un compte puis boucherait le service.

**Fichiers.** `backend/app/services/diagnostic.py`, `backend/app/api/routes/diagnostic.py`,
`backend/app/core/config.py`, éventuellement `backend/app/models/` si l'on choisit un compteur persistant.

**À faire.**

1. Choisir la règle : **N analyses par apprenant et par jour** (variable d'environnement, défaut raisonnable) ou
   **quota d'abonnements** (`abonnement.quota_heures` existe déjà mais n'est débité par rien).
2. Compter les tentatives `TERMINE` avec `analyse_ia IS NOT NULL` sur la fenêtre, ou tenir un compteur.
3. Au-delà : **ne pas appeler l'IA**, renvoyer `200` avec un résultat partiel et un log explicite. Une limite ne
   doit jamais casser la clôture du test.
4. Refuser proprement la création de tentative au-delà d'un seuil de tentatives `EN_COURS` simultanées.

**Critères d'acceptation.**

- [ ] la limite est documentée dans le contrat et dans `.env.example` ;
- [ ] dépassement → `200` avec `analyse = None` (pas `429` sur la clôture : le test doit rester terminable) ;
- [ ] un test prouve qu'aucun appel HTTP n'est émis quand la limite est atteinte ;
- [ ] le log ne contient ni réponse d'apprenant ni prompt.

### B-04 — Corriger ou exclure les réponses libres

**Priorité** P1 · **État** 🟡 (stockées, non notées, transmises) · **Effort** M · **Dépend de** `I-03` —

**Objectif.** Décider ce que vaut une réponse `texte`, et le rendre cohérent partout.

**État actuel.** Trois comportements coexistent :

| Étape | Comportement | Fichier |
| --- | --- | --- |
| Enregistrement | la réponse est stockée telle quelle | `POST /diagnostic/reponse` |
| Score déterministe | **ignorée** : seules les questions `choix` comptent | `_calculer_competences` |
| Requête IA | **transmise** comme `contenu` (max 5 000 caractères) | `_preparer` |

```python
# backend/app/services/analyse_diagnostic.py
if ligne.type_reponse != "choix":
    continue    # les réponses libres ne sont pas corrigées de façon déterministe
```

Conséquence : l'apprenant peut écrire trois paragraphes, son score ne bouge pas, mais l'IA les lit. Ce n'est pas
un bug — c'est un choix assumé et documenté — mais l'écart entre « je rédige » et « ça ne compte pas » n'est
signalé nulle part à l'écran.

**Fichiers.** `backend/app/services/analyse_diagnostic.py`, `backend/app/services/scoring.py`,
`backend/app/schemas/diagnostic.py`, `ia-service/app/agents/diagnostic.py`.

**À faire.**

1. Trancher : **A** — les réponses libres comptent via l'IA, avec un statut explicite « évaluation non
   déterministe » ; **B** — elles ne comptent pas, et le contrat le dit (`poids: 0` ou champ `evalue: false`).
2. Si **A** : `I-03` doit renvoyer un jugement par réponse, que le backend intègre **hors** du score officiel
   (par exemple un champ `evaluations_libres` séparé, jamais dans `score`).
3. Si **B** : ne plus envoyer les réponses libres à l'IA, ou les envoyer seulement pour les points faibles, et
   l'indiquer dans le contrat.
4. Dans les deux cas : afficher la règle à l'apprenant avant la saisie.

**Critères d'acceptation.**

- [ ] le contrat dit explicitement si une réponse `texte` influence le score ;
- [ ] le comportement du code correspond au contrat (test dédié) ;
- [ ] aucune régression sur `score`/`level` : ils restent déterministes.

### B-05 — Tracer l'exécution IA (`meta`)

**Priorité** P1 · **État** 🔌 (`meta` validée, persistée, jamais exploitée) · **Effort** S · **Dépend de** —

**Objectif.** Pouvoir répondre à « combien de temps a pris l'analyse, avec quel fournisseur, quel prompt ? ».

**État actuel.** L'enveloppe contient déjà tout :

```python
# backend/app/schemas/ia.py
class MetaExecutionIA(_ModeleIA):
    duree_ms: int
    fournisseur: str
    modele: str
    version_corpus: str | None = None
    empreinte_prompt: str
```

Elle est validée, puis **écrite dans `test_diagnostic.analyse_ia`** et jamais relue : `_analyser_document()` ne
lit que `document["resultat"]`. Aucune ligne de journal ne contient `duree_ms`, `fournisseur` ou `empreinte_prompt`.
Seul log existant :

```python
logger.warning("Analyse IA indisponible (tentative=%s, code=%s)", id_tentative, erreur.code)
```

**Fichiers.** `backend/app/services/analyse_diagnostic.py`, `backend/app/services/ia.py`,
`backend/app/core/config.py` (niveau de log).

**À faire.**

1. Journaliser **une** ligne par analyse : `tentative`, `request_id`, `duree_ms`, `fournisseur`, `modele`,
   `empreinte_prompt`, `version_corpus`. Jamais le contenu, jamais la clé.
2. Journaliser aussi les **non-appels** (langue hors référentiel, aucune réponse exploitable, quota atteint) : ce
   sont eux qui expliquent un résultat partiel en démonstration.
3. Exposer éventuellement un compteur agrégé côté administration (`stats:read`) : nombre d'analyses, durée moyenne,
   taux d'échec par code.

**Critères d'acceptation.**

- [ ] `docker compose logs backend | Select-String "analyse IA"` montre une ligne par clôture, avec un code ;
- [ ] un test vérifie qu'aucun `contenu` de réponse n'apparaît dans les logs ;
- [ ] la durée est cohérente avec le budget (≤ 55 s côté backend, ≤ 45 s côté IA).

### B-06 — Trancher : analyse synchrone ou `202`

**Priorité** P2 · **État** 🟡 (le frontend gère un cas que le backend n'émet jamais) · **Effort** M · **Dépend de** —

**Objectif.** Supprimer un contrat fantôme.

**État actuel.** Le frontend sait recevoir une réponse `202` :

```ts
// frontend/src/services/test-diagnostic.service.ts
interface AnalyseEnAttenteDto {
  id_tentative: number;
  statut: "en_attente";
}
```

et possède un écran dédié (`ResultatEnAttente.tsx`). Or le backend renvoie **toujours** `200` avec
`ScoreDiagnosticOut`, et `response_model=ScoreDiagnosticOut` empêcherait structurellement un `202`.

Deux options, exclusives :

- **A — rester synchrone** : supprimer la branche `202`, `AnalyseEnAttenteDto` et l'écran, et documenter que la
  clôture peut durer jusqu'à 55 s.
- **B — passer en asynchrone** : la clôture répond `202` immédiatement, une route de lecture (`GET .../resultat`)
  renvoie l'analyse quand elle est prête, le frontend interroge.

**À faire (option A, recommandée à court terme).** Retirer le code mort, mesurer la durée réelle, et faire
afficher un état d'attente explicite (voir `F-05`).

**À faire (option B).** Ajouter la colonne d'état d'analyse (ou réutiliser `analyse_ia` + `statut`), la route de
lecture, et l'idempotence de la clôture (`202` rejoué = même `request_id`).

**Critères d'acceptation.**

- [ ] il n'existe plus de branche `202` non atteignable, ou elle est réellement atteignable et testée ;
- [ ] le contrat décrit un seul comportement.

### B-07 — Historique des tentatives

**Priorité** P2 · **État** ⛔ · **Effort** M · **Dépend de** `B-01` —

**Objectif.** Afficher les tentatives passées d'un apprenant (date, langue, score, niveau).

**État actuel.** Les données sont complètes en base (`test_diagnostic`, `reponse`) et aucune route ne les liste. Le
frontend n'a pas d'écran. C'est la fonctionnalité la moins chère du backlog : rien à modéliser, tout à exposer.

**À faire.** `GET /diagnostic/tentatives?limit=&offset=` (apprenant, ses propres tentatives uniquement), tri
antéchronologique, sans l'analyse IA complète (trop volumineuse) ; puis un écran dans l'espace apprenant.

**Critères d'acceptation.**

- [ ] un apprenant ne voit que ses tentatives ;
- [ ] la réponse reste légère : pas de `analyse_ia` complet dans la liste ;
- [ ] pagination documentée.

### B-08 — Santé de l'IA sans bloquer le backend

**Priorité** P2 · **État** 🟡 (`/health` statique) · **Effort** S · **Dépend de** —

**Objectif.** Savoir, en une requête, si la chaîne IA est opérationnelle — sans transformer une panne IA en panne
du backend.

**État actuel.**

```python
# backend/app/main.py
@app.get("/health", tags=["supervision"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "backend"}
```

Le healthcheck Docker du backend passe donc même si `ia-service` est arrêté. C'est **volontaire** (l'IA est
best-effort), mais cela rend le diagnostic d'incident difficile : la stack est « healthy » et l'analyse échoue.

**À faire.** Ajouter une route séparée, non bloquante, par exemple `GET /health/ia`, qui appelle `GET :8001/health`
avec un timeout très court (1–2 s) et renvoie `{"ia": "ok|indisponible|non_configure"}`. **Ne pas** modifier
`/health` : le healthcheck Docker doit rester indépendant de l'IA.

**Critères d'acceptation.**

- [ ] `docker compose stop ia-service` → `/health` reste `200`, `/health/ia` répond `indisponible` ;
- [ ] aucune exception ne remonte : la route ne fait jamais échouer le backend ;
- [ ] le test associé utilise un transport simulé, pas un vrai réseau.

### B-09 — Réponses audio : stockage et transcription

**Priorité** P2 · **État** ⛔ (refus explicite `422`) · **Effort** L · **Dépend de** — 

**Objectif.** Accepter une réponse orale, ou l'annoncer clairement comme hors périmètre.

**État actuel.** Le backend refuse : `422 AUDIO_NON_DISPONIBLE`. Le frontend possède pourtant un enregistreur
(`SpeechRecorder.tsx`, `EnregistrementOral.tsx`) qui fonctionne, et le service IA sait recevoir
`type_reponse: "audio"` avec une transcription en `contenu`.

**À faire (si la fonctionnalité est retenue).**

1. Stockage du média (le dossier `media/` existe déjà pour les photos, servi sous `/media`) ;
2. durée et taille maximales, type MIME vérifié ;
3. transcription (service externe ou modèle local dans `ia-service/models/`) ;
4. la transcription, et non l'audio, part vers l'IA ;
5. suppression à la fin de la rétention.

**À faire (si elle est écartée).** Retirer l'enregistreur de l'écran réel (le garder en mock), et l'écrire dans le
contrat : un écran qui propose un micro pour finir en `422` est un piège de démonstration.

**Critères d'acceptation.**

- [ ] soit une réponse audio produit un enregistrement + une transcription exploitée, soit l'écran ne propose plus
      le micro ;
- [ ] aucune donnée audio n'est journalisée ;
- [ ] la taille maximale est refusée en `413`/`422` avec un message clair.

---

## 4. Tâches frontend

Le frontend est **en avance sur le backend** : il code des champs et des routes que personne ne fournit. Le travail
consiste donc autant à **retirer** des promesses qu'à en ajouter.

### F-01 — Trancher la promesse « justification »

**Priorité** P1 · **État** 🔌 (écran prêt, données inexistantes) · **Effort** S · **Dépend de** `B-02` —

**Objectif.** Ne plus afficher en permanence une fonctionnalité qui n'arrivera pas dans la démonstration.

**État actuel.** `JustificationNiveau` est monté inconditionnellement par `TestResult`, et
`informationsManquantes()` compte `justification` comme manquante tant que `resume` est absent. Le bandeau
« Résultat partiel » liste donc **toujours** la justification, même quand l'IA a répondu.

**À faire.**

1. Si `B-02` est planifiée : garder l'écran, retirer `justification` de la liste des manquantes **tant que le
   backend ne l'envoie pas** (sinon on annonce un manque qu'on ne peut pas combler), et rouvrir la ligne quand le
   champ arrive.
2. Sinon : supprimer la section et le type `Justification`, et retirer la ligne du bandeau.
3. Dans les deux cas, un test doit fixer la décision.

**Critères d'acceptation.**

- [ ] en mode réel, le bandeau ne promet plus un champ que le backend n'envoie pas ;
- [ ] `informationsManquantes` est couverte par un test pour les deux cas (présent / absent) ;
- [ ] aucune référence morte à `Justification` dans `src/types/test-diagnostic.ts`.

### F-02 — Brancher la reprise sur le vrai backend

**Priorité** P1 · **État** 🔌 (E2E faux positif) · **Effort** S · **Dépend de** `B-01` —

**Objectif.** Que `testEnCours()` et `abandonner()` soient vérifiés contre le backend, pas contre un mock.

**État actuel.** Le service est complet et strict : il valide `id_tentative`, `code_langue`, `code_niveau`,
`reponses`, et retombe sur `Date.now()` si `date_debut` est illisible. Mais la route n'existe pas, donc :

- en réel : `404` → l'écran de reprise ne s'affiche jamais ;
- en E2E : Playwright intercepte les deux appels → le test passe et **ne prouve rien**.

**À faire.**

1. `B-01` d'abord.
2. Retirer les interceptions de `reprise-test.spec.ts` pour les deux routes et laisser l'E2E appeler le backend —
   ce qui suppose une stack réelle ou un mock serveur, pas un mock navigateur.
3. Ajouter un test de service qui vérifie le `204` (aucune tentative) et le cas `reponses` vide.

**Critères d'acceptation.**

- [ ] l'E2E échoue si `GET /diagnostic/tentatives/en-cours` disparaît ;
- [ ] un `204` produit `null`, pas une exception ;
- [ ] abandonner puis recharger ne repropose plus la tentative.

### F-03 — Aligner les délais d'attente

**Priorité** P1 · **État** 🟡 (60 s côté client, 55 s côté serveur, pour deux raisons différentes) · **Effort** S · **Dépend de** —

**Objectif.** Un seul délai cohérent, justifié, et pas d'attente silencieuse.

**État actuel.**

```ts
// frontend/src/services/test-diagnostic.service.ts
export const TIMEOUT_ANALYSE_MS = 60_000;
```

Ce délai est utilisé à deux endroits :

| Appel | Délai | Justification dans le code | Réalité |
| --- | --- | --- | --- |
| `terminer()` | 60 s | analyse IA à la clôture | backend borne à 55 s : cohérent |
| `repondre()` si `texte` | 60 s | « une réponse écrite peut être évaluée par le LLM avant d'être confirmée » | **faux** : le backend ne fait aucun appel IA sur cette route |

Le second cas fait attendre l'apprenant jusqu'à 60 s en cas de lenteur serveur, pour un appel qui ne fait qu'un
`INSERT`.

**À faire.**

1. Retirer `timeoutMs` de `repondre()` (ou le ramener à un délai d'écriture, 10 s).
2. Garder 60 s sur `terminer()`, en commentant la marge de 5 s sur `IA_SERVICE_TIMEOUT_S=55`.
3. Vérifier l'ordre : `LLM_BUDGET_TOTAL_S` (30) < `budget_ms` agent (45) < `IA_SERVICE_TIMEOUT_S` (55) <
   `TIMEOUT_ANALYSE_MS` (60). Un test de constante peut verrouiller cette chaîne.

**Critères d'acceptation.**

- [ ] une réponse écrite n'attend plus 60 s ;
- [ ] l'ordre des quatre budgets est documenté et testé ;
- [ ] aucun délai n'est dupliqué en dur ailleurs.

### F-04 — Retirer le `202` mort ou l'implémenter

**Priorité** P2 · **État** ⛔ (branche inatteignable) · **Effort** S · **Dépend de** `B-06` —

**Objectif.** Ne pas maintenir un chemin d'exécution que le serveur ne peut pas produire.

**État actuel.** `terminer()` teste `"statut" in dto && dto.statut === "en_attente"`, et
`ResultatEnAttente.tsx` existe. Le backend renvoie toujours un `ScoreDiagnosticOut`.

**À faire.** Suivre la décision de `B-06`. En option A : supprimer la branche, le type `AnalyseEnAttenteDto` et
l'écran. En option B : implémenter le polling et le test.

**Critères d'acceptation.**

- [ ] plus aucun code inatteignable, ou une couverture de test qui prouve le contraire ;
- [ ] la suppression ne casse pas `EtatsAnalyse.test.tsx` (à adapter).

### F-05 — Rendre l'attente lisible

**Priorité** P2 · **État** 🟡 (composants présents, parcours non vérifié) · **Effort** M · **Dépend de** —

**Objectif.** Pendant les 5 à 45 secondes d'analyse, l'apprenant doit voir que quelque chose se passe.

**État actuel.** Trois composants existent — `AnalyseEnCours.tsx`, `ResultatEnAttente.tsx`,
`ErreurReessayable.tsx` — mais la clôture réelle passe par `TIMEOUT_ANALYSE_MS` sans progression. Un écran figé
pendant 45 s est perçu comme une panne, et la première réaction est de recharger… ce qui ne relance pas la clôture.

**À faire.**

1. Afficher un état d'analyse explicite dès l'appui sur « Terminer », avec le message « cela peut prendre jusqu'à
   une minute ».
2. En cas de timeout réseau côté navigateur, proposer « Réessayer » — sans créer une nouvelle tentative
   (l'idempotence de `analyse_ia` fait le reste).
3. Vérifier au clavier et avec un lecteur d'écran (`role="status"`, `aria-live`).

**Critères d'acceptation.**

- [ ] aucune période > 3 s sans retour visuel ;
- [ ] « Réessayer » ne crée pas de doublon de tentative ;
- [ ] test de composant sur les trois états (attente, succès, échec).

### F-06 — Supprimer `NEXT_PUBLIC_IA_URL`

**Priorité** P1 · **État** 🔌 (variable lue par aucun code) · **Effort** S · **Dépend de** —

**Objectif.** Empêcher qu'un futur développement branche le navigateur directement sur le service IA.

**État actuel.** `.env.example` déclare :

```dotenv
NEXT_PUBLIC_IA_URL=http://localhost:8001
```

Aucun fichier de `frontend/src` ne la lit. C'est une **invitation** : la variable est publique (donc dans le bundle),
le service IA n'a **aucune authentification**, et son port est publié sur l'hôte. La brancher « pour aller plus
vite » reviendrait à contourner le backend, donc le scoring, la validation et la persistance.

**À faire.**

1. Supprimer la variable de `.env.example` et de `README.md` si elle y figure.
2. Ajouter une règle explicite dans `frontend/README.md` et dans le contrat : le navigateur ne parle **jamais** au
   service IA.
3. Facultatif : un test de garde qui échoue si `process.env.NEXT_PUBLIC_IA_URL` apparaît dans `src/`.

**Critères d'acceptation.**

- [ ] la variable n'existe plus dans aucun fichier versionné ;
- [ ] la règle est écrite à l'endroit où un développeur la lira (contrat + README frontend).

### F-07 — Rendre le mock honnête

**Priorité** P2 · **État** 🧪 · **Effort** S · **Dépend de** —

**Objectif.** Éviter que la démonstration en mode simulé fasse croire que la chaîne IA réelle fonctionne.

**État actuel.** Le mock produit une analyse **complète** :

```ts
// frontend/src/mocks/test-diagnostic.mock.ts
pointsFaibles: faiblesses.map(({ domaine, detail }) => ({ domaine, detail })),
phaseAssimil: echelle.indexOf(niveau) <= 1 ? "impregnation" : "activation",
justification: { resume: `Avec ${session.score} bonne(s) réponse(s) sur ${session.total}…`, sources: [...] },
```

En `NEXT_PUBLIC_API_MOCK=true`, l'écran est donc complet : justification, sources, points faibles détaillés. En
réel, la même page affiche « Résultat partiel ». Un jury qui voit d'abord le mock puis la stack réelle conclut à une
régression.

**À faire.**

1. Ajouter au mock un commutateur (variable ou paramètre d'URL) « analyse complète / analyse absente ».
2. Par défaut, se rapprocher du réel : pas de `justification`, `phaseAssimil` présent, `pointsFaibles` sans
   `detail`.
3. Écrire dans le README frontend que le mock est **optimiste par construction**.

**Critères d'acceptation.**

- [ ] un mode mock reproduit l'état réel (bandeau partiel) ;
- [ ] le mode complet reste disponible pour tester l'affichage ;
- [ ] la différence est documentée en une phrase dans `frontend/README.md`.

### F-08 — Écran de chatbot

**Priorité** P2 · **État** ⛔ (bloqué par l'absence de route backend) · **Effort** L · **Dépend de** `B-10` —

**Objectif.** Un jour, un vrai assistant. Aujourd'hui, rien.

**État actuel.** `POST /chatbot/message` existe **uniquement** dans `ia-service`, avec son agent, son prompt
`chatbot/conversation@1.0.0` et un budget de 30 s. Aucun code backend ne l'appelle, aucun écran ne l'affiche. Le
service IA n'est pas authentifié : l'exposer au navigateur serait une faute (voir `F-06`).

**À faire.** D'abord `B-10` : une route backend authentifiée qui relaie vers le service IA, avec un quota (même
problème de coût que `B-03`). Ensuite seulement, un panneau de discussion.

**Critères d'acceptation.**

- [ ] l'écran n'existe que si la route backend existe ;
- [ ] le quota est appliqué côté backend, pas côté navigateur ;
- [ ] aucun historique n'est persisté sans décision de rétention explicite.

---

## 5. Tâches Docker et infrastructure

C'est la couche où les écarts sont les plus visibles en démonstration : la stack démarre « healthy » alors que
l'analyse IA échoue systématiquement.

### D-01 — Analyse complète dès `docker compose up`

**Priorité** **P0** · **État** ✅ (stratégie 1, US153/US154) · **Effort** M · **Dépend de** `I-01` —

**Objectif.** Qu'une stack fraîchement démarrée produise une analyse, ou que l'absence soit **annoncée**.

**État actuel.** Compose lance le service IA avec :

```yaml
LLM_FOURNISSEUR: ${LLM_FOURNISSEUR:-factice}
ENVIRONNEMENT: ${ENVIRONNEMENT:-dev}
```

Or l'adaptateur `factice` **sans scénario** échoue en `LLM_CONFIGURATION` (`500`). Le backend dégrade proprement
(`analyse = None`), le frontend affiche « Résultat partiel ». C'est donc le comportement **par défaut** de toute
démonstration : personne ne voit jamais `points_faibles` ni `phase_assimil` sans configurer une clé.

**À faire — choisir une stratégie, pas les trois.**

1. **Scénario factice** (`I-01`) : un jeu de réponses déterministe pour l'agent diagnostic, activé quand
   `LLM_FOURNISSEUR=factice`. Coût nul, démonstration complète, reproductible en CI.
2. **Fournisseur réel documenté** : une section « démonstration avec analyse » dans le README, avec la marche à
   suivre Groq (clé, `LLM_MODELE`, `LLM_BASE_URL`) et le redémarrage.
3. **Absence assumée** : garder `factice`, mais l'écrire en tête du parcours de démonstration, avec la phrase
   exacte à dire au jury.

**Critères d'acceptation.**

- [x] `docker compose up --build -d --wait` puis un test terminé → soit `points_faibles` non vide, soit un
      message d'attente **explicite** (pas une erreur) ;
- [x] `docker compose logs ia-service` ne montre pas de trace Python ;
- [x] la stratégie retenue est écrite dans `docs/fonctionnalites/01-demarrage-docker.md`.

### D-02 — Ne pas exposer le service IA

**Priorité** P1 · **État** 🔌 (port publié, CORS ouvert, aucune authentification) · **Effort** S · **Dépend de** —

**Objectif.** Le service IA doit être joignable **par le backend**, et par personne d'autre.

**État actuel.** Trois faits se cumulent :

```yaml
# docker-compose.yml — service ia-service
ports:
  - "${IA_PORT:-8001}:8001"        # publié sur l'hôte, y compris en prod
environment:
  BACKEND_CORS_ORIGINS: ${BACKEND_CORS_ORIGINS:-http://localhost:3000,http://localhost:8000}
```

```python
# ia-service/app/main.py
app.add_middleware(CORSMiddleware, allow_origins=origines, allow_credentials=True, allow_methods=["*"], ...)
```

Aucune route du service IA ne vérifie de jeton. Un navigateur ouvert sur le frontend peut donc appeler
`POST :8001/diagnostic/evaluer` directement et consommer des jetons LLM sans passer par le backend, donc sans
quota, sans traçabilité et sans validation.

**À faire.**

1. En production : **ne pas publier** `8001` (le réseau Docker suffit au backend). Garder le port publié
   uniquement dans `docker-compose.dev.yml`, pour `/docs`.
2. Restreindre `BACKEND_CORS_ORIGINS` du service IA : la valeur par défaut ne devrait pas inclure le frontend.
3. Optionnel mais recommandé : un en-tête partagé (`X-Interne: <secret>`) vérifié par le service IA, pour que
   même un conteneur voisin ne puisse pas l'utiliser.

**Critères d'acceptation.**

- [ ] `docker compose -f docker-compose.yml config` ne publie pas `8001` ;
- [ ] un `Invoke-RestMethod` depuis l'hôte vers `:8001` échoue en prod, réussit en dev ;
- [ ] la décision est écrite dans `docs/api/contrat-frontend.md` (le frontend n'appelle jamais l'IA).

### D-03 — Périmètre des clés LLM

**Priorité** P1 · **État** 🟡 (bien parti, à verrouiller) · **Effort** S · **Dépend de** —

**Objectif.** Une clé LLM ne doit exister que dans le conteneur qui en a besoin, et jamais dans une image.

**État actuel.** Le point fort à conserver :

```yaml
# docker-compose.yml — service backend
environment:
  # Les clés des fournisseurs LLM sont réservées au service IA.
  LLM_API_KEY: ""
  GEMINI_API_KEY: ""
```

Le point à vérifier : `ia-service/.dockerignore` exclut `.env` (bien), mais `.env` est lu par Compose **à la
racine** et injecté dans `ia-service`. Il n'y a pas de `.dockerignore` racine (il n'y en a pas besoin, les contextes
de build sont `./backend`, `./frontend`, `./ia-service`).

**À faire.**

1. Vérifier qu'aucune image ne contient de `.env` : `docker compose build` puis inspection de l'image.
2. Ajouter au README la règle « une clé ne sort jamais du service IA ».
3. S'assurer que `ENVIRONNEMENT=prod` est bien positionné en production : c'est ce qui **interdit** `factice`.
4. Ne jamais afficher la clé dans un `docker compose config` collé dans une issue.

**Critères d'acceptation.**

- [ ] `docker compose config` montre la clé sur `ia-service` **uniquement** ;
- [ ] aucune couche d'image ne contient `.env` ;
- [ ] `ENVIRONNEMENT=prod` + `LLM_FOURNISSEUR=factice` empêche le démarrage (déjà vrai, à tester).

### D-04 — Retirer la dépendance Redis inutile

**Priorité** P2 · **État** 🔌 (dépendance sans usage) · **Effort** S · **Dépend de** —

**Objectif.** Ne pas faire attendre le service IA pour un service qu'il ne lit pas.

**État actuel.**

```yaml
ia-service:
  depends_on:
    redis:
      condition: service_healthy
```

Aucun code du service IA n'ouvre de connexion Redis : le RAG est **local** (`app/rag/local.py`), et la
configuration ne contient aucune variable Redis. Le backend, lui, reçoit `REDIS_HOST`/`REDIS_PORT` sans les lire
non plus. Redis est provisionné, démarré, et utilisé par personne.

**À faire.** Soit retirer Redis de la stack (et de `.env.example`), soit le garder en le documentant comme
« provisionné pour le rate limiting à venir ». Dans les deux cas, retirer le `depends_on` du service IA.

**Critères d'acceptation.**

- [ ] le service IA démarre sans Redis ;
- [ ] la décision est écrite (garder/retirer) dans `01-demarrage-docker.md` ;
- [ ] aucune documentation n'affirme que Redis est utilisé.

### D-05 — Volumes `models` / `corpus`

**Priorité** P2 · **État** 🟡 (montages vides) · **Effort** S · **Dépend de** —

**Objectif.** Éviter un montage qui laisse croire à un modèle ou un corpus présent.

**État actuel.**

```yaml
volumes:
  - ./ia-service/models:/app/models:ro
  - ./ia-service/corpus:/app/corpus:ro
```

`ia-service/models/` ne contient qu'un `.gitkeep`. `ia-service/corpus/` ne contient que le manifeste et un
README : les descripteurs CECRL sont un artefact **privé**, généré hors dépôt. En production, monter un dossier
hôte est de toute façon une dépendance fragile.

**À faire.**

1. Documenter dans `01-demarrage-docker.md` ce que chaque volume doit contenir, et ce qui se passe s'il est vide.
2. En production : supprimer les montages (image autonome) et injecter le corpus par une étape de build ou un
   volume nommé.
3. Garder les montages uniquement dans `docker-compose.dev.yml`.

**Critères d'acceptation.**

- [ ] `docker compose -f docker-compose.yml config` ne référence plus de chemin hôte pour l'IA ;
- [ ] `RAG_CORPUS_ACTIF=true` sans descripteurs produit une erreur claire au démarrage, pas un silence.

### D-06 — Tester l'IA de bout en bout en CI

**Priorité** P1 · **État** 🟡 (`/health` seulement) · **Effort** M · **Dépend de** `I-01` —

**Objectif.** La CI doit prouver que la chaîne IA fonctionne, pas seulement que le port répond.

**État actuel.** Le job `docker` vérifie :

```yaml
- name: Les services répondent
  run: |
    curl --fail --silent http://localhost:8000/health
    curl --fail --silent http://localhost:8001/health
    curl --fail --silent --output /dev/null http://localhost:3000/login
    curl --fail --silent http://localhost:8000/api/v1/formules | grep -q '"libelle":"Simple"'
```

et le job `ia-service` lance `ruff` + `pytest` (couverture ≥ 70 %). Aucun test n'exerce
`POST /diagnostic/evaluer` **à travers le backend**. Une régression du contrat (champ renommé, enveloppe changée)
passerait donc la CI.

**À faire.**

1. `I-01` d'abord (sinon l'appel échoue en `factice`).
2. Ajouter au job `docker` : login apprenant → création de tentative → réponse → clôture → `jq -e` sur
   `points_faibles` et `phase_assimil`.
3. Vérifier aussi le cas dégradé : `docker compose stop ia-service`, clôturer, obtenir `200` sans analyse.
4. Ne **jamais** mettre de clé LLM dans la CI : le scénario factice suffit.

**Critères d'acceptation.**

- [ ] le job échoue si `points_faibles` disparaît de la réponse ;
- [ ] le cas « IA arrêtée » est testé et renvoie `200` ;
- [ ] aucun secret n'est ajouté aux workflows.

### D-07 — Hygiène des journaux et des ressources

**Priorité** P2 · **État** 🟡 · **Effort** S · **Dépend de** —

**Objectif.** Des journaux exploitables, sans contenu d'apprenant ni prompt.

**État actuel.** `PYTHONUNBUFFERED=1` est positionné dans les deux images, et le service IA journalise via un
gestionnaire d'erreurs central qui ne recopie ni trace ni secret. Il n'y a en revanche **aucune rotation** de
journaux, aucune limite mémoire/CPU, et l'image de production du service IA lance **2 workers** (justifié dans le
Dockerfile par le premier démarrage à froid).

**À faire.**

1. Ajouter des options de rotation (`logging: driver: json-file, max-size, max-file`) sur les trois services.
2. Poser des limites raisonnables (`deploy.resources.limits` ou `mem_limit`) — l'IA est surtout limitée par le
   réseau, pas par le CPU.
3. Documenter la règle : **jamais** de prompt, de réponse d'apprenant ni de clé dans un log.
4. Vérifier que `docker compose logs ia-service` reste lisible après une journée de démonstration.

**Critères d'acceptation.**

- [ ] les journaux ne dépassent pas une taille bornée ;
- [ ] un `grep` sur les logs ne trouve ni `LLM_API_KEY` ni contenu de réponse ;
- [ ] le nombre de workers est commenté et assumé.

---

## 6. Tâches du service IA (quatrième couche)

Elles ne sont pas dans la demande initiale (Back / Front / Docker), mais **trois tâches backend et frontend en
dépendent directement**. Le détail du Harness, des prompts et du RAG est dans [`05-ia-service.md`](05-ia-service.md).

### I-01 — Scénario `factice` pour le diagnostic

**Priorité** **P0** · **État** ✅ (`LLM_FACTICE_SCENARIO=demonstration`, `app/llm/demonstration.py`) · **Effort** S · **Dépend de** —

**Objectif.** Rendre `LLM_FOURNISSEUR=factice` **utile** pour le diagnostic, au lieu d'échouer.

**État actuel.** L'adaptateur `factice` est déterministe et hors ligne, mais sans scénario enregistré il lève une
erreur de configuration, traduite en `LLM_CONFIGURATION` (`500`). C'est la cause racine du « Résultat partiel »
par défaut.

**À faire.** Fournir une réponse factice **valide au sens du schéma** (`ResultatDiagnostic` : `niveau_estime`,
`phase_assimil`, `points_faibles` cohérents avec `score_confiance`, `ecart_avec_niveau_preliminaire`) et la
sélectionner par variable d'environnement. La réponse doit rester **déterministe** : mêmes entrées → mêmes sorties.

**Critères d'acceptation.**

- [x] `POST /diagnostic/evaluer` avec le client factice renvoie `200` et une enveloppe valide ;
- [x] les tests existants (`test_llm_factice.py`, `test_diagnostic.py`) passent sans clé ;
- [x] aucun appel réseau.

### I-02 — Ajouter `justification` et `sources` au résultat

**Priorité** P1 · **État** ⛔ · **Effort** L · **Dépend de** — 

**Objectif.** Produire la matière de « Pourquoi ce niveau ? ».

**État actuel.** Le résultat ne contient ni résumé ni sources. Le prompt `evaluation@1.1.0` produit des points
faibles justifiés par une réponse, pas une synthèse de niveau adossée au référentiel.

**À faire.**

1. Ajouter `Justification {resume, sources[]}` au schéma de sortie, avec des validateurs : `resume` borné, sources
   dédupliquées, `referentiel` cohérent avec le contexte, `url` facultative.
2. Faire produire ces champs par le prompt (nouvelle version `evaluation@1.2.0`, l'ancienne restant résolvable).
3. Si le RAG est actif (`I-04`), les sources viennent des descripteurs ; sinon, le modèle ne doit pas inventer de
   citation — préférer `sources: []` à une source fabriquée.
4. Ajouter un cas de test « justification refusée si source inventée ».

**Critères d'acceptation.**

- [ ] une réponse valide contient `justification.resume` non vide ;
- [ ] une source sans `titre`/`extrait` est refusée (`LLM_REPONSE_INVALIDE`, `502`) ;
- [ ] la version du prompt est tracée dans `meta.empreinte_prompt`.

### I-03 — Évaluer les réponses libres

**Priorité** P1 · **État** 🟡 (transmises, pas jugées) · **Effort** M · **Dépend de** — 

**Objectif.** Donner un sens aux réponses `texte`, ou assumer qu'elles n'en ont pas.

**État actuel.** L'agent reçoit `type_reponse: "texte"` et le contenu, mais son schéma de sortie ne permet pas de
rendre un jugement **par réponse** : seulement des points faibles par domaine, citant une question.

**À faire.** Ajouter une liste `evaluations[]` (`id_question`, `niveau_atteint`, `commentaire` borné), validée et
**non autoritaire** : le backend ne l'utilise pas pour le score. Ou décider explicitement que les réponses libres
ne servent qu'aux points faibles, et le documenter (`B-04`).

**Critères d'acceptation.**

- [ ] chaque `id_question` renvoyé existe dans l'entrée ;
- [ ] aucune évaluation ne modifie `score` ni `level` côté backend ;
- [ ] le prompt interdit d'inventer une réponse absente.

### I-04 — Activer le RAG CECRL

**Priorité** P2 · **État** 🔌 (`RAG_CORPUS_ACTIF=false`, corpus privé) · **Effort** M · **Dépend de** — 

**Objectif.** Adosser la justification à de vrais descripteurs.

**État actuel.** `RAG_CORPUS_ACTIF` vaut `false` par défaut ; seul `corpus/cecrl/manifeste.json` est versionné ;
les descripteurs JSONL sont générés hors dépôt (`python -m scripts.ingestion_cecrl`). Le récupérateur local
existe, testé (`test_rag_local.py`, `test_rag_corpus.py`).

**À faire.** Décider de la politique de corpus (privé livré par l'équipe pédagogique), vérifier l'empreinte
(`RAG_CORPUS_VERIFIER_EMPREINTE=true`), et n'activer qu'après `I-02` — sans justification, le RAG n'alimente rien
de visible.

**Critères d'acceptation.**

- [ ] `RAG_CORPUS_ACTIF=true` sans descripteurs → erreur claire, pas un démarrage silencieux ;
- [ ] `meta.version_corpus` est renseigné quand le RAG est actif ;
- [ ] aucun descripteur sous licence n'est versionné.

---

## 7. Ordre d'exécution

L'ordre n'est pas « par couche » mais **par dépendance**. Quatre lots, chacun démontrable.

### Lot 0 — Rendre la démonstration honnête (2 à 3 jours)

| Ordre | Tâche | Pourquoi maintenant |
| :-: | --- | --- |
| 1 | `I-01` | sans scénario factice, tout le reste est invisible |
| 2 | `D-01` | transforme l'échec par défaut en résultat ou en message clair |
| 3 | `B-03` | sans plafond, la démo peut coûter cher |
| 4 | `F-06` + `D-02` | ferme la porte à un appel navigateur → IA |
| 5 | `F-01` | arrête de promettre la justification |

**Résultat attendu** : `docker compose up` + test terminé → analyse visible (factice) ou bandeau exact ; aucune
variable piège ; aucun port IA ouvert en prod.

### Lot 1 — Réparer le contrat (3 à 5 jours)

| Ordre | Tâche | Dépend de |
| :-: | --- | --- |
| 1 | `B-01` | — |
| 2 | `F-02` | `B-01` |
| 3 | `B-06` puis `F-04` | — |
| 4 | `F-03` | — |
| 5 | `B-05` | — |

**Résultat attendu** : reprise de test réelle, E2E qui prouve quelque chose, budgets cohérents, journaux
exploitables.

### Lot 2 — Analyse complète (5 à 8 jours)

| Ordre | Tâche | Dépend de |
| :-: | --- | --- |
| 1 | `I-02` | — |
| 2 | `B-02` | `I-02` |
| 3 | `F-01` (réouverture) | `B-02` |
| 4 | `I-03` puis `B-04` | — |
| 5 | `D-06` | `I-01` |

**Résultat attendu** : « Pourquoi ce niveau ? » rempli, réponses libres traitées de façon explicite, CI qui
détecte une rupture de contrat IA.

### Lot 3 — Extensions (au-delà)

`B-07` (historique) → `B-09` (audio) → `B-10`/`F-08` (chatbot) → `I-04` (RAG) → `B-08` (santé détaillée),
`D-04`, `D-05`, `D-07`, `F-05`, `F-07` au fil de l'eau.

### 7.1 Le graphe des dépendances

```
I-01 ──► D-01 ──► D-06
  │
  └──► (démo complète)

I-02 ──► B-02 ──► F-01

I-03 ──► B-04

B-01 ──► F-02

B-06 ──► F-04

B-10 ──► F-08

B-03   (indépendant, à faire tôt)
F-06 ◄─► D-02  (même décision, deux couches)
```

---

## 8. Definition of Done commune

Une tâche IA n'est **pas** terminée quand « ça marche chez moi ». Elle l'est quand les six points suivants sont
vrais.

| # | Critère | Vérification |
| :-: | --- | --- |
| 1 | **Contrat à jour** | `docs/api/contrat-frontend.md` décrit la route ou le champ |
| 2 | **Chaîne frontend à jour** | `endpoints.ts` + service/mapper + `services.test.ts` |
| 3 | **Dégradation testée** | le cas « IA indisponible » renvoie `200`, jamais `500` |
| 4 | **Aucune fuite** | ni prompt, ni réponse d'apprenant, ni clé dans les journaux |
| 5 | **Budgets respectés** | 30 s < 45 s < 55 s < 60 s (voir `F-03`) |
| 6 | **Qualité** | `ruff` + `pytest --cov-fail-under=70` (backend et IA), `npm run check` (frontend) |

### 8.1 Checklist de revue pour une PR « IA »

- [ ] la tâche ne déplace pas l'autorité : `score` et `level` restent calculés par le backend ;
- [ ] un nouveau champ IA est **facultatif** côté contrat public (`| None`), sinon un service IA en panne casse
      l'écran ;
- [ ] un nouveau champ est validé en `extra="forbid"` à la frontière `backend/app/schemas/ia.py` ;
- [ ] le frontend sait afficher l'absence du champ (bandeau, pas d'erreur) ;
- [ ] aucun appel réseau vers `:8001` depuis `frontend/src` ;
- [ ] le test E2E n'intercepte pas la route nouvellement créée ;
- [ ] `docs/fonctionnalites/05-ia-service.md` et ce chapitre sont mis à jour si un verdict change.

---

## 9. Ce qu'il ne faut pas faire

Cinq tentations qui reviennent, et pourquoi elles sont des pièges.

| Tentation | Pourquoi c'est faux |
| --- | --- |
| **Faire calculer le niveau par l'IA** | le scoring déterministe est la seule autorité ; `niveau_estime` est une **proposition** (`ecart_avec_niveau_preliminaire` borné à ±5) |
| **Afficher `meta` au frontend** | `MetaExecutionIA` contient fournisseur, modèle, empreinte de prompt : de l'information d'infrastructure, pas de la pédagogie |
| **Rendre `/health` dépendant de l'IA** | une panne IA ferait redémarrer le backend en boucle ; le healthcheck doit rester local |
| **Appeler `:8001` depuis le navigateur** | pas d'authentification, pas de quota, pas de validation : c'est contourner tout le backend |
| **Inventer une `justification` quand l'IA échoue** | le bandeau « Résultat partiel » est **le comportement correct** ; une justification fabriquée est un mensonge pédagogique |

Une sixième, plus subtile : **rendre le champ `justification` obligatoire**. Si le contrat public l'exige, une
panne IA rendrait la clôture du test impossible. Tout ce qui vient de l'IA doit rester facultatif.

---

## 10. Vérifier une tâche, commande par commande

### 10.1 Clôturer un test et lire l'analyse

```powershell
$base = "http://localhost:8000/api/v1"

$login = Invoke-RestMethod -Method Post "$base/auth/login" -ContentType "application/json" `
  -Body (@{ email = "apprenant@digitheque.mg"; mot_de_passe = "Demo2026" } | ConvertTo-Json)
$h = @{ Authorization = "Bearer $($login.access_token)" }

$t = Invoke-RestMethod -Method Post "$base/diagnostic/tentatives" -Headers $h `
  -ContentType "application/json" -Body (@{ code_langue = "en" } | ConvertTo-Json)

$q = Invoke-RestMethod "$base/diagnostic/questions?code_langue=en&code_niveau=$($t.code_niveau)" -Headers $h

Invoke-RestMethod -Method Post "$base/diagnostic/reponse" -Headers $h -ContentType "application/json" `
  -Body (@{ id_tentative = $t.id_tentative; id_question = $q[0].id_question; reponse_fournie = $q[0].choix[0] } | ConvertTo-Json) | Out-Null

$r = Invoke-RestMethod -Method Post "$base/diagnostic/tentatives/$($t.id_tentative)/terminer" -Headers $h
$r | ConvertTo-Json -Depth 6
```

Lecture du résultat :

| Ce que l'on voit | Ce que cela prouve |
| --- | --- |
| `competences` non vide | le scoring déterministe a tourné (indépendant de l'IA) |
| `points_faibles` absent | l'analyse IA a échoué ou a été ignorée |
| `points_faibles` présent | la chaîne IA complète a fonctionné |
| `phase_assimil` présent | idem |

### 10.2 Prouver que l'analyse est bien persistée

```powershell
docker compose exec -T db psql -U admin -d centre_langues -c `
  "select id_test, statut, score, analyse_ia is not null as analyse from test_diagnostic order by id_test desc limit 5;"
```

Une deuxième clôture de la **même** tentative doit renvoyer la même analyse **sans nouvelle ligne de log d'appel** :
c'est l'idempotence.

### 10.3 Voir pourquoi l'analyse manque

```powershell
docker compose logs ia-service --tail 50
docker compose logs backend | Select-String "Analyse IA"
```

| Log | Interprétation |
| --- | --- |
| `Analyse IA ignorée : langue non supportée` | garde-fou `LANGUES_IA` |
| `Analyse IA ignorée : niveau hors référentiel` | garde-fou `NIVEAUX_IA` |
| `Analyse IA ignorée : aucune réponse exploitable` | tentative sans réponse, ou compétences inconnues |
| `Analyse IA indisponible (…, code=timeout)` | le service IA a dépassé 55 s |
| `code=http_500` | le service IA a refusé : souvent `LLM_CONFIGURATION` |
| `code=non_configure` | `IA_SERVICE_URL` est vide |

### 10.4 Appeler le service IA directement (diagnostic d'incident)

```powershell
$corps = Get-Content "ia-service/tests/exemples/valide/requete-diagnostic.json" -Raw
Invoke-RestMethod -Method Post "http://localhost:8001/diagnostic/evaluer" `
  -ContentType "application/json" -Body $corps | ConvertTo-Json -Depth 6
```

En `factice` sans scénario, la réponse est une enveloppe d'erreur `LLM_CONFIGURATION`. C'est **le symptôme de
`I-01`**, pas un bug du backend.

### 10.5 Vérifier la configuration réellement chargée

```powershell
docker compose config | Select-String "LLM_FOURNISSEUR|LLM_MODELE|ENVIRONNEMENT|IA_SERVICE_TIMEOUT_S|IA_PORT"
docker compose exec -T ia-service python -c "from app.core.config import charger_config; print(charger_config().fournisseur)"
```

> `charger_config()` relit l'environnement à chaque appel et lève `ErreurConfiguration` si une variable est
> incohérente (message sans clé ni valeur refusée). Mais les variables d'un conteneur sont fixées à sa création :
> après avoir modifié `.env`, il faut **recréer** le conteneur (`docker compose up -d ia-service`), pas seulement
> le redémarrer.

---

## 11. Ce que le développeur doit retenir

1. **La chaîne IA fonctionne déjà** : le travail restant est du contrat, du coût et de l'observabilité, pas de
   l'algorithme.
2. **Deux P0 suffisent à changer la démonstration** : `I-01` (scénario factice) et `B-03` (plafond d'appels).
3. **La justification n'existe nulle part** : ce n'est pas un oubli du backend, c'est une fonctionnalité à créer de
   bout en bout (`I-02` → `B-02` → `F-01`).
4. **Le frontend est en avance** : il code `202`, `justification`, reprise et abandon que le backend ne fournit pas.
   Une tâche frontend sans tâche backend est une dette, pas une avance.
5. **Tout ce qui vient de l'IA doit rester facultatif** : un champ obligatoire transforme une panne d'IA en panne
   de diagnostic.
6. **Les budgets sont une chaîne**, pas quatre nombres : 30 < 45 < 55 < 60. Casser l'ordre produit soit des
   timeouts invisibles, soit des attentes inutiles.
7. **Le service IA ne doit jamais être joignable par le navigateur** : ni port publié en prod, ni
   `NEXT_PUBLIC_IA_URL`, ni CORS ouvert.

---

## Questions de compréhension

1. Un apprenant termine son test et la réponse contient `competences` mais ni `points_faibles` ni
   `phase_assimil`. Quelles sont les **trois** causes possibles, et quelle commande permet de distinguer la
   bonne ? Pourquoi le backend renvoie-t-il quand même `200` ?
2. La justification du niveau est absente à l'écran. Explique pourquoi ce n'est **pas** une tâche backend
   isolée : quelles couches faut-il modifier, dans quel ordre, et pourquoi le frontend est-il déjà prêt ?
3. Pourquoi `B-03` (plafonner les analyses) est-elle une priorité **P0** alors que le projet fonctionne sans ?
   Décris le scénario concret qui coûte de l'argent, en t'appuyant sur le fait que chaque
   `POST /diagnostic/tentatives` crée une nouvelle tentative.
4. Un développeur propose d'ajouter `NEXT_PUBLIC_IA_URL` et d'appeler `:8001/diagnostic/evaluer` depuis React pour
   « éviter l'aller-retour par le backend ». Donne trois conséquences précises de ce choix, en citant les
   mécanismes du code qui seraient contournés.
5. Le service IA tombe pendant une démonstration. Décris, étape par étape, ce que voit l'apprenant, ce que
   contiennent les journaux du backend, et pourquoi il serait **faux** d'afficher une justification inventée pour
   « sauver » la démonstration.
