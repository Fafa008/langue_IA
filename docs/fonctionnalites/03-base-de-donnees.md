# 03 — La base de données

> Référence : `backend/app/models/`, `backend/alembic/versions/`, `backend/app/seed.py`,
> `backend/app/seed_diagnostic.py`, `docs/donnees/README.md`.
> Constat du **14 novembre 2026**, branche `develop` (`95543db`).
> Les chiffres viennent du seed et des migrations : Docker n'était pas lancé à la rédaction.

---

## 1. Où vivent les données

| Donnée | Emplacement | Persistée entre deux démarrages | Versionnée dans Git |
| --- | --- | --- | --- |
| Données métier | PostgreSQL 16, volume `postgres_data` | oui | non |
| Photos de profil | volume `media_data` → `/srv/media/photos` | oui | non |
| Corpus CECRL (RAG) | `ia-service/corpus/cecrl/` | oui (fichier local) | manifeste seulement |
| Modèles entraînés | `ia-service/models/` | oui | non (`.gitkeep`) |
| Données simulées du frontend | `frontend/src/mocks/` | — | oui (`.ts`) |
| Redis | volume `redis_data` | oui | — |

Deux précisions indispensables :

- **`database/` à la racine est vide** (seulement des `.gitkeep`). Le schéma vit dans
  `backend/alembic/versions/`, le seed dans `backend/app/seed.py`. Ne cherche pas les migrations à la racine.
- **Redis tourne mais n'est lu par aucun code** : ni cache, ni file, ni limitation de débit. Son volume
  persiste donc des données que personne n'écrit.

---

## 2. Les 22 tables, par domaine

### 2.1 Vue d'ensemble

```
IDENTITÉ                    PÉDAGOGIE                 FACTURATION
utilisateur ──1:1── apprenant      langue ──n:n── niveau      formule ──n:n── langue
     │            formateur        │                          │
     │            administrateur   │                          └──1:n── abonnement
     │                             │                                     │
     ├──n:n── langue (apprenant_langue)                                apprenant
     ├──n:n── langue (formateur_langue)
     └──n:1── roles ──n:n── permissions

DIAGNOSTIC                  PARCOURS                  ATELIERS
question ──n:1── langue      parcours ──1:1── test_diagnostic    atelier ──n:1── langue
    │        └── niveau      parcours ──n:n── exercice           atelier ──n:1── formateur
    └──1:n── reponse          parcours_exercice
test_diagnostic ──1:n── reponse
```

### 2.2 Identité et accès (9 tables)

| Table | Rôle | Clés / contraintes notables |
| --- | --- | --- |
| `utilisateur` | compte commun | `email` **unique**, `role` FK, `statut`, `photo_url` |
| `apprenant` | spécialisation | PK = `id_user` (FK `CASCADE`), `date_naissance`, `pays`, `ville`, `objectif` |
| `formateur` | spécialisation | `certifications`, `type_contrat` |
| `administrateur` | spécialisation | `niveau_acces` (`SMALLINT`) |
| `apprenant_langue` | langues choisies | PK composite, FK `CASCADE` |
| `formateur_langue` | langues enseignées | PK composite, FK `CASCADE` |
| `roles` | rôles RBAC | `code` unique, `id_role` = code entier |
| `permissions` | permissions | `code` unique (`users:manage`…) |
| `role_permission` | association | PK composite, FK `CASCADE` |

Le point structurant : **un rôle = une ligne dans une table de spécialisation**, reliée par la même clé
`id_user`. Un changement de rôle **crée** la nouvelle ligne et **conserve** les anciennes. On ne perd donc
jamais l'historique d'un apprenant devenu formateur.

### 2.3 Pédagogie et facturation (6 tables)

| Table | Rôle | Champs notables |
| --- | --- | --- |
| `langue` | catalogue | `code` (ISO 639, unique), `libelle` |
| `niveau` | CECRL et HSK | `code` unique (`A1`, `HSK 3`) |
| `langue_niveau` | niveaux ouverts par langue | PK composite, FK `CASCADE` |
| `formule` | abonnement commercial | `prix_mensuel`, `duree_mois`, `quota_heures`, `quota_ateliers` |
| `formule_langue` | langues couvertes | **aucune ligne = toutes les langues** |
| `abonnement` | souscription d'un apprenant | `date_debut`, `date_fin`, `statut`, quotas **copiés** |

