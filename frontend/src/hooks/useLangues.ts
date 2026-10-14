"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { languesService } from "@/services/langues.service";
import type { LanguePayload, LanguesFiltres } from "@/types/langue";
import { queryKeys } from "./queryKeys";
import { useFiltresUrl } from "./useFiltresUrl";

/** Page de langues ; la page précédente reste affichée pendant le chargement de la suivante. */
export function useLangues(filtres: LanguesFiltres) {
  return useQuery({
    queryKey: queryKeys.langues(filtres),
    queryFn: () => languesService.lister(filtres),
    placeholderData: keepPreviousData,
  });
}

/** Pas de critère à choix fermé : seulement la recherche et la pagination. */
const CRITERES = {};

/** Filtres de la liste des langues, gardés dans l'URL (?recherche=&page=&taille=). */
export function useLanguesFiltres() {
  const { filtres, setFiltres } = useFiltresUrl(CRITERES);
  return {
    filtres: filtres as LanguesFiltres,
    setFiltres: setFiltres as (changes: Partial<LanguesFiltres>) => void,
  };
}

/** Après toute modification du catalogue, toutes les pages de la liste sont rechargées. */
function useRechargerLangues() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.languesToutes });
}

export function useCreerLangue() {
  const recharger = useRechargerLangues();
  return useMutation({ mutationFn: languesService.creer, onSuccess: recharger });
}

export function useModifierLangue() {
  const recharger = useRechargerLangues();
  return useMutation({
    mutationFn: ({ idLangue, payload }: { idLangue: number; payload: LanguePayload }) => languesService.modifier(idLangue, payload),
    onSuccess: recharger,
  });
}

export function useSupprimerLangue() {
  const recharger = useRechargerLangues();
  return useMutation({ mutationFn: languesService.supprimer, onSuccess: recharger });
}
