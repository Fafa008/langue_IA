# Chatbot : revue des tâches ClickUp, conception et planification

**Centre Langues IA · La Digithèque**
Source : export ClickUp `resume_taches_fa6c63.csv` (218 tâches) et analyse de l'agent Chatbot sur `develop`.

Ce document fait trois choses, dans cet ordre : il vérifie les tâches ClickUp liées au chatbot, il revoit la conception de l'agent avant tout développement, puis il planifie chaque tâche par phases.

---

## 1. Revue des tâches ClickUp

### 1.1 Constat général

Une quarantaine de tâches concernent le chatbot. Toutes sont à faire, sauf une. Elles sont réparties entre les sprints 4, 5 et 6, mais elles forment une seule fonctionnalité. Presque aucune n'est assignée.

### 1.2 Incohérences à corriger

| # | Constat | Tâches concernées | Action |
|---|---|---|---|
| I-1 | Une tâche est marquée « complete » alors que la route backend n'existe pas. Elle est assignée à Finoana. | `[Sprint 6] US67 – API chatbot` (123t3hvzezx) | Vérifier ce qu'elle couvre. Si c'est la route du service IA seule, renommer en « Route IA » et rouvrir la tâche backend. |
| I-2 | US75 existe en double : une tâche au sprint 5, une au sprint 6 (priorité basse) | `[Sprint 5] US75-BE` (123t3hw0f4h) et `[Sprint 6] US75 – Tables log/scenario` (123t3hvzezy) | Marquer le doublon du sprint 6 (à traiter comme les autres doublons). |
| I-3 | Le parent « US73 » et la tâche « US73-FE » existent toutes deux | 123t3hw0f4d et 123t3hw0f4u | Garder la tâche FE comme seule tâche de travail, le parent sert de regroupement. |
| I-4 | Le relais backend est nommé « US74-BE », alors qu'il sert toute la route chat (et non seulement les corrections) | 123t3hw0f4q | Renommer en « Relais chat backend (route, auth, timeout) » et le rattacher à la fonctionnalité chat. |
| I-5 | Aucune tâche n'existe pour le jeton interne, le port 8001, le quota | — | Créer les tâches (section 4). |
| I-6 | Aucune tâche n'existe pour la gestion de l'historique de session côté backend | — | Créer. |
| I-7 | Aucune tâche n'existe pour la réponse de démonstration du chatbot | — | Créer, ou rattacher à « US161-BE » (mode démo). |
| I-8 | La tâche « Bilan de fin de session » dépend du journal du chat, mais elle est présentée comme une tâche à part | 123t3hw0f4f, 123t3hw0f4y, 123t3hw0f4z | La garder dans une phase optionnelle. |
| I-9 | Les tâches US160 (thème) sont dans le même lot que le chat, alors qu'elles relèvent d'un mode distinct | 123t3hw0f4e à 123t3hw0f4x | Les séparer en phase optionnelle. |
| I-10 | La quasi-totalité des tâches chatbot n'a pas de responsable | toutes | Assigner (section 5). |

### 1.3 Tâches à fermer ou fusionner

- Fusionner les deux tâches « Environnement de recette du chat » et « Test de recette » si elles ont le même périmètre.
- Fermer le doublon US75 du sprint 6, après vérification.
- Ne rien supprimer : marquer, fusionner ou archiver, comme demandé précédemment.

---

## 2. Revue de la conception de l'agent Chatbot

### 2.1 Ce qui existe aujourd'hui

| Élément | État | Référence |
|---|---|---|
| Route `POST /chatbot/message` sur le service IA | Réel | `ia-service/app/api/chatbot.py` |
| Consigne `chatbot/conversation@1.0.0` | Réel, sortie : `{"reponse": ...}` | `ia-service/app/prompts/chatbot/` |
| Schéma d'entrée : message 2 000 caractères, 20 tours d'historique | Réel | `ia-service/app/schemas/chatbot.py` |
| Scénarios de la bibliothèque : quotidien, examen, entretien | Réel (exemples) | `ia-service/app/prompts/exemples/` |
| Relais backend, authentification, quota | Absent | — |
| Réponse de démonstration pour le chatbot | Absent | `ia-service/app/llm/demonstration.py` ne couvre que le diagnostic |
| Interface : envoi réel | Absent (mock) | `frontend/src/services/endpoints.ts` : « à créer » |
| Correction en marge | Absent côté sortie IA | La consigne ne renvoie que `reponse` |

