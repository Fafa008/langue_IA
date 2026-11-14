# 05 — Le service IA (`ia-service`)

> Référence : `ia-service/app/`, `ia-service/tests/`, `ia-service/prompts` (dans `app/prompts/`),
> `ia-service/Dockerfile`, `ia-service/requirements.txt`, `backend/app/services/ia.py`,
> `backend/app/services/analyse_diagnostic.py`.
> Constat du **14 novembre 2026**, branche `develop` (`95543db`).

---

## 1. À quoi sert le service IA

`ia-service` est un **service FastAPI séparé** du backend, sur le port **8001**. Il ne fait qu'une chose :
transformer une entrée pédagogique en **estimation structurée** produite par un modèle de langage.

Ce qu'il **ne fait pas** :

| Interdit | Pourquoi |
| --- | --- |
| Écrire en base | il n'a **aucune connexion PostgreSQL** ; c'est le backend qui persiste |
| Recalculer le score du test | le score reste la propriété du backend (`scoring.py`) |
| Connaître l'identité de l'apprenant | le contexte ne contient ni nom, ni e-mail, ni identifiant |
| Garder une conversation en mémoire | il est **sans état** : l'historique est renvoyé à chaque appel |
| Décider seul du niveau final | il **propose** ; le backend reste l'autorité |

Autrement dit : le service IA est un **calculateur externe**, pas une source de vérité. Le backend peut
l'ignorer et continuer à fonctionner (résultat partiel).

---

## 2. Carte des fichiers

```
ia-service/
├── app/
│   ├── main.py                  # application, lifespan, CORS, gestionnaires d'erreurs
│   ├── api/
│   │   ├── diagnostic.py        # POST /diagnostic/evaluer
│   │   └── chatbot.py           # POST /chatbot/message
│   ├── harness/
│   │   ├── execution.py         # pipeline commun (le cœur du service)
│   │   ├── registre.py          # résolution agent + version
│   │   └── agent.py             # DefinitionAgent, OutilsCommuns, ContexteExecution
│   ├── agents/
│   │   ├── diagnostic.py        # diagnostic@1.0.0, budget 45 s
│   │   └── chatbot.py           # chatbot@1.0.0, budget 30 s
│   ├── schemas/
│   │   ├── commun.py            # enveloppes RequeteAgent / ReponseAgent / ReponseErreur
│   │   ├── contexte.py          # ContexteApprenant, MemoirePedagogique
│   │   ├── diagnostic.py        # ResultatDiagnostic + validations croisées
│   │   └── chatbot.py           # EntreeChatbot, ResultatChatbot
│   ├── llm/
│   │   ├── base.py              # port FournisseurLLM
│   │   ├── fabrique.py          # obtenir_client() : un client par processus
│   │   └── adaptateurs/         # factice.py, compatible_openai.py, gemini.py
│   ├── prompts/
│   │   ├── registre.py          # chargement, versionnement, empreinte SHA-256
│   │   ├── diagnostic/evaluation@1.1.0.{systeme,utilisateur}.md + .jsonl
│   │   ├── chatbot/conversation@1.0.0.{systeme,utilisateur}.md
│   │   └── exemples/diagnostic/ # few-shot : quotidien, examen, entretien
│   ├── rag/                     # port RAG, RecuperateurVide, corpus CECRL local
│   └── core/
│       ├── config.py            # ConfigLLM (Pydantic Settings)
│       ├── codes_erreur.py      # catalogue unique des codes publics
│       ├── erreurs.py           # exceptions typées
│       └── gestionnaire_erreurs.py
├── corpus/cecrl/                # descripteurs privés (non versionnés)
├── models/                      # modèles entraînés (vide, seulement .gitkeep)
└── tests/                       # 28 fichiers, aucun réseau requis
```

Règle de lecture : **route → Harness → agent → client LLM**. Une route ne contient aucune logique
pédagogique ; un agent ne construit ni client ni Harness.

---

## 3. Démarrage et configuration

