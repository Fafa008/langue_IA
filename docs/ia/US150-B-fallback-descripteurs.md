# US150-B - Repli controle des descripteurs du RAG Diagnostic

## 1. Objectif et perimetre

### Objectif

Garantir que l'agent `diagnostic@1.0.0` continue a produire une estimation prudente lorsque le RAG ne fournit aucun descripteur, sans jamais presenter un contenu invente comme un descripteur officiel CECRL/HSK.

### Perimetre

- Inclus : le flux `POST /diagnostic/evaluer` -> Harness -> RAG -> prompt `diagnostic/evaluation@1.1.0` -> LLM -> validation Pydantic.
- Inclus : un catalogue de reperes pedagogiques originaux et synthetiques, une provenance explicite `synthetique_fallback`, et un signalement interne `A_VERIFIER` lorsqu'aucun repli pertinent n'existe.
- Exclus : le comportement de `chatbot@1.0.0`, les prompts versionnes, les schemas Pydantic publics, le score objectif du backend, le corpus source et les droits des documents officiels.
- Exclus : toute nouvelle dependance Python et toute modification directe de `develop`.

### Resultat attendu

- Le RAG retourne des descripteurs reels : ils sont transmis tels quels et `meta.version_corpus` conserve l'etiquette du corpus reel, par exemple `2026.11`.
- RAG vide, corpus desactive ou corpus indisponible, avec `fr`, `en`, `it` ou `de` en CECRL : des reperes synthetiques explicitement non officiels sont transmis et `meta.version_corpus` vaut `synthetique_fallback`.
- RAG vide et aucun repli pertinent, notamment HSK ou langue sans catalogue : aucun descripteur n'est transmis et `meta.version_corpus` vaut `A_VERIFIER`.

## 2. Audit preliminaire

L'audit a porte sur `ia-service/app/api/diagnostic.py`, `app/harness/execution.py`, `app/harness/agent.py`, `app/agents/diagnostic.py`, `app/rag/`, `app/prompts/` et les tests associes.

Constatations :

- La route `POST /diagnostic/evaluer` ne contient aucune logique pedagogique : elle transmet l'enveloppe validee au Harness et traduit les erreurs via le catalogue des codes.
- Le Harness construit le `ContexteExecution`, fournit le client LLM et le recuperateur RAG, execute sous budget, valide la sortie et construit `MetaExecution`.
- `RecuperateurVide.rechercher()` retourne une sequence vide. La fabrique `construire_recuperateur()` deja gradue aussi vers `RecuperateurVide` si `RAG_CORPUS_ACTIF` est faux ou si le corpus est absent/incoherent.
- Le prompt `diagnostic/evaluation@1.1.0.systeme.md` contient deja une regle de prudence : en l'absence de descripteurs exploitables, le modele doit rester conservateur et ne pas inventer de reference. Cette regle n'a pas ete modifiee.
- Aucun statut `A_VERIFIER` n'existait dans le code avant cette US. Le contrat public Pydantic est strict (`extra="forbid"`) et ne prevoit pas de champ de provenance ou de verification.
- L'agent `chatbot@1.0.0` n'utilise pas le RAG. Le decorateur est donc injecte dans le Harness, pas dans la fabrique, afin de preserver les tests existants et de ne pas modifier le chatbot.
- Les tests existants couvraient deja le RAG reel, le RAG vide, le corpus indisponible et la mapping d'erreur. Le test qui exigeait une erreur sur `ErreurCorpusIndisponible` a ete adapte au nouveau comportement de repli.

## 3. Architecture avant / apres

### Avant

- `POST /diagnostic/evaluer` -> Harness -> `RecuperateurVide` ou `RecuperateurLocal` -> agent Diagnostic -> prompt -> LLM -> `ResultatDiagnostic`.
- Si le RAG retournait `()` :
  - le prompt recevait `descripteurs_rag: []` ;
  - l'agent journalisait seulement un avertissement ;
  - `meta.version_corpus` conservait l'etiquette du recuperateur, y compris quand aucun descripteur reel n'etait disponible ;
  - aucun signalement explicite de verification n'etait transmis.

### Apres

- `POST /diagnostic/evaluer` -> Harness -> `RecuperateurAvecRepli(principal)` -> agent Diagnostic -> signalement interne -> prompt -> LLM -> `ResultatDiagnostic` + `MetaExecution`.
- Le decorateur intercepte les resultats vides et l'erreur `ErreurCorpusIndisponible` ; toute autre erreur continue a etre mapped par le Harness.
- L'agent examine la provenance des descripteurs valides et ecrit dans `ContexteExecution.signalement` :
  - `provenance = officiel` si des descripteurs reels sont utilises ;
  - `provenance = synthetique_fallback` si tous les descripteurs utilises sont synthetiques ;
  - `statut_verification = A_VERIFIER` si aucun descripteur n'est disponible.
- Le Harness utilise `signalement.version_corpus_effective` pour renseigner `MetaExecution.version_corpus`, sans toucher aux autres champs de l'enveloppe.

