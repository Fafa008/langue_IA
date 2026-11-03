"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Demande confirmation avant de quitter la page tant que `actif` est vrai :
 * - fermeture, rechargement ou lien externe : avertissement du navigateur (beforeunload) ;
 * - lien interne de l'application (menu, en-tête…) : la navigation est suspendue et `destination` est renseignée,
 *   à l'écran de la confirmer ou de l'annuler.
 */
export function useConfirmationSortie(actif: boolean) {
  const router = useRouter();
  const [destination, setDestination] = useState<string | null>(null);

  useEffect(() => {
    if (!actif) return;

    const avantDechargement = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Chrome et Edge exigent encore returnValue pour afficher l'avertissement
      event.returnValue = "";
    };

    // Phase de capture : le clic est arrêté avant que le composant Link de Next.js ne navigue
    const clic = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const lien = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!lien || lien.target === "_blank" || lien.hasAttribute("download")) return;
      const url = new URL(lien.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      event.preventDefault();
      event.stopPropagation();
      setDestination(`${url.pathname}${url.search}${url.hash}`);
    };

    window.addEventListener("beforeunload", avantDechargement);
    document.addEventListener("click", clic, true);
    return () => {
      window.removeEventListener("beforeunload", avantDechargement);
      document.removeEventListener("click", clic, true);
    };
  }, [actif]);

  return {
    /** Page demandée par l'apprenant, en attente de sa confirmation. */
    destination,
    annuler: () => setDestination(null),
    confirmer: () => {
      if (destination) router.push(destination);
      setDestination(null);
    },
  };
}
