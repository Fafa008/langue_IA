/* Configuration lue au build (variables NEXT_PUBLIC_*, voir README « Variables d'environnement »). */

/** URL du backend FastAPI, sans « / » final. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

/** Vrai quand le frontend doit utiliser les données simulées de src/mocks au lieu de l'API. */
export const API_MOCK = process.env.NEXT_PUBLIC_API_MOCK === "true";
