import type { Role, StatutUtilisateur, Utilisateur } from "@/types/utilisateur";

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
});
