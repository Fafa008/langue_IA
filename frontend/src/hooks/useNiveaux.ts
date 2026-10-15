"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trierNiveaux } from "@/lib/niveaux";
import { niveauxService } from "@/services/niveaux.service";
import type { NiveauPayload } from "@/types/langue";
import { queryKeys } from "./queryKeys";

/** Tous les niveaux, triés par code. */
export function useNiveaux() {
  return useQuery({ queryKey: queryKeys.niveaux, queryFn: niveauxService.lister, select: trierNiveaux });
}

/** Après toute modification, la liste est rechargée, ainsi que les langues qui affichent leurs niveaux. */
function useRechargerNiveaux() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.niveaux }),
      queryClient.invalidateQueries({ queryKey: queryKeys.languesToutes }),
    ]);
}

export function useCreerNiveau() {
  const recharger = useRechargerNiveaux();
  return useMutation({ mutationFn: niveauxService.creer, onSuccess: recharger });
}

export function useModifierNiveau() {
  const recharger = useRechargerNiveaux();
  return useMutation({
    mutationFn: ({ idNiveau, payload }: { idNiveau: number; payload: NiveauPayload }) => niveauxService.modifier(idNiveau, payload),
    onSuccess: recharger,
  });
}

export function useSupprimerNiveau() {
  const recharger = useRechargerNiveaux();
  return useMutation({ mutationFn: niveauxService.supprimer, onSuccess: recharger });
}
