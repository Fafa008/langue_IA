# Guide de contribution

Merci de contribuer au projet **Centre de Langues IA — La Digithèque** !

Ce guide explique comment travailler efficacement avec l'équipe.

---

## 📋 Table des matières

- [Avant de commencer](#-avant-de-commencer)
- [Workflow Git](#-workflow-git)
- [Convention de commits](#-convention-de-commits)
- [Pull Requests](#-pull-requests)
- [Revue de code](#-revue-de-code)
- [Tests](#-tests)
- [Intégration et livraison continues](#-intégration-et-livraison-continues)
- [Communication](#-communication)
- [Questions](#-questions)

---

## 🚀 Avant de commencer

1. Lire le [README.md](README.md)
2. Installer Git et Docker Desktop (Windows/macOS) ou Docker Engine (Linux) avec Docker Compose 2.20+.
   Python 3.11 et Node.js 22 ne sont nécessaires qu'en installation locale facultative.
3. Cloner le dépôt :
   ```bash
   git clone https://github.com/Fafa008/langue_IA.git
   cd langue_IA
   ```
4. Configurer votre environnement :
   ```bash
   cp .env.example .env
   ```
   Sous PowerShell : `Copy-Item .env.example .env`.
5. Démarrer avec `make dev` (Linux/macOS), `.\scripts\dev.ps1 dev` (PowerShell), ou
   `bash scripts/dev.sh dev` (WSL2/Git Bash). `make doctor` / `.\scripts\dev.ps1 doctor` vérifie les prérequis.
6. Rejoindre le Trello et les canaux de communication

L’équipe travaille dans Docker ou le devcontainer VS Code/Codespaces pour conserver le même environnement sur
Linux, macOS (Intel/Apple Silicon) et Windows/WSL2. Les conteneurs utilisent Python 3.11 et Node 22. Un venv local
est facultatif ; si vous en utilisez un, installez exactement Python 3.11 (`.python-version`) avec uv ou pyenv.
Python 3.14 système n’est pas compatible avec toutes les wheels verrouillées.

---

## 🌿 Workflow Git

### 1. Se placer sur `develop`

```bash
git checkout develop
git pull origin develop
```

### 2. Créer une branche

```bash
git checkout -b feature/US-XX-nom-court
```

**Convention de nommage :**

- `feature/US01-inscription-utilisateur`
- `bugfix/US58-correction-reservation`
- `hotfix/correction-faille-securite`

### 3. Développer

- Commits réguliers et atomiques
- Messages clairs (voir convention)
- Tests unitaires

### 4. Pousser

```bash
git push origin feature/US-XX-nom-court
```

### 5. Créer une Pull Request

- Base : `develop`
- Compare : `feature/US-XX-nom-court`
- Titre : `[US-XX] Description courte`
- Description : remplir le template
- Reviewers : 1 minimum (2 pour l'IA)

### 6. Après approbation

- Merger dans `develop`
- Supprimer la branche

---

## 📝 Convention de commits

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

**Exemples concrets :**

```bash
git commit -m "feat(auth): ajout endpoint POST /auth/register"
git commit -m "fix(diagnostic): correction calcul score CECRL"
git commit -m "docs(readme): mise à jour installation"
git commit -m "test(ia): ajout tests modèle recommandation"
git commit -m "chore(deps): mise à jour scikit-learn 1.4"
```

---

## 🔀 Pull Requests

### Template de PR

```markdown
## Description

Brève description de la fonctionnalité.

## User Story

US-XX : [lien vers Trello]

## Changements

- [ ] Ajout de ...
- [ ] Modification de ...
- [ ] Suppression de ...

## Tests

- [ ] Tests unitaires
- [ ] Tests d'intégration
- [ ] Tests manuels

## Captures d'écran

[si applicable]

## Checklist

- [ ] Le code compile
- [ ] Les tests passent
- [ ] La documentation est à jour
- [ ] Pas de conflit avec develop
```

### Règles

- **1 reviewer minimum** (2 pour l'IA)
- **Délai de revue** : 24h maximum
- **Pas de merge** sans approbation
- **Pas de merge** si la CI est rouge (voir [Intégration et livraison continues](#-intégration-et-livraison-continues))
- **Résoudre les conflits** avant la revue
- **Supprimer la branche** après merge

---

## 👀 Revue de code

### Critères

| Critère            | Vérification              |
| ------------------ | ------------------------- |
| **Lisibilité**     | Code clair, bien nommé    |
| **Fonctionnalité** | Fait ce qu'il doit faire  |
| **Tests**          | Couvre les cas principaux |
| **Performance**    | Pas de boucle inutile     |
| **Sécurité**       | Pas de faille             |
| **Documentation**  | Commentaires utiles       |
| **Style**          | Respect des conventions   |

### Bonnes pratiques

- Commentaires **constructifs**
- Expliquer le **pourquoi**, pas le **quoi**
- Proposer des **alternatives**
- Valider les **bonnes pratiques**

---

## 🧪 Tests

Tous les tests doivent passer avant de créer une Pull Request.

### Backend

```bash
make test            # ou bash scripts/dev.sh test ; PowerShell : .\scripts\dev.ps1 test
```

### Suite complète (recommandé avant une PR)

```bash
make check           # backend + IA + frontend, dans les images Docker de développement
# Sans make :
bash scripts/dev.sh check
# Windows PowerShell :
.\scripts\dev.ps1 check
```

### IA

```bash
make test-ia         # ou bash scripts/dev.sh test-ia ; PowerShell : .\scripts\dev.ps1 test-ia
```

Le job CI `make check` couvre Ruff, `ruff format --check`, pytest et la couverture minimale de 70 % pour backend et
IA, ainsi que typage, lint et Jest pour le frontend. La CI teste aussi les tests unitaires IA sous variables
d’environnement polluées sur Linux, macOS et Windows. Les tests backend utilisent PostgreSQL de test et n’appellent
pas réellement le service IA.

Les tests E2E Playwright nécessitent Node.js 22 et Chromium installés localement :

```bash
cd frontend
npm ci
npm run test:e2e
```

### Tests manuels

- Tester les endpoints avec Swagger (`http://localhost:8000/docs`)
- Tester les pages frontend
- Vérifier les cas d'erreur

---

## 🤖 Intégration et livraison continues

Les workflows GitHub Actions sont dans [`.github/workflows/`](.github/workflows/). Résultats : onglet **Actions**
du dépôt, et directement dans chaque Pull Request.

### CI — `ci.yml`

Lancée sur **chaque Pull Request** (y compris une PR dont la base est une autre branche `feature/…`), sur chaque
push vers `develop` et `main`, et à la main (Actions › CI › Run workflow). Un nouveau push annule l'exécution
précédente de la même branche.

| Job          | Vérifie                                                                | Équivalent local                                |
| ------------ | ---------------------------------------------------------------------- | ----------------------------------------------- |
| `frontend`   | typage, lint, tests Jest, build de production                          | `cd frontend && npm run check && npm run build` |
| `e2e`        | tests Playwright (bureau et mobile)                                    | `cd frontend && npm run test:e2e`               |
| `backend`    | ruff (lint et formatage), pytest sur PostgreSQL, **couverture ≥ 70 %** | `make test`                                     |
| `ia-service` | ruff, tests Pydantic, **couverture ≥ 70 %**, chargement              | `cd ia-service && pytest`                       |
| `docker`     | build des images, démarrage de toute la stack, réponse des services    | `make up`                                       |

En cas d'échec : ouvrir le job en rouge pour lire l'erreur. Le job `e2e` joint les traces Playwright (artefact
`playwright-traces`, à ouvrir avec `npx playwright show-trace`), le job `docker` affiche les journaux des conteneurs.

### CD — `cd.yml`

Sur chaque push vers `main` (merge d'une release) et sur chaque tag `vX.Y.Z`, publie les images de production sur le
registre GitHub (onglet **Packages** du dépôt) :

| Image                                  | Tags                                                       |
| -------------------------------------- | ---------------------------------------------------------- |
| `ghcr.io/fafa008/langue_ia-frontend`   | `latest` et `sha-<commit>` (main) ; `X.Y.Z` et `X.Y` (tag) |
| `ghcr.io/fafa008/langue_ia-backend`    | idem                                                       |
| `ghcr.io/fafa008/langue_ia-ia-service` | idem                                                       |

- L'adresse de l'API intégrée au frontend vient de la variable de dépôt `NEXT_PUBLIC_API_URL`
  (Settings › Secrets and variables › Actions › Variables) ; sans elle, `http://localhost:8000`.
- Publier une version : `git tag v1.0.0 && git push origin v1.0.0`.
- Le déploiement sur un serveur n'est pas encore automatisé : il suffira d'y lancer `docker compose pull && docker compose up -d`
  avec ces images, une fois le serveur choisi.

### Réglages GitHub conseillés (administrateur du dépôt)

- **Settings › Branches** : protéger `develop` et `main` en exigeant les jobs `frontend`, `e2e`, `backend`,
  `ia-service` et `docker` avant tout merge.
- **Settings › Actions › General** : autoriser les workflows à écrire dans les packages (publication des images).

---

## 💬 Communication

### Canaux

| Canal                | Usage                | Fréquence          |
| -------------------- | -------------------- | ------------------ |
| **Daily stand-up**   | Avancement quotidien | Tous les jours, 9h |
| **Trello**           | Suivi des tâches     | Continu            |
| **GitHub Issues**    | Bugs et features     | Continu            |
| **WhatsApp / Slack** | Communication rapide | Continu            |
| **Google Meet**      | Réunions             | Selon besoin       |

### Règles

1. **Privilégier Trello** pour le suivi des tâches
2. **Utiliser GitHub Issues** pour les bugs
3. **Répondre dans les 24h** sur les canaux
4. **Documenter les décisions** importantes
5. **Éviter les communications privées** pour les décisions d'équipe

---

## ❓ Questions

Contacter :

- **Chef de projet** : [email]
- **IA Engineer (M2)** : [email]

---

**Merci de contribuer au projet !** 🎉
