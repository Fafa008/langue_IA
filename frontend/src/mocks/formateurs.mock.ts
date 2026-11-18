import { ApiError, HTTP_STATUS } from "@/lib/api-client";
import type { Formateur, FormateurPayload, FormateursFiltres, TypeContrat } from "@/types/formateur";
import type { Paginated } from "@/types/pagination";
import type { StatutUtilisateur } from "@/types/utilisateur";
import { delay } from "./delay";
import { languesParIds } from "./langues.mock";

/* Formateurs simulés, modifiés en mémoire jusqu'au rechargement de la page. */

interface LigneFormateur extends Omit<Formateur, "languesEnseignees"> {
  idLangues: number[];
}

const ligne = (
  idUser: number,
  prenom: string,
  nom: string,
  typeContrat: TypeContrat | null,
  idLangues: number[],
  statut: StatutUtilisateur = "ACTIF",
): LigneFormateur => ({
  idUser,
  prenom,
  nom,
  email: `${prenom.toLowerCase()}.${nom.toLowerCase()}@digitheque.mg`,
  telephone: idUser % 2 === 0 ? `034 1${idUser % 10} 234 56` : null,
  role: "FORMATEUR",
  statut,
  dateInscription: `2025-0${(idUser % 9) + 1}-15T09:00:00Z`,
  photoUrl: null,
  typeContrat,
  certifications: typeContrat === "CDI" ? "DALF C2, habilitation examinateur DELF" : null,
  idLangues,
});

// Le compte de démonstration « formateur@digitheque.mg » (id 2) en tête
const FORMATEURS: LigneFormateur[] = [
  { ...ligne(2, "Hery", "RANDRIA", "CDI", [1, 2]), email: "formateur@digitheque.mg" },
  ligne(21, "Lova", "RABE", "CDD", [3]),
  ligne(22, "Mialy", "RAKOTO", "VACATAIRE", [2]),
  ligne(23, "Tiana", "ANDRIAMANANA", "CDI", [1, 4]),
  ligne(24, "Fanja", "RAZAFY", "PRESTATAIRE", [5], "INACTIF"),
  ligne(25, "Nirina", "RASOA", "CDD", [2, 6]),
  ligne(26, "Haja", "RAMANANTSOA", "VACATAIRE", [1]),
  ligne(27, "Voahirana", "RAHARISON", "CDI", [6, 7]),
  ligne(28, "Andry", "RAJAONA", null, [12]),
  ligne(29, "Sitraka", "RANAIVO", "CDD", [3, 8]),
  ligne(30, "Zo", "RAKOTOBE", "VACATAIRE", [2], "SUSPENDU"),
  ligne(31, "Fara", "RASOLO", "CDI", [1, 12]),
];

let prochainId = 100;

const normaliser = (texte: string) => texte.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const enFormateur = ({ idLangues, ...f }: LigneFormateur): Formateur => ({
  ...f,
  languesEnseignees: languesParIds(idLangues).sort((a, b) => a.libelle.localeCompare(b.libelle, "fr")),
});

function verifierEmailLibre(email: string | undefined, idUser?: number) {
  if (email && FORMATEURS.some((f) => f.email === email && f.idUser !== idUser)) {
    throw new ApiError(HTTP_STATUS.CONFLICT, "Email already registered", "Email already registered");
  }
}

function trouver(idUser: number): number {
  const index = FORMATEURS.findIndex((f) => f.idUser === idUser);
  if (index === -1) throw new ApiError(404, "Trainer not found", "Formateur introuvable.");
  return index;
}

export const formateursMock = {
  async lister({ recherche, statut, page, taille }: FormateursFiltres): Promise<Paginated<Formateur>> {
    await delay(300);
    const terme = normaliser(recherche.trim());
    const resultats = FORMATEURS.filter(
      (f) => (!statut || f.statut === statut) && (!terme || normaliser(`${f.prenom} ${f.nom} ${f.email}`).includes(terme)),
    ).sort((a, b) => a.nom.localeCompare(b.nom, "fr") || a.prenom.localeCompare(b.prenom, "fr"));
    return { items: resultats.slice((page - 1) * taille, page * taille).map(enFormateur), total: resultats.length, page, taille };
  },

  async creer(payload: FormateurPayload): Promise<Formateur> {
    await delay(500);
    verifierEmailLibre(payload.email);
    const formateur: LigneFormateur = {
      idUser: prochainId++,
      prenom: payload.prenom ?? "",
      nom: payload.nom ?? "",
      email: payload.email ?? "",
      telephone: payload.telephone ?? null,
      role: "FORMATEUR",
      statut: "ACTIF",
      dateInscription: new Date().toISOString(),
      photoUrl: null,
      typeContrat: payload.typeContrat ?? null,
      certifications: payload.certifications ?? null,
      idLangues: payload.idLangues ?? [],
    };
    FORMATEURS.push(formateur);
    return enFormateur(formateur);
  },

  async modifier(idUser: number, payload: FormateurPayload): Promise<Formateur> {
    await delay(500);
    const index = trouver(idUser);
    verifierEmailLibre(payload.email, idUser);
    const changements = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
    FORMATEURS[index] = { ...FORMATEURS[index], ...changements };
    return enFormateur(FORMATEURS[index]);
  },
};
