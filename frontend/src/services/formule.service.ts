import { apiRequest } from "@/lib/api-client";
import { API_MOCK } from "@/lib/env";
import { delay } from "@/mocks/delay";
import { FORMULES_MOCK } from "@/mocks/formules.mock";
import type { Formule } from "@/types/formule";
import type { CodeLangue } from "@/types/langue";

const ENDPOINTS = {
  list: "/api/v1/formules",
} as const;

interface FormuleDto {
  id_formule: number;
  libelle: string;
  prix_mensuel: number;
  duree_mois: number;
  quota_heures: number;
  quota_ateliers: number;
  langues: { code: CodeLangue; libelle: string }[];
}

const toFormule = (dto: FormuleDto): Formule => ({
  idFormule: dto.id_formule,
  libelle: dto.libelle,
  prixMensuel: dto.prix_mensuel,
  dureeMois: dto.duree_mois,
  quotaHeures: dto.quota_heures,
  quotaAteliers: dto.quota_ateliers,
  langues: dto.langues.map((l) => l.code),
});

export const formuleService = {
  async list(): Promise<Formule[]> {
    if (API_MOCK) return delay().then(() => FORMULES_MOCK);
    const dtos = await apiRequest<FormuleDto[]>(ENDPOINTS.list);
    return dtos.map(toFormule);
  },
};
