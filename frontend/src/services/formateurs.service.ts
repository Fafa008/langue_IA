import { apiRequest } from "@/lib/api-client";
import { API_MOCK } from "@/lib/env";
import { formateursMock } from "@/mocks/formateurs.mock";
import type { Formateur, FormateurPayload, FormateursFiltres } from "@/types/formateur";
import type { Paginated } from "@/types/pagination";
import { ENDPOINTS } from "./endpoints";
import { toFormateur, type FormateurDto } from "./formateur.mapper";

/* Administration des formateurs (rôle ADMINISTRATEUR, vérifié par le backend). */

interface PageDto<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

/** Seuls les champs fournis sont envoyés ; les langues partent sous forme d'identifiants (id_langues). */
const toBody = ({ typeContrat, idLangues, ...champs }: FormateurPayload) =>
  Object.fromEntries(
    Object.entries({ ...champs, type_contrat: typeContrat, id_langues: idLangues }).filter(([, v]) => v !== undefined),
  );

export const httpFormateursService = {
  async lister({ recherche, statut, page, taille }: FormateursFiltres): Promise<Paginated<Formateur>> {
    const dto = await apiRequest<PageDto<FormateurDto>>(ENDPOINTS.formateurs, {
      query: { page, page_size: taille, search: recherche.trim(), statut },
    });
    return { items: dto.items.map(toFormateur), total: dto.total, page: dto.page, taille: dto.page_size };
  },

  /** Crée le compte (rôle FORMATEUR) ; le backend envoie au formateur un lien pour choisir son mot de passe. */
  async creer(payload: FormateurPayload): Promise<Formateur> {
    return toFormateur(await apiRequest<FormateurDto>(ENDPOINTS.formateurs, { method: "POST", body: toBody(payload) }));
  },

  /** PATCH partiel : informations, contrat, langues enseignées, ou désactivation / réactivation avec { statut }. */
  async modifier(idUser: number, payload: FormateurPayload): Promise<Formateur> {
    return toFormateur(await apiRequest<FormateurDto>(ENDPOINTS.formateur(idUser), { method: "PATCH", body: toBody(payload) }));
  },
};

/** Données simulées tant que NEXT_PUBLIC_API_MOCK=true (voir .env.development). */
export const formateursService: typeof httpFormateursService = API_MOCK ? formateursMock : httpFormateursService;
