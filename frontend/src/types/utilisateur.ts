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
}

export interface Apprenant extends Utilisateur {
  role: "APPRENANT";
  /** Date ISO 8601 (AAAA-MM-JJ) */
  dateNaissance: string | null;
  pays: string | null;
  ville: string | null;
  objectif: string | null;
}
