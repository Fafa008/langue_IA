/*
 * Paquetage « Utilisateurs » du diagramme de classes.
 * Les noms reprennent ceux de l'UML (en camelCase) ; la conversion vers le
 * snake_case de l'API est faite dans services/.
 */

export type Role = "APPRENANT" | "FORMATEUR" | "ADMINISTRATEUR";

export type StatutUtilisateur = "ACTIF" | "INACTIF" | "SUSPENDU";

export interface Utilisateur {
  idUser: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  role: Role;
  statut: StatutUtilisateur;
  /** Date ISO 8601 */
  dateInscription: string;
  /** URL de la photo de profil, ou null : les initiales sont affichées à la place. */
  photoUrl: string | null;
}

export interface Apprenant extends Utilisateur {
  role: "APPRENANT";
  /** Date ISO 8601 (AAAA-MM-JJ) */
  dateNaissance: string | null;
  pays: string | null;
  ville: string | null;
  objectif: string | null;
}

/** Critères de la liste des utilisateurs (administration). */
export interface UtilisateursFiltres {
  /** Recherche sur le nom, le prénom ou l'e-mail. */
  recherche: string;
  /** null : tous les rôles. */
  role: Role | null;
  /** Numéro de page, à partir de 1. */
  page: number;
  taille: number;
}

/** Modification d'un utilisateur par un administrateur : seuls les champs présents sont changés. */
export interface ModificationUtilisateur {
  prenom?: string;
  nom?: string;
  email?: string;
  telephone?: string | null;
  role?: Role;
  statut?: StatutUtilisateur;
}

/** Valeurs du formulaire « Modifier l'utilisateur ». */
export interface UtilisateurFormValues {
  prenom: string;
  nom: string;
  email: string;
  /** Facultatif : vide si l'utilisateur n'a pas renseigné de numéro. */
  telephone: string;
  role: Role;
}
