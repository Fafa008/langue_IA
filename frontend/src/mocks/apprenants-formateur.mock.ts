/*
 * Apprenants simulés de la vue formateur (US49-FE). Données fictives : aucune donnée réelle d'apprenant.
 * L'écran affiche toujours l'étiquette « Données simulées » tant que la liste n'est pas branchée sur le backend.
 */

export interface ApprenantFormateur {
  id: number;
  prenom: string;
  nom: string;
  langue: string;
  codeLangue: string;
  niveauVise: string;
  leconAtteinte: number;
  phase: "PASSIVE" | "ACTIVE";
  exercicesReussis: number;
  exercicesARevoir: number;
  scoreMoyen: number;
  derniereActivite: string;
}

export const APPRENANTS_SIMULES: ApprenantFormateur[] = [
  { id: 1, prenom: "Rova", nom: "Rakoto", langue: "Anglais", codeLangue: "en", niveauVise: "B1", leconAtteinte: 23, phase: "PASSIVE", exercicesReussis: 14, exercicesARevoir: 3, scoreMoyen: 78, derniereActivite: "2026-11-18" },
  { id: 2, prenom: "Hanta", nom: "Ravelo", langue: "Français", codeLangue: "fr", niveauVise: "B2", leconAtteinte: 56, phase: "ACTIVE", exercicesReussis: 31, exercicesARevoir: 6, scoreMoyen: 64, derniereActivite: "2026-11-17" },
  { id: 3, prenom: "Tiana", nom: "Andriamanana", langue: "Anglais", codeLangue: "en", niveauVise: "A2", leconAtteinte: 9, phase: "PASSIVE", exercicesReussis: 5, exercicesARevoir: 4, scoreMoyen: 52, derniereActivite: "2026-11-10" },
  { id: 4, prenom: "Miora", nom: "Razafy", langue: "Italien", codeLangue: "it", niveauVise: "B1", leconAtteinte: 12, phase: "PASSIVE", exercicesReussis: 8, exercicesARevoir: 1, scoreMoyen: 85, derniereActivite: "2026-11-16" },
  { id: 5, prenom: "Fidy", nom: "Rasoanaivo", langue: "Allemand", codeLangue: "de", niveauVise: "A1", leconAtteinte: 3, phase: "PASSIVE", exercicesReussis: 2, exercicesARevoir: 2, scoreMoyen: 41, derniereActivite: "2026-11-05" },
];
