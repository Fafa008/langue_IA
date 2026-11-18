"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { profilService } from "@/services/profil.service";
import { useAuthStore } from "@/store/auth.store";
import { queryKeys } from "./queryKeys";
import type { Utilisateur } from "@/types/utilisateur";

/** Profil de l'utilisateur connecté, relu depuis l'API pour préremplir le formulaire. */
export function useProfil() {
  return useQuery({ queryKey: queryKeys.profil, queryFn: profilService.getProfil });
}

/** Après une modification, le profil en cache et la session (en-tête) sont mis à jour. */
function useEnregistrerUtilisateur() {
  const queryClient = useQueryClient();
  const setUtilisateur = useAuthStore((s) => s.setUtilisateur);

  return (utilisateur: Utilisateur) => {
    queryClient.setQueryData(queryKeys.profil, utilisateur);
    setUtilisateur(utilisateur);
  };
}

export function useUpdateProfil() {
  return useMutation({ mutationFn: profilService.updateProfil, onSuccess: useEnregistrerUtilisateur() });
}

/** Envoi de la photo de profil (image déjà réduite par lib/photo). */
export function useUploadPhoto() {
  return useMutation({ mutationFn: profilService.uploadPhoto, onSuccess: useEnregistrerUtilisateur() });
}

export function useSupprimerPhoto() {
  return useMutation({ mutationFn: profilService.supprimerPhoto, onSuccess: useEnregistrerUtilisateur() });
}
