"use client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { tableauDeBordService } from "@/services/tableau-de-bord.service";
import type { PeriodeInscriptions } from "@/types/tableau-de-bord";
import { queryKeys } from "./queryKeys";

/** Chiffres clés, répartition par langue et derniers inscrits. */
export function useStatistiquesAdmin() {
  return useQuery({ queryKey: queryKeys.statistiquesAdmin, queryFn: tableauDeBordService.consulterStatistiques });
}

/** Inscriptions par jour ; la courbe précédente reste affichée pendant le chargement d'une autre période. */
export function useInscriptions(jours: PeriodeInscriptions) {
  return useQuery({
    queryKey: queryKeys.inscriptions(jours),
    queryFn: () => tableauDeBordService.inscriptions(jours),
    placeholderData: keepPreviousData,
  });
}
