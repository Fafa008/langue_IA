import type { Role, Utilisateur } from "@/types/utilisateur";

/*
 * Comptes de démonstration, un par rôle, utilisables tant que NEXT_PUBLIC_API_MOCK=true.
 * Ils n'existent pas côté backend : à recréer dans les données de test (seeds) de la base.
 */

export const MOT_DE_PASSE_DEMO = "Demo2026";

export interface CompteDemo {
  utilisateur: Utilisateur;
  motDePasse: string;
}

const compte = (idUser: number, role: Role, prenom: string, nom: string, email: string): CompteDemo => ({
  motDePasse: MOT_DE_PASSE_DEMO,
  utilisateur: {
    idUser,
    prenom,
    nom,
    email,
    telephone: `034 00 000 0${idUser}`,
    role,
    statut: "ACTIF",
    dateInscription: "2025-01-06T08:00:00Z",
    photoUrl: null,
  },
});

export const COMPTES_DEMO: Record<Role, CompteDemo> = {
  APPRENANT: compte(1, "APPRENANT", "Rova", "RAKOTO", "apprenant@digitheque.mg"),
  FORMATEUR: compte(2, "FORMATEUR", "Hery", "RANDRIA", "formateur@digitheque.mg"),
  ADMINISTRATEUR: compte(3, "ADMINISTRATEUR", "Fanja", "RASOA", "admin@digitheque.mg"),
};
