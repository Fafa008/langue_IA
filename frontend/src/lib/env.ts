/* Configuration lue au build (variables NEXT_PUBLIC_*, voir README « Variables d'environnement »). */

/** URL du backend FastAPI, sans « / » final. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

/** Vrai quand le frontend doit utiliser les données simulées de src/mocks au lieu de l'API. */
export const API_MOCK = process.env.NEXT_PUBLIC_API_MOCK === "true";

/**
 * Une démo peut garder les exercices simulés (test rapide) tout en branchant l'authentification et le parcours
 * sur le vrai backend : c'est ce que font les deux drapeaux ci-dessous. Leurs valeurs par défaut préservent le
 * comportement historique (API_MOCK=true ⇒ tout est simulé).
 */
export const AUTH_MOCK = API_MOCK && process.env.NEXT_PUBLIC_AUTH_REELLE !== "true";

/**
 * Vrai quand le parcours personnalisé utilise ses données simulées. Un build de démo garde l'API réelle pour le reste
 * (NEXT_PUBLIC_API_MOCK=false) et simule seulement le parcours, tant que ses routes ne sont pas livrées (FE-D5, option B).
 * L'écran affiche alors « Mode démonstration ».
 */
export const PARCOURS_MOCK =
  (API_MOCK || process.env.NEXT_PUBLIC_PARCOURS_MOCK === "true") &&
  process.env.NEXT_PUBLIC_PARCOURS_REELLE !== "true";
