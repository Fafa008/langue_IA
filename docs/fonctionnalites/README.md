# Fonctionnalités et démarrage — Centre de Langues IA (La Digithèque)

> Constat fondé sur l'inspection du code au **14 novembre 2026**.
> Ce dossier répond à une question simple : **qu'est-ce qui fonctionne réellement, et qu'est-ce qui n'est
> qu'ébauché ?**
> Il ne décrit pas le produit rêvé : il décrit le comportement du dépôt, couche par couche.

---

## 1. À quoi sert ce dossier

La documentation d'architecture (`docs/architecture/`) explique **comment** le code est construit.
Ce dossier explique **ce que l'on peut faire** avec ce code, et **ce qu'il faut mettre en route** pour le voir.

Trois lecteurs y trouvent leur compte :

| Lecteur | Question | Chapitre conseillé |
| --- | --- | --- |
| Développeur qui reprend le projet | « Je lance quoi, et qu'est-ce que je peux montrer ? » | 01 puis 06 |
| Étudiant qui doit comprendre le système | « Où s'arrête le fonctionnel, où commence le prévu ? » | 02 → 05 puis 06 |
| Relecteur de PR / jury | « Quelles preuves dans le code ? » | chaque tableau + 06 |

---

## 2. Légende des verdicts

Chaque fonctionnalité reçoit **un seul** verdict principal. Le verdict est volontairement sévère :
« le code existe » ne suffit pas, il faut que la chaîne complète fonctionne.

