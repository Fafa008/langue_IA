# Contrat des modèles du service IA (US-151)

| Élément | Valeur |
| --- | --- |
| Statut | Implémenté et testé |
| Périmètre | `ia-service/app/schemas/` : contrat commun du Harness, contexte apprenant, résultat de diagnostic, erreurs |
| Hors périmètre | Routes HTTP, client LLM, RAG, prompts, persistance |
| Sources | `backend/app/seed.py`, `backend/app/services/scoring.py`, `docs/api/contrat-frontend.md`, `docs/architecture/aj02-cadrage-technique-ia.md` |
| Voir aussi | [US-69 — Client LLM et Agent Harness](US-69-llm-client-harness.md) |

## 1. Audit préalable

- **Aucun modèle Pydantic n'existait dans `ia-service/`** : le service ne contenait que `app/main.py` (`GET /health`)
  et des dossiers vides.
- `ia-service/app/models/` est vide (simple `.gitkeep`). Il est **conservé tel quel** ; les modèles Pydantic vivent
  dans `app/schemas/`, conformément au cadrage AJ02 (§18.2), pour éviter la confusion avec `ia-service/models/`
  (artefacts ML montés en lecture seule).
- Les schémas du backend (`backend/app/schemas/diagnostic.py`) décrivent le **contrat public** ; ils ne sont pas
  importés ici. Le service IA a son propre contrat interne, en `snake_case`, et ne partage aucun code avec le backend.
- Aucune valeur pédagogique n'a été inventée : langues, niveaux, compétences et référentiels proviennent des fichiers
  cités en tête de document.

## 2. Organisation

| Module | Rôle |
| --- | --- |
| `app/schemas/base.py` | `ModeleStrict` : `extra="forbid"` pour tous les modèles |
| `app/schemas/regles.py` | Langues, référentiels, niveaux, compétences, helpers de validation |
| `app/schemas/contexte.py` | `MemoirePedagogique`, `ContexteApprenant` |
| `app/schemas/diagnostic.py` | `PointFaible`, `PhaseAssimil`, `ResultatDiagnostic`, calcul de l'écart |
| `app/schemas/commun.py` | `RequeteAgent`, `ReponseAgent`, `MetaExecution`, `CodeErreur`, `ErreurAgent`, `ReponseErreur` |
| `app/schemas/__init__.py` | Réexports publics du paquet |

## 3. Règles communes

1. **Aucun champ supplémentaire** : tous les modèles héritent de `ModeleStrict` (`extra="forbid"`), y compris les
   objets imbriqués. Un champ inconnu produit une erreur `422` au lieu d'être ignoré.
2. **Espaces normalisés** : `str_strip_whitespace=True` ; les listes de points sont en plus compactées
   («  aisance   orale » → « aisance orale »).
3. **Messages en français**, destinés aux journaux internes ; le backend les traduit avant de les exposer.
4. **Aucune donnée personnelle** : ni nom, ni e-mail, ni téléphone, ni identifiant d'apprenant. Le contexte ne
   transporte que des informations pédagogiques.
5. **Aucun accès base de données** : ces modèles ne dépendent ni de SQLAlchemy, ni d'Alembic, ni de PostgreSQL.
6. **Aucune décision métier** : le service propose (`niveau_estime`, `phase_assimil`, `points_faibles`), le backend
   décide et persiste.

## 4. Valeurs autorisées

### 4.1 Langues et référentiels

| Langue | Code | Référentiel imposé |
| --- | --- | --- |
| Français | `fr` | CECRL |
| Anglais | `en` | CECRL |
| Mandarin | `zh` | HSK |
| Italien | `it` | CECRL |
| Allemand | `de` | CECRL |

Le référentiel est exigé dans la charge utile **et** vérifié contre la langue : `{"code_langue": "en",
"referentiel": "HSK"}` est refusé. Cette règle reproduit `backend/app/services/scoring.py` (`zh` → HSK).

### 4.2 Niveaux

| Référentiel | Niveaux, dans l'ordre |
| --- | --- |
| CECRL | `A1`, `A2`, `B1`, `B2`, `C1`, `C2` |
| HSK | `HSK 1`, `HSK 2`, `HSK 3`, `HSK 4`, `HSK 5`, `HSK 6` |

Un niveau hors du référentiel est refusé (`B1` avec HSK, `HSK 3` avec CECRL), de même qu'un code inconnu (`A0`, `C3`).

### 4.3 Compétences

