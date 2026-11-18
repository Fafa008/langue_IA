# US-151 — Validation stricte des données du service IA (Pydantic)

| Élément | Valeur |
| --- | --- |
| User Story | US-151 |
| Branche | `feature/US151-validation-stricte-pydantic` |
| Commit d'implémentation | `7d18ad3` — `feat(ia): valide strictement les modeles du diagnostic (US-151)` |
| Base | `develop` (`b22ee65`) |
| Statut | Implémenté, testé, documenté — en attente de revue |
| Périmètre | `ia-service/app/schemas/` et ses tests |
| Contrat détaillé | [`contrat-modeles-ia.md`](contrat-modeles-ia.md) |

## 1. Objectif

Le service IA reçoit des requêtes du backend et renvoie des résultats structurés. Avant de brancher le moindre
agent (diagnostic, chatbot, assistant formateur…), il fallait un socle de validation unique : aucun JSON arbitraire,
aucune valeur pédagogique inventée, aucune donnée personnelle inutile.

L'US livre ce socle sous forme de modèles Pydantic 2, avec tests unitaires, exemples JSON et documentation du
contrat, de façon à ce que les neuf agents partagent la même enveloppe sans dupliquer la validation.

## 2. Périmètre

### Inclus

- Enveloppes communes du Harness : requête, réponse de succès, réponse d'erreur.
- Contexte apprenant : langue, référentiel, niveau préliminaire, mémoire pédagogique résumée.
- Résultat du diagnostic : niveau estimé, référentiel, points faibles, phase Assimil, score de confiance, écart avec
  le niveau préliminaire.
- Modèle d'erreur standardisé (codes, `retryable`, `details`).
- Validations de types, de bornes, de valeurs autorisées et de cohérence croisée.
- Tests unitaires, exemples JSON valides et invalides, documentation.
- Job CI `ia-service` : lint, formatage, import, tests, seuil de couverture.

### Exclu (US suivantes)

- Routes HTTP du service IA, intégration au backend.
- Client LLM, prompts, RAG, corpus.
- Persistance et base de données : le service IA reste sans état.
- Calcul du score objectif : il appartient au backend (`backend/app/services/scoring.py`).

## 3. Audit préalable

| Constat | Conséquence |
| --- | --- |
| `ia-service/` ne contenait que `app/main.py` avec `GET /health` | Aucun modèle à réutiliser, création d'un paquet `app/schemas/` |
| `ia-service/app/models/` vide (`.gitkeep`) | Laissé intact : `models/` est réservé aux artefacts ML |
| `backend/app/schemas/diagnostic.py` décrit le contrat **public** | Non importé : le service IA a son contrat interne, en `snake_case` |
| Les valeurs métier existent déjà (`backend/app/seed.py`, `backend/app/services/scoring.py`, `docs/api/contrat-frontend.md`) | Aucune valeur inventée : langues, niveaux, compétences et référentiels sont repris à la source |
| Aucun test dans `ia-service/` | Ajout de `pytest`, `pytest-cov`, `ruff` et d'un `pyproject.toml` local |

## 4. Livrables

| Fichier | Rôle |
| --- | --- |
| `app/schemas/base.py` | `ModeleStrict` : `extra="forbid"` pour tous les modèles |
| `app/schemas/regles.py` | Langues, référentiels, niveaux, compétences, helpers |
| `app/schemas/contexte.py` | `ContexteApprenant`, `MemoirePedagogique` |
| `app/schemas/diagnostic.py` | `ResultatDiagnostic`, `PointFaible`, `PreuveReponse`, `PhaseAssimil`, calcul de l'écart |
| `app/schemas/commun.py` | `RequeteAgent[T]`, `ReponseAgent[T]`, `MetaExecution`, `ErreurAgent`, `ReponseErreur` |
| `app/schemas/__init__.py` | Réexports publics |
| `tests/test_contexte.py` | Contexte et mémoire pédagogique |
| `tests/test_diagnostic.py` | Résultat, phases, écarts, cohérence |
| `tests/test_commun.py` | Enveloppes, métadonnées, erreurs |
| `tests/test_exemples_json.py` | Exécution des exemples livrés |
| `tests/exemples/valide/` et `invalide/` | Charges utiles JSON valides et invalides du contrat courant |
| `docs/contrat-modeles-ia.md` | Contrat détaillé (valeurs, bornes, exemples) |
| `docs/US-151-validation-stricte-pydantic.md` | Le présent bilan de tâche |
| `pyproject.toml`, `requirements-dev.txt` | Outillage local et CI |
| `requirements.txt` | Ajout de `pydantic==2.10.4` (version alignée sur le backend) |
| `.github/workflows/ci.yml` | Job `ia-service` complété |
| `CONTRIBUTING.md` | Commandes de test IA et tableau CI mis à jour |

