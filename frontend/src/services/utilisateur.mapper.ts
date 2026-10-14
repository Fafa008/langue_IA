import { resoudreUrlPhoto } from "@/lib/photo";
import type { Apprenant, Role, StatutUtilisateur, Utilisateur } from "@/types/utilisateur";

/* Format « Utilisateur » renvoyé par l'API (snake_case), partagé par les services auth et profil. */

export interface UtilisateurDto {
  id_user: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  role: Role;
  statut: StatutUtilisateur;
  date_inscription: string;
  /** Chemin (« /media/photos/7.jpg ») ou URL complète de la photo ; absent ou null : pas de photo. */
  photo_url?: string | null;
}

export const toUtilisateur = (dto: UtilisateurDto): Utilisateur => ({
  idUser: dto.id_user,
  nom: dto.nom,
  prenom: dto.prenom,
  email: dto.email,
  telephone: dto.telephone,
  role: dto.role,
  statut: dto.statut,
  dateInscription: dto.date_inscription,
  photoUrl: resoudreUrlPhoto(dto.photo_url),
});

/** Classe Apprenant : Utilisateur + ses attributs propres. */
export interface ApprenantDto extends UtilisateurDto {
  role: "APPRENANT";
  date_naissance: string | null;
  pays: string | null;
  ville: string | null;
  objectif: string | null;
}

export const toApprenant = (dto: ApprenantDto): Apprenant => ({
  ...toUtilisateur(dto),
  role: "APPRENANT",
  dateNaissance: dto.date_naissance,
  pays: dto.pays,
  ville: dto.ville,
  objectif: dto.objectif,
});
