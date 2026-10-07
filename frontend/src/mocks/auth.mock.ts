import { ApiError } from "@/lib/api-client";
import type { AuthSession, LoginPayload, RegisterPayload } from "@/types/auth";
import type { Apprenant } from "@/types/utilisateur";
import { delay } from "./delay";

/** Adresse qui simule un compte déjà existant (pour tester l'erreur 409). */
export const EMAIL_DEJA_UTILISE = "deja@exemple.com";

export const authMock = {
  async login({ email }: LoginPayload): Promise<AuthSession> {
    await delay();
    return {
      accessToken: "mock-token",
      utilisateur: {
        idUser: 1,
        nom: "Apprenant",
        prenom: "Démo",
        email,
        telephone: null,
        role: "APPRENANT",
        statut: "ACTIF",
        dateInscription: new Date().toISOString(),
      },
    };
  },

  async register(payload: RegisterPayload): Promise<Apprenant> {
    await delay(700);
    if (payload.email === EMAIL_DEJA_UTILISE) throw new ApiError(409, "Email already registered", "Email already registered");
    return {
      idUser: Date.now(),
      nom: payload.nom,
      prenom: payload.prenom,
      email: payload.email,
      telephone: null,
      role: "APPRENANT",
      statut: "ACTIF",
      dateInscription: new Date().toISOString(),
      dateNaissance: payload.dateNaissance,
      pays: null,
      ville: null,
      objectif: null,
    };
  },

  async forgotPassword(): Promise<void> {
    await delay();
  },

  async resetPassword(): Promise<void> {
    await delay();
  },
};
