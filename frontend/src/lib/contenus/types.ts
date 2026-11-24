/**
 * Gestion des contenus pédagogiques par le formateur (USPxx) : modules, leçons, activités et parcours, par langue.
 * Spécification : docs/gestion-pedagogique.md (règles RG-GP-01 à RG-GP-10).
 * Aucune route backend n'existe encore : les données viennent de mock-service.ts, derrière l'interface de service.ts.
 */

/** Cycle de vie : Brouillon → Publié → Archivé. */
export type Statut = "BROUILLON" | "PUBLIE" | "ARCHIVE";

/** Formats du MVP (décision D5, docs/decisions/gestion_pedagogique_decisions.md) ; la production libre est corrigée par le formateur. */
export type TypeActivite = "QCM" | "ASSOCIATION" | "TEXTE_A_TROUS" | "VRAI_FAUX_NON_MENTIONNE" | "REMISE_EN_ORDRE" | "PRODUCTION_LIBRE";

export type Competence = "LECTURE" | "ECOUTE" | "ECRITURE" | "ORAL";

export type Referentiel = "CECRL" | "HSK";

/** Les quatre entités gérées par la rubrique « Contenus ». */
export type TypeEntite = "module" | "lecon" | "activite" | "parcours";

export type PhaseAssimil = "passive" | "active";

export interface Niveau {
  /** Unique toutes langues confondues : « en-A1 », « zh-HSK1 ». */
  id: string;
  /** « A1 », « HSK 1 ». */
  code: string;
  referentiel: Referentiel;
}

export interface Langue {
  /** Code ISO en minuscules : « fr », « zh ». */
  code: string;
  libelle: string;
  /** Vide : aucun contenu ne peut être créé pour cette langue. */
  niveaux: Niveau[];
}

/** RG-GP-10 : auteur et date de création et de dernière modification (simulés). */
export interface Tracabilite {
  creePar: string;
  creeLe: string;
  modifiePar: string;
  modifieLe: string;
}

interface EntiteBase extends Tracabilite {
  id: string;
  codeLangue: string;
  statut: Statut;
}

/** Regroupe des leçons. */
export interface Module extends EntiteBase {
  titre: string;
  /** Entier positif, unique par langue (RG-GP-01). */
  ordre: number;
}

export interface Lecon extends EntiteBase {
  idModule: string;
  idNiveau: string;
  titre: string;
  /** Entier positif, unique par langue (RG-GP-01) ; détermine la phase Assimil. */
  ordre: number;
  description: string;
}

export interface Activite extends EntiteBase {
  idLecon: string;
  type: TypeActivite;
  competence: Competence;
  /** De 1 à 5. */
  difficulte: number;
  consigne: string;
  contenu: string;
  /** Réponse de référence ou critère de correction ; obligatoire pour une production libre (RG-GP-04). */
  critereCorrection: string;
  /** Pas de téléversement : description de l'emplacement attendu du fichier audio ou image. */
  emplacementMedia: string;
  /** Champs propres au mandarin (langue ZH) ; chaînes vides ailleurs. */
  caracteres: string;
  pinyin: string;
  /** Pour une activité de compétence orale. */
  tonsAttendus: string;
}

export interface ParcoursElement {
  type: "lecon" | "activite";
  id: string;
}

export interface Parcours extends EntiteBase {
  titre: string;
  idNiveauCible: string;
  /** Ordonnés ; au moins un (RG-GP-05). */
  elements: ParcoursElement[];
}

/* Saisies des formulaires : ce que le formateur renseigne (la langue, l'identifiant et la traçabilité sont posés par le service). */

export type ModuleSaisie = Pick<Module, "titre" | "statut"> & { ordre: string };
export type LeconSaisie = Pick<Lecon, "idModule" | "idNiveau" | "titre" | "description" | "statut"> & { ordre: string };
export type ActiviteSaisie = Pick<
  Activite,
  "idLecon" | "consigne" | "contenu" | "critereCorrection" | "emplacementMedia" | "caracteres" | "pinyin" | "tonsAttendus" | "statut"
> & {
  /** Vide tant que le formateur n'a pas choisi. */
  type: TypeActivite | "";
  competence: Competence | "";
  difficulte: string;
};
export type ParcoursSaisie = Pick<Parcours, "titre" | "idNiveauCible" | "elements" | "statut">;

export interface EntitesParType {
  module: Module;
  lecon: Lecon;
  activite: Activite;
  parcours: Parcours;
}

export interface SaisiesParType {
  module: ModuleSaisie;
  lecon: LeconSaisie;
  activite: ActiviteSaisie;
  parcours: ParcoursSaisie;
}

export type Entite = EntitesParType[TypeEntite];

/** Tous les contenus d'une langue : sert aux règles qui portent sur plusieurs entités (unicité, publication, usage). */
export interface ContenusLangue {
  langue: Langue;
  modules: Module[];
  lecons: Lecon[];
  activites: Activite[];
  parcours: Parcours[];
}

export interface Compteurs {
  modules: number;
  lecons: number;
  activites: number;
  parcours: number;
}

export interface LangueResume extends Langue {
  compteurs: Compteurs;
}

export interface FiltresContenus {
  /** Sur le titre (la consigne pour une activité, qui n'a pas de titre). */
  recherche?: string;
  statut?: Statut | null;
  /** Activités d'une seule leçon. */
  idLecon?: string | null;
}
