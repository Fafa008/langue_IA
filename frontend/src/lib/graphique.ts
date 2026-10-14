/* Calculs des graphiques du tableau de bord (sans bibliothèque de graphiques). */

/**
 * Graduations « rondes » de 0 jusqu'à au moins `max` (pas de 1, 2, 5 ou 10 × 10ⁿ).
 * graduations(64) → [0, 20, 40, 60, 80]
 */
export function graduations(max: number, nombreVise = 4): number[] {
  if (max <= 0) return [0, 1];
  const brut = max / nombreVise;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 5, 10].map((m) => m * puissance).find((p) => p >= brut) ?? 10 * puissance;
  const haut = Math.ceil(max / pas) * pas;
  return Array.from({ length: Math.round(haut / pas) + 1 }, (_, i) => i * pas);
}

/** Part en pourcentage, arrondie à l'entier : 71 sur 186 → 38. */
export function pourcentage(valeur: number, total: number): number {
  return total > 0 ? Math.round((valeur / total) * 100) : 0;
}

/** Indices de `n` étiquettes réparties régulièrement sur `longueur` points, premier et dernier compris. */
export function indicesEtiquettes(longueur: number, n = 5): number[] {
  if (longueur <= n) return Array.from({ length: longueur }, (_, i) => i);
  return Array.from({ length: n }, (_, i) => Math.round((i * (longueur - 1)) / (n - 1)));
}
