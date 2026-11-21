# Construction de la requête RAG de l’Agent Diagnostique (P0.3)

## Périmètre

Ce document décrit la frontière **backend → service IA → récupérateur RAG** pour le diagnostic. Il ne modifie ni le contrat public frontend, ni la configuration du corpus, ni les garde-fous du corpus officiel.

## Données transmises

Le backend envoie désormais, pour chaque réponse de diagnostic, un champ `enonce` optionnel dans `PreuveDiagnosticIA` (`backend/app/schemas/ia.py`).

- Source : `Question.enonce`, joint à la réponse par `analyse_diagnostic._charger_lignes`.
- Contenu : énoncé pédagogique uniquement, sans corrigé (`Question.reponse_correcte` reste côté backend).
- Longueur : 2 000 caractères maximum, chaîne vide normalisée à `null`.
- Compatibilité : champ optionnel avec valeur par défaut `null` ; une ancienne requête sans `enonce` reste valide.

Côté service IA, `ReponseDiagnosticPrompt` accepte ce champ mais le déclare `exclude=True` : il est disponible à l’agent pour la recherche documentaire et n’entre pas dans le JSON du prompt LLM. Le contrat de prompting et son empreinte ne changent donc pas.

## Construction du texte de requête

`ia-service/app/agents/diagnostic.py::texte_requete_depuis_preuves` assemble, pour chaque preuve :

1. l’énoncé, s’il est présent et non vide ;
2. la réponse de l’apprenant.

Les paires sont jointes par des retours à la ligne, puis le texte est tronqué à `TEXTE_REQUETE_MAX` (4 000 caractères). Aucun énoncé n’est inventé : si le champ manque, seule la réponse est transmise.

Exemple :

```text
She ___ a student.
is
I ___ coffee every morning.
drink
```

## Filtres et limite

La `RequeteRAG` conserve exactement les filtres existants :

- `code_langue` : langue du contexte apprenant ;
- `referentiel` : `CECRL` ou `HSK` selon la langue ;
- `niveau` : `niveau_preliminaire` calculé par le backend ;
- `competences` : compétences dédupliquées des preuves ;
- `limite` : `DESCRIPTEURS_MAX` (8).

La compétence, la langue et le niveau restent des champs structurés de la requête ; ils ne sont pas dupliqués dans le texte indexé, afin de ne pas polluer le BM25.

`RecuperateurExperimental` continue de filtrer par langue, référentiel `CECRL`, niveau exact et compétence dérivée du corpus, puis ne retient que les scores BM25 strictement positifs.

## Provenance CARCL

Les résultats du corpus expérimental portent un identifiant `carcl:` et un contenu indiquant explicitement qu’ils ne sont pas des descripteurs officiels du CECRL. L’Agent Diagnostique conserve cette distinction :

- présence d’au moins un repère `carcl:` → provenance `experimentale`, version `carcl-experimental-2026.1` ;
- uniquement des repères synthétiques → provenance `synthetique_fallback` ;
- aucun résultat exploitable → statut `A_VERIFIER`.

Le garde-fou `RAG_CORPUS_OFFICIEL_AUTORISE` reste inchangé : la branche `experimental` est évaluée avant le contrôle officiel, et aucun exercice CARCL n’est présenté comme officiel.

## Repli synthétique

`RecuperateurAvecRepli` n’intervient que si le récupérateur principal ne retourne aucun résultat (ou lève `ErreurCorpusIndisponible`). Le repli reste donc le comportement attendu lorsque :

- l’énoncé n’est pas disponible ;
- l’énoncé ne correspond à aucun exercice indexé ;
- le jetonnage ne produit aucun terme utile ;
- le corpus est indisponible.

Dans ces cas, les repères `synthetique_fallback:` et la version `synthetique_fallback` restent explicitement identifiés dans `meta`.

## Limites connues

La correction améliore le signal pédagogique disponible, mais elle ne crée pas de correspondance lorsque l’énoncé est absent du corpus CARCL. Par exemple, `She ___ a student.` n’existe pas dans le corpus expérimental : avec ou sans énoncé, le repli synthétique reste légitime. Les tests couvrent explicitement ce cas.
