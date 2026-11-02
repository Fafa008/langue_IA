import type { CadreReference } from "@/types/test-diagnostic";

/** Échelles complètes des référentiels, du niveau le plus bas au plus haut. */
export const ECHELLES: Record<CadreReference, readonly string[]> = {
  CECRL: ["A1", "A2", "B1", "B2", "C1", "C2"],
  HSK: ["HSK 1", "HSK 2", "HSK 3", "HSK 4", "HSK 5", "HSK 6"],
};

/** Le chinois est évalué sur l'échelle HSK, les autres langues sur le CECRL (même règle que le backend). */
export const cadreDeLangue = (code: string): CadreReference => (code === "zh" ? "HSK" : "CECRL");

/** « Échelle CECRL, A1 à C2 » : sous-titre d'une langue sur l'écran d'accueil du test. */
export function descriptionEchelle(cadre: CadreReference, niveaux: readonly string[]): string {
  if (niveaux.length === 0) return `Échelle ${cadre}`;
  const premier = niveaux[0];
  const dernier = niveaux[niveaux.length - 1];
  // « HSK 1 à HSK 6 » → « HSK 1 à 6 »
  const fin = cadre === "HSK" ? dernier.replace(/^HSK\s*/, "") : dernier;
  return `Échelle ${cadre}, ${premier} à ${fin}`;
}

/** Durée estimée du test : environ une minute par question. */
export const MINUTES_PAR_QUESTION = 1;
