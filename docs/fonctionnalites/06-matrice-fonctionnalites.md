# 06 — Matrice des fonctionnalités

> Synthèse des chapitres 01 à 05. Constat du **14 novembre 2026**, branche `develop` (`95543db`).
> Cette matrice répond à une seule question : **pour chaque fonctionnalité, quelle couche fait quoi, et
> jusqu'où va-t-elle réellement ?**

---

## 1. Comment lire la matrice

Chaque ligne décrit **une fonctionnalité** et l'état de **chaque couche** :

| Symbole | Sens |
| --- | --- |
| ✅ | fait, branché, testé |
| 🟡 | existe mais limité, dégradé ou incomplet |
| 🔌 | code présent, **aucun appelant** (ou appel qui échoue toujours) |
| ⛔ | absent |
| 🧪 | ne fonctionne qu'en mode simulé (`NEXT_PUBLIC_API_MOCK=true`) |
| — | sans objet pour cette couche |

Le **verdict** est celui de la chaîne complète, pas de la meilleure couche. Une fonctionnalité avec un backend
parfait et aucun écran reste 🔌.

---

## 2. Matrice complète

### 2.1 Identité et session

| Fonctionnalité | Front | Back | Base | IA | Verdict | Preuve / limite |
| --- | :-: | :-: | :-: | :-: | :-: | --- |
| Inscription d'un apprenant + abonnement | ✅ | ✅ | ✅ | — | ✅ | `POST /auth/register` crée `Utilisateur` + `Apprenant` + `Abonnement` en une transaction |
| Connexion JWT | ✅ | ✅ | ✅ | — | ✅ | bcrypt + `access_token`, `deps.py` |
| Mot de passe oublié | ✅ | ✅ | ✅ | — | ✅ | 204 systématique (anti-énumération) |
| Réinitialisation par lien | ✅ | ✅ | ✅ | — | ✅ | claim `mdp` = usage unique |
| Déconnexion | ✅ | ⛔ | — | — | 🟡 | côté client seulement : le JWT reste valide jusqu'à expiration |
| Rafraîchissement de jeton | ⛔ | ⛔ | — | — | ⛔ | expiration = reconnexion |
| Limitation de débit / anti-bruteforce | ⛔ | ⛔ | — | — | ⛔ | aucune |
| Session persistée (local / session) | ✅ | — | — | — | ✅ | `rememberAwareStorage`, JWT expiré effacé au rechargement |

### 2.2 Profil et rôles

| Fonctionnalité | Front | Back | Base | IA | Verdict | Preuve / limite |
| --- | :-: | :-: | :-: | :-: | :-: | --- |
| Lire / modifier son profil | ✅ | ✅ | ✅ | — | ✅ | `GET`/`PATCH /users/me` |
| Changer son mot de passe | ✅ | ✅ | ✅ | — | ✅ | 400 si mot de passe actuel faux |
| Photo de profil (envoi / suppression) | ✅ | ✅ | ✅ | — | ✅ | JPEG/PNG/WebP, 2 Mo, signature binaire |
| Lecture publique des photos | ✅ | ✅ | ✅ | — | 🟡 | `/media` sans authentification |
| 3 rôles + 9 permissions (RBAC) | ✅ | ✅ | ✅ | — | ✅ | `permission_requise`, contrôle **en base** |
| Écran d'administration des rôles | ⛔ | ✅ | ✅ | — | 🔌 | `GET /roles`, `PUT /roles/{id}/permissions` sans interface |
| Changement de rôle d'un utilisateur | ✅ | ✅ | ✅ | — | ✅ | crée la spécialisation manquante, conserve les anciennes |
| Suppression d'un utilisateur | ⛔ | ⛔ | — | — | ⛔ | on désactive (`statut = INACTIF`) |
| Garde de page par rôle | ✅ | ✅ | — | — | ✅ | `RequireAuth` (UX) + RBAC (sécurité réelle) |

### 2.3 Administration