Deux règles métier sont dans le schéma, pas dans le code applicatif :

- **`formule_langue` vide signifie « toutes les langues »** : c'est `register` qui interprète
  `couvertes = {…}` et refuse une langue non couverte ;
- **les quotas sont copiés à la souscription** : modifier une formule plus tard ne change **pas** les
  abonnements existants. C'est volontaire (droit acquis).

### 2.4 Diagnostic (3 tables)

| Table | Rôle | Champs notables |
| --- | --- | --- |
| `question` | banque | `enonce`, `competence`, `type_reponse`, `choix` (JSONB), `reponse_correcte`, `support`, `audio_url`, `audio_texte` |
| `test_diagnostic` | tentative | `statut`, `score` `Numeric(5,2)`, `id_niveau_final`, `analyse_ia` (JSONB) |
| `reponse` | réponse fournie | `reponse_fournie`, `evaluation` (JSONB), unicité `(id_tentative, id_question)` |

Contraintes fortes :

- `ck_question_type_reponse` : `type_reponse IN ('choix', 'texte', 'audio')` ;
- `ck_question_reponse_correcte_choix` : une clé de correction n'existe que pour un QCM ;
- `ck_test_diagnostic_score` : score entre 0 et 100 ;
- unicité `(id_tentative, id_question)` : **une seule réponse par question et par tentative**, appliquée
  aussi par un `IntegrityError` géré dans `enregistrer_reponse`.

### 2.5 Parcours (3 tables) et ateliers (1 table)

| Table | Rôle | État réel |
| --- | --- | --- |
| `parcours` | parcours issu d'un diagnostic | **0 ligne**, aucune route |
| `exercice` | exercice d'un parcours | **0 ligne**, aucune route |
| `parcours_exercice` | progression par leçon | **0 ligne**, aucune route |
| `atelier` | atelier animé par un formateur | **0 ligne**, aucune route ; seul le compteur admin la lit |

`parcours.id_test` est **unique** : un diagnostic ne produit qu'un parcours. `parcours_exercice` porte
`numero_lecon`, `score_obtenu` (0–100) et une contrainte d'unicité
`(id_parcours, numero_lecon, id_exercice)`.

> Les tables du parcours sont **prêtes mais inertes**. Les compter comme « fonctionnalité » serait une
> erreur : sans route ni écran, elles ne servent à rien.

---

## 3. Conventions de schéma à respecter

| Convention | Pourquoi | Exemple |
| --- | --- | --- |
| **Énumérations en `SMALLINT`** | stable, compact, indexable | `utilisateur.role = 1` |
| Codes figés dans `enums.py` | on ajoute, on ne modifie jamais | `Role.APPRENANT = "APPRENANT"` |
| **`JSONB`** pour le souple | choix variables, enveloppe IA | `question.choix`, `analyse_ia` |
| **`ON DELETE RESTRICT`** pour l'historique | ne pas perdre une trace | langue, niveau, question |
| **`ON DELETE CASCADE`** pour ce qui appartient à l'utilisateur | droit à l'effacement | réponses, abonnements, spécialisations |
| Contraintes métier en base | la base reste cohérente même hors API | score 0–100, difficulté 1–5 |

Exemple d'énumération persistée :

```python
class Role(str, enum.Enum):
    APPRENANT = "APPRENANT"
    FORMATEUR = "FORMATEUR"
    ADMINISTRATEUR = "ADMINISTRATEUR"

role: Mapped[Role] = mapped_column(EnumEntier(Role), ForeignKey("roles.id_role"), index=True)
```

`EnumEntier` stocke la **position** de la valeur, pas le texte. **Réordonner l'énumération corrompt les
données** : c'est la règle la plus importante de ce chapitre.

---

## 4. Migrations Alembic : 7 révisions

| # | Révision | Contenu |
| --- | --- | --- |
| 1 | `20261015_schema_initial` | 13 tables : identité, pédagogie, facturation, atelier |
| 2 | `20261020_rbac` | `roles`, `permissions`, `role_permission` |
| 3 | `20261021_tables_du_diagnostic` | `question`, `test_diagnostic`, `reponse` |
| 4 | `20261023_diagnostic_question_payload` | colonnes de contenu des questions |
| 5 | `20261027_diagnostic_scoring` | clé de correction et score final |
| 6 | `20261110_us45_parcours` | `parcours`, `exercice`, `parcours_exercice` |
| 7 | `20261110_diagnostic_analyse_ia` | `test_diagnostic.analyse_ia` (JSONB) |

