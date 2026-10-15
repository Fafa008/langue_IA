import type { Formule } from "@/types/formule";

// Formules d'exemple : à remplacer par le catalogue réel (GET /api/v1/formules).
// Prix, durées et quotas sont provisoires.
export const FORMULES_MOCK: Formule[] = [
  {
    idFormule: 1,
    libelle: "Simple",
    prixMensuel: 60000,
    dureeMois: 1,
    quotaHeures: 6,
    quotaAteliers: 1,
    langues: [],
  },
  {
    idFormule: 2,
    libelle: "Luxe",
    prixMensuel: 100000,
    dureeMois: 3,
    quotaHeures: 12,
    quotaAteliers: 3,
    langues: [],
  },
  {
    idFormule: 3,
    libelle: "Premium",
    prixMensuel: 150000,
    dureeMois: 6,
    quotaHeures: 24,
    quotaAteliers: 6,
    langues: [],
  },
];