| Fonctionnalité | Front | Back | Base | IA | Verdict | Preuve / limite |
| --- | :-: | :-: | :-: | :-: | :-: | --- |
| Liste des utilisateurs (filtres, pagination) | ✅ | ✅ | ✅ | — | ✅ | `GET /users`, filtres dans l'URL |
| Modification rôle / statut | ✅ | ✅ | ✅ | — | ✅ | auto-modification interdite (403) |
| Liste des formateurs | ✅ | ✅ | ✅ | — | ✅ | `GET /formateurs` |
| Création d'un formateur | ✅ | ✅ | ✅ | — | 🟡 | mot de passe aléatoire + **invitation par e-mail** |
| Modification d'un formateur | ✅ | ✅ | ✅ | — | ✅ | `PATCH /formateurs/{id}` |
| Suppression d'un formateur | ⛔ | ⛔ | — | — | ⛔ | aucune route DELETE |
| CRUD langues + niveaux ouverts | ✅ | ✅ | ✅ | — | ✅ | `DELETE` → 409 si la langue est utilisée |
| CRUD niveaux | ✅ | ✅ | ✅ | — | ✅ | idem |
| Tableau de bord (KPI, courbe, répartition) | ✅ | 🟡 | ✅ | — | 🟡 | courbe et répartition réelles ; **compteur d'ateliers toujours 0** |

### 2.4 Facturation

| Fonctionnalité | Front | Back | Base | IA | Verdict | Preuve / limite |
| --- | :-: | :-: | :-: | :-: | :-: | --- |
| Catalogue public des formules | ✅ | ✅ | ✅ | — | ✅ | `GET /formules`, tri par prix |
| Choix de formule à l'inscription | ✅ | ✅ | ✅ | — | ✅ | `formule_langue` vide = toutes les langues |
| Quotas copiés à la souscription | — | ✅ | ✅ | — | ✅ | modifier une formule ne change pas les abonnements |
| Paiement / facture | ⛔ | ⛔ | ⛔ | — | ⛔ | aucun code |
| Résiliation / renouvellement | ⛔ | ⛔ | — | — | ⛔ | aucune route |
| Administration des formules | ⛔ | ⛔ | ✅ | — | ⛔ | les formules viennent du seed uniquement |

### 2.5 Diagnostic

| Fonctionnalité | Front | Back | Base | IA | Verdict | Preuve / limite |
| --- | :-: | :-: | :-: | :-: | :-: | --- |
| Choix de la langue et disponibilité | ✅ | ✅ | ✅ | — | ✅ | `GET /diagnostic/langues` |
| Questions du niveau | ✅ | ✅ | ✅ | — | ✅ | `GET /diagnostic/questions` |
| Création d'une tentative | ✅ | ✅ | ✅ | — | ✅ | une **nouvelle** tentative à chaque appel |
| Enregistrement des réponses | ✅ | ✅ | ✅ | — | ✅ | unicité `(tentative, question)` |
| Score et niveau final | ✅ | ✅ | ✅ | — | ✅ | déterministe, seuils 20/40/60/75/90 |
| Test adaptatif | ⛔ | ⛔ | — | — | ⛔ | niveau de départ figé au premier niveau ouvert |
| Test long (15 min, 8 QCM + oral + écrit) | 🧪 | ⛔ | ⛔ | — | 🧪 | plan simulé côté frontend ; en réel **2 questions** |
| Réponses orales | 🟡 | ⛔ | ⛔ | — | 🔌 | enregistrement navigateur, backend refuse l'audio (422) |
| Réponses écrites corrigées | ✅ | 🟡 | ⛔ | — | 🟡 | type `texte` accepté et stocké, **jamais corrigé** |
| Reprise d'un test interrompu | 🟡 | ⛔ | — | — | 🔌 | frontend appelle deux routes absentes ; E2E les simule |
| Abandon d'une tentative | 🟡 | ⛔ | — | — | 🔌 | idem |
| Justification détaillée du niveau | 🔌 | ⛔ | — | — | 🔌 | `ScoreDiagnosticOut` n'a pas de champ `justification` |
| Analyse IA (points faibles, phase) | 🟡 | ✅ | ✅ | ✅ | 🟡 | best-effort ; partielle par défaut (`factice`) |
| Compétences par domaine | ✅ | ✅ | ✅ | — | ✅ | **calcul backend**, pas IA |
| Historique des tentatives | ⛔ | ⛔ | ✅ | — | ⛔ | données présentes, aucune route de liste |

### 2.6 Intelligence artificielle

