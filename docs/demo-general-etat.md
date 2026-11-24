# Demo général — état final (22 novembre 2026)

Ce document est le point d'entrée opérationnel de la démonstration générale. Le code exécutable
reste la source de vérité : `backend/app/api/router.py`, `backend/app/api/routes/*.py`,
`frontend/src/services/endpoints.ts` et `docs/api/contrat-frontend.md`.

Le déroulé à présenter est dans `docs/demo-general-script.md` ; la configuration à utiliser est
dans `docs/demo-general-configuration.md`.

## Documents historiques

Les deux revues suivantes décrivent l'état **avant** l'intégration du relais backend et ne doivent
plus être utilisées pour décider d'une fonctionnalité :

- `docs/Revue_Conception_et_Planification_Chatbot.md`
- `docs/Revue_Conception_et_Planification_Chatbot_v2.md`

Elles sont conservées telles quelles (avec leurs éventuelles modifications locales). Leur verdict
« relais backend absent » est remplacé par `docs/ia/etat-integration-agent-chatbot.md`, lui-même
non versionné et préservé. En cas de désaccord, c'est le code des modules routes qui fait foi.

## Routes backend vérifiées

- **Présentes** : auth, profil/photo, utilisateurs, formules, rôles, statistiques, langues/niveaux,
  diagnostic (5 routes), parcours (5 routes), chatbot (`POST /message`, `DELETE /session/{id}`).
- **Absentes** : `GET /diagnostic/tentatives/en-cours`, `POST /diagnostic/tentatives/{id}/abandonner`.
- **Jamais exposées au frontend** : les 4 routes internes de `ia-service` (`X-IA-Token` obligatoire
  en production). Le navigateur ne parle qu'au backend.

## Lots livrés

| Lot | Contenu |
| --- | --- |
| V0 | Documentation d'état et de configuration, garde-fous de formulaire, pages légales et FAQ. |
| V1 | Session et navigation fiabilisées, variante de bouton `danger` et libellés d'accessibilité. |
| V2 | Diagnostic et recommandations explicites, cycle de session du chat, quota et rapport final, repli vocal et messages d'erreur IA. |
| V4 | Distinction entre résultat réel du diagnostic et indicateurs simulés ; modules non livrés annoncés. |
| V5 | Script de démonstration et couverture E2E des 15 scénarios plus six cas limites. |

## État des écrans

| État | Écrans |
| --- | --- |
| Terminés et prouvés | login, register, mot de passe oublié/réinitialisation, profil, démarrage/déroulement/résultats du diagnostic, parcours, module, leçon, recommandations, chat avec session et rapport, administration (5 écrans), pages légales/FAQ |
| Partiels avec état explicite | tableau de bord apprenant (raccourcis actifs, modules futurs signalés), analyse IA du diagnostic (repli partiel lisible), progression (résultat réel séparé des indicateurs simulés) |
| Simulés avec badge | progression apprenant (indicateurs complémentaires), apprenants formateur, synthèse des erreurs formateur |
| Bloqués par le backend | reprise/abandon du diagnostic, suivi formateur réel (RBAC), historique diagnostics/leçons, validation vocale formateur |
| Hors périmètre MVP | génération automatique d'exercices, streaming LLM, score oral certificatif, audio serveur, ateliers/réservations/facturation |

## Couverture E2E

`frontend/e2e/demo-general.spec.ts` contient 21 tests : les scénarios 1 à 15 du script et six cas
limites (API indisponible, session expirée, réponse IA invalide, aucune recommandation, micro refusé,
IA indisponible). Ils s'exécutent sur les projets Playwright `desktop` et `mobile`. Les appels sont
interceptés conformément au contrat backend, avec `NEXT_PUBLIC_MODE=reel`.

```bash
cd frontend
npm run check
npm run test:e2e
```

## Règles de la demo

1. Ne jamais remplacer une API réelle par un mock pour masquer une erreur.
2. Tout mock affiché à l'écran porte un badge explicite.
3. Aucun score, niveau ou statistique non issu d'une réponse backend ou du store de diagnostic
   n'est présenté comme réel ; les indicateurs complémentaires sont étiquetés comme simulés.
4. Aucune permission RBAC n'est créée côté frontend ni contournée.
5. Les modifications locales préexistantes à ce dépôt sont préservées dans chaque PR.
