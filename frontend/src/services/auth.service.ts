import { ApiError, HTTP_STATUS, apiRequest } from "@/lib/api-client";
import { API_MOCK } from "@/lib/env";
import { authMock } from "@/mocks/auth.mock";
import type {
  AuthSession,
  ForgotPasswordPayload,
  LoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
} from "@/types/auth";
import type { Apprenant } from "@/types/utilisateur";
import { ENDPOINTS } from "./endpoints";
import { toUtilisateur, type UtilisateurDto } from "./utilisateur.mapper";

/*
 * Seul fichier qui connaît le format de l'API d'authentification (FastAPI, snake_case).
 * Les noms de champs suivent le diagramme de classes (Utilisateur, Apprenant).
 * Routes publiques : auth: false (pas de JWT, un 401 veut dire « identifiants incorrects »).
 */

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

const toApprenant = (dto: ApprenantDto): Apprenant => ({
  ...toUtilisateur(dto),
  role: "APPRENANT",
  dateNaissance: dto.date_naissance,
  pays: dto.pays,
  ville: dto.ville,
  objectif: dto.objectif,
});

export const httpAuthService = {
  async login({ email, motDePasse }: LoginPayload): Promise<AuthSession> {
    const dto = await apiRequest<TokenResponseDto>(ENDPOINTS.auth.login, {
      method: "POST",
      auth: false,
      body: { email, mot_de_passe: motDePasse },
    });
    const utilisateur = toUtilisateur(dto.utilisateur);
    // Le backend refuse un compte non actif (403) ; même règle si une réponse l'accepte quand même
    if (utilisateur.statut !== "ACTIF") throw new ApiError(HTTP_STATUS.FORBIDDEN, "Compte non actif");
    return { accessToken: dto.access_token, utilisateur };
  },

  /** Crée un Apprenant et son Abonnement à la formule choisie (201) ; il doit ensuite se connecter. */
  async register(payload: RegisterPayload): Promise<Apprenant> {
    const dto = await apiRequest<ApprenantDto>(ENDPOINTS.auth.register, {
      method: "POST",
      auth: false,
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
    return apiRequest<void>(ENDPOINTS.auth.forgotPassword, { method: "POST", auth: false, body: payload });
  },

  resetPassword({ token, motDePasse }: ResetPasswordPayload): Promise<void> {
    return apiRequest<void>(ENDPOINTS.auth.resetPassword, {
      method: "POST",
      auth: false,
      body: { token, nouveau_mot_de_passe: motDePasse },
    });
  },
};

/** Données simulées tant que NEXT_PUBLIC_API_MOCK=true (voir .env.development). */
export const authService: typeof httpAuthService = API_MOCK ? authMock : httpAuthService;
