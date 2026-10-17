import type { TypeContrat } from "@/types/formateur";

export const TYPE_CONTRAT_LABELS: Record<TypeContrat, string> = {
  CDI: "CDI",
  CDD: "CDD",
  VACATAIRE: "Vacataire",
  PRESTATAIRE: "Prestataire",
};

export const TYPES_CONTRAT = Object.keys(TYPE_CONTRAT_LABELS) as TypeContrat[];

/** Valeur reçue de l'API : texte libre côté base, ramené aux choix connus (sinon null). */
export const toTypeContrat = (value: string | null | undefined): TypeContrat | null =>
  value && (TYPES_CONTRAT as string[]).includes(value) ? (value as TypeContrat) : null;