| Verdict | Signification | Exemple |
| --- | --- | --- |
| ✅ **Fonctionnel** | La chaîne complète marche avec le backend, la base et le frontend réels. | Connexion, inscription, profil, CRUD des langues |
| 🟡 **Partiel** | La chaîne existe mais une partie est limitée, incomplète ou dégradée. | Diagnostic (2 questions, non adaptatif), analyse IA (dépend d'un vrai fournisseur) |
| 🔌 **Non branché** | Le code existe mais aucun appelant ne l'utilise, ou l'appel échoue systématiquement. | Chatbot IA, reprise de test, `justification` du résultat |
| ⛔ **Absent** | Aucun code, aucune route, aucune table utile. | Ateliers, réservations, paiements, parcours exposés |
| 🧪 **Simulé** | Fonctionne uniquement avec `NEXT_PUBLIC_API_MOCK=true`. | Tableau de bord apprenant/formateur, banque de 50 questions |

> **Piège à connaître** : « présent dans l'interface » ≠ « fonctionnel ».
> Plusieurs écrans affichent des cartes marquées **« Bientôt »** : elles ne mènent nulle part, volontairement.

---

## 3. Vue d'ensemble en une page

### 3.1 Les cinq briques

```
Navigateur
   │  HTTP :3000
   ▼
Frontend Next.js 14 ── HTTP :8000 ──► Backend FastAPI ── SQL ──► PostgreSQL 16
   (Zustand, React Query,               (JWT, RBAC,               (22 tables)
    services, mocks)                     diagnostic)
                                            │
                                            │ HTTP :8001 (analyse du diagnostic)
                                            ▼
                                      Service IA FastAPI
                                      (Harness, agents, LLM, RAG)
                                            │
                                            └── Redis (démarré, non utilisé)
```

### 3.2 Ce qui marche vraiment

| Domaine | Fonctionnalité | Verdict | Preuve principale |
| --- | --- | --- | --- |
| Authentification | Inscription d'un apprenant + abonnement | ✅ | `POST /auth/register`, `auth.py` |
| Authentification | Connexion JWT | ✅ | `POST /auth/login`, `deps.py` |
| Authentification | Mot de passe oublié / réinitialisation | ✅ | `POST /auth/forgot-password`, `/reset-password` |
| Profil | Lire / modifier son profil | ✅ | `GET`/`PATCH /users/me` |
| Profil | Photo (envoi, suppression, lecture publique) | ✅ | `/users/me/photo`, `StaticFiles` `/media` |
| Sécurité | RBAC : 3 rôles, 9 permissions | ✅ | `roles`, `permissions`, `permission_requise` |
| Administration | Liste / modification / (dés)activation des utilisateurs | ✅ | `GET`/`PATCH /users` |
| Administration | Liste / création / modification des formateurs | ✅ | `/formateurs` + invitation par e-mail |
| Pédagogie | CRUD langues (avec niveaux ouverts) | ✅ | `/langues` |
| Pédagogie | CRUD niveaux | ✅ | `/niveaux` |
| Facturation | Catalogue public des formules | ✅ | `GET /formules` |
| Tableau de bord | Statistiques administrateur | ✅ | `GET /admin/statistiques` |
| Diagnostic | Langues disponibles + questions + réponses + score | 🟡 | `/diagnostic/*` (2 questions, non adaptatif) |
| Diagnostic | Analyse IA (points faibles, phase, compétences) | 🟡 | dépend de `LLM_FOURNISSEUR` ; partiel par défaut |
| Diagnostic | Reprise / abandon d'un test interrompu | 🔌 | routes absentes côté backend |
| Diagnostic | Justification détaillée du niveau | 🔌 | le backend ne renvoie jamais `justification` |
| Chatbot IA | `POST /chatbot/message` | 🔌 | aucune route backend/frontend ne l'appelle |
| Ateliers / réservations | Gestion | ⛔ | table `atelier` vide, aucune route |
| Parcours | Tables `parcours`, `exercice` | ⛔ | aucune route, aucun écran |
| Abonnements | Souscription automatique à l'inscription | ✅ | `Abonnement` créé dans `register` |
| Abonnements | Paiement / facturation | ⛔ | aucun code |
| E-mails | Envoi réel | 🟡 | sans SMTP, le lien est écrit dans les logs |
| Cache / limites | Redis, rate limiting | 🔌 | Redis tourne, aucun code ne le lit |
| Démarrage | Stack Docker complète | ✅ | `docker compose up --build -d --wait` |
| CI/CD | Front, E2E, back, IA, Docker | ✅ | `.github/workflows/ci.yml` |

### 3.3 Le parcours de démonstration en 10 minutes

1. `docker compose up --build -d --wait` (ou `make up`).
2. Ouvrir <http://localhost:3000>, se connecter avec `admin@digitheque.mg` / `Demo2026`.
3. Montrer le tableau de bord, les utilisateurs, les formateurs, les langues et niveaux.
4. Se déconnecter, se reconnecter avec `apprenant@digitheque.mg` / `Demo2026`.
5. Lancer le test de positionnement en anglais : le backend pose **2 questions** (niveau A1).
6. Terminer : le score et le niveau s'affichent ; l'analyse IA est **partielle** tant qu'aucun fournisseur LLM
   n'est configuré.
7. Ouvrir <http://localhost:8000/docs> pour montrer le contrat réel.
8. Ouvrir <http://localhost:8001/docs> pour montrer le service IA.

Le détail pas à pas est dans [`06-matrice-fonctionnalites.md`](06-matrice-fonctionnalites.md).

---

## 4. Sommaire des chapitres

| Fichier | Contenu | Verdicts couverts |
| --- | --- | --- |
| [01-demarrage-docker.md](01-demarrage-docker.md) | Prod vs dev, ports, volumes, healthchecks, entrypoint, seed, commandes, dépannage Windows | Ce qui démarre, ce qui ne démarre pas |
| [02-backend.md](02-backend.md) | Routes, JWT, RBAC, diagnostic, scoring, services, erreurs, tests | Backend fonctionnel / partiel / absent |
| [03-base-de-donnees.md](03-base-de-donnees.md) | 22 tables, migrations, seed, matrice peuplé/vide, inspection psql | Données réellement présentes |
| [04-frontend.md](04-frontend.md) | Pages, gardes de rôle, chaîne service → hook → composant, mocks, E2E | Écrans réels vs « Bientôt » |
| [05-ia-service.md](05-ia-service.md) | Harness, agents, prompts, fournisseurs LLM, RAG, budgets, enveloppes | IA branchée / non branchée |
| [06-matrice-fonctionnalites.md](06-matrice-fonctionnalites.md) | Matrice fonctionnalité × couche, parcours de démo, checklist de vérification | Synthèse et preuves |
| [07-fonctionnalites-par-role.md](07-fonctionnalites-par-role.md) | Tout ce que chaque rôle peut faire, les 32 routes par rôle, le parcours de démo par rôle | Droits réels vs droits apparents |

Ordre de lecture conseillé : **01 → 06** pour une démonstration, **01 → 02 → 03 → 04 → 05 → 06** pour comprendre.
Le chapitre 07 est la synthèse « par rôle » : à lire après le 02 (backend) et le 04 (frontend), ou juste avant
une démonstration pour savoir qui peut montrer quoi.

---

## 5. Règles de lecture

1. **Le code fait foi.** Quand un README contredit le code, c'est le code qui est décrit ici ; l'écart est signalé.
   Exemple : `ia-service/README.md` affirme que l'agent Diagnostic n'a pas de route HTTP, alors que
   `POST /diagnostic/evaluer` existe.
2. **Les chiffres viennent du seed et des migrations**, pas d'une base vivante : Docker n'était pas lancé au moment
   de la rédaction. Chaque chiffre est reproductible avec les commandes du chapitre 03.
3. **Les verdicts sont datés.** Une fonctionnalité « absente » peut apparaître dans une PR ultérieure ; la date et
   la branche de référence sont indiquées en tête de chaque chapitre.
4. **Aucun secret n'est recopié.** Les clés LLM, mots de passe de production et jetons ne figurent jamais ici.

---

## 6. Ce que ce dossier n'est pas

- Ce n'est pas une spécification : les besoins futurs sont dans le backlog et `docs/uml/evolutions.md`.
- Ce n'est pas un tutoriel d'installation détaillé : le pas à pas minimal est dans le `README.md` racine.
- Ce n'est pas un audit de sécurité complet : les risques sont signalés, mais aucun test d'intrusion n'a été mené.

---

## Questions de compréhension

1. Pourquoi une fonctionnalité dont le code existe peut-elle être classée **🔌 Non branché** plutôt que
   **✅ Fonctionnelle** ? Donne un exemple du tableau.
2. Quelle différence fais-tu entre **🟡 Partiel** et **🧪 Simulé** ? Cite un cas de chaque.
3. Un écran affiche une carte « Bientôt » : que se passe-t-il si l'on clique dessus, et pourquoi ce choix ?
4. Pourquoi les chiffres de ce dossier sont-ils vérifiables même sans base de données démarrée ?
