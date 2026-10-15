import type { Niveau } from "@/types/langue";

/** Longueur maximale du code d'un niveau (colonne Niveau.Code, varchar(20)). */
export const NIVEAU_CODE_MAX_LONGUEUR = 20;

/** Niveaux du Cadre européen commun de référence (CECRL), suggérés dans le formulaire. */
export const NIVEAUX_CECRL = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

/** « hsk   7 » → « HSK 7 » */
export function formatCodeNiveau(value: string): string {
  return value.replace(/\s+/g, " ").trimStart().toLocaleUpperCase("fr-FR");
}

/** Ordre d'affichage : par code, les nombres dans l'ordre naturel (« HSK 2 » avant « HSK 10 »). */
export function trierNiveaux(niveaux: Niveau[]): Niveau[] {
  return [...niveaux].sort((a, b) => a.code.localeCompare(b.code, "fr", { numeric: true }));
}
