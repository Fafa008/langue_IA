import { apiRequest } from "@/lib/api-client";
import { API_MOCK } from "@/lib/env";
import { utilisateursMock } from "@/mocks/utilisateurs.mock";
import type { Paginated } from "@/types/pagination";
import type { ModificationUtilisateur, Utilisateur, UtilisateursFiltres } from "@/types/utilisateur";
import { ENDPOINTS } from "./endpoints";
import { toUtilisateur, type UtilisateurDto } from "./utilisateur.mapper";

/* Administration des utilisateurs (réservée au rôle ADMINISTRATEUR, vérifié par le backend). */

interface PageDto<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export const httpUtilisateursService = {
  async lister({ recherche, role, page, taille }: UtilisateursFiltres): Promise<Paginated<Utilisateur>> {
    const dto = await apiRequest<PageDto<UtilisateurDto>>(ENDPOINTS.users, {
      query: { page, page_size: taille, search: recherche.trim(), role },
    });
    return { items: dto.items.map(toUtilisateur), total: dto.total, page: dto.page, taille: dto.page_size };
  },

  /** PATCH partiel : modifier les informations, ou désactiver / réactiver avec { statut }. */
  async modifier(idUser: number, modification: ModificationUtilisateur): Promise<Utilisateur> {
    // Mêmes noms de champs côté API (en un mot) : seuls les champs fournis sont envoyés
    const body = Object.fromEntries(Object.entries(modification).filter(([, v]) => v !== undefined));
    return toUtilisateur(await apiRequest<UtilisateurDto>(ENDPOINTS.user(idUser), { method: "PATCH", body }));
  },
};

/** Données simulées tant que NEXT_PUBLIC_API_MOCK=true (voir .env.development). */
export const utilisateursService: typeof httpUtilisateursService = API_MOCK ? utilisateursMock : httpUtilisateursService;
