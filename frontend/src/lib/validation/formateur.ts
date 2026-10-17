import type { FieldErrors } from "@/types/form";
import type { FormateurFormValues } from "@/types/formateur";
import { compact, validateEmail, validateNomPersonne } from "./auth";
import { validateTelephoneFacultatif } from "./profil";

export const CERTIFICATIONS_MAX = 500;

export function validateFormateur(values: FormateurFormValues): FieldErrors<FormateurFormValues> {
  return compact<FormateurFormValues>({
    prenom: validateNomPersonne(values.prenom, "prénom"),
    nom: validateNomPersonne(values.nom, "nom"),
    email: validateEmail(values.email),
    telephone: validateTelephoneFacultatif(values.telephone),
    typeContrat: values.typeContrat ? undefined : "Choisissez le type de contrat.",
    certifications:
      values.certifications.trim().length > CERTIFICATIONS_MAX
        ? `Les certifications ne doivent pas dépasser ${CERTIFICATIONS_MAX} caractères.`
        : undefined,
    idLangues: values.idLangues.length === 0 ? "Choisissez au moins une langue enseignée." : undefined,
  });
}