### 3.1 Le `lifespan`

Tout est construit **une seule fois** au démarrage, pas au premier appel :

```python
@asynccontextmanager
async def duree_vie(app: FastAPI) -> AsyncIterator[None]:
    registre_prompts = RegistrePrompts()
    client_llm = obtenir_client()
    registre_agents = RegistreAgents()
    recuperateur_rag = construire_recuperateur()

    registre_agents.enregistrer(construire_definition(registre_prompts))   # diagnostic
    registre_agents.enregistrer(definir_agent_chatbot(registre_prompts))   # chatbot

    app.state.harness = Harness(registre_agents, client_llm, ...)
    try:
        yield
    finally:
        await client_llm.fermer()
        await recuperateur_rag.fermer()
        reinitialiser_client()
```

Conséquence volontaire : **une configuration LLM invalide empêche le service de démarrer**. Mieux vaut un
conteneur qui ne démarre pas qu'un service qui échoue à la première requête d'un apprenant.

### 3.2 Les variables d'environnement

| Variable | Défaut Compose | Rôle |
| --- | --- | --- |
| `ENVIRONNEMENT` | `dev` | `dev` / `test` / `prod` ; `prod` interdit `factice` |
| `LLM_FOURNISSEUR` | `factice` | `factice`, `compatible-openai` ou `gemini` |
| `LLM_MODELE` | vide | nom du modèle chez le fournisseur |
| `LLM_BASE_URL` | vide | racine de l'API compatible OpenAI |
| `LLM_API_KEY` | vide | clé du fournisseur |
| `GEMINI_MODEL`, `GEMINI_API_KEY` | vides | requis si `gemini` |
| `LLM_TEMPERATURE` | `0.2` | entre 0 et 2 |
| `LLM_MAX_TOKENS` | `600` | 1 à 8 192 |
| `LLM_TIMEOUT` | `12` | délai d'**un** appel (secondes) |
| `LLM_MAX_RETRIES` | `1` | 0 à 3 reprises |
| `LLM_REPRISE_DELAI_S` / `_MAX_S` | `0.5` / `4` | backoff entre deux tentatives |
| `LLM_BUDGET_TOTAL_S` | `30` | budget d'un appel, reprises comprises |
| `RAG_CORPUS_ACTIF` | `false` | active le corpus CECRL |
| `RAG_CORPUS_CHEMIN` | `/app/corpus/cecrl` | dossier des descripteurs |
| `RAG_CORPUS_VERIFIER_EMPREINTE` | `true` | vérifie le manifeste SHA-256 |

La configuration est **gelée après construction** : un client ne peut pas changer de fournisseur en cours
d'exécution.

### 3.3 Les contrôles de cohérence

`ConfigLLM.verifier_coherence` refuse :

- `factice` quand `ENVIRONNEMENT=prod` ;
- `compatible-openai` sans `LLM_MODELE`, `LLM_BASE_URL` ou `LLM_API_KEY` ;
- `gemini` sans `GEMINI_MODEL` ou `GEMINI_API_KEY` ;
- `LLM_REPRISE_DELAI_MAX_S < LLM_REPRISE_DELAI_S` ;
- `LLM_BUDGET_TOTAL_S < LLM_TIMEOUT`.

Le message d'erreur ne cite **jamais la valeur refusée** (elle peut être une clé). Il est donc journalisable.

---

## 4. Les trois routes

| Méthode | Chemin | Rôle | Réponse |
| --- | --- | --- | --- |
| GET | `/health` | healthcheck Docker / supervision | `{"status": "ok", "service": "ia-service"}` |
| POST | `/diagnostic/evaluer` | analyse d'une tentative terminée | `ReponseAgent[ResultatDiagnostic]` |
| POST | `/chatbot/message` | réponse de l'assistant | `ReponseAgent[ResultatChatbot]` |

Il n'y a **ni authentification, ni jeton, ni contrôle d'origine** entre le backend et ce service : le port 8001
est publié par Compose. CORS ne protège que le navigateur, pas un appel serveur à serveur.

