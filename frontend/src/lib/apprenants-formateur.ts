import type { ApprenantFormateur } from "@/mocks/apprenants-formateur.mock";

export interface FiltresApprenants {
  /** Recherche sur le prénom ou le nom, sans tenir compte de la casse ni des accents. */
  recherche: string;
  /** Code de langue (« en »), ou null pour toutes les langues. */
  codeLangue: string | null;
}

const normaliser = (texte: string) =>
  texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("fr").trim();

/** Apprenants correspondant aux filtres locaux de la vue formateur. */
export function filtrerApprenants(apprenants: ApprenantFormateur[], { recherche, codeLangue }: FiltresApprenants): ApprenantFormateur[] {
  const terme = normaliser(recherche);
  return apprenants.filter((a) => {
    if (codeLangue && a.codeLangue !== codeLangue) return false;
    if (!terme) return true;
    return normaliser(`${a.prenom} ${a.nom}`).includes(terme);
  });
}

/** Langues présentes dans la liste, sans doublon, pour le filtre. */
export function languesDe(apprenants: ApprenantFormateur[]): { code: string; libelle: string }[] {
  const vues = new Map<string, string>();
  for (const a of apprenants) if (!vues.has(a.codeLangue)) vues.set(a.codeLangue, a.langue);
  return [...vues].map(([code, libelle]) => ({ code, libelle })).sort((x, y) => x.libelle.localeCompare(y.libelle, "fr"));
}
