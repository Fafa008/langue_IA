# Contrats backend ↔ service IA — exemples de référence

Le backend et le service IA **ne partagent pas de code** : chacun redéfinit le contrat de son côté
(`backend/app/schemas/ia.py`, `ia-service/app/schemas/*.py`). C'est voulu (frontière de confiance), mais rien ne
garantit alors que les deux définitions restent d'accord. Ces exemples JSON sont la référence commune : **les deux
suites de tests les lisent** à chaque PR.

| Fichier | Règle vérifiée des deux côtés |
|---|---|
| `requete-*.json` | le backend sait produire exactement cette requête ; le service IA l'accepte |
| `reponse-*.json` | le service IA peut la produire (schéma et cohérence) ; le backend l'accepte |
| `invalides/*.json` | refusée **par les deux** (schéma, ou contrôle de cohérence avec `requete-passive.json`) |

Tests : `backend/tests/test_contrat_ia.py` et `ia-service/tests/test_contrat_backend.py`. En plus, le job Docker de
la CI fait un appel réel du backend vers le service IA démarré (`backend/scripts/verifier_contrat_ia.py`).

## Faire évoluer un contrat

1. Modifier les exemples ici **dans la même PR** que les schémas des deux côtés.
2. Un changement incompatible (champ retiré ou renommé, borne resserrée) passe par une nouvelle version du prompt
   ou de l'agent ; ne jamais modifier un exemple pour faire passer un seul côté.
3. Les exemples ne contiennent que des données fictives, jamais une réponse réelle d'apprenant.

## Contrats couverts

- `correction-reponse-libre/` — `POST /correction/reponse-libre`, feedback v2 selon la phase (US157).
