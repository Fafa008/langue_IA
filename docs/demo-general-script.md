# Script de démonstration générale — mémoire

Ce script accompagne la démonstration frontend de 15 scénarios, complétée par six cas limites.
Il suppose une stack démarrée avec `make dev`, `SEED_DEMO=true` et les mocks désactivés côté
comptes de démonstration (voir `docs/demo-general-configuration.md`). Aucun mock applicatif ne doit
être activé pour masquer une erreur : les seules données simulées visibles portent un badge explicite.

Durée recommandée : 12 à 15 minutes. Comptes : `apprenant@digitheque.mg`,
`formateur@digitheque.mg`, `admin@digitheque.mg` — mot de passe `Demo2026`.

## Déroulé

| # | Étape | Action | Ce qu'il faut montrer / dire |
| --- | --- | --- | --- |
| 1 | Connexion | Ouvrir `/login`, saisir le compte apprenant, cliquer sur **Se connecter**. | Redirection vers l'espace apprenant et salutation personnalisée. Le JWT ne porte que l'identité : le rôle et le statut sont relus côté backend. |
| 2 | Tableau de bord | Observer les raccourcis et la zone « modules non livrées ». | Les raccourcis actifs mènent au diagnostic, au parcours, à la progression et au chat. Ateliers, inscriptions et paramètres sont signalés **Bientôt** : rien n'est simulé silencieusement. |
| 3 | Test de positionnement | Ouvrir **Test de positionnement**, choisir l'anglais, puis **Commencer le test** et **Lancer le test**. Répondre aux questions, **Question suivante**, puis **Finaliser le test**. | Le frontend appelle uniquement le backend ; chaque réponse est enregistrée. Le jeu de démonstration est volontairement court, même si le test annonce 15 minutes. |
| 4 | Résultat du diagnostic | Lire l'écran de résultats. | Le niveau et le score viennent du scoring backend. Si le service d'analyse IA est indisponible, un état partiel reste lisible sans détail technique ni erreur pour l'apprenant. |
| 5 | Parcours personnalisé | Cliquer sur **Commencer mon parcours**, puis ouvrir **Mon parcours**. | La langue, le niveau cible, la leçon et les modules sont cohérents avec le diagnostic. |
| 6 | Exercice corrigé | Ouvrir la leçon, sélectionner une réponse au QCM, cliquer sur **Valider ma réponse**. | La correction et le feedback arrivent immédiatement ; le bouton de validation disparaît après correction. |
| 7 | Recommandations | Sur le parcours, cliquer sur **Afficher mes recommandations**. | Afficher le statut, la langue, le niveau cible, l'action prioritaire et le lien vers la leçon. Si le service IA ne fournit rien, le message 『Aucune action ciblée cette fois』 remplace une erreur. |
| 8 | Tuteur IA | Ouvrir **Tuteur IA**, écrire un message, l'envoyer, puis **Terminer et voir le rapport**. | Une session backend est ouverte pour la conversation et fermée à la fin. Montrer la traduction et l'explication françaises affichées à côté de chaque réponse, le quota restant et la synthèse locale **Synthèse indicative** : ce n'est pas une évaluation certificative. |
| 9 | Progression | Revenir sur **Ma progression**. | Le résultat réellement enregistré par le diagnostic est affiché à part des **Indicateurs simulés** ; ne pas présenter ces derniers comme des données backend. |
| 10 | Profil | Ouvrir **Mon profil** depuis l'espace apprenant. | Consultation accessible ; la photo et les informations viennent du backend. |
| 11 | Formateur | Se reconnecter avec le compte formateur, ouvrir **Apprenants**. | La liste porte le badge **Données simulées** : il n'existe pas encore d'API de suivi des apprenants par formateur. |
| 12 | Synthèse formateur | Ouvrir **Synthèse des erreurs**. | La synthèse est signalée **Synthèse simulée** ; le bilan réel est annoncé **Bientôt**. |
| 13 | Administration | Se reconnecter avec le compte admin, ouvrir le tableau de bord. | Les statistiques et la courbe des inscriptions sont alimentées par l'API backend. Les tuiles donnent accès à la gestion des utilisateurs, formateurs, rôles et formules. |
| 14 | Pages légales | Sans session, ouvrir `/conditions`, `/confidentialite` et `/faq`. | Les trois pages sont accessibles : CGU, politique de confidentialité et FAQ, notamment sur la dictée facultative et la panne IA. |
| 15 | Responsive | Sur les écrans clés, réduire la fenêtre ou passer en vue mobile. | Aucun débordement horizontal ; la navigation et les cartes restent lisibles. |

## Cas limites à montrer si le temps le permet

1. **API indisponible** : le parcours affiche « Le serveur est injoignable » avec **Réessayer**, sans déconnecter l'apprenant.
2. **Session expirée** : un `401` sur `/users/me` efface la session et ramène à `/login?session=expiree` avec un message explicite.
3. **Réponse IA invalide** : l'exercice de rédaction affiche un message simple, conserve la saisie et ne montre aucun détail technique.
4. **Aucune recommandation** : la section recommandations reste rassurante et dépourvue d'alerte.
5. **Micro refusé** : un message précise que le micro est bloqué ; la saisie écrite reste disponible. Aucun audio n'est envoyé au serveur.
6. **IA indisponible sur le chat** : le message dédié s'affiche sans détail technique ; l'apprenant peut réécrire et réessayer.

## Limites à annoncer explicitement

- Reprise et abandon d'un diagnostic interrompu : routes backend absentes.
- Suivi formateur réel : pas d'API ni de RBAC dédié ; les écrans correspondants sont simulés et badgés.
- Historique des diagnostics et des leçons : non livré ; seule la progression peut être reconstruite depuis le store de diagnostic.
- Validation vocale formateur, génération automatique d'exercices, streaming LLM et score oral certificatif : hors périmètre de la démonstration.

## Vérification avant soutenance

```bash
cd frontend
npm run check
npm run test:e2e
```

La couverture E2E de ce script est regroupée dans `frontend/e2e/demo-general.spec.ts` : 21 scénarios
(15 étapes et 6 cas limites) exécutés sur les projets Playwright `desktop` et `mobile`. Le serveur de
test force `NEXT_PUBLIC_API_MOCK=false` et `NEXT_PUBLIC_PARCOURS_MOCK=false` : les appels sont
interceptés conformément au contrat backend, jamais redirigés vers `src/mocks`.
