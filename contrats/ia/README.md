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
- `recommandation-parcours/` — `POST /recommandation/actions`, propositions d'exercices à partir des points faibles
  du diagnostic. La requête et la réponse sont uniques ; les exemples invalides couvrent aussi bien le schéma
  (domaines, types, priorités, confiance) que la cohérence avec la requête (langue, niveau visé, domaines demandés).
- `diagnostic-evaluer/` — `POST /diagnostic/evaluer`, estimation produite à partir des preuves transmises (US-N02).
  L'identifiant expose `id_question` des deux côtés (décision T2) : malgré la banque unique, le nom de champ du
  contrat IA ne suit pas le renommage de la clé primaire en base. `version_agent` (`1.0.0`) et `version_prompt`
  (`diagnostic/evaluation@1.1.0`) sont gelés par les exemples : un changement incompatible de schéma doit passer par
  une nouvelle version, publiée atomiquement avec les schémas des deux services.
- `diagnostic-evaluer-v2/` — même route, contrat du test de positionnement 4 compétences. `version_agent` (`1.2.0`)
  et `version_prompt` (`diagnostic/evaluation@1.2.0`) sont gelés par les exemples. L'entrée ajoute les faits calculés
  par le backend (`format`, `difficulte`, `justesse`, `score_competence`, `temps_reponse_secondes`, `transcription`,
  `confiance_stt`) et la sortie ajoute `justification` et `statut` : l'agent interprète, il ne calcule aucun score.
  Les exemples v1 restent inchangés ; le Harness sélectionne la version explicitement demandée par le backend.
