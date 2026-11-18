import { ApiError, HTTP_STATUS } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth.store";
import type { ProfilPayload } from "@/types/profil";
import type { Utilisateur } from "@/types/utilisateur";
import { EMAIL_DEJA_UTILISE, changerMotDePasseMock, verifierMotDePasseMock } from "./auth.mock";
import { delay } from "./delay";

/* Profil simulé : part de l'utilisateur de la session (connexion simulée). */

function utilisateurCourant(): Utilisateur {
  const utilisateur = useAuthStore.getState().utilisateur;
  if (!utilisateur) throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "Not authenticated");
  return utilisateur;
}

/** Photo simulée gardée dans la session, sous forme de data URL (l'image a déjà été réduite). */
const versDataUrl = (photo: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(photo);
  });

export const profilMock = {
  async getProfil(): Promise<Utilisateur> {
    await delay();
    return utilisateurCourant();
  },

  async updateProfil({ motDePasse, motDePasseActuel, ...payload }: ProfilPayload): Promise<Utilisateur> {
    await delay(600);
    const { email } = utilisateurCourant();
    // Toutes les vérifications avant toute modification : un refus ne change rien
    if (payload.email === EMAIL_DEJA_UTILISE) throw new ApiError(HTTP_STATUS.CONFLICT, "Email already registered");
    if (motDePasse && !verifierMotDePasseMock(email, motDePasseActuel ?? "")) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, "Incorrect current password");
    }
    if (motDePasse) changerMotDePasseMock(email, motDePasse);
    return { ...utilisateurCourant(), ...payload };
  },

  async uploadPhoto(photo: Blob): Promise<Utilisateur> {
    await delay(800);
    return { ...utilisateurCourant(), photoUrl: await versDataUrl(photo) };
  },

  async supprimerPhoto(): Promise<Utilisateur> {
    await delay();
    return { ...utilisateurCourant(), photoUrl: null };
  },
};