### 2.2 Ce que la conception doit trancher

Ces points doivent être décidés avant de coder. Ils ne sont pas tous techniques.

**D1. Qui produit la correction en marge ?**
Deux options : (a) l'agent Chatbot renvoie, avec sa réponse, un bloc `corrections[]` ; (b) un agent Correction séparé. Recommandation : (a). Le bloc est limité à trois corrections au plus, chacune avec `extrait`, `correction`, `explication`. Il est validé par schéma avant affichage. La correction des exercices (US157) reste distincte, car elle porte sur une réponse fermée ou un texte attendu.

**D2. Où vit l'historique de conversation ?**
Le service IA n'a pas de mémoire : l'historique doit être fourni à chaque appel. Deux options : (a) le frontend le garde et l'envoie (20 tours au plus) ; (b) le backend le garde en session, et l'envoie au service IA. Recommandation : (b), car le backend contrôle l'authentification, le quota et la durée de conservation. Le texte brut ne doit pas être stocké durablement (RG11). Il est supprimé à la fin de la session, ou après une durée courte fixée par décision.

**D3. Que journalise-t-on ?**
Pour chaque échange : horodatage, scénario, durée, modèle, version de la consigne, nombre de corrections. Aucun texte brut de l'apprenant, ni de la réponse, dans le journal persistant. Cette règle protège la traçabilité sans conserver de données personnelles.

**D4. Quel est le lien entre scénario et langue ?**
La bibliothèque contient trois scénarios : quotidien, examen, entretien. L'apprenant choisit un scénario (US73) et la langue vient du diagnostic. Le scénario ne change pas le niveau visé : le niveau du contexte reste celui de l'apprenant.

**D5. Le mode thème fait-il partie du chat ?**
Non, c'est un mode distinct : une traduction, trois variantes, un refus avant la leçon 50. Il a sa propre consigne et son propre schéma. Il reste optionnel et sacrifiable.

**D6. Le bilan de session est-il du chatbot ?**
Il est produit à partir du journal de la session. Il dépend donc du chat, mais il n'est pas nécessaire pour un chat fonctionnel. Il est optionnel. Recommandation : le garder en phase optionnelle.

### 2.3 Architecture cible

```
Apprenant
   |
Frontend (chat, corrections en marge, choix du scénario)
   |  HTTPS, JWT
Backend : route /chatbot/message
   |  authentification, quota, validation de la requête
   |  historique de session (D2), journal anonymisé (D3)
   |  jeton interne
Service IA : /chatbot/message (non publié)
   |  Harness : validation entrée et sortie, délai, reprise bornée, repli
   |  Agent Chatbot : consigne 1.1.0 (réponse + corrections[])
   |
Modèle de langage (ou réponse de démonstration)
```

Principes :
- le navigateur ne parle jamais au service IA ;
- le service IA n'écrit jamais en base ;
- le backend décide de ce qui est enregistré ;
- chaque réponse du modèle est validée avant d'être affichée.

### 2.4 Ce qui change dans la consigne

- Passer de `chatbot/conversation@1.0.0` à une version `1.1.0` qui renvoie `reponse` et `corrections[]` (au plus 3).
- Le schéma de sortie est étendu en conséquence, avec les mêmes règles stricts que les autres agents.
- La validation par l'expert IA est obligatoire avant intégration (règle déjà fixée pour les prompts).

### 2.5 Ce qui ne doit pas être présenté comme acquis

- La correction en marge : aucune sortie ne la produit aujourd'hui.
- La réponse en moins de 2 secondes (RG13) : elle n'a jamais été mesurée.
- L'échange réel depuis l'interface : le relais n'existe pas.

---

## 3. Planification par phases

Les phases ne sont pas des sprints. Elles s'enchaînent selon les dépendances. Taille : S (petit), M (moyen), L (grand).

