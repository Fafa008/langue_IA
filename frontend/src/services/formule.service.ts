import { apiRequest } from "@/lib/api-client";
import { API_MOCK } from "@/lib/env";
import { delay } from "@/mocks/delay";
import { FORMULES_MOCK } from "@/mocks/formules.mock";
import type { Formule } from "@/types/formule";
import { ENDPOINTS } from "./endpoints";
import { toFormule, type FormuleDto } from "./formule.mapper";

export const formuleService = {
  async list(): Promise<Formule[]> {
    if (API_MOCK) return delay().then(() => FORMULES_MOCK);
    const dtos = await apiRequest<FormuleDto[]>(ENDPOINTS.formules);
    return dtos.map(toFormule);
  },
};