> **Piège documentaire** : `ia-service/README.md` affirme encore que « l'agent Diagnostic n'a pas de route
> HTTP ». C'est faux depuis PRE-05 : `POST /diagnostic/evaluer` existe et le backend l'appelle.

---

## 5. Les enveloppes : le vrai contrat

Tout passe par trois objets, définis dans `app/schemas/commun.py`. Ils sont **génériques** : `RequeteAgent[T]`
change de `T` selon l'agent, mais l'enveloppe ne change jamais.

### 5.1 Requête

```json
{
  "request_id": "6f1c2a4e-8f3b-4c2a-9d1e-7b5a0c3e2d11",
  "version_agent": null,
  "contexte": {
    "code_langue": "en",
    "referentiel": "CECRL",
    "niveau_preliminaire": "A1",
    "memoire_pedagogique": null
  },
  "entree": { }
}
```

| Champ | Type | Remarque |
| --- | --- | --- |
| `request_id` | UUID | corrélation des journaux ; recopié dans la réponse |
| `version_agent` | optionnel | sans lui, la **dernière** version enregistrée est retenue |
| `contexte` | `ContexteApprenant` | aucune donnée identifiante |
| `entree` | `T` | validée **deux fois** : par la route, puis par le Harness |

`ContexteApprenant` vérifie que le référentiel correspond à la langue : `zh` impose `HSK`, les autres
imposent `CECRL`. Un niveau hors référentiel est refusé.

`memoire_pedagogique` est un **résumé** préparé par le backend (`resume`, `points_forts`, `points_faibles`,
`nb_activites`), jamais un historique brut. Un premier diagnostic transmet `null`, pas un objet vide.

### 5.2 Réponse de succès

```json
{
  "request_id": "6f1c2a4e-8f3b-4c2a-9d1e-7b5a0c3e2d11",
  "agent": "diagnostic",
  "version_agent": "1.0.0",
  "version_prompt": "diagnostic/evaluation@1.1.0",
  "statut": "succes",
  "resultat": {
    "code_langue": "en",
    "referentiel": "CECRL",
    "niveau_estime": "A2",
    "phase_assimil": "impregnation",
    "points_faibles": [],
    "score_confiance": 0.62,
    "niveau_preliminaire": "A1",
    "ecart_avec_niveau_preliminaire": 1
  },
  "meta": {
    "duree_ms": 1840,
    "fournisseur": "compatible-openai",
    "modele": "openai/gpt-oss-20b",
    "version_corpus": null,
    "empreinte_prompt": "sha256:3f9c…"
  }
}
```

`meta` sert à l'**exploitation** (latence, fournisseur, version du prompt). Le backend ne la transmet pas au
frontend.

### 5.3 Réponse d'erreur

```json
{
  "request_id": "6f1c2a4e-8f3b-4c2a-9d1e-7b5a0c3e2d11",
  "agent": "diagnostic",
  "statut": "erreur",
  "erreur": {
    "code": "LLM_TIMEOUT",
    "message": "Le fournisseur LLM n'a pas répondu dans le délai imparti.",
    "retryable": true,
    "details": null
  }
}
```

Deux garanties :

- `retryable` est **vérifié contre le code** : un même code ne peut pas être annoncé tantôt rejouable,
  tantôt définitif ;
- `message` tient sur **une ligne** et ne recopie **jamais** l'entrée, la réponse du fournisseur ou un secret.

---

## 6. Le Harness : un seul pipeline

`app/harness/execution.py` est le passage obligé. Il ne contient **aucune logique pédagogique** ; il applique
toujours la même séquence :

```
1. résoudre l'agent (code + version)      → AGENT_INCONNU (404)
2. revalider l'entrée typée               → ENTREE_INVALIDE (422)
3. préparer les OutilsCommuns             → client LLM, prompts, RAG, horloge
4. exécuter sous budget asyncio.timeout   → LLM_TIMEOUT (504)
5. traduire toute exception en code       → catalogue
6. valider la sortie avec Pydantic        → LLM_REPONSE_INVALIDE (502)
7. construire ReponseAgent + meta
```