### Phase 0 : décisions (avant tout développement)

| ID | Décision | Qui | Taille |
|---|---|---|---|
| D1 à D6 | Voir section 2.2 | Product Owner, expert IA | S |

**Condition de fin :** décisions écrites et reportées dans cette revue.

### Phase 1 : prérequis de sécurité et de gouvernance

| ID | Tâche | Existant dans ClickUp ? | Taille | Dépend de | Condition de fin |
|---|---|---|---|---|---|
| P1-1 | Jeton interne entre backend et service IA ; fermeture du port 8001 | Non, à créer | M | — | Un appel sans jeton est refusé ; le port n'est plus publié |
| P1-2 | Politique de quota par apprenant et table | Non, à créer | M | D-quota | Un dépassement renvoie `QUOTA_DEPASSE` (test) |
| P1-3 | Validation de l'expert IA du mode chat et du mode thème | Oui : PRE-S5-01 (Fafa) | S | — | Validation écrite |
| P1-4 | Confirmation que la route `chatbot/message` est appelable | Oui : PRE-S5-05 | S | P1-1 | Appel réussi depuis le backend (test) |
| P1-5 | Environnement de recette du chat | Oui : DEV-ENV | S | P1-1 | Environnement accessible par toute l'équipe |

### Phase 2 : conception IA

| ID | Tâche | Existant ? | Taille | Dépend de | Condition de fin |
|---|---|---|---|---|---|
| P2-1 | Consigne `chatbot/conversation@1.1.0` avec `corrections[]` (au plus 3) | Oui : US74-IA (Fafa) | M | D1, P1-3 | Consigne versionnée, validée par l'expert |
| P2-2 | Schéma de sortie étendu, validation stricte | Oui : US74-IA | S | P2-1 | Champ inattendu rejeté (test) |
| P2-3 | Réponse de démonstration du chatbot | Non, à créer | S | — | Route répond en démonstration, étiquetée |
| P2-4 | Tests unitaires de l'agent : consigne, limites, schéma | Partiel (test_chatbot.py) | S | P2-2 | Tests exécutés, résultats consignés |

### Phase 3 : backend

| ID | Tâche | Existant ? | Taille | Dépend de | Condition de fin |
|---|---|---|---|---|---|
| P3-1 | Route `POST /api/v1/chatbot/message` : authentification, validation (2 000 caractères, 20 tours) | Oui : US67-BE (à faire) | M | P1-1 | Requête non authentifiée refusée ; trop longue refusée |
| P3-2 | Relais vers le service IA : jeton, délai, erreurs structurées | Oui : US74-BE (à renommer) | M | P3-1, P2-2 | Panne du service IA renvoie une erreur structurée |
| P3-3 | Historique de session (D2) | Non, à créer | M | D2, P3-1 | L'historique envoyé est borné à 20 tours ; supprimé à la fin de session |
| P3-4 | Quota | Non, à créer | S | P1-2 | Test du dépassement |
| P3-5 | Journal anonymisé (D3) : tables et enregistrement | Oui : US68-BE, US75-BE | M | D3 | Aucun texte brut dans le journal (test) |
| P3-6 | Filtre d'anonymisation avant appel | Oui : US132-BE | M | — | Phrases piégées rejetées ou masquées |
| P3-7 | Réponse de démonstration reliée au backend | Non, à créer (ou via US161-BE) | S | P2-3 | Mode démo sans clé fonctionne |

### Phase 4 : frontend

| ID | Tâche | Existant ? | Taille | Dépend de | Condition de fin |
|---|---|---|---|---|---|
| P4-1 | Interface de chat : texte, historique, saisie, envoi réel | Oui : US72-FE | M | P3-1 | Un message est envoyé et une réponse affichée |
| P4-2 | Affichage des corrections en marge | Oui : US74-FE | M | P4-1, P2-1 | Une correction s'affiche sans bloquer la conversation |
| P4-3 | Choix du scénario et de la langue | Oui : US73-FE | S | P4-1 | Le scénario choisi est transmis |
| P4-4 | Avertissement sur l'envoi de l'historique au fournisseur | Non, à créer | S | P4-1 | Visible avant le premier message |
| P4-5 | Retrait du mock du chat | Non, à créer | S | P4-1 | Aucun appel mock pour le chat |

