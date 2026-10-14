import { apiRequest } from "@/lib/api-client";
import { API_MOCK } from "@/lib/env";
import { languesMock } from "@/mocks/langues.mock";
import type { LangueAvecNiveaux, LanguePayload, LanguesFiltres } from "@/types/langue";
import type { Paginated } from "@/types/pagination";
import { ENDPOINTS } from "./endpoints";
import { toLangueAvecNiveaux, type LangueAvecNiveauxDto } from "./langue.mapper";

/* Administration des langues (rôle ADMINISTRATEUR, vérifié par le backend). */

interface PageDto<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

/** Seuls les champs fournis sont envoyés ; les niveaux partent sous forme d'identifiants (id_niveaux). */
const toBody = ({ code, libelle, idNiveaux }: LanguePayload) =>
  Object.fromEntries(Object.entries({ code, libelle, id_niveaux: idNiveaux }).filter(([, v]) => v !== undefined));

export const httpLanguesService = {
  async lister({ recherche, page, taille }: LanguesFiltres): Promise<Paginated<LangueAvecNiveaux>> {
    const dto = await apiRequest<PageDto<LangueAvecNiveauxDto>>(ENDPOINTS.langues, {
      query: { page, page_size: taille, search: recherche.trim() },
    });
    return { items: dto.items.map(toLangueAvecNiveaux), total: dto.total, page: dto.page, taille: dto.page_size };
  },

  async creer(payload: Required<LanguePayload>): Promise<LangueAvecNiveaux> {
    return toLangueAvecNiveaux(await apiRequest<LangueAvecNiveauxDto>(ENDPOINTS.langues, { method: "POST", body: toBody(payload) }));
  },

  /** Modifier la désignation, le code ou les niveaux ouverts. */
  async modifier(idLangue: number, payload: LanguePayload): Promise<LangueAvecNiveaux> {
    return toLangueAvecNiveaux(
      await apiRequest<LangueAvecNiveauxDto>(ENDPOINTS.langue(idLangue), { method: "PATCH", body: toBody(payload) }),
    );
  },

  /** Refusé (409) si la langue est utilisée (formules, parcours). */
  async supprimer(idLangue: number): Promise<void> {
    await apiRequest<void>(ENDPOINTS.langue(idLangue), { method: "DELETE" });
  },
};

/** Données simulées tant que NEXT_PUBLIC_API_MOCK=true (voir .env.development). */
export const languesService: typeof httpLanguesService = API_MOCK ? languesMock : httpLanguesService;
