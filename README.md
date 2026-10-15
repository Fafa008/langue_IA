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
│              │ │  (cache)   │ │  Port 8001    │
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

- Git 2.40+
- Docker 24+ et Docker Compose 2.20+
- Node.js 20+
- Python 3.11+

### Étapes (Docker)

Tout le monorepo démarre avec une seule commande : PostgreSQL, Redis, backend, service IA et frontend.

```bash
# 1. Cloner le dépôt
git clone https://github.com/Fafa008/langue_IA.git
cd langue_IA

# 2. Copier les variables d'environnement (puis changer les mots de passe et secrets)
cp .env.example .env

# 3. Lancer la stack (images de production, en arrière-plan)
docker compose up --build -d --wait      # ou : make up

# 4. Accéder aux services
# Frontend   : http://localhost:3000
# Backend    : http://localhost:8000      (santé : /health)
# Swagger    : http://localhost:8000/docs
# IA Service : http://localhost:8001      (santé : /health)
# PostgreSQL et Redis : internes à Docker (en mode dev : localhost:55432 et localhost:56379)
```

| Besoin                            | Commande                                                                    | Raccourci               |
| --------------------------------- | --------------------------------------------------------------------------- | ----------------------- |
| Développer (rechargement à chaud) | `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build` | `make dev`              |
| Voir l'état / les journaux        | `docker compose ps` / `docker compose logs -f`                              | `make ps` / `make logs` |
| Arrêter (données conservées)      | `docker compose down`                                                       | `make down`             |
| Repartir d'une base vide          | `docker compose down --volumes`                                             | `make reset`            |

Bon à savoir :

- **Ports déjà utilisés** (un `npm run dev` ou un autre projet) : changer `FRONTEND_PORT`, `BACKEND_PORT` ou
  `IA_PORT` dans `.env`. PostgreSQL et Redis ne sont pas ouverts sur la machine (pas de conflit possible avec un
  PostgreSQL déjà installé) : les services les joignent par leur nom (`db`, `redis`). En mode `dev`, ils sont
  accessibles sur `localhost:55432` et `localhost:56379` (`POSTGRES_HOST_PORT`, `REDIS_HOST_PORT`).
- **Données simulées** : `NEXT_PUBLIC_API_MOCK=true` (par défaut) tant que le backend n'implémente pas
  [`docs/api/contrat-frontend.md`](docs/api/contrat-frontend.md). Cette valeur est intégrée au build du frontend :
  relancer `docker compose up --build` après un changement (en mode `dev`, un simple redémarrage suffit).
- **Backend** : implémente le contrat du frontend (voir [`backend/README.md`](backend/README.md)). Au démarrage, il
  applique les migrations et crée les comptes de démonstration (`admin@digitheque.mg`, `Demo2026`…) si
  `SEED_DEMO=true`. Tests : `make test`. Le **service IA** n'est encore qu'un squelette (route `/health`).
- **Modèles IA** : déposer les fichiers entraînés dans `ia-service/models/` (non versionnés), montés en lecture seule.

### Installation manuelle

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows : venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (fonctionne sans backend grâce aux données simulées : voir frontend/README.md)
cd frontend
npm install
npm run dev

# IA Service
cd ia-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

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
| UML          | [docs/uml/](docs/uml/)                   |
| API          | [docs/api/](docs/api/)                   |
| Mémoires     | [docs/memoires/](docs/memoires/)         |

---

## 📝 Licence

Ce projet est sous licence MIT. Voir [LICENSE](LICENSE) pour plus de détails.

---

**Dernière mise à jour** : Octobre 2025
