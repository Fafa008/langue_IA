# US152 — Jeu de cas de test du diagnostic IA

## Livrables

Le corpus synthétique est `tests/data/diagnostic/jeu_cas.json`. Il regroupe douze cas versionnés. Chaque cas indique
un identifiant, une catégorie, la langue, le référentiel, le niveau préliminaire, des réponses fictives, une
simulation LLM, le résultat ou code d'erreur attendu et des critères d'acceptation séparés entre contrôles
déterministes et revue humaine.

Chaque réponse comporte aussi une `consigne` de référence destinée à l'évaluateur, en particulier pour apprécier
les réponses hors sujet. Cette consigne sert aux critères de revue et n'est pas ajoutée au message envoyé au
`FakeLLMClient` : elle ne change pas le contrat d'entrée du service.

Les catégories couvrent :

- un cas débutant, intermédiaire et avancé ;
- réponses insuffisantes, incohérentes et hors sujet ;
- les référentiels CECRL et HSK ;
- JSON LLM mal formé, fournisseur indisponible et timeout ;
- un écart de trois niveaux entre niveau préliminaire et estimation simulée.

Les textes et identifiants sont fictifs. Aucun nom, compte, identifiant d'apprenant ou autre donnée personnelle n'est
utilisé.

## Exécution et vérifications automatiques

`tests/test_jeu_cas_diagnostic.py` valide la structure stricte du jeu, la couverture de toutes les catégories, les
réponses selon le modèle de prompt (après exclusion des consignes réservées à la revue), la cohérence
langue/référentiel/niveau et les résultats selon
`ResultatDiagnostic`. Les cas passent par le Harness commun avec un agent d'essai qui ne porte aucune logique
pédagogique : cela vérifie l'enveloppe de résultat et la traduction d'erreurs. Le `FakeLLMClient` simule le JSON
mal formé et l'indisponibilité ; le cas de timeout dépasse volontairement un budget d'exécution de 25 ms.

```powershell
cd ia-service
.\.venv\Scripts\python.exe -m pytest tests\test_jeu_cas_diagnostic.py -v
```

Le test du jeu ne fait aucun appel réseau et ne dépend d'aucune clé API. Les scénarios du faux client sont
déterministes.

## Résultats mesurés

Validation effectuée le 4 novembre 2026 :

- jeu US152 : **15 tests réussis** ;
- suite IA complète avec seuil de couverture à 70 % : **358 tests réussis**, couverture `app/` **98,99 %** ;
- Ruff lint : réussi ; Ruff format check : **54 fichiers conformes** ;
- import de l'application FastAPI : réussi ;
- chaque cas du JSON est chargé et validé par Pydantic ;
- les simulations de JSON invalide, d'indisponibilité et de timeout produisent les codes d'erreur attendus ;
- validation syntaxique du fichier JSON : réussie.

Pytest a émis un avertissement de dépréciation tiers (`anyio.abc.BlockingPortal`) depuis Starlette. Il n'a pas fait
échouer les tests. Ces chiffres mesurent les tests logiciels, pas l'exactitude pédagogique du diagnostic.

## Limites et revue humaine

Les tests déterministes vérifient le contrat et le comportement du faux client, pas la qualité d'une réponse
générée par un vrai modèle. Les critères de plausibilité du niveau, de pertinence des points faibles, de
classification d'une réponse hors sujet ou incohérente et de phase Assimil requièrent un évaluateur pédagogique.
Ils sont inscrits dans `criteres_acceptation.revue_humaine` et ne sont pas présentés comme des assertions
automatiques.

**Dépendance de branche :** le `develop` de départ possède `ResultatDiagnostic`, le Harness et `FakeLLMClient`, mais
pas encore `DiagnosticAgent` ni les évolutions US30. Le jeu valide donc les contrats disponibles et les erreurs
LLM simulées ; il ne prétend pas tester de bout en bout l'agent réel. Les phases attendues suivent le schéma présent
sur cette base (`passive` / `active`). Après intégration de US30, les fixtures devront être alignées sur son schéma
(`impregnation` / `activation`) et les mêmes cas devront être branchés au véritable `DiagnosticAgent`.

Enfin, des sorties attendues fixes ne constituent pas une vérité de référence linguistique. Les niveaux indiqués
servent à vérifier la validation et les écarts de contrat ; leur adéquation aux réponses doit être confirmée par des
évaluateurs, idéalement avec les consignes et descripteurs de référence effectivement utilisés.
