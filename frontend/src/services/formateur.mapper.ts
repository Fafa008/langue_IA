import { toTypeContrat } from "@/lib/formateur";
import type { Formateur } from "@/types/formateur";
import { toLangue, type LangueDto } from "./langue.mapper";
import { toUtilisateur, type UtilisateurDto } from "./utilisateur.mapper";

/* Classe « Formateur » au format de l'API : Utilisateur + ses attributs propres et ses langues enseignées. */

export interface FormateurDto extends UtilisateurDto {
  role: "FORMATEUR";
  type_contrat: string | null;
  certifications: string | null;
  langues_enseignees: LangueDto[];
}

export const toFormateur = (dto: FormateurDto): Formateur => ({
  ...toUtilisateur(dto),
  role: "FORMATEUR",
  typeContrat: toTypeContrat(dto.type_contrat),
  certifications: dto.certifications,
  languesEnseignees: dto.langues_enseignees.map(toLangue).sort((a, b) => a.libelle.localeCompare(b.libelle, "fr")),
});