| Fonctionnalité | Front | Back | Base | IA | Verdict | Preuve / limite |
| --- | :-: | :-: | :-: | :-: | :-: | --- |
| `POST /diagnostic/evaluer` (agent Diagnostic) | — | ✅ | — | ✅ | ✅ | enveloppe validée, budget 45 s |
| Harness (enveloppes, budget, erreurs) | — | — | — | ✅ | ✅ | `harness/execution.py` |
| Prompts versionnés + empreinte | — | — | — | ✅ | ✅ | `diagnostic/evaluation@1.1.0` |
| Fournisseur `compatible-openai` | — | — | — | ✅ | ✅ | adaptateur testé |
| Fournisseur `gemini` | — | — | — | ✅ | ✅ | adaptateur testé |
| Fournisseur `factice` en démonstration | — | — | — | 🟡 | 🟡 | aucun scénario par défaut → `LLM_CONFIGURATION` (500) |
| Chatbot `POST /chatbot/message` | ⛔ | ⛔ | — | ✅ | 🔌 | route IA + prompt + tests, **aucun appelant** |
| Mémoire de conversation | ⛔ | ⛔ | — | ⛔ | ⛔ | service sans état ; historique renvoyé à chaque appel |
| RAG CECRL | — | — | — | 🔌 | 🔌 | `RAG_CORPUS_ACTIF=false`, corpus absent |
| Modèles entraînés locaux | — | — | — | ⛔ | ⛔ | `ia-service/models/` vide |
| Authentification backend → IA | — | ⛔ | — | ⛔ | ⛔ | port 8001 publié sans jeton |
| Quota / limitation d'appels LLM | — | ⛔ | — | ⛔ | ⛔ | aucun compteur |

### 2.7 Pédagogie à venir

| Fonctionnalité | Front | Back | Base | IA | Verdict | Preuve / limite |
| --- | :-: | :-: | :-: | :-: | :-: | --- |
| Parcours issu du diagnostic | ⛔ | ⛔ | 🔌 | — | ⛔ | 3 tables créées, 0 ligne, aucune route |
| Exercices et progression | ⛔ | ⛔ | 🔌 | — | ⛔ | idem |
| Ateliers | ⛔ | ⛔ | 🔌 | — | ⛔ | table vide ; seul le compteur admin la lit |
| Réservations d'atelier | ⛔ | ⛔ | ⛔ | — | ⛔ | entrée « Bientôt » |
| Formations | ⛔ | ⛔ | ⛔ | — | ⛔ | entrée « Bientôt » |
| Mes cours (apprenant) | ⛔ | ⛔ | ⛔ | — | ⛔ | entrée « Bientôt » |
| Mes séances / mes apprenants (formateur) | ⛔ | ⛔ | ⛔ | — | ⛔ | entrées « Bientôt » |
| Rapports | ⛔ | ⛔ | ⛔ | — | ⛔ | entrée « Bientôt » |
| Paramètres | ⛔ | ⛔ | ⛔ | — | ⛔ | entrée « Bientôt » |

### 2.8 Exploitation

| Fonctionnalité | Front | Back | Base | IA | Verdict | Preuve / limite |
| --- | :-: | :-: | :-: | :-: | :-: | --- |
| Stack Docker complète | — | ✅ | ✅ | ✅ | ✅ | `docker compose up --build -d --wait` |
| Healthchecks | — | ✅ | ✅ | ✅ | ✅ | `/health` sur 8000 et 8001, `pg_isready`, Redis |
| Migrations automatiques | — | ✅ | ✅ | — | ✅ | `alembic upgrade head` à chaque démarrage |
| Seed idempotent | — | ✅ | ✅ | — | ✅ | `SEED_DEMO=true` par défaut avec Compose |
| CI (front, E2E, back, IA, Docker) | ✅ | ✅ | — | ✅ | ✅ | `.github/workflows/ci.yml` |
| Couverture ≥ 70 % | — | ✅ | — | ✅ | ✅ | `--cov-fail-under=70` sur les deux services Python |
| Sauvegarde automatique | — | ⛔ | ⛔ | — | ⛔ | `BACKUP_*` dans `.env.example` sans code |
| Rétention / purge | — | ⛔ | ⛔ | — | ⛔ | ni tentatives, ni `analyse_ia` |
| Anonymisation / RGPD | — | ⛔ | ⛔ | — | ⛔ | aucune |
| Métriques / traces | — | ⛔ | — | ⛔ | ⛔ | journaux seulement |
| Redis | — | 🔌 | 🔌 | — | 🔌 | démarré, jamais lu |
| E-mails réels | — | 🟡 | — | — | 🟡 | SMTP absent → lien d'invitation dans les logs |
| Accessibilité | 🟡 | — | — | — | 🟡 | tests dédiés, pas d'audit complet |

---

## 3. Les cinq choses à retenir

1. **Le socle est solide** : authentification, RBAC, profil, administration, langues/niveaux, formules et
   diagnostic déterministe fonctionnent de bout en bout, avec base réelle et tests.
2. **Le diagnostic est court** : 2 questions en A1 avec le seed. Ce n'est pas un test de 15 minutes, c'est une
   démonstration de chaîne complète.
