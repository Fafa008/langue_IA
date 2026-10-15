import type { CodeLangue, Langue } from "@/types/langue";

// Liste statique en attendant un endpoint GET /langues côté backend
export const LANGUES: (Langue & { flag: string })[] = [
  { code: "fr", libelle: "Français", flag: "/flags/fr.jpg" },
  { code: "en", libelle: "Anglais", flag: "/flags/gb.jpg" },
  { code: "zh", libelle: "Mandarin", flag: "/flags/cn.jpg" },
  { code: "it", libelle: "Italien", flag: "/flags/it.jpg" },
  { code: "de", libelle: "Allemand", flag: "/flags/de.jpg" },
];

/** "zh" → « Mandarin » (le code est renvoyé tel quel s'il est inconnu). */
export function libelleLangue(code: CodeLangue): string {
  return LANGUES.find((l) => l.code === code)?.libelle ?? code;
}

/** Drapeau d'une langue connue (« FR » ou « fr »), sinon null (les initiales du code sont affichées). */
export function drapeauLangue(code: string): string | null {
  return LANGUES.find((l) => l.code === code.toLowerCase())?.flag ?? null;
}
