import type { LangueAvecNiveaux, LangueGeree } from "@/types/langue";
import { toNiveau, type NiveauDto } from "./niveau.mapper";

/* Classe « Langue » (paquetage Pédagogie) au format de l'API, partagée par les services qui la renvoient. */

export interface LangueDto {
  id_langue: number;
  code: string;
  libelle: string;
}

export const toLangue = (dto: LangueDto): LangueGeree => ({
  idLangue: dto.id_langue,
  code: dto.code,
  libelle: dto.libelle,
});

/** Langue et ses niveaux (association LangueNiveau). */
export interface LangueAvecNiveauxDto extends LangueDto {
  niveaux: NiveauDto[];
}

export const toLangueAvecNiveaux = (dto: LangueAvecNiveauxDto): LangueAvecNiveaux => ({
  ...toLangue(dto),
  niveaux: dto.niveaux.map(toNiveau),
});
