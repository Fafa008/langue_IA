# US71 — Bibliothèque Few-shot du diagnostic

## Format commun et anonymisation

La bibliothèque est versionnée dans `app/prompts/exemples/diagnostic/`, avec un fichier JSON par scénario :
`quotidien.json`, `entretien.json` et `examen.json`. Chaque entrée reprend le modèle `ExempleFewShot` déjà défini
pour US70 :

```json
{
  "scenario": "entretien",
  "entree": {
    "contexte_apprenant": {
      "code_langue": "fr",
      "referentiel": "CECRL",
      "niveau_preliminaire": "B1",
      "memoire_pedagogique": null
    },
    "reponses": [
      {
        "id_question": "q-entretien-fr-01",
        "competence": "oral",
        "type_reponse": "texte",
        "contenu": "Réponse synthétique et entièrement fictive."
      }
    ],
    "score_preliminaire": 64,
    "descripteurs_rag": [
      {
        "identifiant": "exemple-fr-b1-oral",
        "code_langue": "fr",
        "referentiel": "CECRL",
        "niveau": "B1",
        "competence": "oral",
        "contenu": "Exemple pédagogique non normatif, à ne pas traiter comme une source officielle."
      }
    ]
  },
  "sortie": {
    "code_langue": "fr",
    "referentiel": "CECRL",
    "niveau_estime": "B1",
    "phase_assimil": "activation",
    "points_faibles": [],
    "score_confiance": 0.76,
    "niveau_preliminaire": "B1",
    "ecart_avec_niveau_preliminaire": 0
  },
  "justification": "Justification courte liée aux éléments observables."
}
```

Le schéma Pydantic strict US70 vérifie les champs, les langues, le référentiel associé, les niveaux, les domaines de
faiblesse, les preuves citées, les bornes numériques, la cohérence du résultat avec le contexte et l'écart de niveau. Le champ `scenario` accepte
uniquement `quotidien`, `entretien` ou `examen`. Son défaut `quotidien` permet de charger sans changement les
exemples historiques de US70, dont la version de prompt reste intacte.

Les quinze exemples (trois scénarios par langue `fr`, `en`, `zh`, `it` et `de`) sont inventés pour ce jeu de tests ;
ils ne contiennent aucun identifiant ou donnée de personne réelle. Les textes de descripteurs ont été rédigés
spécifiquement comme illustrations, sans prétendre reproduire des descripteurs CECRL/HSK officiels. En production,
seuls les descripteurs autorisés issus du RAG doivent servir de référence ; les few-shot montrent la structure et
le raisonnement attendu, jamais une source normative de niveau.

## Sélection

`BibliothequeFewShot` charge et valide tout le catalogue au démarrage. Il refuse un fichier absent ou invalide, les
doublons d'une paire scénario/langue et les combinaisons manquantes. La sélection est exacte et déterministe :

```python
exemples = bibliotheque.selectionner("entretien", "fr")
```

Elle ne se rabat jamais sur une autre langue ou un autre scénario. Un seul exemple est envoyé par sélection afin de
limiter la taille du prompt. `VariablesEvaluationDiagnostic.scenario` vaut `quotidien` par défaut, pour préserver
les appels existants ; le fournisseur d'exemples est sélectionné depuis cette valeur et `code_langue`.

Le rendu US70 utilise ce résultat automatiquement si `exemples_few_shot` n'est pas fourni. Les exemples injectés
restent compatibles avec les variables du prompt US70 (`entree`, `sortie`, `justification`) et avec le validateur de
sortie `ResultatDiagnostic`. Une sélection explicite est également refusée si son scénario ou sa langue diffère.
Le template et les fichiers du prompt `diagnostic/evaluation@1.0.0` ne sont pas modifiés par US71. Depuis US30, les
exemples ont été alignés sur `diagnostic/evaluation@1.1.0` (preuves directes, phases `impregnation`/`activation`) ;
les ressources `1.0.0` restent archivées et ne sont plus chargées.

L'empreinte renvoyée par le rendu combine l'empreinte des ressources de prompt US70 et le JSON canonique de l'exemple
effectivement sélectionné. Elle distingue donc les exemples utilisés sans modifier le contenu ou la version du
prompt publié.

## Tests

La suite `tests/test_bibliotheque_few_shot.py` vérifie les quinze paires scenario/langue, le non-repli, les fichiers
manquants, les scénarios mal classés, les doublons et la cohérence de la sortie. `tests/test_prompts.py` vérifie que
les exemples sont sélectionnés puis rendus dans le template US70 et que les sélections incompatibles sont refusées.

```powershell
cd ia-service
python -m pytest tests/test_bibliotheque_few_shot.py tests/test_prompts.py
```
