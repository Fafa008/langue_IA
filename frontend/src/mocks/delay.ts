/** Simule la latence réseau pour que les états de chargement restent visibles. */
export const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));
