/** Espace connecté : un dossier par rôle (src/app/espace/admin, formateur, apprenant). */
const ESPACE = "/espace";

export const ROUTES = {
  home: "/",
  login: "/login",
  register: "/register",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  /** Page commune aux trois rôles */
  profil: `${ESPACE}/profil`,
  apprenant: {
    dashboard: `${ESPACE}/apprenant`,
    mesCours: `${ESPACE}/apprenant/mes-cours`,
    ateliers: `${ESPACE}/apprenant/ateliers`,
    mesInscriptions: `${ESPACE}/apprenant/mes-inscriptions`,
    parametres: `${ESPACE}/apprenant/parametres`,
  },
  formateur: {
    dashboard: `${ESPACE}/formateur`,
    seances: `${ESPACE}/formateur/seances`,
    ateliers: `${ESPACE}/formateur/ateliers`,
    apprenants: `${ESPACE}/formateur/apprenants`,
    parametres: `${ESPACE}/formateur/parametres`,
  },
  admin: {
    dashboard: `${ESPACE}/admin`,
    utilisateurs: `${ESPACE}/admin/utilisateurs`,
    formateurs: `${ESPACE}/admin/formateurs`,
    ateliers: `${ESPACE}/admin/ateliers`,
    reservations: `${ESPACE}/admin/reservations`,
    formations: `${ESPACE}/admin/formations`,
    langues: `${ESPACE}/admin/langues`,
    niveaux: `${ESPACE}/admin/niveaux`,
    rapports: `${ESPACE}/admin/rapports`,
    parametres: `${ESPACE}/admin/parametres`,
  },
  terms: "/conditions",
  privacy: "/confidentialite",
} as const;
