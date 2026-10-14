import { apiRequest } from "@/lib/api-client";
import { API_MOCK } from "@/lib/env";
import { tableauDeBordMock } from "@/mocks/tableau-de-bord.mock";
import type { InscriptionsDuJour, PeriodeInscriptions, StatistiquesAdmin } from "@/types/tableau-de-bord";
import { toAbonnement, type AbonnementDto } from "./abonnement.mapper";
import { ENDPOINTS } from "./endpoints";
import { toLangue, type LangueDto } from "./langue.mapper";
import { toApprenant, type ApprenantDto } from "./utilisateur.mapper";

/* Tableau de bord de l'administrateur (rôle ADMINISTRATEUR, vérifié par le backend). */

interface StatistiquesDto {
  totaux: { utilisateurs: number; apprenants: number; formateurs: number; ateliers_programmes: number };
  apprenants_par_langue: { langue: LangueDto; apprenants: number }[];
  dernieres_inscriptions: { apprenant: ApprenantDto; langues: LangueDto[]; abonnement: AbonnementDto | null }[];
}

export const httpTableauDeBordService = {
  /** Administrateur.consulterStatistiques() */
  async consulterStatistiques(): Promise<StatistiquesAdmin> {
    const dto = await apiRequest<StatistiquesDto>(ENDPOINTS.admin.statistiques);
    return {
      totaux: {
        utilisateurs: dto.totaux.utilisateurs,
        apprenants: dto.totaux.apprenants,
        formateurs: dto.totaux.formateurs,
        ateliersProgrammes: dto.totaux.ateliers_programmes,
      },
      apprenantsParLangue: dto.apprenants_par_langue.map((l) => ({ langue: toLangue(l.langue), apprenants: l.apprenants })),
      dernieresInscriptions: dto.dernieres_inscriptions.map((i) => ({
        apprenant: toApprenant(i.apprenant),
        langues: i.langues.map(toLangue),
        abonnement: i.abonnement && toAbonnement(i.abonnement),
      })),
    };
  },

  async inscriptions(jours: PeriodeInscriptions): Promise<InscriptionsDuJour[]> {
    return apiRequest<InscriptionsDuJour[]>(ENDPOINTS.admin.inscriptions, { query: { jours } });
  },
};

/** Données simulées tant que NEXT_PUBLIC_API_MOCK=true (voir .env.development). */
export const tableauDeBordService: typeof httpTableauDeBordService = API_MOCK ? tableauDeBordMock : httpTableauDeBordService;
