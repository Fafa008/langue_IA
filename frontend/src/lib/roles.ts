import type { Role, StatutUtilisateur } from "@/types/utilisateur";

export const ROLE_LABELS: Record<Role, string> = {
  APPRENANT: "Apprenant",
  FORMATEUR: "Formateur",
  ADMINISTRATEUR: "Administrateur",
};

export const ROLES = Object.keys(ROLE_LABELS) as Role[];

export const STATUT_LABELS: Record<StatutUtilisateur, string> = {
  ACTIF: "Actif",
  INACTIF: "Inactif",
  SUSPENDU: "Suspendu",
};
