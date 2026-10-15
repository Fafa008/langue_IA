/* Édition du profil de l'utilisateur connecté (rôle, statut et dates restent gérés par le backend). */

export interface ProfilPayload {
  prenom: string;
  nom: string;
  email: string;
  /** null : pas de numéro (le téléphone est facultatif). */
  telephone: string | null;
  /** Absent : le mot de passe reste inchangé. */
  motDePasse?: string;
  /** Envoyé avec motDePasse : le backend le vérifie avant d'accepter le changement. */
  motDePasseActuel?: string;
}

export interface ProfilFormValues {
  prenom: string;
  nom: string;
  email: string;
  /** Facultatif : vide si l'utilisateur ne donne pas de numéro. */
  telephone: string;
  /** Exigé seulement pour changer de mot de passe. */
  motDePasseActuel: string;
  /** Nouveau mot de passe ; laissé vide pour garder l'actuel. */
  motDePasse: string;
  confirmation: string;
}
