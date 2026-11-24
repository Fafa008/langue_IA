# Gestion des contenus pédagogiques par le formateur (USPxx)

> **Centre Langues IA · La Digithèque** · 24 novembre 2026 · branche `feature/USPxx-contenus-formateur`
>
> Rubrique « Contenus » de l'espace formateur : modules, leçons, activités (exercices) et parcours, langue par langue.
> **Frontend seulement, données simulées** : aucune route backend n'existe pour ces entités. Les écrans passent par
> l'interface `ContenusService` (`frontend/src/lib/contenus/service.ts`), implémentée en mémoire
> (`mock-service.ts`). Brancher l'API revient à fournir une autre implémentation dans
> `frontend/src/hooks/useContenus.ts`, sans changer les composants.
>
> Spécification cible plus large (banque unique d'exercices, diagnostic, permissions) :
> [`fonctionnalites/09-gestion-pedagogique.md`](fonctionnalites/09-gestion-pedagogique.md).

## 1. Périmètre

| Écran | Adresse | Contenu |
|---|---|---|
| Liste des langues | `/espace/formateur/contenus` | Six langues, niveaux, compteurs (modules, leçons, activités, parcours) |
| Une langue | `/espace/formateur/contenus/[code]?onglet=modules\|lecons\|exercices\|parcours` | Onglets Modules, Leçons, Exercices (activités), Parcours |
| Détail d'une leçon | `/espace/formateur/contenus/[code]/lecons/[id]` | Informations de la leçon, liste de ses activités (ajout, modification, archivage) |

Chaque onglet propose une recherche par titre (la consigne pour une activité), un filtre par statut (Brouillon,
Publié, Archivé), un bouton « Ajouter » qui ouvre un panneau latéral (même modèle que « Ajouter une langue »), un
tableau avec « Modifier » et « Archiver » ou « Supprimer », et un état vide explicite. Le badge « Données simulées »
est visible sur chaque écran.

Hors périmètre : chatbot, prononciation, ateliers, réservations, examens blancs, abonnements ; aucun téléversement
de fichier audio ou image.

## 2. Langues et niveaux

| Langue | Niveaux | Contenus de démonstration |
|---|---|---|
| Français | A1 à C2 (CECRL) | Aucun (onglets vides) |
| Anglais | A1 à C2 (CECRL) | Oui |
| Mandarin | HSK 1, HSK 2 | Oui |
| Italien | A1 à C2 (CECRL) | Aucun (onglets vides) |
| Allemand | A1 à B2 (CECRL) | Aucun (onglets vides) |
| Espagnol | Aucun | Aucun : « Ajoutez d'abord des niveaux pour cette langue », aucune création possible |

Contenus de démonstration (anglais et mandarin) : un module de 8 leçons, chacune avec 6 activités de six types
différents, et un parcours. Les textes sont des espaces réservés (« [Contenu à rédiger par le formateur] ») :
aucun contenu pédagogique réel, les textes sont rédigés par les formateurs référents.

## 3. Modèle

- **Module** : titre, numéro d'ordre (entier positif, unique par langue), statut. Regroupe des leçons.
- **Leçon** : module, niveau (de la langue), titre, numéro d'ordre (entier positif, unique par langue), description
  facultative, statut (Brouillon par défaut). Phase Assimil en lecture seule, calculée depuis le numéro : passive de
  1 à 49, active à partir de 50.
- **Activité** : leçon, type (formats du MVP, décision D5 : QCM, association, texte à trous, vrai / faux / non mentionné,
  remise en ordre, production libre ; la dictée, la discrimination des tons et la description d'image sont reportées), compétence (lecture, écoute, écriture, oral), difficulté (1 à 5), consigne, contenu, réponse de référence
  ou critère de correction, emplacement attendu du fichier audio ou image (texte), statut. Pour le mandarin (ZH)
  seulement : caractères, pinyin, tons attendus (affichés quand la compétence est l'oral).
- **Parcours** : titre, niveau cible (de la langue), statut, liste ordonnée d'éléments (leçons ou activités) avec
  ajout, retrait, déplacement vers le haut ou le bas.

Cycle de vie : **Brouillon → Publié → Archivé**, sans retour en arrière ; l'archivage passe par l'action
« Archiver », après confirmation.

## 4. Règles de gestion

Implémentées dans `frontend/src/lib/contenus/validation.ts` (fonctions pures), appliquées par les formulaires et
revalidées par le service.

| Règle | Énoncé |
|---|---|
| RG-GP-01 | Numéro d'ordre unique par langue, pour les modules et les leçons. |
| RG-GP-02 | Le niveau d'une leçon, d'une activité (celui de sa leçon) ou d'un parcours appartient à la langue. |
| RG-GP-03 | Une leçon publiée contient au moins une activité publiée ; refus explicite à la publication. |
| RG-GP-04 | Une activité de production libre (corrigée par le formateur, D5) a une réponse de référence ou un critère de correction. |
| RG-GP-05 | Un parcours contient au moins un élément. |
| RG-GP-06 | Un élément archivé ne peut pas être ajouté à un parcours. |
| RG-GP-07 | Un parcours publié ne référence que des éléments publiés. |
| RG-GP-08 | Une entité utilisée est archivée, jamais supprimée. |
| RG-GP-09 | Une entité non utilisée peut être supprimée, après confirmation. |
| RG-GP-10 | Chaque modification enregistre l'auteur et la date (simulés). |

Précisions retenues pour l'implémentation (à valider) :

- « Utilisée » (RG-GP-08) : une leçon ou une activité présente dans un parcours, **ou** un module qui contient des
  leçons, **ou** une leçon qui contient des activités (les supprimer laisserait des contenus sans parent).
- RG-GP-06 : un élément archivé **après** son ajout reste toléré dans un parcours en brouillon ; un parcours publié
  le refuse (RG-GP-07).
- Un élément archivé ne se modifie plus.

## 5. Accessibilité

Libellés reliés à chaque champ ; messages d'erreur reliés aux champs (`aria-describedby`, `aria-invalid`) et focus
sur le premier champ invalide ; focus sur le premier champ à l'ouverture du panneau et retour au bouton d'origine à
sa fermeture ; onglets au modèle WAI-ARIA (flèches, Début, Fin) ; confirmation dans une fenêtre modale native.

## 6. Tests

```bash
cd frontend
npx jest src/lib/__tests__/contenus src/components/formateur/contenus   # règles, service simulé, formulaires, écrans
npm run check                                                           # typage, lint, toute la suite Jest
npm run test:e2e -- e2e/contenus.spec.ts                                # parcours complet, bureau et mobile
```

Contrat d'API proposé pour brancher le backend : [`api/contrat-frontend.md`](api/contrat-frontend.md), section
« Contenus pédagogiques du formateur ».
