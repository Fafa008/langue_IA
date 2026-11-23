# Plan — Test de positionnement MVP (4 compétences, front prioritaire)

**Statut : PHASE 1 LIVRÉE sur les mocks — PR #115 (base `develop`).**
**Date : 23/11/2026.**
**Branche de travail : `feature/test-positionnement-4-competences`.*

## Objectif

Faire passer le test de positionnement existant d'un QCM de grammaire à un test couvrant
**lire, écouter, écrire, parler**, pour les cinq langues présentes (`de`, `en`, `fr`, `it` en CECRL ;
`zh` en HSK), avec une note finale sur 100 et des données exploitables par l'agent diagnostic.

## Principe directeur

**Le frontend est livré en premier, sur les mocks.** Aucune dépendance vers le backend, le contrat IA
ou Whisper n'est nécessaire pour la phase 1 : l'interface, les interactions et l'écran de résultat sont
validés seuls, puis les couches inférieures viennent s'y brancher. Cela respecte la contrainte de temps
et évite de bloquer l'écran sur une décision de transcription vocale non tranchée.

Règle conservée : **le backend calcule la note, l'agent interprète et ne calcule aucun score.**

## Périmètre

- 4 compétences : `lire`, `ecouter`, `ecrire`, `parler`.
- 4 formats : QCM / vrai-faux, dictée audio, texte à trous avec lettres mélangées, phrase à dire au micro.
- 5 langues : `de`, `en`, `fr`, `it` (CECRL), `zh` (HSK, pinyin optionnel).
- Barème proposé : 20 items, 5 par compétence, 5 points chacun = **100**.
- `parler` passe par Whisper/STT ; si la confiance est < 0,7 *(seuil proposé, à valider)*, l'item est écarté,
  le score est recalculé sur 95 et l'agent reçoit `statut: "a_verifier"`.
- Aucune correspondance officielle CECRL↔HSK n'est affirmée : les niveaux restent ceux de la banque.

---

## Phase 1 — FRONTEND (prioritaire)

**Livrable :** un parcours complet jouable en mock, avec les 4 formats et un écran de résultat lisible.

### Changements réalisés

| Domaine | Fichiers | Changement |
|---|---|---|
| Types | `frontend/src/types/test-diagnostic.ts` | `Question.format` optionnel, `lettresMelangees`, `dureeSecondes`, `DonneeAnalyse`, `ReponseTest.sans_reponse`. Les compétences historiques `lecture/ecoute/ecrit/oral` sont conservées : ce sont déjà lire/écouter/écrire/parler. |
| DTO / mapper | `frontend/src/services/test-diagnostic.service.ts` | mappe les nouveaux champs et `donnees_analyse` quand le backend les fournira. Le filtre alpha et le refus audio du **service HTTP** restent en place tant que le backend et le stockage média n'existent pas ; le mock, lui, accepte déjà l'audio. |
| Contrat | `docs/api/contrat-frontend.md` | champs facultatifs documentés comme « phase frontend », sans changer `endpoints.ts` (aucune route nouvelle). |
| Mocks | `frontend/src/mocks/questions-test.mock.ts`, `test-diagnostic.mock.ts` | banque simulée 5 langues × 4 compétences × 5 exercices = 20 items ; 20 × 5 = 100 ; dictée et texte à trous corrigés exactement ; oral validé sur enregistrement seul en attendant la STT. |
| Composants | `QuestionCard.tsx`, `TexteATrous.tsx`, `EnregistrementOral.tsx`, `DeroulementTest.tsx`, `EnteteEtape.tsx`, `resultat/DonneesAnalyse.tsx` | rendu par format, phrase à répéter, compte à rebours par exercice avec passage automatique, tableau des faits transmis à l'agent. |
| État | `frontend/src/lib/etapesTest.ts`, `hooks/useTestDiagnostic.ts` | consigne et durée par format ; action `expirerQuestion` qui compte un item faux et enchaîne. Le minuteur global de 15 min et les 4 étapes existantes restent inchangés. |
| Tests | `src/mocks/__tests__/`, `src/components/.../__tests__/`, `src/lib/__tests__/`, `src/services/__tests__/`, `e2e/support/test-diagnostic-api.ts` | banque complète, score /100, correction des formats, consignes/durées, rendu des nouveaux exercices. |

### Critères de sortie

