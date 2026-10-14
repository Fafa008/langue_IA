import { apiRequest } from "@/lib/api-client";
import { API_MOCK } from "@/lib/env";
import { profilMock } from "@/mocks/profil.mock";
import type { ProfilPayload } from "@/types/profil";
import type { Utilisateur } from "@/types/utilisateur";
import { ENDPOINTS } from "./endpoints";
import { toUtilisateur, type UtilisateurDto } from "./utilisateur.mapper";

/* Profil de l'utilisateur connecté (le JWT est ajouté par apiRequest). */

export const httpProfilService = {
  async getProfil(): Promise<Utilisateur> {
    return toUtilisateur(await apiRequest<UtilisateurDto>(ENDPOINTS.me));
  },

  async updateProfil(payload: ProfilPayload): Promise<Utilisateur> {
    const dto = await apiRequest<UtilisateurDto>(ENDPOINTS.me, {
      method: "PATCH",
      body: {
        prenom: payload.prenom,
        nom: payload.nom,
        email: payload.email,
        telephone: payload.telephone,
        // Absents : le mot de passe reste inchangé ; l'actuel est vérifié par le backend (400 s'il est faux)
        ...(payload.motDePasse
          ? { mot_de_passe: payload.motDePasse, mot_de_passe_actuel: payload.motDePasseActuel }
          : {}),
      },
    });
    return toUtilisateur(dto);
  },

  /** Envoie la photo (déjà réduite) en multipart/form-data, champ « photo ». */
  async uploadPhoto(photo: Blob): Promise<Utilisateur> {
    const body = new FormData();
    body.append("photo", photo, "photo.jpg");
    return toUtilisateur(await apiRequest<UtilisateurDto>(ENDPOINTS.mePhoto, { method: "POST", body }));
  },

  /** Retire la photo : les initiales sont de nouveau affichées. */
  async supprimerPhoto(): Promise<Utilisateur> {
    return toUtilisateur(await apiRequest<UtilisateurDto>(ENDPOINTS.mePhoto, { method: "DELETE" }));
  },
};

/** Données simulées tant que NEXT_PUBLIC_API_MOCK=true (voir .env.development). */
export const profilService: typeof httpProfilService = API_MOCK ? profilMock : httpProfilService;