## 5. Décisions de conception

| Sujet | Décision | Justification |
| --- | --- | --- |
| Emplacement | `app/schemas/` (et non `app/models/`) | Cadrage AJ02 §18.2 ; évite la confusion avec les artefacts ML de `ia-service/models/` |
| Généricité | `RequeteAgent[T]` / `ReponseAgent[T]` | Un seul contrat pour les neuf agents, sans accepter de JSON libre : chaque route instancie `T` |
| Champs inconnus | `extra="forbid"` hérité partout | Une faute de frappe ou un champ pirate produit une `422`, jamais un silence |
| Référentiel | Exigé puis vérifié contre la langue (`zh` → HSK, sinon CECRL) | Reprend la règle du backend ; empêche `en` + `HSK` |
| Niveaux | Listes fermées CECRL et HSK | Aucune valeur inventée (`A0`, `C3`, `HSK 7` refusés) |
| Phase Assimil | `impregnation` et `activation` (US30 ; `passive`/`active` archivés) | Les deux phases du contrat public ; toute autre phase relève d'une décision pédagogique |
| Écart | Recalculé par différence d'indices et comparé au champ reçu | Rend l'arbitrage traçable et détecte une incohérence |
| Score de confiance | Nombre entre 0 et 1, booléen et chaîne refusés | Ce n'est pas un score de bonnes réponses sur 100 |
| Niveau préliminaire | Répété dans le résultat | Auditabilité et vérification de l'écart (point ouvert §10) |
| Nom d'agent | Validé par motif, pas par énumération | Liste des neuf agents non arbitrée (D-07) |
| `retryable` | Vérifié contre une table de 10 codes | Un même code ne peut pas être tantôt rejouable, tantôt définitif |
| `details` | Dictionnaire plat, clés et valeurs non vides, sans saut de ligne | Évite secrets, contenu apprenant et falsification des journaux |
| Types entiers | `strict=True` pour `nb_activites`, `duree_ms`, `ecart` | Refuse `true`, `"12"` et `12.5` |
| Données personnelles | Aucun nom, e-mail, téléphone ni identifiant d'apprenant | Minimisation ; le service reste non autoritaire |

## 6. Règles de validation (résumé)

1. Aucun champ supplémentaire, y compris dans les objets imbriqués.
2. Espaces normalisés (`str_strip_whitespace`, listes compactées).
3. Langues fermées : `fr`, `en`, `zh`, `it`, `de` ; référentiel cohérent avec la langue.
4. Niveaux fermés par référentiel ; compétences fermées : `grammaire`, `lecture`, `ecoute`, `ecrit`, `oral`.
5. Longueurs bornées : résumé 2 000, point 120, observation 160, justification 240, message 500, agent 32,
   empreinte SHA-256.
6. Listes bornées : 5 points forts, 5 points faibles, 5 points faibles de diagnostic, 10 détails.
7. Unicité : pas de doublon de point (casse ignorée), de domaine de faiblesse ou d'identifiant de question ; un
   point ne peut être à la fois fort et faible.
8. Cohérence : référentiel/langue, niveau/référentiel, écart/niveaux, `retryable`/code.
9. Formats : UUID, SemVer, `agent/tache@x.y.z`, `sha256:<64 hex>`, code d'agent en minuscules.

Le détail champ par champ, avec exemples, se trouve dans [`contrat-modeles-ia.md`](contrat-modeles-ia.md).

## 7. Tests

### Commandes exécutées (2 novembre 2026)

```bash
cd ia-service
python -m ruff check .                                   # All checks passed!
python -m ruff format --check .                          # 14 files already formatted
python -c "from app.main import app; print(app.title)"    # import OK
python -m pytest --cov=app --cov-report=term-missing:skip-covered --cov-fail-under=70
```

### Résultats réels

| Indicateur | Résultat |
| --- | --- |
| Tests | **109 réussis** |
| Couverture `app/schemas/` | **100 %** |
| Couverture `app/` | **96,14 %** (`app/main.py` hors périmètre) |
| Seuil CI (70 %) | Atteint |
| Ruff | Conforme (`line-length = 120`) |

Environnement : Python 3.12.10 en local, pydantic 2.10.4, fastapi 0.115.6, pytest 8.3.4, pytest-cov 6.0.0,
ruff 0.8.4. La CI cible Python 3.11.

### Couverture fonctionnelle

