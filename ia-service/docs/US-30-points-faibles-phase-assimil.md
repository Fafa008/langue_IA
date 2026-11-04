# US30 — Points faibles justifiés et phase Assimil

| Élément | Valeur |
| --- | --- |
| User Story | US30 |
| Branche | `feature/US-30-points-faibles-phase-assimil` |
| Base | `feature/US-29-agent-diagnostic` (empilée ; PR à recibler sur `develop` après la fusion de #29/#31) |
| Statut | Implémenté, testé, documenté — en attente de revue |
| Périmètre | `ia-service/app/schemas/`, `app/prompts/`, `app/agents/diagnostic.py`, exemples JSON, tests et documentation |
| Voir aussi | [US29 — Agent Diagnostic](US-29-agent-diagnostic.md), [US70 — Prompt diagnostic](US-70-prompt-diagnostic.md), [US71 — Bibliothèque few-shot](US-71-bibliotheque-few-shot.md), [Contrat des modèles](contrat-modeles-ia.md) |

## 1. Objectif

US29 produisait déjà une estimation de niveau et une liste de points faibles. US30 rend cette liste **auditable** :

- chaque point faible sépare le **fait observé** de son **interprétation** et cite la réponse qui le démontre ;
- seuls les domaines réellement évaluables à partir des réponses disponibles sont retenus ;
- la phase Assimil n'est plus déduite du niveau global, mais des preuves de production et de réception ;
- aucune difficulté, aucun niveau de maîtrise et aucune preuve ne sont inventés.

Le service IA reste un **estimateur** : le score objectif, le niveau final et la persistance restent au backend.

## 2. Domaines de faiblesse autorisés

Les six domaines sont ceux du contrat public (`docs/api/contrat-frontend.md`) :

| Domaine | Ce qu'il couvre | Ce qu'il ne prouve pas |
| --- | --- | --- |
| `grammaire` | morphologie, syntaxe, emploi des temps observables dans une production | un niveau de maîtrise global |
| `vocabulaire` | choix lexical, précision, répétitions, mot isolé | la compréhension d'un texte |
| `comprehension_ecrite` | difficulté exprimée sur un texte lu | une réponse à choix non corrigée |
| `comprehension_orale` | difficulté exprimée sur un audio écouté | une réponse à choix non corrigée |
| `expression_ecrite` | production écrite personnelle | une simple copie de l'énoncé |
| `expression_orale` | production orale transcrite | un texte écrit à l'avance |

Aucune valeur n'est ajoutée : `prononciation`, `orthographe` ou `culture` resteraient hors contrat. Le contrat
public autorise au maximum cinq points faibles par résultat ; avec six domaines, au moins un domaine est donc
nécessairement absent. Ce plafond n'oblige pas à remplir la liste.

## 3. Modèle `PointFaible`

| Champ | Type | Contrainte |
| --- | --- | --- |
| `domaine` | domaine autorisé | requis ; un seul point par domaine |
| `id_question` | texte | 1 à 64 caractères ; doit désigner une réponse réellement transmise |
| `observation` | texte | 1 à 160 caractères, espaces normalisés |
| `justification` | texte | 1 à 240 caractères, espaces normalisés |

```json
{
  "domaine": "expression_orale",
  "id_question": "q-entretien-en-01",
  "observation": "L'apprenant indique avoir besoin de plus de temps pour expliquer une situation difficile.",
  "justification": "Cette réserve, formulée dans la réponse, semble signaler une difficulté d'expression orale ; elle reste à confirmer."
}
```

### 3.1 Observation

`observation` ne contient **que ce qui est directement lisible** dans la réponse citée :

- une formulation effective (« phrase au présent là où le passé serait attendu », « mot isolé », « réponse
  incomplète ») ;
- une réserve explicitement formulée (« je ne comprends pas le passage sur les horaires », « j'ai deviné ») ;
- une absence vérifiable dans la réponse (« aucun connecteur reliant les deux idées »).

Elle ne contient ni niveau (`B1`), ni pourcentage, ni conclusion pédagogique, ni reproche général. Elle ne peut pas
être vide après normalisation des espaces.

### 3.2 Justification

`justification` interprète l'observation et la relie au domaine et, quand ils existent, aux descripteurs RAG :

- elle reste prudente (« semble », « ne permet pas de », « à confirmer ») ;
- elle n'attribue jamais un niveau de maîtrise non démontré ;
- elle ne s'appuie pas sur la mémoire pédagogique ni sur le seul score préliminaire ;
- elle n'invente pas de descripteur absent du corpus.

### 3.3 Unicité et confiance

- Deux points faibles ne peuvent pas partager le même domaine.
- Un résultat dont `score_confiance == 0.0` ne peut contenir aucun point faible : « aucune preuve » est
  incompatible avec « difficulté démontrée ».
- Un point faible sans réponse citée est refusé.

## 4. Preuves disponibles

`PreuveReponse` réduit chaque réponse du test à ses indices vérifiables, sans recopier son contenu :

| Champ | Type |
| --- | --- |
| `id_question` | texte |
| `competence` | `grammaire`, `lecture`, `ecoute`, `ecrit`, `oral` |
| `type_reponse` | `choix`, `texte`, `audio` |

### 4.1 Preuve directe par domaine

`preuve_directe(domaine, preuve)` applique la table suivante :

| Domaine | Compétence exigée | Type de réponse exigé |
| --- | --- | --- |
| `grammaire` | indifférente | `texte` ou `audio` |
| `vocabulaire` | indifférente | `texte` ou `audio` |
| `comprehension_ecrite` | `lecture` | `texte` ou `audio` |
| `comprehension_orale` | `ecoute` | `texte` ou `audio` |
| `expression_ecrite` | `ecrit` | `texte` |
| `expression_orale` | `oral` | `audio` |

**Pourquoi une réponse à choix ne suffit jamais** : le service IA ne reçoit pas le corrigé du backend. Une réponse
`choix` ne montre ni la compréhension réelle, ni la grammaire employée. La seule exception serait un énoncé qui
exprime lui-même l'incompréhension, et il serait alors de type `texte` ou `audio`.

**Pourquoi `expression_orale` exige `audio`** : une transcription textuelle d'un oral reste une trace audio côté
backend. Un texte rédigé ne prouve pas une production orale.

### 4.2 Vérification

`ResultatDiagnostic.verifier_preuves(reponses)` refuse :

- des identifiants de réponse dupliqués ;
- un point faible qui cite une réponse absente ;
- un point faible dont la réponse citée n'est pas une preuve directe du domaine ;
- une phase `activation` alors que toutes les réponses sont des choix.

L'agent appelle cette vérification après la validation Pydantic et la cohérence de contexte. Une incohérence devient
une erreur `LLM_REPONSE_INVALIDE` (rejouable), sans exposer la réponse ni le contenu de l'apprenant.

`EntreeDiagnostic` refuse également deux réponses partageant le même `id_question` : sans cette unicité, un point
faible citerait une preuve ambiguë.

## 5. Phase Assimil

`PhaseAssimil` ne contient que deux valeurs, celles du contrat public :

| Valeur | Signification | Preuves typiques |
| --- | --- | --- |
| `impregnation` | premier contact, réception, reconnaissance, répétition | choix, lecture, écoute, mots isolés, récitation |
| `activation` | réutilisation autonome et production personnelle | phrases personnelles, reformulation, prise de position |

Règles appliquées :

1. **La phase n'est jamais déduite du niveau global.** Un niveau faible peut déjà être en activation ; un niveau
   élevé peut rester en imprégnation dans une nouvelle langue.
2. **`activation` exige au moins une production libre** (`texte` ou `audio`). Une simple copie de l'énoncé, une
   récitation ou une répétition ne suffit pas : le prompt demande au modèle de distinguer ces cas, la vérification
   structurelle garantit au minimum la présence d'une production.
3. **`impregnation` reste valide avec des choix seuls** : c'est le cas normal d'un test réceptif.
4. **Les anciennes valeurs `passive` et `active` sont refusées.** Elles ne sont plus acceptées par le schéma, les
   prompts ni les exemples.
5. En cas de preuves insuffisantes, le schéma impose une phase : le prompt utilise `impregnation` comme **valeur de
   repli**, sans prétendre qu'elle a été établie. La confiance vaut alors `0.0`.

## 6. Prompt `diagnostic/evaluation@1.1.0`

Le prompt actif passe de `1.0.0` à `1.1.0` ; les ressources `1.0.0` restent sur disque mais ne sont plus chargées
ni revalidées.

| Élément | Valeur |
| --- | --- |
| Version active | `diagnostic/evaluation@1.1.0` |
| Température | `0.2` |
| Limite de sortie | `900` tokens (contre `600` en `1.0.0`) |
| Ressources | `.systeme.md`, `.utilisateur.md`, `.jsonl` (3 exemples) |

Le prompt `1.1.0` ajoute explicitement :

- la liste des six domaines et l'interdiction de doublon ;
- la séparation `observation` / `justification` et leurs limites de longueur ;
- l'obligation de citer `id_question` ;
- la table des preuves directes, avec l'interdiction de conclure depuis un choix seul ;
- la distinction `impregnation` / `activation` fondée sur les réponses, jamais sur le niveau ;
- l'interdiction d'affirmer un point faible avec `score_confiance == 0.0` ;
- le repli prudent avec `impregnation` présenté comme valeur de schéma, pas comme constat.

## 7. Exemples et fixtures

- Les quinze exemples few-shot (trois scénarios × cinq langues) utilisent `activation` et les nouvelles preuves.
  L'exemple `entretien` en anglais illustre un point faible `expression_orale` justifié par une réserve explicite.
- Les réponses de type `oral` sont désormais des transcriptions `audio`, seule preuve directe d'expression orale.
- `tests/exemples/valide/resultat-diagnostic.json` et `reponse-diagnostic.json` utilisent le schéma US30 et
  `diagnostic/evaluation@1.1.0`.
- Les fixtures invalides couvrent : phase `passive`, domaine inconnu, domaine dupliqué, confiance nulle avec point
  faible, écart incohérent et empreinte invalide.

## 8. Compatibilité avec le contrat public

| Contrat public | Service IA | Remarque |
| --- | --- | --- |
| `phase_assimil`: `impregnation` \| `activation` | identique | plus de `passive`/`active` |
| `points_faibles[].domaine`: six valeurs | identique | aucune valeur ajoutée |
| `points_faibles[].detail`: texte facultatif | `observation` + `justification` | le backend devra composer `detail` (par exemple `observation` puis `justification`) |

Aucun champ public n'est ajouté : `id_question`, `observation` et `justification` restent internes au service IA et à
la traçabilité. La route backend qui exposera le résultat IA n'existe pas encore dans ce périmètre.

## 9. Tests et couverture

```powershell
cd ia-service
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m ruff format --check .
.\.venv\Scripts\python.exe -m pytest --cov=app --cov-fail-under=70
```

État mesuré le 4 novembre 2026 :

| Indicateur | Résultat |
| --- | --- |
| Tests | **415 réussis** |
| Couverture `app/` | **98,62 %** |
| Couverture `app/schemas/diagnostic.py` | **100 %** |
| Ruff (lint et formatage) | conforme (`line-length = 120`) |

Couverture fonctionnelle US30 :

- schéma `PointFaible` (domaines, longueurs, normalisation, champs supplémentaires, domaine dupliqué) ;
- `PreuveReponse` et `preuve_directe` pour les six domaines ;
- preuve absente, preuve indirecte, identifiants dupliqués ;
- `activation` sans production refusée, `impregnation` avec choix acceptée ;
- confiance nulle avec point faible refusée ;
- intégration dans le vrai Harness : entrée dupliquée, réponse inventée, preuve indirecte, phase incohérente ;
- prompt `1.1.0` (version, tokens, règles, ressources archivées) ;
- exemples JSON valides et invalides.

## 10. Contraintes US29 conservées

| Contrainte | Mise en œuvre |
| --- | --- |
| Ne jamais recalculer le score objectif | `score_preliminaire` transmis tel quel ; la confiance reste distincte |
| Aucun accès PostgreSQL | uniquement des schémas Pydantic et les outils injectés par le Harness |
| Aucune persistance apprenant | le contexte reste un résumé fourni par le backend |
| Ne jamais contourner le Harness | l'agent est exécuté par le pipeline commun |
| Erreurs publiques stables | `{code, message, retryable}`, sans trace ni clé |
| Aucune donnée sensible dans les journaux | seuls `request_id`, agent, langue et écart sont journalisés |

## 11. Limites et points à valider

| Sujet | État |
| --- | --- |
| Cinq points faibles pour six domaines | Plafond du contrat public ; un domaine reste forcément absent |
| `activation` | La vérification structurelle garantit une production ; la qualité de la réutilisation reste jugée par le modèle |
| `impregnation` de repli | Valeur imposée par le schéma quand les preuves manquent, pas une phase observée |
| Prononciation et orthographe | Non couvertes : aucun domaine correspondant dans le contrat public |
| Mapping `detail` | À définir côté backend lors de l'exposition de la route IA |
| Exemples few-shot | Synthétiques, à valider pédagogiquement avant production |
| Prompt `1.0.0` | Conservé pour l'audit, non chargé par le registre |
