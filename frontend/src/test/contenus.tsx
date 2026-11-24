import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { ContenusServiceContext } from "@/hooks/useContenus";
import { creerServiceContenusSimule } from "@/lib/contenus/mock-service";
import type { ContenusService } from "@/lib/contenus/service";
import type { ContenusLangue } from "@/lib/contenus/types";

/** Service simulé neuf (données de démonstration intactes), sans latence. */
export const nouveauService = () => creerServiceContenusSimule({ latence: 0, maintenant: () => new Date("2026-11-24T10:00:00Z") });

/** Rendu avec un client React Query neuf et le service de contenus donné. */
export function afficherContenus(element: ReactElement, service: ContenusService = nouveauService()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const rendu = render(
    <QueryClientProvider client={client}>
      <ContenusServiceContext.Provider value={service}>{element}</ContenusServiceContext.Provider>
    </QueryClientProvider>,
  );
  return { ...rendu, service };
}

/** Tous les contenus d'une langue, comme les fournit useContenusLangue. */
export async function contenusDe(service: ContenusService, code: string): Promise<ContenusLangue> {
  const langue = (await service.listLangues()).find((l) => l.code === code)!;
  const [modules, lecons, activites, parcours] = await Promise.all([
    service.listModules(code),
    service.listLecons(code),
    service.listActivites(code),
    service.listParcours(code),
  ]);
  return { langue, modules, lecons, activites, parcours };
}
