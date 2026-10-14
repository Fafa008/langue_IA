import { ApiError, HTTP_STATUS } from "@/lib/api-client";
import type { AuthSession, LoginPayload, RegisterPayload } from "@/types/auth";
import type { Apprenant, Utilisateur } from "@/types/utilisateur";
import { COMPTES_DEMO, type CompteDemo } from "./comptes-demo";
import { delay } from "./delay";

/** Adresse qui simule un compte déjà existant (pour tester l'erreur 409). */
export const EMAIL_DEJA_UTILISE = "deja@exemple.com";

/* Adresses qui simulent un compte non actif (erreur 403), quel que soit le mot de passe. */
export const EMAIL_COMPTE_INACTIF = "inactif@exemple.com";
export const EMAIL_COMPTE_SUSPENDU = "suspendu@exemple.com";

/**
 * Comptes reconnus par la connexion simulée : les comptes de démonstration, plus ceux créés
 * par l'inscription simulée (gardés en mémoire jusqu'au rechargement de la page).
 */
const comptes = new Map<string, CompteDemo>(Object.values(COMPTES_DEMO).map((c) => [c.utilisateur.email, c]));

/** JWT factice (non signé) valable 24 h, pour que la session simulée ait une date d'expiration. */
function fakeJwt(utilisateur: Utilisateur): string {
  const encode = (data: object) => btoa(JSON.stringify(data)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({ sub: String(utilisateur.idUser), role: utilisateur.role, exp })}.`;
}

export const authMock = {
  async login({ email, motDePasse }: LoginPayload): Promise<AuthSession> {
    await delay();
    if (email === EMAIL_COMPTE_INACTIF || email === EMAIL_COMPTE_SUSPENDU) throw new ApiError(HTTP_STATUS.FORBIDDEN, "Inactive account");
    const compte = comptes.get(email);
    if (!compte || compte.motDePasse !== motDePasse) throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "Incorrect email or password");
    return { accessToken: fakeJwt(compte.utilisateur), utilisateur: compte.utilisateur };
  },

  async register(payload: RegisterPayload): Promise<Apprenant> {
    await delay(700);
    if (payload.email === EMAIL_DEJA_UTILISE || comptes.has(payload.email)) {
      throw new ApiError(HTTP_STATUS.CONFLICT, "Email already registered", "Email already registered");
    }
    const apprenant: Apprenant = {
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
    comptes.set(apprenant.email, { utilisateur: apprenant, motDePasse: payload.motDePasse });
    return apprenant;
  },

  async forgotPassword(): Promise<void> {
    await delay();
  },

  async resetPassword(): Promise<void> {
    await delay();
  },
};