`grammaire`, `lecture`, `ecoute`, `ecrit`, `oral` — valeurs du contrat public (`docs/api/contrat-frontend.md`). Le
service n'en ajoute aucune.

### 4.4 Phases Assimil

`passive`, `active` — les deux phases de la méthode Assimil (découverte/imprégnation, puis réutilisation/expression).
Aucune autre phase n'existe dans le dépôt ; en ajouter une relève d'une décision pédagogique, pas d'un correctif.

### 4.5 Codes d'erreur

| Code | Rejouable | Origine |
| --- | --- | --- |
| `ENTREE_INVALIDE` | non | Schéma Pydantic invalide |
| `AGENT_INCONNU` | non | Code ou version non enregistré |
| `TAILLE_DEPASSEE` | non | Texte ou audio trop volumineux |
| `QUOTA_DEPASSE` | **oui** | Limite d'appels LLM |
| `LLM_INDISPONIBLE` | **oui** | Fournisseur en erreur |
| `LLM_TIMEOUT` | **oui** | Budget de temps dépassé |
| `LLM_REPONSE_INVALIDE` | **oui** | Sortie non conforme au schéma |
| `CORPUS_INDISPONIBLE` | **oui** | Index RAG non chargé |
| `PROMPT_INTROUVABLE` | non | Fichier ou variable manquant |
| `ERREUR_INTERNE` | non | Exception non prévue |

`retryable` est **vérifié** contre ce tableau : annoncer `LLM_TIMEOUT` non rejouable, ou `ENTREE_INVALIDE`
rejouable, est une erreur de validation.

## 5. Contexte apprenant

### 5.1 `ContexteApprenant`

| Champ | Type | Contrainte |
| --- | --- | --- |
| `code_langue` | `fr` \| `en` \| `zh` \| `it` \| `de` | requis |
| `referentiel` | `CECRL` \| `HSK` | requis, cohérent avec `code_langue` |
| `niveau_preliminaire` | niveau du référentiel | requis |
| `memoire_pedagogique` | `MemoirePedagogique` \| `null` | facultatif ; `null` pour un premier diagnostic |

### 5.2 `MemoirePedagogique`

| Champ | Type | Contrainte |
| --- | --- | --- |
| `resume` | texte | 1 à 2 000 caractères, requis dès que l'objet est fourni |
| `points_forts` | liste de textes | 0 à 5, chaque 1 à 120 caractères, sans doublon (casse ignorée) |
| `points_faibles` | liste de textes | idem ; aucun point ne peut être à la fois fort et faible |
| `nb_activites` | entier strict | 0 à 100 000, défaut `0` ; booléen, chaîne et décimal refusés |

C'est un **résumé** produit par le backend, pas un historique : le service IA n'a pas accès aux réponses brutes.

## 6. Résultat du diagnostic

### 6.1 `PointFaible`

| Champ | Type | Contrainte |
| --- | --- | --- |
| `competence` | compétence du contrat | requis |
| `description` | texte | 1 à 200 caractères, espaces normalisés |

### 6.2 `ResultatDiagnostic`

| Champ | Type | Contrainte |
| --- | --- | --- |
| `code_langue` | langue du contrat | requis |
| `referentiel` | `CECRL` \| `HSK` | requis, cohérent avec la langue |
| `niveau_estime` | niveau du référentiel | requis ; **proposition**, pas une décision |
| `niveau_preliminaire` | niveau du référentiel | requis ; niveau de référence utilisé |
| `phase_assimil` | `passive` \| `active` | requis |
| `points_faibles` | liste de `PointFaible` | 0 à 5, une seule entrée par compétence |
| `score_confiance` | nombre | entre 0 et 1 ; `true` et `"0.8"` refusés |
| `ecart_avec_niveau_preliminaire` | entier | `-5` à `+5`, strict, cohérent avec les deux niveaux |

**Calcul de l'écart** : différence d'indices dans le référentiel (`A1` = 0 … `C2` = 5 ; `HSK 1` = 0 … `HSK 6` = 5).
`+1` signifie « un niveau au-dessus du niveau préliminaire », `-3` « trois niveaux en dessous », `0` « identique ».
Un écart incohérent (par exemple `B1` → `B2` avec `3`) est refusé à la validation.

**Ce que le résultat ne contient pas** : le score objectif du backend (`0..100`, `percentage`, `level`, `framework`),
le nombre de bonnes réponses, le niveau final, l'identité de l'apprenant. Ces notions restent dans le backend
(`backend/app/services/scoring.py`).

### 6.3 Cohérence avec le contexte

