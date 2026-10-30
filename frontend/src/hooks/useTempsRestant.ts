"use client";

import { useEffect, useState } from "react";

/** Secondes restantes avant `debut + dureeMinutes` (0 une fois le temps écoulé, null sans début). */
export function secondesRestantes(debut: number | null, dureeMinutes: number, maintenant = Date.now()): number | null {
  return debut === null ? null : Math.max(0, (debut + dureeMinutes * 60_000 - maintenant) / 1000);
}

/**
 * Compte à rebours mis à jour chaque seconde. Il est calculé depuis l'heure de début :
 * il reste juste après un rechargement de la page.
 */
export function useTempsRestant(debut: number | null, dureeMinutes: number): number | null {
  const [restantes, setRestantes] = useState(() => secondesRestantes(debut, dureeMinutes));

  useEffect(() => {
    setRestantes(secondesRestantes(debut, dureeMinutes));
    if (debut === null) return;
    const minuteur = setInterval(() => setRestantes(secondesRestantes(debut, dureeMinutes)), 1000);
    return () => clearInterval(minuteur);
  }, [debut, dureeMinutes]);

  return restantes;
}
