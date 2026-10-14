/* Classe « Langue » du paquetage Pédagogie. */

export type CodeLangue = "fr" | "en" | "zh" | "it" | "de";

export interface Langue {
  code: CodeLangue;
  libelle: string;
}

/** Langue proposée dans l'interface, avec son drapeau (chemin dans public/). */
export interface LangueAffichee extends Langue {
  flag: string;
}

/* Administration des langues (table Langue : code et libellé). */

export interface LangueGeree {
  idLangue: number;
  /** Code ISO 639 en minuscules (« fr ») ; affiché en majuscules. */
  code: string;
  /** Désignation affichée : « Français ». */
  libelle: string;
}

/**
 * Langue avec ses niveaux ouverts : association Langue 0..* — 0..* Niveau (table LangueNiveau).
 * Renvoyée par l'administration des langues ; ailleurs, la Langue seule suffit.
 */
export interface LangueAvecNiveaux extends LangueGeree {
  niveaux: Niveau[];
}

export interface LanguesFiltres {
  recherche: string;
  page: number;
  taille: number;
}

/** Création, ou modification partielle (seuls les champs présents sont changés). */
export interface LanguePayload {
  code?: string;
  libelle?: string;
  /** Niveaux ouverts pour la langue : la liste remplace entièrement la précédente. */
  idNiveaux?: number[];
}

export interface LangueFormValues {
  libelle: string;
  code: string;
  idNiveaux: number[];
}

/* Administration des niveaux (table Niveau), associés ensuite à chaque langue (LangueNiveau). */

export interface Niveau {
  idNiveau: number;
  /** Code court, unique : « A1 », « HSK 3 ». */
  code: string;
  /** Description : « Débutant ». */
  libelle: string;
}

export interface NiveauPayload {
  code: string;
  libelle: string;
}

export type NiveauFormValues = NiveauPayload;