- `npm run check`, `npm run build`, `npm run test:e2e` verts.
- Sur une langue couverte, le parcours va du choix de la langue jusqu'à l'écran de résultat sans backend.
- Les 4 formats s'affichent et se corrigent dans le mock, avec un score sur 100 et un dossier par exercice.
- Aucun écran de création d'exercice dans cette phase.
- Le formateur voit les mêmes informations plus la validation/ajustement du niveau : **reste à faire** (hors périmètre immédiat).

---

## Phase 2 — BACKEND

**Livrable :** sélection, barème et persistance réels, sans toucher au contrat IA.

- `backend/app/models/parcours.py` / `app/models/__init__.py` : champs `competence`, `format`, `duree_secondes`, `version` sur l'exercice ; migration Alembic réversible (aucune donnée supprimée).
- `backend/app/schemas/diagnostic.py` : étendre `QuestionOut` (liste blanche stricte, aucune clé de correction).
- `backend/app/services/diagnostic.py` : sélection par langue + norme + type + `statut='publié'` + `usage='diagnostic'`.
- `backend/app/services/scoring.py` : barème /100 par compétence puis global, reproductible ; mêmes réponses → même score.
- `backend/app/services/diagnostic.py` : contrôle de couverture avant démarrage, avec liste explicite des manques.
- Réponses rattachées à `id_exercice` **et** à sa `version`.
- Tests : langue non couverte refusée avec manques ; exercice non publié jamais sélectionné ; score reproductible ; score par compétence cohérent ; temps étendu appliqué.

---

## Phase 3 — IA

**Livrable :** interprétation versionnée, sans calcul de score.

- Nouvelle version du contrat `contrats/ia/diagnostic-evaluer/` + `backend/app/schemas/ia.py` + prompts + `VERSION_AGENT` : entrée avec `competence`, `type`, `difficulte`, `justesse`, `score_competence`, `transcription`, `confiance_stt`, `temps_reponse_s` ; sortie `niveau_estime`, `points_faibles[]`, `justification`, `statut`.
- `extra="forbid"` conservé ; anciens exemples non réécrits (changement incompatible = nouvelle version).
- Repli si sortie invalide : résultat partiel sans détail technique pour l'apprenant.
- Tests : sortie conforme au schéma, statut `a_verifier` sous le seuil, aucun score produit par l'agent, mode démonstration sans clé.

---

## Phase 4 — STT / Whisper

**Livrable :** transcription de la réponse orale.

- Service interne de transcription (à créer : aucun code Whisper/STT n'existe aujourd'hui dans le dépôt).
- Branchement sur la réponse `parler`, confiance renvoyée au backend puis à l'agent.
- Le front reste fonctionnel en mock si le service est absent.

---

## Phase 5 — CONTENU

**Livrable :** catalogue réel, 5 langues × 4 compétences.

- Exemples validés en phase 1 (voir proposition dans la conversation) transformés en exercices semés via `backend/app/seed_diagnostic.py`, avec `donnees_test = true`.
- Aucun audio tiers non libre de droits ; les audios de démonstration restent générés/TTS.
- Validation pédagogique avant insertion : niveaux, libellés, corrections.

---

## Risques et points à trancher

1. **Seuil de confiance STT 0,7** : proposition, pas une règle officielle. À valider avant la phase 4.
2. **Contrat IA strict** : toute extension passe par une version incrémentée, jamais par une modification en place.
3. **Durée / tempo** : le front lit aujourd'hui une durée fixe de 15 min ; elle devient un paramètre de profil.
4. **Contenu HSK** : aucun niveau ni équivalence CECRL inventé ; source officielle requise pour le mémoire, pas pour le code.
5. **Aucun numéro US n'a été attribué** pour ce travail : je n'en invente pas. Les noms de branches et les PR seront décidés quand tu me donneras le feu vert pour coder.

## Limites de cette phase

- Le backend, le contrat IA, Whisper/STT et le contenu pédagogique validé ne sont pas modifiés : les phases 2 à 5 restent à faire.
- La note sur 100 et la correction sont calculées par le **mock frontend** ; le service HTTP continue d'attendre le backend.
- L'oral est compté comme réussi dès qu'un enregistrement est fourni : la transcription et la confiance STT arriveront en phase 4.
- Phase 1 commitée et poussée sur la branche dédiée, PR #115 ouverte sans fusion ni modification ClickUp.
