/*
 * Toutes les routes du backend appelées par le frontend, en un seul endroit.
 * Le format des requêtes et réponses est décrit dans docs/api/contrat-frontend.md :
 * si le backend change une route, on adapte ici et dans ce document.
 */

const API = "/api/v1";

export const ENDPOINTS = {
  auth: {
    login: `${API}/auth/login`,
    register: `${API}/auth/register`,
    forgotPassword: `${API}/auth/forgot-password`,
    resetPassword: `${API}/auth/reset-password`,
  },
  /** Profil de l'utilisateur connecté */
  me: `${API}/users/me`,
  /** Photo de profil de l'utilisateur connecté (envoi et suppression) */
  mePhoto: `${API}/users/me/photo`,
  /** Administration (rôle ADMINISTRATEUR) */
  users: `${API}/users`,
  user: (idUser: number) => `${API}/users/${idUser}`,
  langues: `${API}/langues`,
  langue: (idLangue: number) => `${API}/langues/${idLangue}`,
  niveaux: `${API}/niveaux`,
  niveau: (idNiveau: number) => `${API}/niveaux/${idNiveau}`,
  formateurs: `${API}/formateurs`,
  formateur: (idUser: number) => `${API}/formateurs/${idUser}`,
  /** Tableau de bord de l'administrateur */
  admin: {
    statistiques: `${API}/admin/statistiques`,
    inscriptions: `${API}/admin/statistiques/inscriptions`,
  },
} as const;
