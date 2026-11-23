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
  formules: `${API}/formules`,
  diagnostic: {
    langues: `${API}/diagnostic/langues`,
    tentatives: `${API}/diagnostic/tentatives`,
    terminerTentative: (idTentative: number) => `${API}/diagnostic/tentatives/${idTentative}/terminer`,
    /**
     * Routes du contrat encore absentes du backend (vérifié dans routes/diagnostic.py) : 404 hors mode mock.
     * Démarrage, réponse et clôture existent ; la reprise et l'abandon ne sont pas exposés.
     */
    tentativeEnCours: `${API}/diagnostic/tentatives/en-cours`,
    abandonnerTentative: (idTentative: number) => `${API}/diagnostic/tentatives/${idTentative}/abandonner`,
    questions: `${API}/diagnostic/questions`,
    reponse: `${API}/diagnostic/reponse`,
  },
  /** Parcours personnalisé de l'apprenant connecté : routes exposées par backend/app/api/routes/parcours.py. */
  parcours: {
    enCours: `${API}/parcours/en-cours`,
    exercices: (idParcours: number) => `${API}/parcours/${idParcours}/exercices`,
    lecon: (idParcours: number, numeroLecon: number) => `${API}/parcours/${idParcours}/lecons/${numeroLecon}`,
    reponse: (idParcours: number, idParcoursExercice: number) =>
      `${API}/parcours/${idParcours}/exercices/${idParcoursExercice}/reponse`,
    /** Recommandations pédagogiques (REC-03) : appel explicite, idempotent, jamais d'erreur visible. */
    recommandations: (idParcours: number) => `${API}/parcours/${idParcours}/recommandations`,
  },
  /** Chat apprenant : relais backend authentifié du service IA (routes présentes dans routes/chatbot.py). */
  chatbot: {
    message: `${API}/chatbot/message`,
    fermerSession: (identifiantSession: string) => `${API}/chatbot/session/${identifiantSession}`,
  },
  formateurs: `${API}/formateurs`,
  formateur: (idUser: number) => `${API}/formateurs/${idUser}`,
  /** Tableau de bord de l'administrateur */
  admin: {
    statistiques: `${API}/admin/statistiques`,
    inscriptions: `${API}/admin/statistiques/inscriptions`,
  },
} as const;
