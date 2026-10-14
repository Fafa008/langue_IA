import type { LanguesFiltres } from "@/types/langue";
import type { UtilisateursFiltres } from "@/types/utilisateur";

/** Clés du cache React Query, en un seul endroit pour les lire et les invalider sans faute de frappe. */
export const queryKeys = {
  profil: ["profil"] as const,
  /** Préfixe commun à toutes les pages de la liste (pour les recharger toutes après une modification). */
  utilisateursTous: ["utilisateurs"] as const,
  utilisateurs: (filtres: UtilisateursFiltres) => ["utilisateurs", filtres] as const,
  languesToutes: ["langues"] as const,
  langues: (filtres: LanguesFiltres) => ["langues", filtres] as const,
  niveaux: ["niveaux"] as const,
};
