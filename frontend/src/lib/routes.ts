/** Espace connecté : un dossier par rôle (src/app/espace/admin, formateur, apprenant). */
const ESPACE = "/espace";
/** Module Diagnostic (domaine Pédagogie) : src/app/espace/apprenant/(pedagogie)/test-diagnostic (démarrage, test, résultats). */
const DIAGNOSTIC = `${ESPACE}/apprenant/test-diagnostic`;
/** Module Parcours personnalisé (domaine Pédagogie) : src/app/espace/apprenant/(pedagogie)/parcours. */
const PARCOURS = `${ESPACE}/apprenant/parcours`;

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
    testDiagnostic: {
      /** Choix de la langue et personnalisation ; ?langue=de présélectionne la langue. */
      demarrage: DIAGNOSTIC,
      test: `${DIAGNOSTIC}/test`,
      resultats: `${DIAGNOSTIC}/resultats`,
    },
    /** Mon parcours (parcours, leçon du jour, exercices), puis une page par module et par leçon. */
    parcours: {
      accueil: PARCOURS,
      module: (numero: number) => `${PARCOURS}/modules/${numero}`,
      lecon: (numero: number) => `${PARCOURS}/lecons/${numero}`,
    },
    /** Chat avec le professeur IA : page livrée et exposée dans le menu (RE-02 / US72). */
    chat: `${ESPACE}/apprenant/chat`,
    /** Ma progression : page fille de l'accueil, données simulées tant que US47 et US48 ne sont pas livrés (US51-FE). */
    progression: `${ESPACE}/apprenant/progression`,
    ateliers: `${ESPACE}/apprenant/ateliers`,
    mesInscriptions: `${ESPACE}/apprenant/mes-inscriptions`,
    parametres: `${ESPACE}/apprenant/parametres`,
  },
  formateur: {
    dashboard: `${ESPACE}/formateur`,
    seances: `${ESPACE}/formateur/seances`,
    ateliers: `${ESPACE}/formateur/ateliers`,
    apprenants: `${ESPACE}/formateur/apprenants`,
    /** Synthèse des erreurs récurrentes de la classe (US52-FE). */
    syntheseErreurs: `${ESPACE}/formateur/synthese-erreurs`,
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
  faq: "/faq",
} as const;