3. **L'IA est branchée mais facultative** : sans fournisseur configuré, tout continue, avec un « Résultat
   partiel ». C'est un choix d'architecture, pas un bug.
4. **Trois fonctionnalités sont prêtes mais non branchées** : chatbot, RAG, administration des rôles. Le code
   existe, l'appelant manque.
5. **Tout le reste est explicitement absent** : ateliers, réservations, formations, parcours, paiement,
   sauvegardes, rétention.

---

## 4. Parcours de démonstration en 10 minutes

### 4.1 Préparation (2 min)

```powershell
docker compose up --build -d --wait
docker compose ps
```

Attendu : `db`, `redis`, `backend`, `ia-service`, `frontend` en `healthy` ou `running`.

```powershell
Invoke-RestMethod http://localhost:8000/health   # {"status":"ok","service":"backend"}
Invoke-RestMethod http://localhost:8001/health   # {"status":"ok","service":"ia-service"}
```

### 4.2 Côté administrateur (3 min)

1. <http://localhost:3000> → `admin@digitheque.mg` / `Demo2026`.
2. Tableau de bord : compteurs, courbe des inscriptions (30 jours), répartition par langue.
   **À dire** : le compteur d'ateliers est à 0 parce qu'aucun atelier n'existe.
3. Utilisateurs : filtrer, ouvrir une fiche, changer un statut.
4. Formateurs : la création envoie une invitation — sans SMTP, le lien est **dans les logs**.
5. Langues et niveaux : montrer les 5 langues et les 12 niveaux ; tenter de supprimer une langue utilisée →
   **409**.

### 4.3 Côté apprenant (3 min)

1. Se déconnecter, se reconnecter avec `apprenant@digitheque.mg` / `Demo2026`.
2. Lancer le test de positionnement, choisir **anglais**.
3. Répondre aux **2 questions** A1.
4. Terminer : score, pourcentage, niveau, compétences s'affichent.
5. **À dire** : sans `LLM_FOURNISSEUR` configuré, le bandeau « Résultat partiel » est normal ; les points
   faibles et la phase d'assimilation nécessitent un vrai fournisseur.

### 4.4 Côté contrats (2 min)

| URL | Ce que l'on montre |
| --- | --- |
| <http://localhost:8000/docs> | 32 routes backend, le contrat réel |
| <http://localhost:8001/docs> | 2 routes IA + `/health` |
| `docs/api/contrat-frontend.md` | le contrat de référence, y compris les routes à implémenter |

### 4.5 Ce qu'il ne faut **pas** promettre

- « le test dure 15 minutes » → faux en réel ;
- « l'IA analyse toujours les réponses » → faux par défaut ;
- « on peut reprendre un test interrompu » → non branché ;
- « le chatbot est disponible » → non branché ;
- « les ateliers sont gérés » → table vide, aucune route.

---

## 5. Vérification en 10 minutes (checklist)

Cocher chaque ligne ; si une ligne échoue, le diagnostic est dans le chapitre indiqué.

| # | Vérification | Commande | Attendu | Si échec |
| :-: | --- | --- | --- | --- |
| 1 | Stack démarrée | `docker compose ps` | 5 services | 01 |
| 2 | Santé backend | `Invoke-RestMethod http://localhost:8000/health` | `status: ok` | 01 |
| 3 | Santé IA | `Invoke-RestMethod http://localhost:8001/health` | `service: ia-service` | 01 |
| 4 | Frontend en mode réel | `docker compose exec frontend printenv NEXT_PUBLIC_API_MOCK` | `false` | 01 / 04 |
| 5 | Migrations à jour | `docker compose exec backend alembic current` | une seule tête | 03 |
| 6 | Seed chargé | `docker compose exec db psql -U admin -d centre_langues -c "SELECT count(*) FROM question;"` | `35` | 03 |
| 7 | Connexion admin | interface ou `POST /auth/login` | 200 + jeton | 02 |
| 8 | RBAC | apprenant sur `GET /users` | **403** | 02 |
| 9 | Diagnostic complet | interface apprenant | score + niveau | 02 / 04 |
| 10 | Analyse IA dégradée | terminer un test | « Résultat partiel » | 05 |
| 11 | Route IA directe | `POST /diagnostic/evaluer` | 500 `LLM_CONFIGURATION` | 05 |
| 12 | Tests backend | `docker compose ... run --rm backend pytest` | vert, ≥ 70 % | 02 |
| 13 | Tests frontend | `cd frontend; npm run check` | vert | 04 |
| 14 | Tests IA | `docker compose ... run --rm ia-service pytest` | vert | 05 |

