import type { CodeLangue } from "./langue";

/* Classe « Formule » du paquetage Facturation. */

export interface Formule {
  idFormule: number;
  libelle: string;
  prixMensuel: number;
  dureeMois: number;
  quotaHeures: number;
  quotaAteliers: number;
  /** Langues couvertes par la formule. */
  langues: CodeLangue[];
}
