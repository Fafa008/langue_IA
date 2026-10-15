import { ApiError, HTTP_STATUS } from "@/lib/api-client";
import type { Paginated } from "@/types/pagination";
import type { ModificationUtilisateur, Role, StatutUtilisateur, Utilisateur, UtilisateursFiltres } from "@/types/utilisateur";
import { COMPTES_DEMO } from "./comptes-demo";
import { delay } from "./delay";

/* Base d'utilisateurs simulée, filtrée et paginée comme le ferait l'API. */

const PRENOMS = ["Jean", "Marie", "Paul", "Lova", "Tiana", "Lala", "Andry", "Sitraka", "Hery", "Fanja", "Mamy", "Voahangy"];
const NOMS = ["DUPONT", "PAUL", "RAKOTO", "RAMIARISOA", "ANDRIAMIHAJA", "RAJAONARY", "RANDRIANARIVELO", "RAKOTOMALALA"];

function genererUtilisateurs(nombre: number): Utilisateur[] {
  return Array.from({ length: nombre }, (_, i) => {
    const role: Role = i % 7 === 2 ? "ADMINISTRATEUR" : i % 3 === 1 ? "FORMATEUR" : "APPRENANT";
    const statut: StatutUtilisateur = i % 9 === 5 ? "INACTIF" : i % 13 === 8 ? "SUSPENDU" : "ACTIF";
    const prenom = PRENOMS[i % PRENOMS.length];
    const nom = NOMS[(i * 5) % NOMS.length];
    return {
      idUser: i + 1,
      prenom,
      nom,
      email: `${prenom}.${nom}${i + 1}@exemple.com`.toLowerCase(),
      telephone: null,
      role,
      statut,
      dateInscription: new Date(Date.UTC(2025, i % 12, (i * 7) % 28 + 1)).toISOString(),
      photoUrl: null,
    };
  });
}

// Les comptes de démonstration en tête, puis des utilisateurs générés (identifiants à partir de 100)
const UTILISATEURS = [
  ...Object.values(COMPTES_DEMO).map((c) => c.utilisateur),
  ...genererUtilisateurs(47).map((u) => ({ ...u, idUser: u.idUser + 100 })),
];

const normaliser = (texte: string) => texte.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export const utilisateursMock = {
  async lister({ recherche, role, page, taille }: UtilisateursFiltres): Promise<Paginated<Utilisateur>> {
    await delay(300);
    const terme = normaliser(recherche.trim());
    const resultats = UTILISATEURS.filter(
      (u) =>
        (!role || u.role === role) &&
        (!terme || normaliser(`${u.prenom} ${u.nom} ${u.email}`).includes(terme)),
    );
    return { items: resultats.slice((page - 1) * taille, page * taille), total: resultats.length, page, taille };
  },

  /** Modifie l'utilisateur en mémoire (jusqu'au rechargement de la page). */
  async modifier(idUser: number, modification: ModificationUtilisateur): Promise<Utilisateur> {
    await delay(500);
    const index = UTILISATEURS.findIndex((u) => u.idUser === idUser);
    if (index === -1) throw new ApiError(404, "User not found", "Utilisateur introuvable.");
    if (modification.email && UTILISATEURS.some((u) => u.email === modification.email && u.idUser !== idUser)) {
      throw new ApiError(HTTP_STATUS.CONFLICT, "Email already registered", "Email already registered");
    }
    const changements = Object.fromEntries(Object.entries(modification).filter(([, v]) => v !== undefined));
    UTILISATEURS[index] = { ...UTILISATEURS[index], ...changements };
    return UTILISATEURS[index];
  },
};
