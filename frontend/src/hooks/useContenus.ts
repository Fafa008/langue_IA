"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import { creerServiceContenusSimule } from "@/lib/contenus/mock-service";
import type { ContenusService } from "@/lib/contenus/service";
import type { ContenusLangue, Entite, EntitesParType, FiltresContenus, SaisiesParType, TypeEntite } from "@/lib/contenus/types";
import type { ActionRetrait } from "@/lib/contenus/validation";
import { queryKeys } from "./queryKeys";

/**
 * Service des contenus : implémentation simulée tant que le backend n'expose pas ces entités.
 * Pour brancher l'API, fournir une autre implémentation de ContenusService ici : les composants ne changent pas.
 */
export const ContenusServiceContext = createContext<ContenusService>(creerServiceContenusSimule());

export const useContenusService = () => useContext(ContenusServiceContext);

export function useLanguesContenus() {
  const service = useContenusService();
  return useQuery({ queryKey: queryKeys.contenusLangues, queryFn: () => service.listLangues() });
}

/** Une langue et tous ses contenus ; null si la langue n'existe pas. */
export function useContenusLangue(code: string) {
  const service = useContenusService();
  return useQuery({
    queryKey: queryKeys.contenusLangue(code),
    queryFn: async (): Promise<ContenusLangue | null> => {
      const langue = (await service.listLangues()).find((l) => l.code === code);
      if (!langue) return null;
      const [modules, lecons, activites, parcours] = await Promise.all([
        service.listModules(code),
        service.listLecons(code),
        service.listActivites(code),
        service.listParcours(code),
      ]);
      return { langue, modules, lecons, activites, parcours };
    },
  });
}

/** Liste filtrée d'un onglet (recherche, statut, leçon). */
export function useListeContenus<T extends TypeEntite>(type: T, code: string, filtres: FiltresContenus) {
  const service = useContenusService();
  return useQuery({
    queryKey: queryKeys.contenusListe(code, type, filtres),
    queryFn: (): Promise<EntitesParType[T][]> => {
      // Appels de méthode (et non fonctions détachées) : une implémentation en classe garde son `this`
      const lister: Record<TypeEntite, () => Promise<Entite[]>> = {
        module: () => service.listModules(code, filtres),
        lecon: () => service.listLecons(code, filtres),
        activite: () => service.listActivites(code, filtres),
        parcours: () => service.listParcours(code, filtres),
      };
      return lister[type]() as Promise<EntitesParType[T][]>;
    },
    placeholderData: keepPreviousData,
  });
}

/** Création (id absent) ou modification. */
export function useEnregistrerContenu<T extends TypeEntite>(type: T, codeLangue: string) {
  const service = useContenusService();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, saisie }: { id?: string; saisie: SaisiesParType[T] }) =>
      id ? service.update(type, id, saisie) : service.create(type, codeLangue, saisie),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.contenusTout }),
  });
}

export function useRetirerContenu() {
  const service = useContenusService();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ action, type, entite }: { action: ActionRetrait; type: TypeEntite; entite: Entite }) =>
      action === "archiver" ? service.archive(type, entite.id) : service.remove(type, entite.id),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.contenusTout }),
  });
}
