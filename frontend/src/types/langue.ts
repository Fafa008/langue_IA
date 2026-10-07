/* Classe « Langue » du paquetage Pédagogie. */

export type CodeLangue = "fr" | "en" | "zh" | "it" | "de";

export interface Langue {
  code: CodeLangue;
  libelle: string;
}
