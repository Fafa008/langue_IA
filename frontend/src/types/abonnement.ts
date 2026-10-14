import type { Formule } from "./formule";

/* Classe « Abonnement » et énumération StatutAbonnement du paquetage Facturation. */

export type StatutAbonnement = "ACTIF" | "EXPIRE" | "SUSPENDU";

/** Souscrit par un Apprenant ; correspond à une Formule (quotas copiés à la souscription). */
export interface Abonnement {
  idAbonnement: number;
  /** Date ISO 8601 (AAAA-MM-JJ) */
  dateDebut: string;
  /** Date ISO 8601 (AAAA-MM-JJ) */
  dateFin: string;
  statut: StatutAbonnement;
  quotaHeures: number;
  quotaAteliers: number;
  formule: Formule;
}
