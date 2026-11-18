"use client";
import { useQuery } from "@tanstack/react-query";
import { formuleService } from "@/services/formule.service";

/** Formules d'abonnement proposées à l'inscription (catalogue peu changeant : cache 5 min). */
export function useFormules() {
  return useQuery({
    queryKey: ["formules"],
    queryFn: formuleService.list,
    staleTime: 5 * 60 * 1000,
    // Une seule nouvelle tentative : l'utilisateur voit vite le bouton « Réessayer »
    retry: 1,
  });
}
