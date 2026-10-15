import { apiRequest } from "@/lib/api-client";
import { API_MOCK } from "@/lib/env";
import { niveauxMock } from "@/mocks/niveaux.mock";
import type { Niveau, NiveauPayload } from "@/types/langue";
import { ENDPOINTS } from "./endpoints";
import { toNiveau, type NiveauDto } from "./niveau.mapper";

/* Administration des niveaux (rôle ADMINISTRATEUR, vérifié par le backend). */

export const httpNiveauxService = {
  /** Liste complète (quelques dizaines de niveaux au plus : pas de pagination). */
  async lister(): Promise<Niveau[]> {
    return (await apiRequest<NiveauDto[]>(ENDPOINTS.niveaux)).map(toNiveau);
  },

  async creer(payload: NiveauPayload): Promise<Niveau> {
    return toNiveau(await apiRequest<NiveauDto>(ENDPOINTS.niveaux, { method: "POST", body: payload }));
  },

  async modifier(idNiveau: number, payload: NiveauPayload): Promise<Niveau> {
    return toNiveau(await apiRequest<NiveauDto>(ENDPOINTS.niveau(idNiveau), { method: "PATCH", body: payload }));
  },

  /**
   * Refusé (409) si le niveau est utilisé (tests diagnostiques, parcours, exercices).
   * Ses associations aux langues (LangueNiveau) sont supprimées avec lui.
   */
  async supprimer(idNiveau: number): Promise<void> {
    await apiRequest<void>(ENDPOINTS.niveau(idNiveau), { method: "DELETE" });
  },
};

/** Données simulées tant que NEXT_PUBLIC_API_MOCK=true (voir .env.development). */
export const niveauxService: typeof httpNiveauxService = API_MOCK ? niveauxMock : httpNiveauxService;
