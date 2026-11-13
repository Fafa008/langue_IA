# État des données — Centre de Langues IA (La Digithèque)

> Constat fondé sur l'inspection du code au **13 novembre 2026**.
> Ce document décrit **ce qui existe réellement** dans le dépôt : schéma, données de départ,
> données hors base, données simulées et points de vigilance.
> La règle de production est décrite dans [`directive-donnees.md`](directive-donnees.md).

---

## 1. Où vivent les données

| Type de donnée | Emplacement | Persistée entre deux démarrages | Versionnée dans Git |
| --- | --- | --- | --- |
| Données métier | PostgreSQL, volume Docker `postgres_data` | oui | non |
| Photos de profil | volume `media_data` → `/srv/media/photos` | oui | non |
| Corpus CECRL (RAG) | `ia-service/corpus/cecrl/` | oui (fichier local) | **manifeste seulement** |
| Modèles entraînés | `ia-service/models/` | oui | non (`.gitignore`) |
| Données simulées du frontend | `frontend/src/mocks/` | — | oui (ce sont des `.ts`) |
| Redis | volume `redis_data` | oui | — |

Deux précisions :

- `database/` à la racine est **vide** (`README.md` vide, `migrations/.gitkeep`,
  `seeds/.gitkeep`). Le schéma vit dans `backend/alembic/versions/`, le seed dans
  `backend/app/seed.py`.
- Redis est démarré et son volume existe, mais **aucun code ne l'utilise** : ni cache, ni file
  d'attente, ni limitation de débit.

---

## 2. Le schéma : 22 tables

Créées par 7 migrations Alembic :

| Migration | Tables |
| --- | --- |
| `20261015_schema_initial` | `formule`, `langue`, `niveau`, `utilisateur`, `administrateur`, `apprenant`, `formateur`, `formule_langue`, `langue_niveau`, `abonnement`, `apprenant_langue`, `atelier`, `formateur_langue` |
| `20261020_rbac` | `roles`, `permissions`, `role_permission` |
| `20261021_tables_du_diagnostic` | `question`, `test_diagnostic`, `reponse` |
| `20261023_diagnostic_question_payload` | colonnes de payload des questions |
| `20261027_diagnostic_scoring` | colonnes de score et de niveau final |
| `20261110_us45_parcours` | `parcours`, `exercice`, `parcours_exercice` |
| `20261110_diagnostic_analyse_ia` | colonne `test_diagnostic.analyse_ia` (PRE-05) |

### Conventions à connaître

- **Énumérations en `SMALLINT`** : rôles et statuts sont des entiers (1, 2, 3…), jamais des
  chaînes. Les codes sont figés dans `backend/app/models/enums.py` — on ajoute, on ne modifie
  jamais.
- **`JSONB`** pour les structures souples : `question.choix`, `test_diagnostic.analyse_ia`,
  `reponse.evaluation`.
- **`ON DELETE RESTRICT`** là où l'historique compte (langue, niveau, question) ;
  **`CASCADE`** pour ce qui appartient à l'apprenant (réponses, abonnements).
- **Contraintes métier en base** : score entre 0 et 100, `difficulte` entre 1 et 5, une seule
  réponse par question et par tentative.

### Tables du diagnostic

| Table | Rôle | Champs notables |
| --- | --- | --- |
| `question` | banque de questions | `enonce`, `competence`, `type_reponse`, `choix` (JSONB), `reponse_correcte`, `support`, `audio_url`, `audio_texte` |
| `test_diagnostic` | tentative d'un apprenant | `statut`, `score` (`Numeric(5,2)`), `id_niveau_final`, `analyse_ia` (JSONB) |
| `reponse` | réponse fournie | `reponse_fournie`, `evaluation` (JSONB), unicité `(id_tentative, id_question)` |

---

## 3. Ce que le seed remplit réellement

`backend/app/seed.py` tourne **à chaque démarrage** du conteneur, via `docker-entrypoint.sh` :
`alembic upgrade head`, puis `python -m app.seed`, puis la commande du conteneur. Il est
**idempotent** : il compare des clés naturelles (code, libellé, e-mail, énoncé) et n'ajoute que
ce qui manque.

### Toujours chargé (référentiel)

| Donnée | Quantité | Détail |
| --- | --- | --- |
| Langues | 5 | `fr`, `en`, `zh`, `it`, `de` |
| Niveaux | 12 | 6 CECRL (A1→C2) + 6 HSK (HSK 1→6) |
| Formules | 3 | Simple 60 000 Ar, Luxe 100 000 Ar, Premium 150 000 Ar |
| Rôles | 3 | apprenant, formateur, administrateur |
| Permissions | 9 | `profile:read`, `users:manage`, `pedagogy:manage`… |