La chaîne est **linéaire** (`down_revision` pointe sur la précédente). La migration 7 est volontairement
placée après la 6 pour garder **une seule tête Alembic** sur `develop`.

### 4.1 Appliquer

```powershell
# Automatique à chaque démarrage du conteneur backend
docker compose exec backend alembic upgrade head

# Vérifier la révision courante
docker compose exec backend alembic current

# Revenir d'une révision
docker compose exec backend alembic downgrade -1
```

### 4.2 Créer une migration

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm backend `
  alembic revision --autogenerate -m "ajout table reservation"
```

Puis **relire le fichier généré**. L'autogénération rate régulièrement :

- les contraintes `CHECK` nommées ;
- les index partiels ;
- les `server_default` ;
- les renommages de colonne (elle préfère supprimer + créer, ce qui perd les données).

### 4.3 Ajouter une table : la checklist

1. écrire le modèle dans `backend/app/models/` ;
2. l'importer dans `backend/app/models/__init__.py` (sinon Alembic ne le voit pas) ;
3. `make migration m="description"` ;
4. relire et corriger le fichier ;
5. redémarrer le backend : `alembic upgrade head` s'applique ;
6. ajouter un test de modèle si la table a des contraintes.

---

## 5. Le seed : ce qui est chargé, et quand

`backend/app/seed.py` tourne **à chaque démarrage** du backend (`docker-entrypoint.sh`), après les
migrations. Il est **idempotent** : il compare des clés naturelles et n'ajoute que ce qui manque.

| Donnée | Clé d'idempotence | Quantité |
| --- | --- | --- |
| Niveaux | `code` | 12 (6 CECRL + 6 HSK) |
| Langues | `code` | 5 (`fr`, `en`, `zh`, `it`, `de`) |
| Formules | `libelle` | 3 (Simple, Luxe, Premium) |
| Rôles | `code` | 3 |
| Permissions | `code` | 9 |
| Comptes démo | `email` | 3 (si `SEED_DEMO=true`) |
| Questions | `(id_langue, id_niveau, enonce)` | 35 (si `SEED_DEMO=true`) |

### 5.1 Toujours chargé (référentiel)

| Langue | Code | Niveaux ouverts |
| --- | --- | --- |
| Français | `fr` | A1 → C2 |
| Anglais | `en` | A1 → C2 |
| Mandarin | `zh` | HSK 1 → HSK 6 |
| Italien | `it` | A1 → C2 |
| Allemand | `de` | A1 → C2 |

| Formule | Prix mensuel | Durée | Heures | Ateliers |
| --- | --- | --- | --- | --- |
| Simple | 60 000 Ar | 1 mois | 6 | 1 |
| Luxe | 100 000 Ar | 3 mois | 12 | 3 |
| Premium | 150 000 Ar | 6 mois | 24 | 6 |

### 5.2 Seulement si `SEED_DEMO=true`

| Donnée | Quantité | Détail |
| --- | --- | --- |
| Comptes | 3 | `apprenant@`, `formateur@`, `admin@digitheque.mg` / `Demo2026` |
| Abonnement démo | 1 | formule Luxe, `aujourd'hui + 365 jours` |
| Questions | **35** | **18 anglais**, **17 français**, toutes des QCM |

Répartition des 35 questions par niveau :

| Langue | A1 | A2 | B1 | B2 | C1 | C2 |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| Anglais | 2 | 4 | 3 | 4 | 3 | 2 |
| Français | 2 | 4 | 3 | 3 | 3 | 2 |

> **Piège** : `SEED_DEMO` vaut `false` par défaut dans le code Python, mais `docker-compose.yml` force
> `${SEED_DEMO:-true}`. **Avec Compose, les données de démo sont chargées par défaut.** En production, il faut
> explicitement `SEED_DEMO=false`.

### 5.3 Le cas de l'abonnement démo

