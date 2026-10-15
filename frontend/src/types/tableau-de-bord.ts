import type { Abonnement } from "./abonnement";
import type { LangueGeree } from "./langue";
import type { Apprenant } from "./utilisateur";

/*
 * Administrateur.consulterStatistiques() : vue calculée par le backend, sans table propre.
 * Elle ne fait qu'assembler des classes du diagramme (Apprenant, Langue, Abonnement, Formule) :
 * leurs types et leurs conversions sont ceux des autres pages, et suivront le diagramme sans retouche ici.
 */

export interface TotauxPlateforme {
  /** Tous les Utilisateur, quel que soit le statut. */
  utilisateurs: number;
  apprenants: number;
  formateurs: number;
  /** Atelier à venir (date_heure ≥ maintenant) et non ANNULE. */
  ateliersProgrammes: number;
}

export interface ApprenantsParLangue {
  langue: LangueGeree;
  /** Apprenants distincts qui suivent cette langue. */
  apprenants: number;
}

/** Inscription d'un Apprenant : son compte, les langues choisies et l'Abonnement souscrit (avec sa Formule). */
export interface InscriptionApprenant {
  apprenant: Apprenant;
  langues: LangueGeree[];
  /** null : l'abonnement n'a pas (encore) été créé. */
  abonnement: Abonnement | null;
}

export interface StatistiquesAdmin {
  totaux: TotauxPlateforme;
  apprenantsParLangue: ApprenantsParLangue[];
  dernieresInscriptions: InscriptionApprenant[];
}

/** Durées proposées pour la courbe des inscriptions, en jours. */
export const PERIODES_INSCRIPTIONS = [7, 30, 90] as const;
export type PeriodeInscriptions = (typeof PERIODES_INSCRIPTIONS)[number];

/** Nombre d'Utilisateur créés un jour donné (Utilisateur.date_inscription). */
export interface InscriptionsDuJour {
  /** AAAA-MM-JJ */
  date: string;
  nombre: number;
}
