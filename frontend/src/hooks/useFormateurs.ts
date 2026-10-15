"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STATUTS } from "@/lib/roles";
import { formateursService } from "@/services/formateurs.service";
import type { FormateurPayload, FormateursFiltres } from "@/types/formateur";
import { queryKeys } from "./queryKeys";
import { useFiltresUrl } from "./useFiltresUrl";

/** Page de formateurs ; la page précédente reste affichée pendant le chargement de la suivante. */
export function useFormateurs(filtres: FormateursFiltres) {
  return useQuery({
    queryKey: queryKeys.formateurs(filtres),
    queryFn: () => formateursService.lister(filtres),
    placeholderData: keepPreviousData,
  });
}

const CRITERES = { statut: STATUTS };

/** Filtres de la liste des formateurs, gardés dans l'URL (?recherche=&statut=&page=&taille=). */
export function useFormateursFiltres() {
  const { filtres, setFiltres } = useFiltresUrl(CRITERES);
  return {
    filtres: filtres as FormateursFiltres,
    setFiltres: setFiltres as (changes: Partial<FormateursFiltres>) => void,
  };
}

/** Un formateur est aussi un utilisateur : les deux listes sont rechargées après une modification. */
function useRechargerFormateurs() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.formateursTous }),
      queryClient.invalidateQueries({ queryKey: queryKeys.utilisateursTous }),
    ]);
}

export function useCreerFormateur() {
  const recharger = useRechargerFormateurs();
  return useMutation({ mutationFn: formateursService.creer, onSuccess: recharger });
}

export function useModifierFormateur() {
  const recharger = useRechargerFormateurs();
  return useMutation({
    mutationFn: ({ idUser, payload }: { idUser: number; payload: FormateurPayload }) => formateursService.modifier(idUser, payload),
    onSuccess: recharger,
  });
}