## 4. Fonctionnement du repli

### Catalogue synthetique

`app/rag/repli.py` contient cinq reperes par langue pour les competences du contrat interne (`grammaire`, `lecture`, `ecoute`, `ecrit`, `oral`) en `fr`, `en`, `it` et `de`. Ces textes ont ete ecrits pour ce projet. Aucun texte n'est copie d'un document CECRL ou HSK.

Chaque descripteur de repli :

- porte un identifiant prefixe `synthetique_fallback:<langue>:<niveau>:<competence>` ;
- reprend exactement le modele Pydantic existant `DescripteurRAGPrompt` ;
- contient explicitement `Provenance : synthetique_fallback`, `Repere pedagogique original, non officiel et non valide` et `ne pas l'attribuer a un referentiel officiel` ;
- est limite par `RequeteRAG.limite`, elle-meme bornee par `DESCRIPTEURS_MAX` (8).

### Regles de decision

1. Le recuperateur reel est appele en premier. S'il retourne au moins un descripteur, le repli n'est jamais utilise.
2. Une sequence vide declenche `descripteurs_repli(requete)`.
3. `ErreurCorpusIndisponible` est journalisee puis traitee comme une sequence vide. Les autres exceptions ne sont pas absorbees.
4. Seul le referentiel `CECRL` dispose de reperes de repli. Le mandarin (`zh`, `HSK`) retourne donc `()` et l'agent pose `A_VERIFIER` au lieu d'inventer une reference HSK.
5. Une langue hors catalogue retourne egalement `()` et conduit a `A_VERIFIER`.
6. Une liste vide n'est jamais presentee comme un corpus officiellement valide : elle est soit completee par un repere synthetique etiquete, soit signalee `A_VERIFIER`.

### Absence de fausse attribution

La verification est double :

- `est_descripteur_synthetique()` detecte le prefixe d'identifiant ;
- le contenu lui-meme interdit l'attribution a un referentiel officiel.

Le prompt versionne n'a pas ete modifie : les reperes synthetiques restent des donnees non fiables, comme les descripteurs reels, et la regle de prudence existante s'applique toujours.

## 5. Fichiers crees et modifies

### Crees

- `ia-service/app/rag/repli.py` : catalogue synthetique, `descripteurs_repli()`, `est_descripteur_synthetique()` et `RecuperateurAvecRepli`.
- `ia-service/tests/test_rag_repli.py` : tests unitaires du repli et de la delegation.
- `docs/ia/US150-B-fallback-descripteurs.md` : le present document.

### Modifies

- `ia-service/app/rag/base.py` : constantes internes `PROVENANCE_OFFICIELLE`, `PROVENANCE_SYNTHETIQUE`, `STATUT_A_VERIFIER` et `PREFIXE_IDENTIFIANT_SYNTHETIQUE`.
- `ia-service/app/rag/__init__.py` : exports du repli et des constantes.
- `ia-service/app/harness/agent.py` : `SignalementRAG` ajoute a `ContexteExecution`.
- `ia-service/app/harness/execution.py` : injection du decorateur et choix de `version_corpus` effectif.
- `ia-service/app/agents/diagnostic.py` : ecriture du signalement de provenance ou de `A_VERIFIER`.
- `ia-service/tests/test_agent_diagnostic.py` : tests d'integration adaptes et nouveaux tests de bout en bout.

### Non modifies

- `ia-service/app/prompts/diagnostic/evaluation@1.1.0.systeme.md` et le prompt utilisateur.
- `ia-service/app/agents/chatbot.py` et ses tests.
- `ia-service/app/main.py`, `app/rag/fabrique.py`, `app/rag/local.py`, `app/rag/vide.py` et `app/rag/corpus.py`.
- `ia-service/corpus/` : aucun fichier source n'a ete touche.
- Aucun fichier `requirements*.txt` ou `pyproject.toml` : aucune dependance ajoutee.

## 6. Contrats et provenance des donnees

### Contrats publics

- Les schemas `RequeteAgent`, `ReponseAgent`, `ReponseErreur`, `MetaExecution`, `ContexteApprenant`, `DescripteurRAGPrompt` et `ResultatDiagnostic` sont inchanges.
- Aucun champ Pydantic n'a ete ajoute, supprime ou rendu optionnel.
- `MetaExecution.version_corpus` reste un `str | None`. Il peut desormais porter, en plus de l'etiquette du corpus reel, les valeurs internes `synthetique_fallback` ou `A_VERIFIER`.
- `SignalementRAG` est un dataclass interne au Harness. Il n'est jamais serialise dans la reponse HTTP.

### Provenance

- Descripteurs reels : etiquette du corpus reel, par exemple `2026.11`.
- Reperes synthetiques : `synthetique_fallback`, visibles dans le prefixe des identifiants, dans le texte des descripteurs et dans `meta.version_corpus`.
- Absence de reference valide : `A_VERIFIER`, visible dans les journaux et dans `meta.version_corpus`, sans descripteur fabrique.

## 7. Tests executes et resultats reels

Commandes lancees depuis le worktree, dans `ia-service/` :

