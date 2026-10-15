import { ApiError, HTTP_STATUS } from "@/lib/api-client";
import type { LangueAvecNiveaux, LangueGeree, LanguePayload, LanguesFiltres } from "@/types/langue";
import type { Paginated } from "@/types/pagination";
import { delay } from "./delay";
import { niveauxParIds } from "./niveaux.mock";

/* Catalogue des langues simulé, modifié en mémoire jusqu'au rechargement de la page. */

const LANGUES: LangueGeree[] = [
  { idLangue: 1, code: "fr", libelle: "Français" },
  { idLangue: 2, code: "en", libelle: "Anglais" },
  { idLangue: 3, code: "zh", libelle: "Mandarin" },
  { idLangue: 4, code: "it", libelle: "Italien" },
  { idLangue: 5, code: "de", libelle: "Allemand" },
  { idLangue: 6, code: "es", libelle: "Espagnol" },
  { idLangue: 7, code: "pt", libelle: "Portugais" },
  { idLangue: 8, code: "ja", libelle: "Japonais" },
  { idLangue: 9, code: "ko", libelle: "Coréen" },
  { idLangue: 10, code: "ar", libelle: "Arabe" },
  { idLangue: 11, code: "ru", libelle: "Russe" },
  { idLangue: 12, code: "mg", libelle: "Malgache" },
];

/** Langues utilisées par les formules simulées : la suppression est refusée (comme le ferait le backend). */
const LANGUES_UTILISEES = new Set(["fr", "en", "zh", "it", "de"]);

/** Association LangueNiveau : les niveaux CECRL (1 à 6) pour les langues européennes, HSK (7, 8) pour le mandarin. */
const CECRL = [1, 2, 3, 4, 5, 6];
const NIVEAUX_PAR_LANGUE = new Map<number, number[]>([
  [1, CECRL],
  [2, CECRL],
  [3, [7, 8]],
  [4, CECRL],
  [5, [1, 2, 3, 4]],
]);

const avecNiveaux = (langue: LangueGeree): LangueAvecNiveaux => ({
  ...langue,
  niveaux: niveauxParIds(NIVEAUX_PAR_LANGUE.get(langue.idLangue) ?? []),
});

let prochainId = LANGUES.length + 1;

const normaliser = (texte: string) => texte.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function verifierCodeLibre(code: string | undefined, idLangue?: number) {
  if (code && LANGUES.some((l) => l.code === code && l.idLangue !== idLangue)) {
    throw new ApiError(HTTP_STATUS.CONFLICT, "Language code already exists", "Language code already exists");
  }
}

function trouver(idLangue: number): number {
  const index = LANGUES.findIndex((l) => l.idLangue === idLangue);
  if (index === -1) throw new ApiError(404, "Language not found", "Langue introuvable.");
  return index;
}

export const languesMock = {
  async lister({ recherche, page, taille }: LanguesFiltres): Promise<Paginated<LangueAvecNiveaux>> {
    await delay(300);
    const terme = normaliser(recherche.trim());
    const resultats = LANGUES.filter((l) => !terme || normaliser(`${l.libelle} ${l.code}`).includes(terme));
    return { items: resultats.slice((page - 1) * taille, page * taille).map(avecNiveaux), total: resultats.length, page, taille };
  },

  async creer({ idNiveaux, ...champs }: Required<LanguePayload>): Promise<LangueAvecNiveaux> {
    await delay(500);
    verifierCodeLibre(champs.code);
    const langue: LangueGeree = { idLangue: prochainId++, ...champs };
    LANGUES.push(langue);
    NIVEAUX_PAR_LANGUE.set(langue.idLangue, idNiveaux);
    return avecNiveaux(langue);
  },

  async modifier(idLangue: number, { idNiveaux, ...champs }: LanguePayload): Promise<LangueAvecNiveaux> {
    await delay(500);
    const index = trouver(idLangue);
    verifierCodeLibre(champs.code, idLangue);
    const changements = Object.fromEntries(Object.entries(champs).filter(([, v]) => v !== undefined));
    LANGUES[index] = { ...LANGUES[index], ...changements };
    if (idNiveaux) NIVEAUX_PAR_LANGUE.set(idLangue, idNiveaux);
    return avecNiveaux(LANGUES[index]);
  },

  async supprimer(idLangue: number): Promise<void> {
    await delay(500);
    const index = trouver(idLangue);
    if (LANGUES_UTILISEES.has(LANGUES[index].code)) {
      throw new ApiError(HTTP_STATUS.CONFLICT, "Language in use", "Language in use");
    }
    LANGUES.splice(index, 1);
    NIVEAUX_PAR_LANGUE.delete(idLangue);
  },
};