Règle d'association : le mandarin est relié aux niveaux HSK, les quatre autres langues aux
niveaux CECRL.

### Seulement si `SEED_DEMO=true`

| Donnée | Quantité | Détail |
| --- | --- | --- |
| Comptes de démonstration | 3 | un par rôle, mot de passe `Demo2026` |
| Abonnement de l'apprenant démo | 1 | formule Luxe |
| Questions de diagnostic | **35** | 18 en anglais, 17 en français |

Les questions sont **toutes des QCM** (`type_reponse = "choix"`), avec au moins 2 par niveau.
Elles couvrent la grammaire, le vocabulaire, la lecture et l'écoute (l'écoute utilise
`audio_texte`, lu par la synthèse vocale du navigateur).

> **Piège** : `SEED_DEMO` vaut `false` par défaut dans le code Python, mais
> `docker-compose.yml` force `${SEED_DEMO:-true}`. Avec Compose, les comptes de démo et les
> questions sont donc chargés **par défaut**, même sans variable définie.

---

## 4. Ce qui reste vide ou partiel

| Donnée | État réel | Conséquence |
| --- | --- | --- |
| Questions `zh`, `it`, `de` | **0** | `GET /diagnostic/langues` renvoie `disponible: false` ; démarrer le test échoue en `aucune_question` |
| Questions `audio` | **0 en base** | `TYPES_ENREGISTRABLES = ("choix", "texte")` : l'audio est refusé (422), le frontend masque ces questions |
| Questions `texte` | **0 en base** | le type est accepté, mais ces réponses ne sont **pas corrigées** par le scoring |
| `parcours`, `exercice`, `parcours_exercice` | **0** | tables prêtes (US-45), aucune route, aucune UI |
| `atelier` | **0** | compteur « ateliers programmés » du tableau de bord admin à 0 |
| `abonnement` | 1 (démo) + ceux créés à l'inscription | pas de route de souscription ni de résiliation |
| `reponse.evaluation` | **jamais écrit** | colonne réservée, sans code qui la remplit |
| `test_diagnostic.analyse_ia` | écrit **si** le service IA répond | sinon reste `NULL` → « Résultat partiel » |

### Règles du scoring à garder en tête

- Le test pose **toutes les questions à choix du niveau de départ**, pas un échantillon.
- Une question sans réponse est comptée **fausse**.
- `pourcentage = arrondi(correctes × 100 / total, 2)`.
- Seuils : `20`, `40`, `60`, `75`, `90`, `101` → A1, A2, B1, B2, C1, C2 (ou HSK 1→6).
- Les questions `texte` ne sont pas notées ; les questions `audio` sont refusées.

---

## 5. Les données hors base

### Corpus CECRL (RAG)

- `ia-service/corpus/cecrl/manifeste.json` est versionné : version, source, licence, langues,
  niveaux, comptages, empreintes SHA256.
- `descripteurs.jsonl` (325 descripteurs anglais, A1→B2) est **volontairement absent du dépôt** :
  les droits de réutilisation ne sont pas clarifiés avec le Conseil de l'Europe.
- Le corpus se génère hors dépôt avec `scripts/ingestion_cecrl.py`, qui refuse toute sortie
  située dans le dépôt.
- Le RAG est **désactivé par défaut** (`RAG_CORPUS_ACTIF=false`) : sans corpus, le service
  utilise `RecuperateurVide`.

### Modèles

`ia-service/models/` ne contient que `.gitkeep`. Le diagnostic n'utilise pas de modèle entraîné :
c'est un **LLM** (Groq, Gemini ou fournisseur factice) piloté par le Harness. Les formats
`.pkl`, `.h5`, `.pt`, `.onnx`, `.joblib` sont ignorés par Git.

### Sauvegardes

`.env.example` déclare `BACKUP_ENABLED`, `BACKUP_PATH`, `BACKUP_RETENTION_DAYS`… mais **aucun code
ne les lit**. Il n'existe aujourd'hui aucune sauvegarde automatique : la seule protection est le
volume Docker `postgres_data`.

---

## 6. Les données simulées du frontend

`frontend/src/mocks/` contient un jeu complet utilisé quand `NEXT_PUBLIC_API_MOCK=true` (valeur
de `frontend/.env.development`) : comptes, langues, niveaux, formules, formateurs, utilisateurs,
tableau de bord, et **50 questions** (25 anglais + 25 français).

