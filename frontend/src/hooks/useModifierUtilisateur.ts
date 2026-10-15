"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { utilisateursService } from "@/services/utilisateurs.service";
import { useAuthStore } from "@/store/auth.store";
import type { ModificationUtilisateur } from "@/types/utilisateur";
import { queryKeys } from "./queryKeys";

interface Variables {
  idUser: number;
  modification: ModificationUtilisateur;
}

/**
 * Modification d'un utilisateur par l'administrateur (informations, rôle ou statut).
 * La liste est rechargée ; si l'administrateur se modifie lui-même, sa session suit.
 */
export function useModifierUtilisateur() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ idUser, modification }: Variables) => utilisateursService.modifier(idUser, modification),
    onSuccess: (utilisateur) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.utilisateursTous });
      const { utilisateur: courant, setUtilisateur } = useAuthStore.getState();
      if (courant?.idUser === utilisateur.idUser) setUtilisateur(utilisateur);
    },
  });
}
