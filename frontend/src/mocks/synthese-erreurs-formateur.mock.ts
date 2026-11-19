/*
 * Synthèse simulée des erreurs récurrentes de la classe (US52-FE). Fictive : aucune donnée réelle d'apprenant.
 * Le bilan réel (US158-BE, BILAN-IA) n'est pas livré : la section réelle reste « Bientôt ».
 */

export interface ErreurRecurrente {
  id: number;
  titre: string;
  domaine: string;
  apprenantsConcernes: number;
  exemple: string;
  conseil: string;
}

export const ERREURS_SIMULEES: ErreurRecurrente[] = [
  {
    id: 1,
    titre: "Passé composé avec « être »",
    domaine: "Grammaire",
    apprenantsConcernes: 7,
    exemple: "« Hier, je suis aller au marché. » au lieu de « je suis allé ».",
    conseil: "Revoir la liste des verbes conjugués avec « être » et faire réécrire trois phrases au passé.",
  },
  {
    id: 2,
    titre: "Accord de l'adjectif",
    domaine: "Expression écrite",
    apprenantsConcernes: 5,
    exemple: "« une maison grand » au lieu de « une maison grande ».",
    conseil: "Présenter l'accord au féminin avec des paires de mots, puis une courte rédaction à corriger.",
  },
  {
    id: 3,
    titre: "Ordre des mots dans la phrase négative",
    domaine: "Grammaire",
    apprenantsConcernes: 4,
    exemple: "« Je ne parle pas bien français. » est juste ; « Je parle ne pas » est erroné.",
    conseil: "Montrer la place de « ne … pas » autour du verbe conjugué, avec un exercice de tri de mots.",
  },
];