Ces 50 questions sont **plus riches que les 35 du backend** : elles incluent 3 sujets
d'expression orale et 3 sujets d'expression écrite par langue, que le seed ne charge pas.

> Conséquence : une question qui « marche » en mode mock peut ne pas exister côté serveur.
> Toute divergence entre les mocks et le seed doit être documentée.

---

## 7. Cycle de vie et commandes utiles

```powershell
# Recharger le référentiel et les données de démo sur une stack déjà lancée
make seed
# ou
docker compose exec backend python -m app.seed

# Tout effacer (base, Redis, photos) puis repartir de zéro
make reset

# Vérifier la révision Alembic appliquée
docker compose exec backend alembic current

# Compter les questions par langue
docker compose exec db psql -U admin -d centre_langues -c `
  "SELECT l.code, count(*) FROM question q JOIN langue l USING (id_langue) GROUP BY l.code ORDER BY l.code;"

# Voir les tentatives et la présence d'une analyse IA
docker compose exec db psql -U admin -d centre_langues -c `
  "SELECT id_test, statut, score, (analyse_ia IS NOT NULL) AS ia FROM test_diagnostic ORDER BY id_test DESC LIMIT 10;"
```

La CI vérifie ce cycle : le job `docker` démarre la stack, se connecte avec le compte démo,
passe le diagnostic d'anglais et exige `percentage == 100`.

---

## 8. Points de vigilance

1. **Trois langues sur cinq sans questions** : le test n'est réellement utilisable qu'en anglais
   et en français.
2. **Vocabulaire orphelin dans l'analyse IA** : le seed étiquette des questions
   `competence = "vocabulaire"`, mais `analyse_diagnostic._ALIAS_COMPETENCES` ne connaît que
   `grammaire`, `lecture`, `ecoute`, `ecrit`, `oral`. Ces réponses sont **ignorées** par
   l'analyse IA (elles restent comptées dans le score déterministe).
3. **Données personnelles** : e-mail, date de naissance, ville, photo. Les photos sont servies
   par un `StaticFiles` monté sur `/media`, **sans authentification** : qui connaît l'URL voit
   l'image. Aucune politique de rétention ni d'anonymisation n'est codée.
4. **`analyse_ia` conserve la sortie du LLM** dans `test_diagnostic`, sans purge ni durée de
   conservation.
5. **Cohérence du seed démo** : l'abonnement de l'apprenant démo est daté
   `aujourd'hui + 365 jours` alors que la formule Luxe dure 3 mois. Sans impact fonctionnel,
   mais trompeur pour une démonstration.
6. **Aucune sauvegarde** malgré les variables `BACKUP_*`.

---

## 9. Écarts documentaires corrigés

Le dépôt a évolué avec la PR **PRE-05** (orchestration de l'analyse IA). Les chapitres
d'architecture ont été mis à jour le 13 novembre 2026 pour refléter l'état réel :

- le backend appelle `POST /diagnostic/evaluer` du service IA (`backend/app/services/ia.py`),
  de façon **best-effort** : une panne dégrade en résultat partiel, sans faire échouer la
  clôture ;
- `POST /diagnostic/tentatives/{id}/terminer` renvoie `competences`, `points_faibles` et
  `phase_assimil` en plus du score, **si** l'analyse aboutit ;
- le service IA expose **deux** routes métier : `POST /chatbot/message` et
  `POST /diagnostic/evaluer`.

Restent volontairement non alignés, car ils décrivent des intentions : le contrat
`docs/api/contrat-frontend.md` annonce `justification` et le `202`, que le backend n'implémente
toujours pas.

---

## 10. Suite

La production, la validation et la gouvernance des données sont décrites dans :

- [`directive-donnees.md`](directive-donnees.md) — directive complète (six jeux de données) ;
- [`modele-questions.csv`](modele-questions.csv) — modèle de livraison pour l'équipe
  pédagogique ;
- [`exemple-questions.jsonl`](exemple-questions.jsonl) — exemple de format d'intégration ;
- [`livraisons/`](livraisons/README.md) — zone de dépôt des CSV de l'équipe pédagogique.

---

## Questions de compréhension

1. Pourquoi le seed est-il idempotent, et sur quelles clés repose cette idempotence ?
2. Que se passe-t-il si un apprenant choisit le mandarin alors que `SEED_DEMO=true` ?
3. Où est stockée l'analyse du LLM, et que se passe-t-il si le service IA est indisponible au
   moment de la clôture ?
4. Pourquoi les 12 questions d'expression orale/écrite des mocks n'existent-elles pas en base ?
5. Quelles données personnelles le projet conserve-t-il, et quelles protections manquent
   aujourd'hui ?
