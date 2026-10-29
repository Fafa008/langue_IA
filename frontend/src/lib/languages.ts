import type { CodeLangue, Langue } from "@/types/langue";

// Liste statique en attendant un endpoint GET /langues côté backend
// `natif` : nom de la langue dans cette langue, pour le choix de la langue d'affichage
export const LANGUES: (Langue & { flag: string; natif: string })[] = [
  { code: "fr", libelle: "Français", natif: "Français", flag: "/flags/fr.jpg" },
  { code: "en", libelle: "Anglais", natif: "English", flag: "/flags/gb.jpg" },
  { code: "zh", libelle: "Mandarin", natif: "中文", flag: "/flags/cn.jpg" },
  { code: "it", libelle: "Italien", natif: "Italiano", flag: "/flags/it.jpg" },
  { code: "de", libelle: "Allemand", natif: "Deutsch", flag: "/flags/de.jpg" },
];

/** "zh" → « Mandarin » (le code est renvoyé tel quel s'il est inconnu). */
export function libelleLangue(code: CodeLangue): string {
  return LANGUES.find((l) => l.code === code)?.libelle ?? code;
}

/** Drapeau d'une langue connue (« FR » ou « fr »), sinon null (les initiales du code sont affichées). */
export function drapeauLangue(code: string): string | null {
  return LANGUES.find((l) => l.code === code.toLowerCase())?.flag ?? null;
}