- `python -m pytest tests/test_rag_repli.py tests/test_agent_diagnostic.py` : **47 tests reussis**.
- `python -m pytest` : **608 reussis, 2 ignores, 1 avertissement en 14,99 s**.
- `ruff check .` : **All checks passed!**
- `git diff --check` : aucune erreur.

Scenarios couverts :

- RAG contenant des descripteurs : les descripteurs reels sont preserves et l'etiquette du corpus reste `2026.11`.
- RAG retournant une liste vide : deux reperes synthetiques sont injectes pour les competences `ecrit` et `oral` de la requete de test, avec prefixe et mention non officielle.
- RAG desactive via `RecuperateurVide` : le repli synthetique est utilise et `meta.version_corpus` vaut `synthetique_fallback`.
- Corpus indisponible via `ErreurCorpusIndisponible` : l'erreur est journalisee puis le repli est utilise ; l'ancien test d'erreur a ete remplace par un test de repli.
- Autre erreur du RAG : elle n'est pas absorbee et reste mapped en `ReponseErreur` avec le code `CORPUS_INDISPONIBLE`.
- Langue/referentiel non pris en charge : cas HSK couvert de bout en bout, avec `meta.version_corpus == "A_VERIFIER"` et aucun descripteur transmis ; cas langue hors catalogue couvert au niveau unitaire.
- Provenance : identifiants prefixes, texte explicite et `meta.version_corpus` verifies.
- Absence de fausse attribution : verification qu'aucun descripteur reel ne porte le prefixe synthetique et que le texte des reperes interdit l'attribution officielle.

L'unique avertissement est le deprecation `anyio.abc.BlockingPortal` de Starlette, deja present avant cette modification. `openpyxl==3.1.5` a ete installe dans l'environnement de test local uniquement ; il etait deja declare dans `ia-service/requirements-dev.txt` et n'a pas ete ajoute au projet.

## 8. Limites connues

- Les reperes synthetiques ne sont pas des descripteurs CECRL/HSK et ne certifient aucun niveau. Ils ne doivent pas etre utilises comme reference officielle.
- Le repli ne couvre que `fr`, `en`, `it` et `de` en CECRL. Pour HSK et les autres langues, le diagnostic reste utilisable mais est marque `A_VERIFIER`.
- Le signalement `A_VERIFIER` est porte par `meta.version_corpus` et les journaux. Aucun nouveau champ public n'a ete ajoute afin de respecter le contrat existant ; le frontend ne dispose donc pas d'un champ dedie.
- Seule `ErreurCorpusIndisponible` declenche le repli. Une panne inattendue du RAG continue de produire une erreur standard.
- Le decorateur est applique par le Harness a tous les agents, mais seul l'agent Diagnostic consulte le RAG. Le comportement du chatbot est inchange.
- Aucun test de providers LLM reels n'a ete lance : les tests utilisent le client factice deterministic, comme la configuration par defaut.

## 9. Instructions de configuration

Aucune nouvelle variable d'environnement n'est necessaire.

- Pour conserver le comportement habituel sans corpus : ne pas definir `RAG_CORPUS_ACTIF` ou le laisser a `false`. Le Harness utilisera `RecuperateurVide`, puis le repli synthetique pour les langues CECRL couvertes.
- Pour activer le corpus reel : poser `RAG_CORPUS_ACTIF=true` et, si besoin, `RAG_CORPUS_CHEMIN` vers le dossier du corpus. Tant que le corpus retourne des descripteurs, aucun repli n'est utilise.
- `RAG_CORPUS_VERIFIER_EMPREINTE` conserve son role existant de controle d'integrite. Un corpus absent ou incoherent fait retomber la fabrique sur `RecuperateurVide`, puis sur le repli synthetique.
- Le catalogue de repli est du code source, pas un corpus monte : il n'y a aucun fichier a ajouter ni droit a clarifier.
- Aucune rotation de secret ni changement de `LLM_*` n'est lie a cette US.

Commandes de verification en environnement Docker, si besoin :

- `docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm --no-deps ia-service pytest tests/test_rag_repli.py tests/test_agent_diagnostic.py`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm --no-deps ia-service ruff check .`

## 10. Branche, commits et etat de la PR

- Branche : `feature/US150-B-fallback-descripteurs`.
- Worktree : `C:/Users/Best/AppData/Local/Temp/opencode/us150b-fallback-descripteurs`.
- Base : `origin/develop` synchronise a `06f1f822fbb7fc652e1e693102489d157b557ccf`.
- `develop` local et `origin/develop` sont tous deux a cette meme revision et n'ont pas ete modifies directement.
- Commits : aucun. Toutes les modifications sont locales et non validees dans le worktree.
- PR : aucune PR ouverte.
- Checkout principal : conserve sur `feature/PRE-12-audit-corpus-cecrl-hsk` avec ses modifications non validees et ses fichiers non suivis intacts.
- Validation attendue : le developpeur doit relire le diff, valider les choix de provenance, puis seulement demander commit et ouverture de PR.
