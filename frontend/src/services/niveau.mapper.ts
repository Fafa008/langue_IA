import type { Niveau } from "@/types/langue";

/* Classe « Niveau » (paquetage Pédagogie) au format de l'API, partagée par les services qui la renvoient. */

export interface NiveauDto {
  id_niveau: number;
  code: string;
  libelle: string;
}

export const toNiveau = (dto: NiveauDto): Niveau => ({ idNiveau: dto.id_niveau, code: dto.code, libelle: dto.libelle });