### Phase 5 : qualité et validation

| ID | Tâche | Existant ? | Taille | Dépend de | Condition de fin |
|---|---|---|---|---|---|
| P5-1 | Test d'intégration du relais (backend vers service IA) | Non, à créer | M | P3-2 | Test exécuté, vert |
| P5-2 | Test bout en bout du dialogue | Oui : QA-E2E | M | P4-2 | Dialogue complet, vert |
| P5-3 | Mesure de latence | Oui : QA-LAT | S | P5-2 | Mesure consignée ; objectif fixé après mesure |
| P5-4 | Phrases piégées sur le chat | Oui : US132-QA | S | P3-6 | Aucune donnée personnelle dans le journal |
| P5-5 | Test que le journal ne contient aucune donnée personnelle | Oui : US68-QA | S | P3-5 | Test vert |

### Phase 6 : optionnel, séparé du chat

| ID | Tâche | Existant ? | Taille | Dépend de |
|---|---|---|---|---|
| O-1 | Mode thème : consigne, route, écran | Oui : US160-IA, US160-BE, US160-FE | M | P2 |
| O-2 | Bilan de fin de session | Oui : BILAN-IA, BILAN-BE | M | P3-5 |

---

## 4. Tâches à créer dans ClickUp

| Nom proposé | Phase | Pourquoi |
|---|---|---|
| [Chatbot] Jeton interne backend↔IA et fermeture du port 8001 | 1 | Faille de sécurité |
| [Chatbot] Politique et table de quota | 1 | Limiter la consommation par apprenant |
| [Chatbot] Historique de session côté backend | 3 | Le service IA n'a pas de mémoire (D2) |
| [Chatbot] Réponse de démonstration | 2 | Démo sans clé |
| [Chatbot] Avertissement sur l'envoi de l'historique | 4 | Transparence sur les données (RG11) |
| [Chatbot] Retrait du mock du chat | 4 | Éviter un chat simulé présenté comme réel |
| [Chatbot] Test d'intégration du relais | 5 | Couvrir la chaîne backend vers service IA |

Un fichier d'import est fourni avec cette revue, sous le nom `ClickUp_Import_Chatbot_Taches_a_creer.csv`.

---

## 5. Responsables proposés

| Équipe | Tâches |
|---|---|
| Expert IA | P1-3, P2-1, P2-2, P2-3, P2-4, O-1 (consigne et relecture) |
| Backend | P1-1, P1-2, P3-1 à P3-7, P5-1, O-2 |
| Frontend | P4-1 à P4-5, O-1 (écran) |
| DevOps / QA | P1-4, P1-5, P5-2 à P5-5 |
| Product Owner | Phase 0 (décisions D1 à D6) |

---

## 6. Risques

| Risque | Effet | Réponse |
|---|---|---|
| Le modèle dépasse 2 secondes | La latence ne respecte pas RG13 | Mesurer tôt (P5-3) ; fixer l'objectif réel après mesure et le dire dans le mémoire |
| La correction en marge ne sort pas du modèle proprement | L'interface affiche une erreur | Repli : afficher la réponse seule, sans correction, avec mention |
| L'expert IA est le seul à valider les prompts | Goulot | Prioriser P2-1 ; le reste de la chaîne peut avancer avec une consigne provisoire et une démo |
| Le quota est reporté | Consommation non contrôlée | Ne pas ouvrir le chat à l'extérieur sans P1-2 |

---

## 7. Décisions à obtenir

1. D1 : correction en marge dans l'agent Chatbot (recommandé).
2. D2 : historique côté backend, supprimé à la fin de session (recommandé).
3. D3 : journal sans texte brut (recommandé).
4. D4 : scénario choisi par l'apprenant, niveau issu du diagnostic.
5. D5 : mode thème séparé et optionnel.
6. D6 : bilan de session optionnel.
7. Valeur du quota (nombre d'échanges ou de minutes par apprenant).
8. Durée de conservation de l'historique de session.
