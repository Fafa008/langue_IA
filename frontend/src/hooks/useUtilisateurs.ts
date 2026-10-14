"use client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ROLES } from "@/lib/roles";
import { utilisateursService } from "@/services/utilisateurs.service";
import type { UtilisateursFiltres } from "@/types/utilisateur";
import { useFiltresUrl } from "./useFiltresUrl";
import { queryKeys } from "./queryKeys";

/** Page d'utilisateurs ; la page précédente reste affichée pendant le chargement de la suivante. */
export function useUtilisateurs(filtres: UtilisateursFiltres) {
  return useQuery({
    queryKey: queryKeys.utilisateurs(filtres),
    queryFn: () => utilisateursService.lister(filtres),
    placeholderData: keepPreviousData,
  });
}

const CRITERES = { role: ROLES };

/** Filtres de la liste des utilisateurs, gardés dans l'URL (?recherche=&role=&page=&taille=). */
export function useUtilisateursFiltres() {
  const { filtres, setFiltres } = useFiltresUrl(CRITERES);
  return {
    filtres: filtres as UtilisateursFiltres,
    setFiltres: setFiltres as (changes: Partial<UtilisateursFiltres>) => void,
  };
}