> Rappel Windows : les cibles `make` utilisent `--user "$(id -u):$(id -g)"`, indisponible sous PowerShell.
> Utiliser directement `docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm <service> …`.

---

## 6. Risques classés

### 6.1 P0 — à corriger avant toute mise en production

| Risque | Effet | Correctif attendu |
| --- | --- | --- |
| `SEED_DEMO=true` par défaut | comptes `Demo2026` en production | forcer `false` dans l'environnement de prod |
| Port 8001 sans authentification | n'importe qui consomme la clé LLM | jeton interne ou réseau privé |
| Photos servies sans contrôle | fuite d'image par URL | route authentifiée ou URL signée |
| Aucune sauvegarde | perte totale sur `down --volumes` | `pg_dump` planifié + test de restauration |
| Aucune limitation de débit | bruteforce, coût LLM | reverse proxy ou middleware |
| Pas de déconnexion serveur | jeton volé valide jusqu'à expiration | liste de révocation ou jetons courts + refresh |

### 6.2 P1 — à traiter avant une démonstration officielle

| Risque | Effet |
| --- | --- |
| Deux routes de reprise absentes | écran « test interrompu » en erreur |
| `justification` jamais renvoyée | bloc de résultat vide |
| Seed à 2 questions par langue en A1 | test trop court pour convaincre |
| `factice` sans scénario | analyse IA toujours partielle |
| README `ia-service` obsolète | contredit le code |
| Mocks à 50 questions vs seed à 35 | démonstration non reproductible en réel |

### 6.3 P2 — dette assumée

| Risque | Effet |
| --- | --- |
| Redis inutilisé | ressource consommée pour rien |
| `formule.service.ts` hors `endpoints.ts` | contrat dispersé |
| Vocabulaire `vocabulaire` non mappé côté IA | réponses ignorées dans l'analyse |
| Pas de métriques | diagnostic de latence difficile |
| Tables `parcours` / `atelier` inertes | schéma en avance sur le code |

---

## 7. Ce que chaque couche apporte à la démonstration

| Couche | Ce qu'elle prouve | Ce qu'elle ne prouve pas |
| --- | --- | --- |
| Docker | la stack démarre seule, migrations et seed compris | la charge, la haute disponibilité |
| Base | 22 tables, contraintes, seed idempotent | la qualité pédagogique des questions |
| Backend | règles métier, RBAC, scoring déterministe | la robustesse sous concurrence |
| Frontend | parcours complets, gardes de rôle, mocks | la sécurité (le backend seul protège) |
| IA | contrat d'enveloppe, validations, dégradation propre | la qualité des réponses d'un LLM réel |
| CI | non-régression sur les quatre briques | les performances |

---

## 8. Feuille de route minimale pour « tout brancher »

Dans l'ordre de coût croissant :

1. **Reprise de test** : deux routes backend (`en-cours`, `abandonner`) + un champ `statut`.
2. **`justification`** : exposer `niveau_estime` et un texte de justification dans `ScoreDiagnosticOut`.
3. **Chatbot** : une route backend qui relaie `/chatbot/message` + un panneau frontend.
4. **Administration des rôles** : un écran qui consomme `GET /roles` et `PUT /roles/{id}/permissions`.
5. **Banque de questions** : fournir des questions A1→C2 pour `zh`, `it`, `de`, et plus de 2 par niveau.
6. **Fournisseur LLM** : configurer `compatible-openai` ou `gemini` dans l'environnement de démonstration.
7. **RAG** : fournir le corpus CECRL hors dépôt et activer `RAG_CORPUS_ACTIF`.
8. **Parcours et ateliers** : routes, écrans, données — le chantier le plus lourd.

---

## Questions de compréhension

1. Une fonctionnalité a un backend ✅, une base ✅ et un frontend ⛔. Quel verdict global lui donnes-tu, et
   pourquoi ? Cite un exemple de la matrice.
2. Pourquoi le tableau de bord administrateur est-il classé 🟡 alors que la courbe des inscriptions et la
   répartition par langue fonctionnent réellement ?
3. Le chatbot a une route IA ✅, un prompt ✅ et des tests ✅, mais le verdict est 🔌. Qu'est-ce qui manque
   exactement pour le passer en ✅, et dans quelles couches ?
4. Un jury demande « le test de positionnement dure-t-il 15 minutes ? ». Quelle réponse donnes-tu, en
   distinguant le mode simulé du mode réel ?
5. Classe ces trois risques du plus grave au moins grave, en justifiant : `SEED_DEMO=true` en production,
   Redis inutilisé, absence de route de reprise de test.
