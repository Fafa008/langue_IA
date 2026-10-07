import type { CodeLangue } from "./langue";
import type { Utilisateur } from "./utilisateur";

export interface AuthSession {
  accessToken: string;
  utilisateur: Utilisateur;
}

/* Données envoyées à l'API */

export interface LoginPayload {
  email: string;
  motDePasse: string;
}

/**
 * Inscription d'un Apprenant et souscription à une Formule (création de l'Abonnement).
 * Le rôle et le statut sont fixés par le backend.
 */
export interface RegisterPayload {
  prenom: string;
  nom: string;
  email: string;
  motDePasse: string;
  /** Date ISO 8601 (AAAA-MM-JJ) */
  dateNaissance: string;
  langues: CodeLangue[];
  idFormule: number;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  motDePasse: string;
}

/* Valeurs des formulaires (ce que l'utilisateur saisit) */

export interface LoginFormValues extends LoginPayload {
  seSouvenir: boolean;
}

export interface RegisterFormValues {
  prenom: string;
  nom: string;
  email: string;
  dateNaissance: string;
  langues: CodeLangue[];
  idFormule: number | null;
  motDePasse: string;
  confirmation: string;
  accepteConditions: boolean;
}

export interface ResetPasswordFormValues {
  motDePasse: string;
  confirmation: string;
}
