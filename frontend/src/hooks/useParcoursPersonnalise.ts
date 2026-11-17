"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parcoursPersonnaliseService } from "@/services/parcours-personnalise.service";
import type { MessageChatbot, ReponseExercice } from "@/types/parcours-personnalise";
import { queryKeys } from "./queryKeys";

/** Parcours en cours de l'apprenant connecté (404 s'il n'a pas encore passé le test de positionnement). */
export function useParcoursPersonnalise() {
  return useQuery({ queryKey: queryKeys.parcours, queryFn: parcoursPersonnaliseService.enCours });
}

/** Exercices du parcours ; la requête attend que le parcours soit chargé. */
export function useExercicesParcours(idParcours: number | undefined) {
  return useQuery({
    queryKey: queryKeys.exercicesParcours(idParcours ?? 0),
    queryFn: () => parcoursPersonnaliseService.exercices(idParcours as number),
    enabled: idParcours !== undefined,
  });
}

export function useLeconParcours(idParcours: number | undefined, numeroLecon: number) {
  return useQuery({
    queryKey: queryKeys.leconParcours(idParcours ?? 0, numeroLecon),
    queryFn: () => parcoursPersonnaliseService.lecon(idParcours as number, numeroLecon),
    enabled: idParcours !== undefined,
  });
}

/** Après une correction, tout le parcours est relu : statuts, leçon atteinte et phase peuvent changer. */
export function useCorrigerExercice(idParcours: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ idParcoursExercice, reponse }: { idParcoursExercice: number; reponse: ReponseExercice }) =>
      parcoursPersonnaliseService.corriger(idParcours, idParcoursExercice, reponse),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.parcoursTout }),
  });
}

/** Message au professeur IA ; la conversation reste dans l'écran (aucun historique conservé, cf. tâche F-08). */
export function useChatbot() {
  return useMutation({
    mutationFn: ({ message, historique }: { message: string; historique: MessageChatbot[] }) =>
      parcoursPersonnaliseService.chatbot(message, historique),
  });
}
