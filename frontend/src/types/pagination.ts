/** Page de résultats renvoyée par une liste paginée. */
export interface Paginated<T> {
  items: T[];
  /** Nombre total de résultats, toutes pages confondues. */
  total: number;
  page: number;
  taille: number;
}
