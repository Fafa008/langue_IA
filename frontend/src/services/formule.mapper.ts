import type { Formule } from "@/types/formule";
import type { CodeLangue } from "@/types/langue";

/* Classe « Formule » (paquetage Facturation) au format de l'API, partagée par les services qui la renvoient. */

export interface FormuleDto {
  id_formule: number;
  libelle: string;
  prix_mensuel: number;
  duree_mois: number;
  quota_heures: number;
  quota_ateliers: number;
  langues: { code: CodeLangue; libelle: string }[];
}

export const toFormule = (dto: FormuleDto): Formule => ({
  idFormule: dto.id_formule,
  libelle: dto.libelle,
  prixMensuel: dto.prix_mensuel,
  dureeMois: dto.duree_mois,
  quotaHeures: dto.quota_heures,
  quotaAteliers: dto.quota_ateliers,
  langues: dto.langues.map((l) => l.code),
});
