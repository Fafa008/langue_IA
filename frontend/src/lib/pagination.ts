/** Tailles de page proposées dans les listes. */
export const TAILLES_PAGE = [10, 20, 50] as const;

export const ELLIPSE = "…" as const;

export function nombreDePages(total: number, taille: number): number {
  return Math.max(1, Math.ceil(total / taille));
}

/**
 * Numéros affichés dans la pagination : la première et la dernière page, et les voisines
 * de la page courante ; les trous sont remplacés par « … ».
 * pagesAffichees(1, 10) → [1, 2, 3, 4, 5, "…", 10] ; pagesAffichees(6, 10) → [1, "…", 5, 6, 7, "…", 10]
 */
export function pagesAffichees(courante: number, total: number, voisines = 1): (number | typeof ELLIPSE)[] {
  // Peu de pages : toutes affichées
  if (total <= 5 + 2 * voisines) return Array.from({ length: total }, (_, i) => i + 1);

  // Fenêtre de taille constante, recalée contre les bords pour que la barre ne change pas de largeur
  const largeur = 3 + 2 * voisines;
  let debut = Math.max(2, courante - voisines);
  let fin = Math.min(total - 1, courante + voisines);
  if (courante <= largeur - 1) [debut, fin] = [2, largeur];
  if (courante >= total - largeur + 2) [debut, fin] = [total - largeur + 1, total - 1];

  const milieu = Array.from({ length: fin - debut + 1 }, (_, i) => debut + i);
  return [1, ...(debut > 2 ? [ELLIPSE] : []), ...milieu, ...(fin < total - 1 ? [ELLIPSE] : []), total];
}
