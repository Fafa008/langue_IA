import { NIVEAU_CODE_MAX_LONGUEUR } from "@/lib/niveaux";
import { normaliserEspaces } from "@/lib/saisie";
import type { FieldErrors } from "@/types/form";
import type { NiveauFormValues } from "@/types/langue";
import { compact } from "./auth";

export function validateNiveau(values: NiveauFormValues): FieldErrors<NiveauFormValues> {
  const code = normaliserEspaces(values.code);
  return compact<NiveauFormValues>({
    code: !code
      ? "Le code est requis."
      : code.length > NIVEAU_CODE_MAX_LONGUEUR
        ? `Le code compte ${NIVEAU_CODE_MAX_LONGUEUR} caractères au maximum.`
        : undefined,
    libelle: normaliserEspaces(values.libelle) ? undefined : "Le libellé est requis.",
  });
}
