# Rapport de tests — parcours personnalisé (US46)

Périmètre : génération du parcours après diagnostic (US36), lecture du parcours (US41, US42), correction des exercices
(US43-BE, US44) et cohérence entre ces étapes. Date : 2026-11-20. Branche : `feature/PRE-S4-02-solde-reliquat-s3`.

## Résultats

| Suite | Tests | Résultat |
|---|---:|---|
| Parcours ciblés (génération, cohérence, correction, lecture, phases, modèle) | 99 | 99 verts |
| Backend complet (`make test`) | 347 | 347 verts, 0 échec, mesuré après US48, son exposition et la correction du test de scoring |
| E2E parcours (Playwright, desktop et mobile) | 30 | 30 verts |
| Typecheck, ESLint (fichiers E2E) | — | OK |

Le rapport JUnit des 99 tests ciblés est généré par pytest (`--junitxml`) et n'est pas versionné : il reste un
artefact de la session de test.

## Couverture par étape

**Génération (US36)** — couverte par trois niveaux :
- règles unitaires : niveau visé, leçon de départ, domaines faibles (`test_generation_parcours.py`) ;
- association des exercices : langue, niveau, priorité aux points faibles, pas de doublon, catalogue vide ;
- fumée : diagnostic complet → parcours créé (`test_smoke_generation_parcours.py`, question partagée dans
  `tests/fabriques_parcours.py`).

**Cohérence de bout en bout** (`test_parcours_coherence.py`) : un même apprenant suit son parcours dans les quatre
routes. Le parcours décrit par `en-cours` est celui que la génération a créé ; la liste des exercices reflète la
génération (une ligne, leçon de départ, à faire) ; la leçon ne montre pas la bonne réponse ; la correction se
répercute ensuite sur la liste (réussi, 100/100).

**Invariant de phase** : aucune génération ne mène à la leçon 50 (mode actif). Le test calcule la leçon de chaque niveau
ouvert de la langue anglaise et vérifie qu'elle reste sous 50.

**Lecture (US41, US42)** — `test_lecture_parcours.py` : parcours en cours, exercices limités à la leçon atteinte,
statuts (seuil 50), contenu visible uniquement (aucune fuite de la bonne réponse), accès refusé hors de son parcours et
aux formateurs.

**Correction (US43-BE, US44)** — `test_correction_automatique.py` et `test_parcours_correction.py` : normalisation
(casse, accents, ponctuation), score 100 ou 0, bonne réponse et explication, aucun appel à l'IA, refus sans réponses
acceptées sans rien enregistrer, refaire un exercice.

**E2E** — `mon-parcours.spec.ts`, `liste-exercices-parcours.spec.ts`, `feedback-exercice-parcours.spec.ts`. Ils
interceptent l'API (fixtures de `e2e/support/parcours.ts`) : ils valident le rendu, pas le câblage réel.

## Écarts connus

1. **Corrigé** : `tests/test_diagnostic_scoring.py::TestTerminerTentative::test_calcule_le_score_et_persiste_le_niveau_de_reference`
   attendait une réponse de `POST …/terminer` sans l'analyse IA. Le test vérifie désormais les champs de l'analyse
   (`competences`, `points_faibles`, `phase_assimil`), et le contrat les documente dans l'exemple de réponse.
2. **Mode actif jamais atteint à la génération** : avec les niveaux CECRL (A1 à C2), la leçon maximale est 36. Le mode
   actif commence à la leçon 50, donc il ne peut venir que de la progression (progression par leçon, US48).
3. **Modules absents** : `GET /parcours/en-cours` renvoie `modules: []` ; le modèle des modules reste à décider (PO).
4. **Intitulé d'exercice** : lu dans la clé `intitule` du contenu, faute de colonne dédiée. À confirmer avec la donnée
   de démo (US156).
5. **Avancement de la leçon** : livré (US48, `services/progression_lecon.py`, 14 tests dans
   `tests/test_progression_lecon.py`). Le total ci-dessus inclut ce travail.

## Reproduire

```bash
# Suite backend complète
make test

# Parcours seuls, avec rapport JUnit (écrit dans le dossier backend de l'hôte, à déplacer ensuite)
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm --user "$(id -u):$(id -g)" backend \
  pytest tests/test_parcours_coherence.py tests/test_smoke_generation_parcours.py tests/test_generation_parcours.py \
  tests/test_correction_automatique.py tests/test_parcours_correction.py tests/test_lecture_parcours.py \
  tests/test_phase_parcours.py tests/test_modele_parcours.py -p no:cacheprovider -o addopts="" \
  --junitxml=junit-parcours.xml

# E2E parcours sur desktop et mobile
cd frontend && npx playwright test e2e/mon-parcours.spec.ts e2e/liste-exercices-parcours.spec.ts \
  e2e/feedback-exercice-parcours.spec.ts e2e/parcours-erreurs-ia.spec.ts --project=desktop --project=mobile
```
