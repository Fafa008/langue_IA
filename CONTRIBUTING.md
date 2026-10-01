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
- [Communication](#-communication)
- [Questions](#-questions)

---

## 🚀 Avant de commencer

1. Lire le [README.md](README.md)
2. Installer les prérequis (Git, Docker, Node.js, Python)
3. Cloner le dépôt :
   ```bash
   git clone https://github.com/Fafa008/langue_IA.git
   cd langue_IA
   ```
4. Configurer votre environnement :
   ```bash
   cp .env.example .env
   ```
5. Rejoindre le Trello et les canaux de communication

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
cd backend
pytest
```

### Frontend

```bash
cd frontend
npm test
```

### IA

```bash
cd ia-service
pytest
```

### Tests manuels

- Tester les endpoints avec Swagger (`http://localhost:8000/docs`)
- Tester les pages frontend
- Vérifier les cas d'erreur

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
