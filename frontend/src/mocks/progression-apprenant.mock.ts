/*
 * Progression simulée de l'apprenant (US51-FE). Fictive ; l'écran affiche toujours « Données simulées » tant que la
 * progression réelle (US47, US48) n'est pas branchée.
 */

export interface ProgressionApprenant {
  leconAtteinte: number;
  leconsTotal: number;
  scoreMoyen: number;
  derniereLecon: { numero: number; intitule: string };
  serieJours: number;
  exercicesParJour: { jour: string; nombre: number }[];
}

export const PROGRESSION_SIMULEE: ProgressionApprenant = {
  leconAtteinte: 23,
  leconsTotal: 56,
  scoreMoyen: 78,
  derniereLecon: { numero: 23, intitule: "Le passé composé" },
  serieJours: 5,
  exercicesParJour: [
    { jour: "Lun", nombre: 3 },
    { jour: "Mar", nombre: 0 },
    { jour: "Mer", nombre: 4 },
    { jour: "Jeu", nombre: 2 },
    { jour: "Ven", nombre: 5 },
    { jour: "Sam", nombre: 1 },
    { jour: "Dim", nombre: 3 },
  ],
};
