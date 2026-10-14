import { ApiError, HTTP_STATUS } from "@/lib/api-client";
import type { Niveau, NiveauPayload } from "@/types/langue";
import { delay } from "./delay";

/* Niveaux simulés, modifiés en mémoire jusqu'au rechargement de la page. */

const NIVEAUX: Niveau[] = [
  { idNiveau: 1, code: "A1", libelle: "Débutant" },
  { idNiveau: 2, code: "A2", libelle: "Élémentaire" },
  { idNiveau: 3, code: "B1", libelle: "Intermédiaire" },
  { idNiveau: 4, code: "B2", libelle: "Intermédiaire avancé" },
  { idNiveau: 5, code: "C1", libelle: "Avancé" },
  { idNiveau: 6, code: "C2", libelle: "Maîtrise" },
  { idNiveau: 7, code: "HSK 1", libelle: "Mandarin – débutant" },
  { idNiveau: 8, code: "HSK 2", libelle: "Mandarin – élémentaire" },
];

/** Niveaux déjà utilisés par des tests ou des parcours simulés : la suppression est refusée. */
const NIVEAUX_UTILISES = new Set([1, 2, 3]);

let prochainId = NIVEAUX.length + 1;

function verifierCodeLibre(code: string, idNiveau?: number) {
  if (NIVEAUX.some((n) => n.code === code && n.idNiveau !== idNiveau)) {
    throw new ApiError(HTTP_STATUS.CONFLICT, "Level code already exists", "Level code already exists");
  }
}

function trouver(idNiveau: number): number {
  const index = NIVEAUX.findIndex((n) => n.idNiveau === idNiveau);
  if (index === -1) throw new ApiError(404, "Level not found", "Niveau introuvable.");
  return index;
}

/** Niveaux existants parmi `ids` : un niveau supprimé disparaît des langues (comme LangueNiveau en cascade). */
export function niveauxParIds(ids: Iterable<number>): Niveau[] {
  const voulus = new Set(ids);
  return NIVEAUX.filter((n) => voulus.has(n.idNiveau));
}

export const niveauxMock = {
  async lister(): Promise<Niveau[]> {
    await delay(300);
    return [...NIVEAUX];
  },

  async creer(payload: NiveauPayload): Promise<Niveau> {
    await delay(500);
    verifierCodeLibre(payload.code);
    const niveau: Niveau = { idNiveau: prochainId++, ...payload };
    NIVEAUX.push(niveau);
    return niveau;
  },

  async modifier(idNiveau: number, payload: NiveauPayload): Promise<Niveau> {
    await delay(500);
    const index = trouver(idNiveau);
    verifierCodeLibre(payload.code, idNiveau);
    NIVEAUX[index] = { idNiveau, ...payload };
    return NIVEAUX[index];
  },

  async supprimer(idNiveau: number): Promise<void> {
    await delay(500);
    const index = trouver(idNiveau);
    if (NIVEAUX_UTILISES.has(idNiveau)) throw new ApiError(HTTP_STATUS.CONFLICT, "Level in use", "Level in use");
    NIVEAUX.splice(index, 1);
  },
};
