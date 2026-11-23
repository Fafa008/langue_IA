"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parcoursPersonnaliseService } from "@/services/parcours-personnalise.service";
import type {
  MessageChatbot,
  ParcoursPersonnalise,
  ReponseExercice,
  TypeErreurChatbot,
} from "@/types/parcours-personnalise";
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

/**
 * Recommandations pédagogiques (REC-03) : appel explicite et idempotent. Le résultat est placé dans le cache du
 * parcours (le backend le persiste aussi), sans recharger tous les exercices.
 */
export function useRecommandationsParcours(idParcours: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => parcoursPersonnaliseService.recommandations(idParcours),
    onSuccess: (recommandation) =>
      queryClient.setQueryData<ParcoursPersonnalise>(queryKeys.parcours, (parcours) =>
        parcours ? { ...parcours, recommandation } : parcours,
      ),
  });
}

/** Message au tuteur IA : l'historique affiché reste local, mais le backend conserve les tours de la session. */
export function useChatbot() {
  return useMutation({
    mutationFn: ({ message, historique }: { message: string; historique: MessageChatbot[] }) =>
      parcoursPersonnaliseService.chatbot(message, historique),
  });
}

/** Correction du dernier message par l'agent dédié, distincte de la réponse du tuteur. */
export function useCorrigerChatbot() {
  return useMutation({
    mutationFn: ({ message, historique }: { message: string; historique: MessageChatbot[] }) =>
      parcoursPersonnaliseService.corrigerChatbot(message, historique),
  });
}

/** Traduction d'une réponse du tuteur, indexée par son identifiant de message. */
export function useTraduireChatbot() {
  return useMutation({
    mutationFn: ({ idMessage, message }: { idMessage: string; message: string }) =>
      parcoursPersonnaliseService.traduireChatbot(idMessage, message),
  });
}

/** Exercice ciblé sur une erreur relevée par le correcteur. */
export function useExerciceChatbot() {
  return useMutation({
    mutationFn: ({ typeErreur, erreur }: { typeErreur: TypeErreurChatbot; erreur: string }) =>
      parcoursPersonnaliseService.exerciceChatbot(typeErreur, erreur),
  });
}

/** Ferme la session chatbot (historique et quota supprimés côté backend). */
export function useFermerSessionChatbot() {
  return useMutation({ mutationFn: () => parcoursPersonnaliseService.fermerSession() });
}
