import type { Abonnement, StatutAbonnement } from "@/types/abonnement";
import { toFormule, type FormuleDto } from "./formule.mapper";

/* Classe « Abonnement » (paquetage Facturation) au format de l'API, avec sa Formule. */

export interface AbonnementDto {
  id_abonnement: number;
  date_debut: string;
  date_fin: string;
  statut: StatutAbonnement;
  quota_heures: number;
  quota_ateliers: number;
  formule: FormuleDto;
}

export const toAbonnement = (dto: AbonnementDto): Abonnement => ({
  idAbonnement: dto.id_abonnement,
  dateDebut: dto.date_debut,
  dateFin: dto.date_fin,
  statut: dto.statut,
  quotaHeures: dto.quota_heures,
  quotaAteliers: dto.quota_ateliers,
  formule: toFormule(dto.formule),
});
