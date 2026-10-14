/*
 * Toutes les routes du backend appelées par le frontend, en un seul endroit :
 * si le backend change une route, c'est ici qu'on l'adapte.
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
} as const;