L'apprenant démo reçoit un abonnement Luxe dont `date_fin = aujourd'hui + 365 jours`, alors que la formule
Luxe dure **3 mois**. Sans impact fonctionnel (aucun code ne vérifie la cohérence), mais c'est trompeur en
démonstration. À corriger si le sujet est montré à un jury.

---

## 6. Matrice « peuplé / vide »

| Table | Après un démarrage neuf | Conséquence |
| --- | --- | --- |
| `langue`, `niveau`, `formule` | ✅ peuplées | catalogue disponible |
| `roles`, `permissions` | ✅ peuplées | RBAC opérationnel |
| `utilisateur` | 3 (démo) ou 0 | connexion possible seulement avec `SEED_DEMO=true` |
| `apprenant`, `formateur`, `administrateur` | 3 lignes (démo) | spécialisations cohérentes |
| `abonnement` | 1 (démo) + inscriptions | pas de route de résiliation |
| `question` | 35 (démo) | test utilisable **en anglais et français seulement** |
| `test_diagnostic`, `reponse` | 0 | créées à l'usage |
| `parcours`, `exercice`, `parcours_exercice` | **0** | tables inertes |
| `atelier` | **0** | compteur admin à 0 |
| `reponse.evaluation` | **jamais écrite** | colonne réservée |
| `test_diagnostic.analyse_ia` | écrit **si** l'IA répond | sinon `NULL` → résultat partiel |

### 6.1 Trois langues sans questions

`zh`, `it`, `de` n'ont **aucune question**. `GET /diagnostic/langues` renvoie donc `disponible: false`, et
tenter de démarrer le test échoue en `aucune_question` (409). Ce n'est pas un bug : c'est une donnée
manquante, à fournir par l'équipe pédagogique (voir `docs/donnees/directive-donnees.md`).

### 6.2 Questions `audio` et `texte`

- **0 question `audio` en base** : le type existe, mais `TYPES_ENREGISTRABLES = ("choix", "texte")` et une
  réponse audio est refusée (422).
- **0 question `texte` en base** : le type est accepté, mais ces réponses **ne sont pas corrigées** par le
  scoring. En créer sans adapter le scoring produirait des points fantômes.

---

## 7. Inspecter la base

### 7.1 Depuis `psql`

```powershell
docker compose exec db psql -U admin -d centre_langues
```

```sql
\dt                                    -- liste des tables
\d test_diagnostic                     -- structure d'une table
SELECT code, libelle FROM langue ORDER BY code;
SELECT count(*) FROM question;
\q
```

### 7.2 Requêtes utiles

```sql
-- Questions par langue et par niveau
SELECT l.code, n.code, count(*)
FROM question q
JOIN langue l USING (id_langue)
JOIN niveau n USING (id_niveau)
GROUP BY l.code, n.code
ORDER BY l.code, n.code;

-- Tentatives et présence d'une analyse IA
SELECT id_test, statut, score, (analyse_ia IS NOT NULL) AS ia
FROM test_diagnostic
ORDER BY id_test DESC
LIMIT 10;

-- Un utilisateur et ses spécialisations
SELECT u.id_user, u.email, u.role, u.statut,
       (a.id_user IS NOT NULL) AS est_apprenant,
       (f.id_user IS NOT NULL) AS est_formateur
FROM utilisateur u
LEFT JOIN apprenant a USING (id_user)
LEFT JOIN formateur f USING (id_user);
```

### 7.3 Depuis PowerShell (sans entrer dans `psql`)

```powershell
docker compose exec db psql -U admin -d centre_langues -c `
  "SELECT l.code, count(*) FROM question q JOIN langue l USING (id_langue) GROUP BY l.code ORDER BY l.code;"
```

### 7.4 En mode développement, avec un client graphique

PostgreSQL est publié sur `127.0.0.1:55432` (utilisateur `admin`, mot de passe `changeme`, base
`centre_langues`). Pratique pour DBeaver ou pgAdmin. **En production locale, le port n'est pas publié.**

---

## 8. Intégrité : les pièges à connaître

### 8.1 Suppressions

| Objet supprimé | Effet |
| --- | --- |
| `langue` | **409** si une formule, un parcours, un atelier ou une question l'utilise |
| `niveau` | **409** si une question, un parcours ou un exercice l'utilise |
| `utilisateur` | **aucune route** : on désactive (`statut = INACTIF`) |
| `test_diagnostic` | réponses supprimées en cascade |
| `question` | **RESTRICT** : impossible si des réponses existent |