- champs supplémentaires (enveloppe, contexte, mémoire, résultat, méta, erreur) ;
- UUID, SemVer, versions de prompt, empreintes ;
- bornes de score, durée, taille, nombre de points et de détails ;
- valeurs autorisées (langues, référentiels, niveaux, compétences, phases, codes d'erreur) ;
- cohérences croisées (langue/référentiel, niveau/référentiel, écart, `retryable`) ;
- unicité et non-contradiction des points pédagogiques ;
- types stricts (booléen, chaîne, décimal refusés là où un entier est attendu) ;
- exemples JSON valides **et** invalides exécutés par les tests.

### Non exécuté

- `make test` (pytest backend sur PostgreSQL) : aucun fichier backend modifié.
- `npm run check` / `npm run build` / E2E : aucun fichier frontend modifié.
- Stack Docker complète : non nécessaire à ce périmètre.
- CI GitHub Actions : sera vérifiée après le push.

## 8. Exemples JSON

| Fichier | Modèle | Attendu |
| --- | --- | --- |
| `tests/exemples/valide/contexte-apprenant.json` | `ContexteApprenant` | valide |
| `tests/exemples/valide/resultat-diagnostic.json` | `ResultatDiagnostic` | valide |
| `tests/exemples/valide/reponse-diagnostic.json` | `ReponseAgent[ResultatDiagnostic]` | valide |
| `tests/exemples/valide/erreur-standard.json` | `ReponseErreur` | valide |
| `tests/exemples/invalide/contexte-apprenant-champ-inconnu.json` | `ContexteApprenant` | `id_apprenant` refusé |
| `tests/exemples/invalide/contexte-apprenant-referentiel-incoherent.json` | `ContexteApprenant` | `en` + `HSK` refusé |
| `tests/exemples/invalide/resultat-diagnostic-ecart-incoherent.json` | `ResultatDiagnostic` | écart incohérent refusé |
| `tests/exemples/invalide/resultat-diagnostic-phase-inconnue.json` | `ResultatDiagnostic` | phase inconnue refusée |
| `tests/exemples/invalide/reponse-diagnostic-empreinte-invalide.json` | `ReponseAgent` | empreinte non SHA-256 refusée |
| `tests/exemples/invalide/erreur-standard-retryable-incoherent.json` | `ReponseErreur` | `retryable` incohérent refusé |

`tests/test_exemples_json.py` vérifie aussi qu'aucun fichier d'exemple n'échappe aux tests et que chaque exemple
invalide échoue pour la raison annoncée.

## 9. CI

Le job `ia-service` (`.github/workflows/ci.yml`) exécute désormais :

1. `pip install -r requirements-dev.txt` ;
2. `ruff check . && ruff format --check .` ;
3. chargement de l'application (`from app.main import app`) ;
4. `pytest --cov=app --cov-report=term-missing:skip-covered --cov-fail-under=70`.

La ligne correspondante de `CONTRIBUTING.md` et la section « Tests IA » ont été mises à jour dans le même commit.

## 10. Points ouverts à valider

| Sujet | État |
| --- | --- |
| Libellés des phases Assimil | `impregnation` et `activation` retenus depuis US30 ; `passive`/`active` ne sont plus acceptés |
| Maximum de 5 points faibles | Choix de conception aligné sur les 5 compétences du contrat |
| `niveau_preliminaire` répété dans le résultat | Conservé pour l'auditabilité ; peut être retiré si le backend s'appuie uniquement sur le contexte |
| Liste des neuf agents | Non arbitrée (D-07) : `agent` validé par format, pas par énumération |
| Codes d'erreur | Repris du cadrage AJ02 §11.5 ; à compléter si le backend en ajoute |
| Liste des langues | Cinq langues actuelles ; une nouvelle langue exige une mise à jour de `regles.py` et du contrat |

## 11. Reproduire et vérifier

```bash
git switch feature/US151-validation-stricte-pydantic
cd ia-service

python -m venv .venv
# Windows : .venv\Scripts\activate    |    POSIX : source .venv/bin/activate
pip install -r requirements-dev.txt

ruff check . && ruff format --check .
pytest --cov=app --cov-report=term-missing --cov-fail-under=70
```

Aucune base de données, aucun service externe et aucun secret ne sont nécessaires.

## 12. Références

- `docs/api/contrat-frontend.md` — contrat public backend/frontend.
- `backend/app/services/scoring.py` — référentiels et seuils de niveaux.
- `backend/app/schemas/diagnostic.py` — score objectif du backend (non dupliqué côté IA).
- `docs/architecture/aj02-cadrage-technique-ia.md` — cadrage du service IA (codes d'erreur, arborescence).
- [`contrat-modeles-ia.md`](contrat-modeles-ia.md) — contrat interne détaillé.
