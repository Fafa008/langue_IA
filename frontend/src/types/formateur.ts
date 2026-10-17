import type { LangueGeree } from "./langue";
import type { StatutUtilisateur, Utilisateur } from "./utilisateur";

/*
 * Classe « Formateur » du paquetage Utilisateurs : un Utilisateur de rôle FORMATEUR,
 * avec ses attributs propres et ses langues enseignées (table FormateurLangue).
 */

/** Valeurs proposées pour Formateur.type_contrat (texte libre côté base). */
export type TypeContrat = "CDI" | "CDD" | "VACATAIRE" | "PRESTATAIRE";

export interface Formateur extends Utilisateur {
  role: "FORMATEUR";
  typeContrat: TypeContrat | null;
  /** Diplômes et certifications (texte libre), ou null. */
  certifications: string | null;
  languesEnseignees: LangueGeree[];
}

/** Critères de la liste des formateurs (administration). */
export interface FormateursFiltres {
  /** Recherche sur le nom, le prénom ou l'e-mail. */
  recherche: string;
  /** null : tous les statuts. */
  statut: StatutUtilisateur | null;
  page: number;
  taille: number;
}

/** Création, ou modification partielle (seuls les champs présents sont changés). */
export interface FormateurPayload {
  prenom?: string;
  nom?: string;
  email?: string;
  telephone?: string | null;
  typeContrat?: TypeContrat;
  certifications?: string | null;
  /** Langues enseignées : la liste remplace entièrement la précédente. */
  idLangues?: number[];
  /** Désactiver ou réactiver le compte. */
  statut?: StatutUtilisateur;
}

/** Valeurs du formulaire « Ajouter / Modifier un formateur ». */
export interface FormateurFormValues {
  prenom: string;
  nom: string;
  email: string;
  /** Facultatif : vide si non renseigné. */
  telephone: string;
  /** Vide tant qu'aucun contrat n'est choisi. */
  typeContrat: TypeContrat | "";
  certifications: string;
  idLangues: number[];
}