`ResultatDiagnostic.verifier_coherence(contexte)` vérifie que le résultat concerne bien le contexte reçu (langue et
niveau préliminaire) et lève `DiagnosticIncoherent` sinon. Le Harness l'appelle après validation du résultat.

## 7. Contrat commun du Harness

### 7.1 `RequeteAgent[T]`

| Champ | Type | Contrainte |
| --- | --- | --- |
| `request_id` | UUID | requis, corrélation des journaux |
| `version_agent` | texte | SemVer (`1.0.0`, `1.1.0-beta.1`) ou `null` |
| `contexte` | `ContexteApprenant` | requis |
| `entree` | `T` | modèle strict propre à l'agent |

`entree` est **générique mais typée** : le Harness ne connaît pas la forme de l'entrée, l'agent l'impose. Un champ
inconnu dans `entree` est refusé comme ailleurs — le service n'accepte jamais de JSON arbitraire.

### 7.2 `ReponseAgent[T]`

| Champ | Type | Contrainte |
| --- | --- | --- |
| `request_id` | UUID | repris de la requête |
| `agent` | texte | minuscules, chiffres et tirets (`diagnostic`, `assistant-formateur`), 32 caractères max |
| `version_agent` | texte | SemVer |
| `version_prompt` | texte | `agent/tache@x.y.z` |
| `statut` | `succes` | valeur fixe |
| `resultat` | `T` | modèle strict propre à l'agent |
| `meta` | `MetaExecution` | requis |

`agent` n'est **pas** une liste fermée : les neuf agents ne sont pas encore tous arbitrés (décision D-07 du cadrage).
Le format est validé, pas le nom.

### 7.3 `MetaExecution`

| Champ | Type | Contrainte |
| --- | --- | --- |
| `duree_ms` | entier strict | 0 à 600 000 ; ni booléen, ni chaîne, ni décimal |
| `fournisseur` | texte | 1 à 64 caractères (`factice`, `compatible-openai`, `anthropic`) |
| `modele` | texte | 1 à 128 caractères |
| `version_corpus` | texte \| `null` | 32 caractères max |
| `empreinte_prompt` | texte | `sha256:` + 64 caractères hexadécimaux |

Le backend ne transmet pas `meta` au frontend : ces informations servent à l'exploitation et à l'audit.

## 8. Erreurs standardisées

### 8.1 `ErreurAgent`

| Champ | Type | Contrainte |
| --- | --- | --- |
| `code` | `CodeErreur` | une des dix valeurs du tableau 4.5 |
| `message` | texte | 1 à 500 caractères, **une seule ligne** |
| `retryable` | booléen | cohérent avec `code` |
| `details` | dictionnaire plat \| `null` | 10 entrées max, clés et valeurs non vides, clés 1 à 64 caractères, valeurs 200 max, sans saut de ligne |

`details` reste plat et vide en production : ni secret, ni contenu d'apprenant, ni JSON imbriqué. Les sauts de ligne
sont refusés pour empêcher la falsification des journaux.

### 8.2 `ReponseErreur`

| Champ | Type | Contrainte |
| --- | --- | --- |
| `request_id` | UUID | requis |
| `agent` | texte | même format que `ReponseAgent` |
| `statut` | `erreur` | valeur fixe |
| `erreur` | `ErreurAgent` | requis |

## 9. Exemples

Les fichiers sont **exécutés par les tests** : `tests/test_exemples_json.py` valide chaque exemple et vérifie que
chaque exemple invalide échoue pour la raison annoncée.

| Fichier | Modèle | Résultat attendu |
| --- | --- | --- |
| `tests/exemples/valide/contexte-apprenant.json` | `ContexteApprenant` | valide |
| `tests/exemples/valide/resultat-diagnostic.json` | `ResultatDiagnostic` | valide |
| `tests/exemples/valide/reponse-diagnostic.json` | `ReponseAgent[ResultatDiagnostic]` | valide |
| `tests/exemples/valide/erreur-standard.json` | `ReponseErreur` | valide |
| `tests/exemples/invalide/contexte-apprenant-champ-inconnu.json` | `ContexteApprenant` | champ `id_apprenant` refusé |
| `tests/exemples/invalide/contexte-apprenant-referentiel-incoherent.json` | `ContexteApprenant` | `en` + `HSK` refusé |
| `tests/exemples/invalide/resultat-diagnostic-ecart-incoherent.json` | `ResultatDiagnostic` | écart `3` au lieu de `1` |
| `tests/exemples/invalide/resultat-diagnostic-phase-inconnue.json` | `ResultatDiagnostic` | phase `perfectionnement` refusée |
| `tests/exemples/invalide/reponse-diagnostic-empreinte-invalide.json` | `ReponseAgent` | empreinte non `sha256` |
| `tests/exemples/invalide/erreur-standard-retryable-incoherent.json` | `ReponseErreur` | `ENTREE_INVALIDE` rejouable |

