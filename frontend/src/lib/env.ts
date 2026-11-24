/* Configuration lue au build (variables NEXT_PUBLIC_*, voir README « Variables d'environnement »). */

/**
 * Deux presets seulement : `reel` (défaut, tout passe par le backend) et `demo` (maquette autonome).
 * En démo, le test, le parcours affiché et les écrans de saisie viennent des mocks ; la langue du test terminé
 * choisit celle du parcours simulé, sinon on lit le parcours backend, et le chat et les recommandations restent
 * branchés sur le backend puis le service IA (voir `parcours-personnalise.service.ts`).
 */
export const MODE = process.env.NEXT_PUBLIC_MODE === "demo" ? "demo" : "reel";
export const DEMO = MODE === "demo";

/** URL du backend FastAPI, sans « / » final. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

/** Vrai en démo : les services génériques et le test de positionnement utilisent `src/mocks`. */
export const API_MOCK = DEMO;

/**
 * La démo obtient automatiquement un JWT pour le compte apprenant de seed (voir `app/providers.tsx`) :
 * l'authentification reste donc réelle dans les deux presets, afin que le backend puisse autoriser le chat.
 */
export const AUTH_MOCK = false;

/** Vrai en démo : le contenu du parcours affiché vient du mock, mais l'IA est réelle. */
export const PARCOURS_MOCK = DEMO;