```python
async with asyncio.timeout(definition.budget_ms / 1000):
    resultat_brut = await definition.executer(entree, contexte)
```

Points importants :

- **le Harness ne lève jamais d'exception vers l'appelant** : il retourne toujours une enveloppe ;
- une `ValidationError` **à la sortie** est classée `LLM_REPONSE_INVALIDE` (502), pas `ERREUR_INTERNE` : c'est
  une réponse de modèle inexploitable, pas un bug du service ;
- le budget est **par agent** et couvre les reprises du client LLM.

| Agent | Version | Budget | Prompt |
| --- | --- | --- | --- |
| `diagnostic` | `1.0.0` | **45 s** | `diagnostic/evaluation@1.1.0` |
| `chatbot` | `1.0.0` | **30 s** | `chatbot/conversation@1.0.0` |

Le prompt `diagnostic/evaluation@1.0.0` reste présent dans le dépôt, mais le registre charge **1.1.0**.

---

## 7. L'agent Diagnostic

### 7.1 Entrée

```python
class EntreeDiagnostic(ModeleStrict):
    scenario: ScenarioDiagnostic = "quotidien"          # quotidien | examen | entretien
    reponses: list[ReponseDiagnosticPrompt]             # 1 à 100
    score_preliminaire: float                           # 0 à 100, fourni par le backend
```

Chaque réponse est **réduite** à ce qui est nécessaire :

```python
class ReponseDiagnosticPrompt(ModeleStrict):
    id_question: str
    competence: Competence          # grammaire | lecture | ecoute | ecrit | oral
    type_reponse: Literal["choix", "texte", "audio"]
    contenu: str                    # 5 000 caractères maximum
```