### 9.1 Requête valide (entrée fournie par l'agent)

```json
{
  "request_id": "3f1c9b7e-6a2d-4f0e-9c1a-2b7d5e8f4a10",
  "version_agent": "1.0.0",
  "contexte": {
    "code_langue": "en",
    "referentiel": "CECRL",
    "niveau_preliminaire": "B1",
    "memoire_pedagogique": {
      "resume": "Deux sessions de conversation, bonnes bases lexicales.",
      "points_forts": ["aisance à l'oral"],
      "points_faibles": ["emploi des temps"],
      "nb_activites": 12
    }
  },
  "entree": {
    "type_reponse": "texte",
    "reponse": "Lifelong learning helps people adapt to new jobs."
  }
}
```

`entree` est ici celle d'un exemple de test : chaque agent publiera son propre modèle d'entrée (`EntreeDiagnostic`
pour l'US d'évaluation). L'enveloppe, elle, ne change pas.

### 9.2 Réponse valide

Voir `tests/exemples/valide/reponse-diagnostic.json`. Extrait du `resultat` :

```json
{
  "code_langue": "en",
  "referentiel": "CECRL",
  "niveau_estime": "B2",
  "phase_assimil": "active",
  "points_faibles": [{ "competence": "ecrit", "description": "Emploi irrégulier des temps." }],
  "score_confiance": 0.78,
  "niveau_preliminaire": "B1",
  "ecart_avec_niveau_preliminaire": 1
}
```

### 9.3 Erreur valide

Voir `tests/exemples/valide/erreur-standard.json` :

```json
{
  "request_id": "3f1c9b7e-6a2d-4f0e-9c1a-2b7d5e8f4a10",
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

## 10. Extension aux neuf agents

1. Créer un modèle d'entrée strict : `class EntreeChatbot(ModeleStrict): ...`.
2. Déclarer les routes typées avec `RequeteAgent[EntreeChatbot]` et `ReponseAgent[ResultatChatbot]`.
3. Ne pas ajouter de liste fermée de noms d'agents : `agent` est validé par format (`diagnostic`,
   `assistant-formateur`…), pas par énumération, tant que la liste des neuf agents n'est pas arbitrée.
4. Ne jamais réutiliser le modèle de résultat d'un autre agent : chaque agent publie son `Resultat...`.
5. Toute nouvelle valeur pédagogique (niveau, phase, compétence) doit être ajoutée dans `app/schemas/regles.py` **et**
   documentée ici, avec sa source.

## 11. Tests

```bash
cd ia-service
pip install -r requirements-dev.txt
pytest --cov=app --cov-report=term-missing
ruff check . && ruff format --check .
```

État mesuré le 2 novembre 2026 :

| Indicateur | Résultat |
| --- | --- |
| Tests | **109 réussis** |
| Couverture `app/schemas/` | **100 %** |
| Couverture `app/` | **96 %** (`app/main.py` n'est pas couvert par cette US) |
| Ruff (lint et formatage) | conforme (`line-length = 120`) |

Cas couverts : champs supplémentaires (enveloppe et objets imbriqués), UUID, SemVer, motifs d'agent, de prompt et
d'empreinte, bornes (score, durée, taille, nombre de points), valeurs autorisées (langues, niveaux, compétences,
phases), cohérences (langue/référentiel, niveau/référentiel, écart, `retryable`), unicité des compétences, absence de
données personnelles dans les exemples.

## 12. Points à valider

| Sujet | État |
| --- | --- |
| Libellés des phases Assimil | `passive` et `active` retenus ; toute autre phase nécessite une validation pédagogique |
| Nombre maximal de points faibles (5) | Choix de conception, aligné sur les cinq compétences du contrat |
| `niveau_preliminaire` répété dans le résultat | Conservé pour l'auditabilité et la vérification de l'écart ; peut être retiré si le backend préfère s'appuyer uniquement sur le contexte |
| Codes d'erreur | Repris du cadrage AJ02 §11.5 ; à ajuster si le backend ajoute un code |
| Liste fermée des langues | Cinq langues du référentiel actuel ; une nouvelle langue exige une mise à jour de `regles.py` |