### 8.2 Changement de rôle

`PATCH /users/{id_user}` avec un nouveau rôle **ajoute** la ligne de spécialisation manquante sans supprimer
les autres. Un utilisateur peut donc être à la fois `apprenant` et `formateur` en base, alors que son champ
`role` n'en indique qu'un. **Le champ `role` fait foi pour les droits** ; les lignes de spécialisation ne
servent qu'aux données métier.

### 8.3 `analyse_ia`

`test_diagnostic.analyse_ia` stocke l'**enveloppe validée** du service IA (JSONB). Elle n'est écrite qu'une
fois : `analyser_tentative` renvoie l'analyse déjà persistée, ce qui rend la clôture idempotente. Aucune
purge, aucune durée de conservation n'est codée.

### 8.4 Vocabulaire orphelin

Le seed étiquette certaines questions `competence = "vocabulaire"`, mais l'analyse IA ne connaît que
`grammaire`, `lecture`, `ecoute`, `ecrit`, `oral`. Ces réponses sont **ignorées** par l'analyse IA, tout en
restant comptées dans le score déterministe. Écart à corriger côté mapping, pas côté données.

---

## 9. Sauvegardes, rétention, données personnelles

| Sujet | État réel |
| --- | --- |
| Sauvegarde automatique | ⛔ aucune, malgré `BACKUP_*` dans `.env.example` |
| Seule protection | volume Docker `postgres_data` |
| Purge des tentatives | ⛔ aucune |
| Purge de `analyse_ia` | ⛔ aucune |
| Politique de rétention | ⛔ non codée |
| Anonymisation | ⛔ non codée |
| Photos | servies par `StaticFiles` sur `/media`, **sans authentification** |
| Données personnelles stockées | e-mail, date de naissance, pays, ville, photo |

```powershell
# Sauvegarde manuelle (à automatiser hors dépôt)
docker compose exec -T db pg_dump -U admin centre_langues > sauvegarde.sql

# Restauration
Get-Content sauvegarde.sql | docker compose exec -T db psql -U admin -d centre_langues
```

> Un `docker compose down --volumes` (`make reset`) **détruit la base**. C'est la commande à ne jamais
> lancer sur un environnement qui contient des données réelles.

---

## 10. Ce qui fonctionne, ce qui manque

| Élément | Verdict | Preuve |
| --- | --- | --- |
| 22 tables créées par 7 migrations | ✅ | `alembic upgrade head` |
| Référentiel (langues, niveaux, formules) | ✅ | `seed.py` |
| RBAC persisté | ✅ | `roles`, `permissions` |
| Comptes et questions de démo | ✅ | `SEED_DEMO=true` |
| Idempotence du seed | ✅ | `test_seed.py` |
| Banque de questions EN/FR | 🟡 | 35 questions, 2 par niveau en A1 |
| Questions `zh`, `it`, `de` | ⛔ | 0 ligne |
| Questions `audio` / `texte` | 🔌 | type accepté, aucune donnée, audio refusé |
| Tables de parcours | ⛔ | 0 ligne, aucune route |
| Ateliers | ⛔ | 0 ligne, aucune route |
| Sauvegardes | ⛔ | aucun code |
| Rétention / anonymisation | ⛔ | aucun code |
| Redis | 🔌 | démarré, jamais lu |

---

## Questions de compréhension

1. Pourquoi ne faut-il **jamais** réordonner les valeurs d'une énumération stockée en `SMALLINT` ? Que
   se passerait-il concrètement pour les utilisateurs existants ?
2. `formule_langue` ne contient aucune ligne pour une formule : que signifie cette absence, et où est
   interprétée cette règle ?
3. Un administrateur supprime une langue utilisée par une formule. Quelle contrainte l'en empêche, et quel
   code HTTP reçoit-il ?
4. Le seed est idempotent. Sur quelles clés repose cette idempotence pour les langues, les comptes et les
   questions ? Que se passe-t-il si l'on modifie l'énoncé d'une question existante ?
5. Pourquoi les tables `parcours` et `atelier` ne doivent-elles pas être présentées comme des
   fonctionnalités livrées, même si elles existent en base ?