Le backend envoie le **libellé choisi** (pas l'index) pour une question à choix, et le texte pour une réponse
libre. Le corrigé n'est **jamais** transmis : le service IA ne peut donc pas recalculer le score.

### 7.2 Déroulement

```
récupérer les descripteurs RAG (ou aucun)
        ↓
assembler les 7 variables du prompt (scénario, langue, référentiel, réponses,
score préliminaire, contexte apprenant, descripteurs)
        ↓
le registre choisit le few-shot selon scénario + langue
        ↓
appel LLM en JSON strict (temperature et max_tokens du prompt)
        ↓
vérifier la cohérence avec le contexte ET les preuves
        ↓
signaler un écart ≥ 2 niveaux dans les journaux
```

### 7.3 Sortie et garde-fous

```python
class ResultatDiagnostic(ModeleStrict):
    code_langue: CodeLangue
    referentiel: Referentiel
    niveau_estime: CodeNiveau
    phase_assimil: PhaseAssimil                 # impregnation | activation
    points_faibles: list[PointFaible]           # 0 à 5, domaines uniques
    score_confiance: float                      # 0 à 1, PAS un score de réussite
    niveau_preliminaire: CodeNiveau
    ecart_avec_niveau_preliminaire: int         # -5 à +5, recalculé et vérifié
```

Les validations sont nombreuses, et c'est le point le plus important du chapitre :

| Règle | Effet si violée |
| --- | --- |
| référentiel cohérent avec la langue | rejet du modèle |
| niveaux dans le référentiel | rejet du modèle |
| `ecart` = position(estimé) − position(préliminaire) | rejet du modèle |
| `score_confiance == 0` interdit un point faible | rejet du modèle |
| domaines de faiblesse uniques | rejet du modèle |
| un point faible cite une question **existante** | `LLM_REPONSE_INVALIDE` |
| cette question est une **preuve directe** du domaine | `LLM_REPONSE_INVALIDE` |
| phase `activation` exige un `texte` ou un `audio` | `LLM_REPONSE_INVALIDE` |

La fonction `preuve_directe` mérite d'être lue en entier :

```python
def preuve_directe(domaine: str, preuve: PreuveReponse) -> bool:
    production = preuve.type_reponse in ("texte", "audio")
    if domaine in ("grammaire", "vocabulaire"):
        return production
    if domaine == "expression_ecrite":
        return preuve.competence == "ecrit" and preuve.type_reponse == "texte"
    if domaine == "expression_orale":
        return preuve.competence == "oral" and preuve.type_reponse == "audio"
    if domaine == "comprehension_ecrite":
        return preuve.competence == "lecture" and production
    if domaine == "comprehension_orale":
        return preuve.competence == "ecoute" and production
    return False
```

**Une réponse à choix ne prouve jamais une compréhension** : le service ne reçoit pas le corrigé, il ne sait
donc pas si elle est juste. Résultat concret avec les données actuelles : le seed ne contient que des QCM, donc
`points_faibles` revient presque toujours **vide**. Ce n'est pas un bug, c'est une conséquence du contrat.

---

## 8. L'agent chatbot

```
EntreeChatbot { message (1–2 000), historique (0–20 tours) }
        ↓
ResultatChatbot { reponse (1–4 000) }
```

- le service est **sans état** : le backend renvoie l'historique récent à chaque appel ;
- l'historique est **borné** à 20 tours pour garder un prompt de taille prévisible ;
- un message fait uniquement d'espaces devient vide et est refusé.

**Mais personne ne l'appelle.** Il n'existe :

- aucune route backend `/chatbot` ;
- aucun écran frontend ;
- aucune entrée de menu.

La route `POST /chatbot/message` est donc **livrée mais non branchée**. C'est la fonctionnalité la plus
« prête à brancher » du dépôt : le contrat existe, le prompt existe, les tests existent.

---

## 9. Les fournisseurs LLM

### 9.1 Trois adaptateurs

| `LLM_FOURNISSEUR` | Classe | Usage réel |
| --- | --- | --- |
| `factice` | `FakeLLMClient` | tests et développement sans clé |
| `compatible-openai` | `CompatibleOpenAI` | Groq, OpenAI, Ollama… toute API `/v1/chat/completions` |
| `gemini` | `GeminiClient` | SDK `google-genai` (import paresseux) |

### 9.2 Le piège du `factice`

`FakeLLMClient` ne produit **rien** par défaut : il consomme une file de scénarios préparés.

```python
def _prochain_scenario(self) -> ScenarioLLM:
    if not self._scenarios:
        raise ErreurConfiguration("Aucun scénario factice n'est disponible pour cet appel.")
    return self._scenarios.popleft()
```

Comme Compose met `LLM_FOURNISSEUR=factice` **sans scénario**, tout appel réel échoue en
`LLM_CONFIGURATION` (500). Le backend dégrade alors en **résultat partiel**. C'est le comportement par défaut
de la stack Docker, et c'est volontaire : pas de clé, pas de facture.

Pour une démonstration complète, il faut configurer un vrai fournisseur :

```powershell
# .env à la racine
$env:LLM_FOURNISSEUR = "compatible-openai"
$env:LLM_MODELE = "openai/gpt-oss-20b"
$env:LLM_BASE_URL = "https://api.groq.com/openai/v1"
$env:LLM_API_KEY = "<clé>"
docker compose up --build -d --wait
```

### 9.3 Le client compatible OpenAI

Il envoie les messages du prompt, demande un **JSON strict** validé par le schéma Pydantic de l'agent, et
applique :

- `LLM_TIMEOUT` par tentative (12 s) ;
- `LLM_MAX_RETRIES` reprises (1) avec backoff 0,5 s → 4 s ;
- `LLM_BUDGET_TOTAL_S` (30 s) comme plafond global.

Une réponse hors schéma devient `LLM_REPONSE_INVALIDE` (502), jamais une exception qui remonte.

---

## 10. Le RAG (corpus CECRL)

| Élément | État réel |
| --- | --- |
| Port `RecuperateurRAG` | ✅ défini, stable |
| `RecuperateurVide` | ✅ **actif par défaut** (aucun descripteur) |
| `RecuperateurLocal` (BM25) | ✅ codé, activable |
| Corpus dans `ia-service/corpus/cecrl/` | 🔌 manifeste versionné, descripteurs **non versionnés** |
| `RAG_CORPUS_ACTIF` | `false` par défaut |

Deux comportements à connaître :

1. **au démarrage**, un corpus absent ou incohérent est **absorbé** : le service démarre quand même avec
   `RecuperateurVide`, et l'estimation devient « prudente » ;
2. **pendant l'exécution**, un échec de récupération devient `CORPUS_INDISPONIBLE` (503).

Le corpus n'est donc **pas** une fonctionnalité livrée : c'est un branchement prêt, désactivé. Les descripteurs
sont des données privées, à fournir hors dépôt.

---

## 11. Catalogue d'erreurs

`app/core/codes_erreur.py` est la **seule source de vérité**. Aucun autre module ne réécrit un code, un message
ou un statut.

| Code | HTTP | Rejouable | Sens |
| --- | :-: | :-: | --- |
| `ENTREE_INVALIDE` | 422 | non | corps hors contrat |
| `AGENT_INCONNU` | 404 | non | agent ou version inconnue |
| `TAILLE_DEPASSEE` | 413 | non | requête trop volumineuse |
| `QUOTA_DEPASSE` | 429 | **oui** | quota applicatif atteint |
| `LLM_INDISPONIBLE` | 503 | **oui** | fournisseur injoignable |
| `LLM_TIMEOUT` | 504 | **oui** | délai dépassé |
| `LLM_LIMITE_REQUETES` | 429 | **oui** | 429 du fournisseur |
| `LLM_AUTHENTIFICATION` | 502 | non | clé refusée |
| `LLM_REQUETE_INVALIDE` | 502 | non | requête refusée par le fournisseur |
| `LLM_CONFIGURATION` | 500 | non | configuration invalide (dont `factice` sans scénario) |
| `LLM_REPONSE_INVALIDE` | 502 | **oui** | sortie hors schéma ou incohérente |
| `CORPUS_INDISPONIBLE` | 503 | **oui** | RAG en échec |
| `PROMPT_INTROUVABLE` | 500 | non | prompt absent du registre |
| `ERREUR_INTERNE` | 500 | non | bug |

Nuance importante : **le backend ne lit pas `retryable`**. `evaluer_diagnostic` considère tout statut ≠ 200
comme un échec et n'essaie pas de rejouer. L'information est produite, mais inutilisée côté appelant.

---

## 12. L'intégration backend → IA

```
POST /api/v1/diagnostic/tentatives/{id}/terminer
        │
        ├── scoring déterministe (score, niveau)  ← autorité
        ├── db.close()                            ← libère la connexion PostgreSQL
        │
        ▼
analyser_tentative(id)  (backend/app/services/analyse_diagnostic.py)
        │  garde-fous : langue/niveau supportés, au moins une réponse exploitable
        │  si analyse_ia déjà en base → la réutilise (idempotent, aucun appel facturé)
        ▼
evaluer_diagnostic(requete)  (backend/app/services/ia.py)
        │  httpx.Client(timeout=IA_SERVICE_TIMEOUT_S = 55 s)
        │  POST {IA_SERVICE_URL}/diagnostic/evaluer
        │  accepte uniquement 200, valide l'enveloppe
        ▼
succès → test_diagnostic.analyse_ia = enveloppe (JSONB)
échec  → logger.warning + analyse = None  → « Résultat partiel »
```

Ce qui est **persisté** : l'enveloppe complète, y compris `meta`. Ce qui est **exposé** au frontend :

| Champ public | Origine réelle |
| --- | --- |
| `score`, `percentage`, `level`, `framework` | scoring backend |
| `competences` | **calcul backend** sur les QCM (pas l'IA) |
| `points_faibles` | `resultat.points_faibles[].justification` |
| `phase_assimil` | `resultat.phase_assimil` |
| `justification` | **jamais produite** |

Deux conséquences :

- le champ `niveau_estime` de l'IA **n'est pas exposé** : le niveau public reste celui du scoring. L'IA ne peut
  donc pas changer la note d'un apprenant ;
- `analyse_ia` n'est jamais purgée : aucune politique de rétention n'est codée.

### 12.1 Le timeout est plus long que le budget

| Couche | Délai |
| --- | --- |
| Budget agent diagnostic | 45 s |
| `LLM_BUDGET_TOTAL_S` | 30 s |
| `LLM_TIMEOUT` par tentative | 12 s |
| **Timeout backend** | **55 s** |

L'ordre est cohérent : le backend attend plus longtemps que le service IA. Si l'on inverse (backend plus court),
on obtient des timeouts backend alors que l'IA aurait répondu.

---

## 13. Tests

```
ia-service/tests/   (25 fichiers test_*.py + conftest.py et 2 jeux de données)
├── test_agent_diagnostic.py     # cohérence, preuves, écart
├── test_api_diagnostic.py       # route + statuts HTTP
├── test_chatbot.py
├── test_harness.py              # budget, erreurs, enveloppes
├── test_commun.py               # validation des enveloppes
├── test_codes_erreur.py         # retryable / statuts
├── test_config_llm.py           # refus de configuration
├── test_llm_factice.py
├── test_adaptateur_compatible_openai.py / test_adaptateur_gemini.py
├── test_prompts.py / test_registre.py / test_bibliotheque_few_shot.py
├── test_rag_corpus.py / test_rag_local.py / test_rag_fabrique.py
├── test_reprise.py              # backoff et budget
└── test_jeu_cas_diagnostic.py   # jeu de cas pédagogiques
```

Aucun test n'a besoin d'une clé ni d'un réseau : `FakeLLMClient` rejoue des scénarios déterministes.

```powershell
# Dans le conteneur de développement
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm ia-service pytest

# Lint
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm ia-service ruff check .
```

La CI exécute `ruff check`, `ruff format --check`, un import de l'application, puis
`pytest --cov=app --cov-fail-under=70`. **La couverture du service IA est donc aussi exigée à 70 %.**

---

## 14. Vérifier le service en 5 minutes

### 14.1 Santé

```powershell
Invoke-RestMethod http://localhost:8001/health
# status service
# ------ -------
# ok     ia-service
```

### 14.2 Un appel diagnostic (doit échouer en `factice`)

```powershell
$corps = @{
  request_id = "6f1c2a4e-8f3b-4c2a-9d1e-7b5a0c3e2d11"
  contexte   = @{ code_langue = "en"; referentiel = "CECRL"; niveau_preliminaire = "A1" }
  entree     = @{
    reponses = @(
      @{ id_question = "12"; competence = "grammaire"; type_reponse = "choix"; contenu = "go" }
    )
    score_preliminaire = 50.0
  }
} | ConvertTo-Json -Depth 6

try {
  Invoke-RestMethod -Method Post http://localhost:8001/diagnostic/evaluer `
    -ContentType "application/json" -Body $corps
} catch {
  $_.ErrorDetails.Message
}
# → statut "erreur", code "LLM_CONFIGURATION" (500) : aucun scénario factice
```

### 14.3 Une entrée invalide

```powershell
# reponses vide → 422 ENTREE_INVALIDE, sans recopier le corps refusé
```

### 14.4 Le chatbot

```powershell
$corps = @{
  request_id = "6f1c2a4e-8f3b-4c2a-9d1e-7b5a0c3e2d11"
  contexte   = @{ code_langue = "fr"; referentiel = "CECRL"; niveau_preliminaire = "B1" }
  entree     = @{ message = "Explique-moi le passé composé."; historique = @() }
} | ConvertTo-Json -Depth 6

Invoke-RestMethod -Method Post http://localhost:8001/chatbot/message `
  -ContentType "application/json" -Body $corps
# → 500 LLM_CONFIGURATION par défaut, comme le diagnostic
```

### 14.5 Vérifier la configuration réellement chargée

```powershell
docker compose exec ia-service printenv LLM_FOURNISSEUR
docker compose exec ia-service printenv RAG_CORPUS_ACTIF
docker compose logs ia-service | Select-String "Corpus|LLM|démarrage"
```

---

## 15. Ce qui fonctionne, ce qui manque

| Élément | Verdict | Preuve |
| --- | --- | --- |
| `GET /health` | ✅ | healthcheck Compose |
| `POST /diagnostic/evaluer` | ✅ | route + tests |
| Harness (budget, enveloppes, erreurs) | ✅ | `test_harness.py` |
| Agent Diagnostic + validations de cohérence | ✅ | `test_agent_diagnostic.py` |
| Prompts versionnés + empreinte | ✅ | `diagnostic/evaluation@1.1.0` |
| Fournisseur `compatible-openai` | ✅ | adaptateur testé |
| Fournisseur `gemini` | ✅ | adaptateur testé |
| Fournisseur `factice` utilisable en démo | 🟡 | aucun scénario → 500 |
| Agent chatbot | 🔌 | route livrée, **aucun appelant** |
| RAG CECRL | 🔌 | désactivé, corpus absent |
| Modèles entraînés (`models/`) | ⛔ | dossier vide |
| Persistance / historique | ⛔ | service sans état, par choix |
| Authentification backend → IA | ⛔ | aucune |
| Limitation de débit | ⛔ | aucune |
| Rétention de `analyse_ia` | ⛔ | aucune purge |

### Limites à retenir

| Limite | Effet concret |
| --- | --- |
| `factice` par défaut | démonstration = résultat partiel |
| QCM seuls dans le seed | `points_faibles` presque toujours vide |
| `retryable` ignoré par le backend | pas de reprise automatique |
| Port 8001 publié sans auth | n'importe qui sur l'hôte peut appeler le LLM (et consommer la clé) |
| Pas de quota | un appel en boucle peut coûter cher |
| `meta` non exposée | impossible de diagnostiquer la latence depuis le frontend |
| README obsolète | laisse croire que la route diagnostic n'existe pas |
| Aucun modèle local | `models/` vide : tout passe par un fournisseur externe |

### Ce que le développeur doit maîtriser

1. **L'enveloppe avant l'agent** : `RequeteAgent[T]` est le contrat ; un champ en trop est refusé.
2. **Le Harness comme unique porte** : ne jamais appeler un agent directement depuis une route.
3. **La double validation** : entrée revalidée, sortie revalidée ; c'est ce qui protège le backend.
4. **Le budget** : `asyncio.timeout` autour de l'agent, pas autour du client.
5. **Les codes d'erreur** : un seul catalogue, `retryable` dérivé du code.
6. **La frontière de confiance** : l'IA propose, le backend décide et persiste.

---

## Questions de compréhension

1. Le service IA reçoit `score_preliminaire` mais ne reçoit jamais le corrigé des questions. Pourquoi ce choix,
   et quelle conséquence a-t-il sur la détection des points faibles quand le test ne contient que des QCM ?
2. Le Harness classe une `ValidationError` de **sortie** en `LLM_REPONSE_INVALIDE` (502) et non en
   `ERREUR_INTERNE` (500). Explique la différence de sens et l'effet sur une éventuelle reprise.
3. Pourquoi le backend ferme-t-il sa session PostgreSQL **avant** `evaluer_diagnostic`, alors que le timeout est
   de 55 s ?
4. `LLM_FOURNISSEUR=factice` est la valeur par défaut de Compose, mais tout appel échoue en
   `LLM_CONFIGURATION`. Explique pourquoi, et comment obtenir une analyse complète en démonstration.
5. Le service IA est sans état et ne reçoit aucune donnée identifiante. Quels sont les deux avantages de ce
   choix, et quelle fonctionnalité devient impossible sans que le backend ne renvoie l'historique à chaque appel ?
