import { apiRequest } from "@/lib/api-client";
import { API_MOCK } from "@/lib/env";
import { authMock } from "@/mocks/auth.mock";
import type {
  AuthSession,
  ForgotPasswordPayload,
  LoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
} from "@/types/auth";
import type { Apprenant, Role, StatutUtilisateur, Utilisateur } from "@/types/utilisateur";

/*
 * Seul fichier qui connaît le contrat de l'API d'authentification (FastAPI, snake_case).
 * Les noms de champs suivent le diagramme de classes (Utilisateur, Apprenant).
 * Si le backend change un endpoint ou un champ, c'est ici qu'on adapte.
 */

const ENDPOINTS = {
  login: "/api/v1/auth/login",
  register: "/api/v1/auth/register",
  forgotPassword: "/api/v1/auth/forgot-password",
  resetPassword: "/api/v1/auth/reset-password",
} as const;

interface UtilisateurDto {
  id_user: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  role: Role;
  statut: StatutUtilisateur;
  date_inscription: string;
}

interface ApprenantDto extends UtilisateurDto {
  role: "APPRENANT";
  date_naissance: string | null;
  pays: string | null;
  ville: string | null;
  objectif: string | null;
}

interface TokenResponseDto {
  access_token: string;
  token_type: string;
  utilisateur: UtilisateurDto;
}

const toUtilisateur = (dto: UtilisateurDto): Utilisateur => ({
  idUser: dto.id_user,
  nom: dto.nom,
  prenom: dto.prenom,
  email: dto.email,
  telephone: dto.telephone,
  role: dto.role,
  statut: dto.statut,
  dateInscription: dto.date_inscription,
});

const toApprenant = (dto: ApprenantDto): Apprenant => ({
  ...toUtilisateur(dto),
  role: "APPRENANT",
  dateNaissance: dto.date_naissance,
  pays: dto.pays,
  ville: dto.ville,
  objectif: dto.objectif,
});

const httpAuthService = {
  async login({ email, motDePasse }: LoginPayload): Promise<AuthSession> {
    const dto = await apiRequest<TokenResponseDto>(ENDPOINTS.login, {
      method: "POST",
      body: { email, mot_de_passe: motDePasse },
    });
    return { accessToken: dto.access_token, utilisateur: toUtilisateur(dto.utilisateur) };
  },

  /** Crée un Apprenant et son Abonnement à la formule choisie (201) ; il doit ensuite se connecter. */
  async register(payload: RegisterPayload): Promise<Apprenant> {
    const dto = await apiRequest<ApprenantDto>(ENDPOINTS.register, {
      method: "POST",
      body: {
        prenom: payload.prenom,
        nom: payload.nom,
        email: payload.email,
        mot_de_passe: payload.motDePasse,
        date_naissance: payload.dateNaissance,
        langues: payload.langues,
        id_formule: payload.idFormule,
      },
    });
    return toApprenant(dto);
  },

  forgotPassword(payload: ForgotPasswordPayload): Promise<void> {
    return apiRequest<void>(ENDPOINTS.forgotPassword, { method: "POST", body: payload });
  },

  resetPassword({ token, motDePasse }: ResetPasswordPayload): Promise<void> {
    return apiRequest<void>(ENDPOINTS.resetPassword, {
      method: "POST",
      body: { token, nouveau_mot_de_passe: motDePasse },
    });
  },
};

/** Données simulées tant que NEXT_PUBLIC_API_MOCK=true (voir .env.development). */
export const authService: typeof httpAuthService = API_MOCK ? authMock : httpAuthService;
