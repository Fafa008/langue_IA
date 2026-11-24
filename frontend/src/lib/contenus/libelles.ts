import type { Activite, Competence, Entite, Statut, TypeActivite, TypeEntite } from "./types";

export const LIBELLES_STATUT: Record<Statut, string> = {
  BROUILLON: "Brouillon",
  PUBLIE: "Publié",
  ARCHIVE: "Archivé",
};

export const LIBELLES_TYPE_ACTIVITE: Record<TypeActivite, string> = {
  QCM: "QCM",
  ASSOCIATION: "Association",
  TEXTE_A_TROUS: "Texte à trous",
  VRAI_FAUX_NON_MENTIONNE: "Vrai / faux / non mentionné",
  REMISE_EN_ORDRE: "Remise en ordre",
  PRODUCTION_LIBRE: "Production libre",
};

export const LIBELLES_COMPETENCE: Record<Competence, string> = {
  LECTURE: "Lecture",
  ECOUTE: "Écoute",
  ECRITURE: "Écriture",
  ORAL: "Oral",
};

export const STATUTS: Statut[] = ["BROUILLON", "PUBLIE", "ARCHIVE"];
export const TYPES_ACTIVITE = Object.keys(LIBELLES_TYPE_ACTIVITE) as TypeActivite[];
export const COMPETENCES = Object.keys(LIBELLES_COMPETENCE) as Competence[];

/** Noms des entités, pour composer les libellés et messages (« Ajouter une leçon », « Aucune leçon »…). */
export const NOMS_ENTITE: Record<TypeEntite, { singulier: string; pluriel: string; feminin: boolean }> = {
  module: { singulier: "module", pluriel: "modules", feminin: false },
  lecon: { singulier: "leçon", pluriel: "leçons", feminin: true },
  activite: { singulier: "activité", pluriel: "activités", feminin: true },
  parcours: { singulier: "parcours", pluriel: "parcours", feminin: false },
};

/** « le module », « la leçon », « l'activité ». */
export function leNom(type: TypeEntite): string {
  const { singulier, feminin } = NOMS_ENTITE[type];
  return /^[aeiouéè]/.test(singulier) ? `l'${singulier}` : `${feminin ? "la" : "le"} ${singulier}`;
}

/** « ce module », « cette leçon ». */
export const ceNom = (type: TypeEntite) => `${NOMS_ENTITE[type].feminin ? "cette" : "ce"} ${NOMS_ENTITE[type].singulier}`;

/** Accord du participe : « ajouté » ou « ajoutée ». */
export const accorder = (type: TypeEntite, participe: string) => `${participe}${NOMS_ENTITE[type].feminin ? "e" : ""}`;

/** « Le module » : première lettre en majuscule. */
export const majuscule = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1);

/** « un module », « une leçon ». */
export const unOuUne = (type: TypeEntite) => `${NOMS_ENTITE[type].feminin ? "une" : "un"} ${NOMS_ENTITE[type].singulier}`;

/** « Aucun module », « Aucune leçon ». */
export const aucun = (type: TypeEntite) => `${NOMS_ENTITE[type].feminin ? "Aucune" : "Aucun"} ${NOMS_ENTITE[type].singulier}`;

const LONGUEUR_EXTRAIT = 60;

/** Début de la consigne, pour nommer une activité (qui n'a pas de titre). */
export function extrait(texte: string, longueur = LONGUEUR_EXTRAIT): string {
  const t = texte.replace(/\s+/g, " ").trim();
  return t.length > longueur ? `${t.slice(0, longueur - 1)}…` : t;
}

/** Nom affiché d'une entité dans les messages et les listes : son titre, ou « QCM : consigne… » pour une activité. */
export function libelleEntite(type: TypeEntite, entite: Entite): string {
  if (type === "activite") {
    const a = entite as Activite;
    return `${LIBELLES_TYPE_ACTIVITE[a.type]} : ${extrait(a.consigne, 40)}`;
  }
  return (entite as { titre: string }).titre;
}
