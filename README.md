# 🎓 Centre de Langues IA — La Digithèque

> **Système d'information intelligent pour un centre hybride d'apprentissage des langues (IA + encadrement humain)**  
> Fianarantsoa, Haute Matsiatra, Madagascar

[![GitHub](https://img.shields.io/badge/GitHub-langue__IA-blue)](https://github.com/Fafa008/langue_IA)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Status](https://img.shields.io/badge/Status-En%20d%C3%A9veloppement-orange)]()

---

## 📋 Table des matières

- [Présentation](#-présentation)
- [Architecture](#-architecture)
- [Stack technique](#-stack-technique)
- [Installation](#-installation)
- [Organisation de l'équipe](#-organisation-de-léquipe)
- [Méthodologie de travail](#-méthodologie-de-travail)
- [Conventions Git](#-conventions-git)
- [Workflow de développement](#-workflow-de-développement)
- [Revue de code](#-revue-de-code)
- [Communication](#-communication)
- [Structure du projet](#-structure-du-projet)
- [Sprints](#-sprints)
- [Documentation](#-documentation)

---

## 🎯 Présentation

Ce projet vise à concevoir et développer un **système d'information intelligent** pour un centre hybride d'apprentissage des langues combinant :

- 🤖 **Intelligence artificielle** : diagnostic de niveau, recommandation, chatbot conversationnel
- 👨‍🏫 **Encadrement humain** : ateliers de conversation, préparation aux certifications
- 🌍 **Cinq langues** : français, anglais, mandarin, italien, allemand
- 🏆 **Certifications** : DELF/DALF, IELTS/TOEFL/TOEIC, HSK/HSKK, Goethe-Zertifikat, CILS/CELI/PLIDA

**Porté par** : La Digithèque, Andrainjato, Fianarantsoa

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────┐
│              FRONTEND (Next.js 14)                   │
│              Port 3000                               │
│         React + TypeScript + Tailwind                │
└────────────────────┬────────────────────────────────┘
                     │ REST API
┌────────────────────▼────────────────────────────────┐
│           BACKEND (FastAPI)                          │
│           Port 8000                                  │
│     Python 3.11 + SQLAlchemy + Pydantic              │
│     JWT Auth + RBAC                                  │
└────────────────────┬────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼──────┐ ┌───▼────────┐ ┌▼──────────────┐
│  PostgreSQL  │ │  Redis     │ │  Microservice │
│  Port 5432   │ │  Port 6379 │ │  IA (FastAPI) │
│              │ │  (cache)   │ │  Interne      │
└──────────────┘ └────────────┘ └───────┬───────┘
                                        │
                          ┌─────────────┼─────────────┐
                          │             │             │
                    ┌─────▼─────┐ ┌─────▼─────┐ ┌────▼──────┐
                    │ Diagnostic│ │Recommand. │ │  Chatbot  │
                    │ sklearn   │ │embeddings │ │  GPT API  │
                    └───────────┘ └───────────┘ └───────────┘
```

---

## 🛠 Stack technique

| Couche              | Technologie             | Version  |
| ------------------- | ----------------------- | -------- |
| **Frontend**        | Next.js                 | 14+      |
| **UI**              | React + TypeScript      | 18+ / 5+ |
| **Styles**          | Tailwind CSS            | 3+       |
| **State**           | Zustand / React Query   | —        |
| **Backend**         | FastAPI                 | 0.110+   |
| **ORM**             | SQLAlchemy              | 2+       |
| **Validation**      | Pydantic                | 2+       |
| **Auth**            | JWT (python-jose)       | —        |
| **Base de données** | PostgreSQL              | 15+      |
| **Migrations**      | Alembic                 | —        |
| **Cache**           | Redis                   | 7+       |
| **IA**              | scikit-learn            | 1.4+     |
| **IA**              | OpenAI API / Mistral    | —        |
| **Conteneurs**      | Docker + Docker Compose | 24+      |
| **CI/CD**           | GitHub Actions          | —        |
| **Tests Back**      | pytest + httpx          | —        |
| **Tests Front**     | Jest + Playwright       | —        |

---

## 🚀 Installation

### Prérequis

- Git
- Docker Desktop/Docker Engine **24+** avec le plugin Docker Compose **2.20+**
- `make` est facultatif. Python et Node.js locaux ne sont pas nécessaires pour développer ou tester dans Docker.
- Pour les outils locaux facultatifs : Python **3.11** et Node.js **22** (`.python-version` et `.nvmrc`).

### Démarrage rapide

Après avoir cloné le dépôt, copiez l’exemple de configuration. Il ne contient aucune vraie clé API : le fournisseur
LLM factice et les secrets de démonstration suffisent pour le développement local.

**Linux (Ubuntu) et macOS** — depuis un terminal à la racine :

```bash
cp .env.example .env
make dev
```

Sans `make` : `bash scripts/dev.sh dev`.

**Windows** — PowerShell avec Docker Desktop utilisant WSL2 :

```powershell
Copy-Item .env.example .env
.\scripts\dev.ps1 dev
```

Pour travailler dans WSL2, clonez le dépôt dans le système de fichiers Linux de la distribution, puis utilisez les
commandes Linux (`make dev` ou `bash scripts/dev.sh dev`). VS Code et GitHub Codespaces peuvent aussi ouvrir le
dépôt dans le devcontainer, qui utilise les images Compose de développement.

La stack de développement démarre PostgreSQL, Redis, backend, service IA et frontend avec rechargement à chaud.
Docker choisit automatiquement une image compatible avec `linux/amd64` ou `linux/arm64` (Apple Silicon).

| Action | Linux/macOS | Windows PowerShell |
|---|---|---|
| Démarrer en développement | `make dev` ou `bash scripts/dev.sh dev` | `.\scripts\dev.ps1 dev` |
| Démarrer en arrière-plan | `make up` ou `bash scripts/dev.sh up` | `.\scripts\dev.ps1 up` |
| Arrêter, conserver les données | `make down` ou `bash scripts/dev.sh down` | `.\scripts\dev.ps1 down` |
| Tests backend | `make test` ou `bash scripts/dev.sh test` | `.\scripts\dev.ps1 test` |
| Tests IA | `make test-ia` ou `bash scripts/dev.sh test-ia` | `.\scripts\dev.ps1 test-ia` |
| Vérifications complètes CI | `make check` ou `bash scripts/dev.sh check` | `.\scripts\dev.ps1 check` |
| Diagnostic des prérequis | `make doctor` ou `bash scripts/dev.sh doctor` | `.\scripts\dev.ps1 doctor` |
| Seed de démonstration | `make seed` ou `bash scripts/dev.sh seed` | `.\scripts\dev.ps1 seed` |
| Effacer les volumes et données | `make reset` ou `bash scripts/dev.sh reset` | `.\scripts\dev.ps1 reset` |

Frontend : `http://localhost:3000`. Backend et Swagger : `http://localhost:8000` et `/docs`. Le service IA reste
privé sur le réseau Docker (`back-tier`), sans port hôte. En mode dev, PostgreSQL et Redis sont accessibles sur
`localhost:55432` et `localhost:56379`.

### Versions locales facultatives

Les services et la CI utilisent Python 3.11 ; Python système 3.14 n’est pas pris en charge pour les installations
locales (certaines dépendances épinglées n’ont pas encore de wheel). Le plus simple est de rester dans Docker ou le
devcontainer. Pour un venv local, installez Python 3.11 avec [uv](https://docs.astral.sh/uv/) ou pyenv avant
d’installer les dépendances :

```bash
uv python install 3.11
uv venv --python 3.11 .venv
uv pip install --python .venv/bin/python -r backend/requirements-dev.txt
.venv/bin/python scripts/verifier_python.py
```

Sur Windows, utilisez `.venv\Scripts\python.exe` à la place de `.venv/bin/python`. Node local, si nécessaire, doit
être en version 22 (`nvm use` lit `.nvmrc`).

### Dépannage

- **Port déjà occupé :** modifiez `FRONTEND_PORT`, `BACKEND_PORT`, `POSTGRES_HOST_PORT` ou `REDIS_HOST_PORT` dans
  `.env`, puis relancez Compose. Les URL frontend/backend et les origines CORS sont déduites des ports si
  `NEXT_PUBLIC_API_URL`, `FRONTEND_URL` et `BACKEND_CORS_ORIGINS` restent vides. L’IA n’a volontairement pas de
  port hôte.
- **Python 3.14 / échec de `pip install`:** ne contournez pas l’échec en changeant les versions verrouillées ;
  utilisez Docker, le devcontainer ou un venv Python 3.11.
- **Permissions Docker sous Linux :** vérifiez que le moteur tourne et que votre utilisateur peut exécuter
  `docker info` (groupe `docker` ou installation rootless). Déconnectez/reconnectez votre session après un changement
  de groupe. `make doctor` détaille les prérequis.
- **`.env` absent :** exécutez `cp .env.example .env` (PowerShell : `Copy-Item .env.example .env`). Ne versionnez
  jamais `.env`.
- **« No module named … » après un changement de dépendances :** `make dev` ou `scripts/dev.ps1 dev` reconstruit
  les images. Les conteneurs dev ne redémarrent pas automatiquement après un redémarrage de la machine.
- **Windows / fins de ligne :** `.gitattributes` force LF pour les scripts et fichiers exécutés dans les conteneurs.
  Le service IA répond à `/health` uniquement depuis le backend ou un conteneur du réseau privé.
- **Modèles IA :** placez les artefacts non versionnés dans `ia-service/models/`, montés en lecture seule.

---

## 👥 Organisation de l'équipe

### Membres

| Membre   | Rôle                                      | Niveau | Mémoire |
| -------- | ----------------------------------------- | ------ | ------- |
| [Nom 1]  | Chef de projet                            | —      | Non     |
| **Fafa** | **IA Engineer + Architecte**              | **M2** | **Oui** |
| [Nom 3]  | Junior Dev (Frontend + Ateliers)          | L3     | Oui     |
| [Nom 4]  | Backend Dev 1 (Abonnements + Facturation) | —      | Non     |
| [Nom 5]  | Backend Dev 2 (Parcours + Progression)    | —      | Non     |
| [Nom 6]  | Mathématicien (Scoring + Analytics)       | —      | Non     |

### Responsabilités par module

| Module                    | Responsable principal | Support        |
| ------------------------- | --------------------- | -------------- |
| Architecture système      | IA Engineer (M2)      | Tous           |
| Authentification & RBAC   | IA Engineer (M2)      | Backend Dev 1  |
| Diagnostic IA             | IA Engineer (M2)      | Mathématicien  |
| Recommandation IA         | IA Engineer (M2)      | Mathématicien  |
| Chatbot IA                | IA Engineer (M2)      | —              |
| Parcours & Progression    | Backend Dev 2         | IA Engineer    |
| Ateliers & Réservations   | Junior Dev (L3)       | Backend Dev 2  |
| Abonnements & Facturation | Backend Dev 1         | —              |
| Frontend Next.js          | Junior Dev (L3)       | Tous           |
| Analytics & KPI           | Mathématicien         | Backend Dev 2  |
| Base de données           | Backend Dev 1 + 2     | IA Engineer    |
| DevOps & CI/CD            | Backend Dev 1         | Chef de projet |
| Documentation             | Chef de projet        | Tous           |

---

## 🔄 Méthodologie de travail

### Framework : Scrum adapté

| Élément              | Détail                       |
| -------------------- | ---------------------------- |
| **Sprints**          | 1 semaine (5 jours ouvrés)   |
| **Daily stand-up**   | 9h00, 15 minutes             |
| **Revue de sprint**  | Vendredi 16h00, 1 heure      |
| **Rétrospective**    | Vendredi 17h00, 30 minutes   |
| **Backlog grooming** | Mercredi 15h00, 1 heure      |
| **Outils**           | Trello, GitHub, Google Drive |

### Rituels

#### Daily stand-up (15 min)

1. Qu'ai-je fait hier ?
2. Que vais-je faire aujourd'hui ?
3. Ai-je des blocages ?

#### Revue de sprint (1 h)

- Démo des fonctionnalités terminées
- Validation avec le Product Owner
- Mise à jour du backlog

#### Rétrospective (30 min)

- Ce qui a bien marché
- Ce qui doit être amélioré
- Actions concrètes

### Definition of Done (DoD)

Une tâche est **terminée** si :

- [ ] Le code est écrit et fonctionnel
- [ ] Les tests unitaires passent (couverture > 70%)
- [ ] Les tests d'intégration passent
- [ ] Le code est revu (Pull Request approuvée)
- [ ] La documentation est à jour
- [ ] Déployé en environnement de test
- [ ] Validé par le Product Owner

### Definition of Ready (DoR)

Une user story est **prête** si :

- [ ] Critères d'acceptation clairs
- [ ] Estimée en points
- [ ] Priorisée
- [ ] Dépendances identifiées
- [ ] Maquettes disponibles (si UI)

---

## 🌳 Conventions Git

### Branches

| Branche             | Rôle                    | Protection |
| ------------------- | ----------------------- | ---------- |
| `main`              | Production stable       | ✅         |
| `develop`           | Intégration continue    | ✅         |
| `feature/US-XX-nom` | Nouvelle fonctionnalité | —          |
| `bugfix/US-XX-nom`  | Correction de bug       | —          |
| `hotfix/nom`        | Correction urgente      | —          |
| `release/vX.Y`      | Préparation de release  | —          |

### Nommage

```
feature/US01-inscription-utilisateur
feature/US29-classification-diagnostic-ia
bugfix/US58-correction-reservation-atelier
hotfix/correction-faille-securite
release/v1.0.0
```

### Convention de commits

Format : `type(scope): description`

| Type       | Usage                   | Exemple                             |
| ---------- | ----------------------- | ----------------------------------- |
| `feat`     | Nouvelle fonctionnalité | `feat(auth): ajout inscription`     |
| `fix`      | Correction de bug       | `fix(diagnostic): correction score` |
| `docs`     | Documentation           | `docs(api): maj Swagger`            |
| `style`    | Formatage               | `style(front): indentation`         |
| `refactor` | Refactoring             | `refactor(ia): optimisation modèle` |
| `test`     | Tests                   | `test(auth): ajout tests JWT`       |
| `chore`    | Maintenance             | `chore(deps): maj dépendances`      |
| `perf`     | Performance             | `perf(ia): accélération inférence`  |
| `ci`       | CI/CD                   | `ci(github): ajout workflow`        |

---

## 🔀 Workflow de développement

### Étapes

```bash
# 1. Se placer sur develop
git checkout develop
git pull origin develop

# 2. Créer une branche feature
git checkout -b feature/US01-inscription

# 3. Développer et commiter
git add .
git commit -m "feat(auth): ajout formulaire inscription"

# 4. Pousser
git push origin feature/US01-inscription

# 5. Créer une Pull Request sur GitHub
#    - Base : develop
#    - Compare : feature/US01-inscription

# 6. Demander une revue (1 reviewer)

# 7. Après approbation, merger dans develop

# 8. Supprimer la branche
git branch -d feature/US01-inscription
git push origin --delete feature/US01-inscription
```

### Règles de Pull Request

- **Titre** : `[US-XX] Description courte`
- **Reviewers** : 1 minimum (2 pour l'IA)
- **Labels** : ajouter les labels
- **Tests** : tous doivent passer
- **Conflits** : résoudre avant la revue

---

## 👀 Revue de code

| Critère            | Vérification                       |
| ------------------ | ---------------------------------- |
| **Lisibilité**     | Code clair, bien nommé             |
| **Fonctionnalité** | Fait ce qu'il doit faire           |
| **Tests**          | Couvre les cas principaux          |
| **Performance**    | Pas de boucle inutile, pas de N+1  |
| **Sécurité**       | Pas de faille (XSS, SQLi, etc.)    |
| **Documentation**  | Commentaires sur parties complexes |
| **Style**          | Respect des conventions            |

**Règles :**

- 1 reviewer minimum (2 pour l'IA)
- Délai de revue : 24h maximum
- Pas de merge sans approbation

---

## 💬 Communication

| Canal                | Usage                  | Fréquence          |
| -------------------- | ---------------------- | ------------------ |
| **Daily stand-up**   | Avancement quotidien   | Tous les jours, 9h |
| **Trello**           | Suivi des tâches       | Continu            |
| **GitHub Issues**    | Bugs et features       | Continu            |
| **WhatsApp / Slack** | Communication rapide   | Continu            |
| **Google Meet**      | Réunions               | Selon besoin       |
| **Email**            | Communication formelle | Selon besoin       |

---

## 📁 Structure du projet

```
langue_IA/
│
├── .github/
│   └── workflows/              # CI/CD GitHub Actions
│
├── backend/                    # API FastAPI
│   ├── app/
│   │   ├── api/               # Routes
│   │   ├── core/              # Config, sécurité
│   │   ├── models/            # Modèles SQLAlchemy
│   │   ├── schemas/           # Schémas Pydantic
│   │   ├── services/          # Logique métier
│   │   └── main.py            # Point d'entrée
│   ├── alembic/               # Migrations
│   ├── tests/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── README.md
│
├── frontend/                   # Next.js
│   ├── src/
│   │   ├── app/               # App Router
│   │   ├── components/        # Composants React
│   │   ├── lib/               # Utilitaires
│   │   ├── services/          # Appels API
│   │   ├── hooks/             # Hooks custom
│   │   └── types/             # Types TypeScript
│   ├── public/
│   ├── package.json
│   ├── Dockerfile
│   └── README.md
│
├── ia-service/                 # Microservice IA
│   ├── app/
│   │   ├── api/               # Routes IA
│   │   ├── models/            # Modèles ML
│   │   ├── services/          # Logique IA
│   │   └── main.py
│   ├── models/                # Fichiers .pkl
│   ├── tests/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── README.md
│
├── database/                   # Migrations et seeds
│   ├── migrations/
│   ├── seeds/
│   └── README.md
│
├── docs/                       # Documentation
│   ├── architecture/
│   ├── uml/
│   ├── api/
│   └── memoires/
│
├── docker-compose.yml          # Stack complète (images de production)
├── docker-compose.dev.yml      # Surcharge de développement (sources montées)
├── Makefile                    # Raccourcis : make up, make dev, make down…
├── .env.example
├── .gitignore
├── README.md
└── CONTRIBUTING.md
```

---

## 📅 Sprints

| Sprint       | Durée  | Objectif                             | Statut      |
| ------------ | ------ | ------------------------------------ | ----------- |
| **Sprint 0** | 1 sem. | Setup, Git, Docker, maquettes        | 🔄 En cours |
| **Sprint 1** | 1 sem. | Auth + Diagnostic IA                 | ⏳ À venir  |
| **Sprint 2** | 1 sem. | Parcours + Recommandation IA         | ⏳ À venir  |
| **Sprint 3** | 1 sem. | Ateliers + Abonnements + Facturation | ⏳ À venir  |
| **Sprint 4** | 1 sem. | Chatbot IA + Tests + Doc             | ⏳ À venir  |

---

## 📚 Documentation

| Document     | Lien                                     |
| ------------ | ---------------------------------------- |
| Architecture | [docs/architecture/](docs/architecture/) |
| Fonctionnalités et démarrage | [docs/fonctionnalites/](docs/fonctionnalites/) |
| Données      | [docs/donnees/](docs/donnees/)           |
| UML          | [docs/uml/](docs/uml/)                   |
| API          | [docs/api/](docs/api/)                   |
| Mémoires     | [docs/memoires/](docs/memoires/)         |

---

## 📝 Licence

Ce projet est sous licence MIT. Voir [LICENSE](LICENSE) pour plus de détails.

---

**Dernière mise à jour** : Octobre 2025
