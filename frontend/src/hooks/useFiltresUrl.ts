"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { TAILLES_PAGE } from "@/lib/pagination";

/** Critères communs à toutes les listes paginées. */
export interface FiltresListe {
  recherche: string;
  /** Numéro de page, à partir de 1. */
  page: number;
  taille: number;
}

/** Lit un entier positif dans l'URL, sinon la valeur par défaut. */
function entier(value: string | null, defaut: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : defaut;
}

/**
 * Filtres d'une liste gardés dans l'URL (?recherche=&page=&taille=&<critère>=) : la liste filtrée
 * se partage par lien et survit à un rechargement. replace() plutôt que push() : pas d'entrée
 * d'historique par frappe.
 *
 * `criteres` : critères à choix fermé (ex. { role: ["APPRENANT", …] }), null quand absents ou inconnus.
 * Il doit être une constante (définie hors du composant).
 */
export function useFiltresUrl<C extends string>(criteres: Record<C, readonly string[]>) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  type Filtres = FiltresListe & Record<C, string | null>;

  const filtres = useMemo(() => {
    const taille = entier(params.get("taille"), TAILLES_PAGE[0]);
    const choix = Object.fromEntries(
      Object.entries<readonly string[]>(criteres).map(([cle, valeurs]) => {
        const valeur = params.get(cle);
        return [cle, valeur !== null && valeurs.includes(valeur) ? valeur : null];
      }),
    ) as Record<C, string | null>;
    return {
      recherche: params.get("recherche") ?? "",
      page: entier(params.get("page"), 1),
      taille: (TAILLES_PAGE as readonly number[]).includes(taille) ? taille : TAILLES_PAGE[0],
      ...choix,
    } as Filtres;
  }, [params, criteres]);

  /** Changer un critère de recherche ramène à la première page. */
  const setFiltres = useCallback(
    (changes: Partial<Filtres>) => {
      const next: Filtres = { ...filtres, page: 1, ...changes };
      const query = new URLSearchParams();
      if (next.recherche) query.set("recherche", next.recherche);
      for (const cle of Object.keys(criteres) as C[]) {
        if (next[cle]) query.set(cle, next[cle] as string);
      }
      if (next.page > 1) query.set("page", String(next.page));
      if (next.taille !== TAILLES_PAGE[0]) query.set("taille", String(next.taille));
      const search = query.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    [filtres, criteres, pathname, router],
  );

  return { filtres, setFiltres };
}
