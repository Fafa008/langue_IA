# US157-IA — Feedback IA sur réponse libre selon la leçon atteinte (contrat v2)

**Route** : `POST /correction/reponse-libre` · **Agent** : `correction@1.0.0` · **Prompt** :
`correction/reponse-libre@1.0.0` · **Appelant** : le backend seulement (réseau `back-tier`, PRE-06).

Le backend appellera cette route (US157-BE) quand un apprenant envoie une rédaction
(`POST /parcours/{id}/exercices/{id}/reponse`, format `redaction`), puis revalidera le résultat avant de
l'enregistrer et de le renvoyer au frontend (`docs/api/contrat-frontend.md`, section « Contrat v2 (US157) »).

## Ce qui change avec le contrat v2

1. **La leçon atteinte entre dans le contexte** : `ContexteApprenant.lecon_atteinte` (entier ≥ 1, facultatif pour le
   diagnostic, **obligatoire** ici : sans elle, `422 ENTREE_INVALIDE` et aucun appel au LLM).
2. **La phase en découle**, avec la règle du backend (`backend/app/services/phase_parcours.py`) : `PASSIVE` pour les
   leçons 1 à 49, `ACTIVE` à partir de la 50 (`app/schemas/correction.py`, `phase_de_lecon`). L'appelant ne la
   fournit pas : elle est recalculée.
3. **Le feedback a un schéma strict** (`ResultatCorrection`) dont la forme dépend de la phase.

## Entrée

```json
{
  "request_id": "3f1c9b7e-6a2d-4f0e-9c1a-2b7d5e8f4a10",
  "contexte": { "code_langue": "en", "referentiel": "CECRL", "niveau_preliminaire": "B1", "lecon_atteinte": 56 },
  "entree": {
    "format": "redaction",
    "consigne": "Write a short message to a friend.",
    "enonce": "Tell your friend what you did yesterday.",
    "mots_minimum": 10,
    "reponse": "yesterday I go to the market with my sister and we buy apples"
  }
}
```

Bornes : `consigne` ≤ 500, `enonce` ≤ 2 000, `reponse` ≤ 5 000 caractères, `mots_minimum` de 1 à 500 (30 par défaut).
Tout champ inconnu est refusé.

## Sortie (`resultat`)

```json
{
  "phase": "ACTIVE",
  "lecon_atteinte": 56,
  "score": 55,
  "commentaire": "Message compréhensible ; revoyez le passé.",
  "points_forts": ["Vous reliez vos idées avec « and »."],
  "erreurs": [{ "extrait": "I go", "correction": "I went", "explication": "« Yesterday » appelle le prétérit." }],
  "reformulation": "Yesterday I went to the market with my sister and we bought apples.",
  "conseil": "Comparez votre texte à la version corrigée, puis réécrivez-le sans la regarder."
}
```

| Champ | Règle |
|---|---|
| `phase`, `lecon_atteinte` | recopiées du contexte ; une phase qui ne suit pas la leçon est refusée |
| `score` | entier 0 à 100, appréciation de la réponse seule : **la phase ne le change pas** |
| `erreurs` | `PASSIVE` : 3 au plus (les essentielles) ; `ACTIVE` : 8 au plus. Extrait recopié mot pour mot de la réponse, différent de sa correction, sans doublon |
| `reformulation` | `PASSIVE` : toujours `null` ; `ACTIVE` : obligatoire dès qu'une erreur est relevée |
| `points_forts` | 0 à 3, 160 caractères chacun, sans doublon |
| `commentaire`, `conseil` | 300 et 240 caractères au maximum, en français (langue de l'interface) |

## Contrôles de l'agent (défense en profondeur)

- **Schéma** : la sortie du LLM est validée par `ResultatCorrection` ; hors contrat → `502 LLM_REPONSE_INVALIDE`.
- **Cohérence** : la leçon renvoyée doit être celle du contexte, et chaque `extrait` doit figurer dans la réponse
  (casse et espaces ignorés). Un extrait inventé par le modèle → `502 LLM_REPONSE_INVALIDE`.
- **Descripteurs** : repères d'expression écrite (`ecrit`) au niveau de l'apprenant. Un descripteur d'une autre langue
  → `503 CORPUS_INDISPONIBLE`. Corpus vide : le Harness fournit les repères synthétiques (US150-B) et
  `meta.version_corpus` vaut `synthetique_fallback`, comme pour le diagnostic.
- **Journaux** : identifiant de requête, agent et langue seulement, jamais la réponse de l'apprenant.
- Délai, indisponibilité et quota du fournisseur : mêmes codes que les autres routes (US-154).

## Démonstration sans clé LLM

Avec `LLM_FOURNISSEUR=factice` et `LLM_FACTICE_SCENARIO=demonstration` (défaut de la stack Docker), la route répond
sans réseau par un feedback **valide et déterministe** (`app/llm/demonstration.py`) : il ne vérifie que la majuscule
initiale, la ponctuation finale et la longueur, applique les règles de la phase et le dit dans son `commentaire`.

## Reste à faire (autres tâches de l'US157)

- **US157-BE** : construire le contexte (dont `lecon_atteinte`), appeler la route, revalider, enregistrer la réponse
  et le feedback, renvoyer le contrat frontend v2.
- **US157-QA** : test de contrat backend ↔ service IA à chaque PR.
- **Revue pédagogique** du prompt (expert IA, cf. PRE-S5-01) et jeu de réponses libres types (PRE-09).
