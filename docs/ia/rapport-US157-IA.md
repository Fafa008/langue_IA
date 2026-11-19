# Rapport — US157-IA : schéma v2 et prompt de correction des réponses libres

**Tâche** : US157-IA (ClickUp `123t3hw0f33`, « Schéma Pydantic v2 du feedback (phase, champs stricts) »)
**Assignée à** : Fafa
**PR** : [#59](https://github.com/Fafa008/langue_IA/pull/59), branche `feature/US157-ia-correction-reponse-libre`, vers `develop`
**Statut** : terminée côté code et tests ; en attente de revue (`HasinaManjaka`, `MandrindraAndrianina`) et de fusion

## 1. Objectif

Donner au service IA une correction des réponses libres (rédactions) dont le retour dépend de la phase du
parcours, déduite de la leçon atteinte (règle US155) :

| Phase | Leçons | Erreurs relevées | Version corrigée |
|---|---|---|---|
| `PASSIVE` | 1 à 49 | 3 essentielles au plus | non |
| `ACTIVE` | 50 et plus | 8 au plus | oui, dès qu'une erreur est relevée |

Le score (0 à 100) ne dépend que de la réponse : la phase change ce que le retour montre, pas la note.

## 2. Ce qui a été livré

- **Route** `POST /correction/reponse-libre`, agent `correction@1.0.0`, prompt versionné
  `correction/reponse-libre@1.0.0`.
- **Contexte** : `ContexteApprenant.lecon_atteinte`, facultatif pour le diagnostic, obligatoire pour la correction.
  Sans elle, la route répond `422 ENTREE_INVALIDE` sans appeler le modèle.
- **Schéma strict** `ResultatCorrection` (`app/schemas/correction.py`) : la phase doit correspondre à la leçon,
  et la forme du retour dépend de la phase. Champs inconnus refusés, bornes de longueur, pas de doublon.
- **Contrôle de cohérence** (`verifier_coherence`) : la leçon renvoyée est celle du contexte, et chaque extrait relevé
  figure dans la réponse de l'apprenant. Un extrait inventé fait échouer l'appel.
- **Descripteurs** : repères d'expression écrite au niveau de l'apprenant. Corpus vide : repli synthétique (US150-B),
  signalé dans `meta.version_corpus = synthetique_fallback`.
- **Démonstration sans clé LLM** : le fournisseur `factice` répond un retour déterministe, qui indique lui-même
  qu'il ne vérifie que la majuscule, le point final et la longueur.
- **Documentation** : `ia-service/docs/US-157-correction-reponse-libre.md`, `ia-service/README.md`.
- **Nettoyage** : suppression du notebook Colab `ia-service/app/rag/La_Digitheque_RAG_CECRL_HSK.ipynb`, qui faisait
  échouer `ruff check .` sur la CI depuis `3250ede`. Il est récupérable : `git show 3250ede:<chemin>`.

## 3. Vérifications

| Contrôle | Résultat |
|---|---|
| `ruff check .` et `ruff format --check .` (ruff 0.8.4), service IA | OK (90 fichiers) |
| `pytest tests/test_correction.py` | 49 tests passent |
| Couverture du service IA | 97 % |
| Appel réel depuis le conteneur backend (leçon 23, leçon 56, sans leçon) | `PASSIVE` ; `ACTIVE` avec version corrigée ; `422` |
| CI de la PR #59 | toutes les vérifications passent : Service IA, Backend, Docker, Frontend (typage, lint, Jest, build), E2E, GitGuardian |

## 4. Choix à valider en revue

- **3 erreurs au plus en phase passive**, sans version corrigée : choix pédagogique.
- **8 erreurs au plus en phase active** : même remarque.
- **Seuil de réussite à 50** : déjà proposé dans le contrat, « à confirmer ».
- **Prompt** : rédigé en français pour les commentaires et conseils, dans la langue étudiée pour les corrections.
  Il demande une revue par l'expert IA (cf. PRE-S5-01).

## 5. Limites connues

- Le backend n'appelle pas encore cette route : c'est la couche suivante (US157-BE), dans une PR séparée.
- Le test de contrat backend ↔ service IA (US157-QA) est dans une PR séparée, qui dépend de celle-ci et de la PR backend.
- Les 3 tests de `tests/test_ingestion_cecrl.py` échouent dans le conteneur de développement, car la racine du dépôt
  y devient `/`. Ils passent en CI.
- ClickUp n'est pas encore mis à jour : à faire à la main, avec le lien de la PR.

## 6. Reste à faire

1. Revue par `HasinaManjaka` et `MandrindraAndrianina` (deux approbations pour une PR IA).
2. Fusion de la PR #59 dans `develop`.
3. Ouvrir les PR des couches suivantes, une par une, chacune depuis `develop` à jour : backend, frontend, test de contrat.
4. Mettre la tâche ClickUp US157-IA à « complete ».
