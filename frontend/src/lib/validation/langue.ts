import { normaliserEspaces } from "@/lib/saisie";
import type { FieldErrors } from "@/types/form";
import type { LangueFormValues } from "@/types/langue";
import { compact } from "./auth";

/** Lettres (accents compris), espaces, tirets ou apostrophes : « Créole mauricien ». */
const LIBELLE_PATTERN = /^\p{L}+(?:[ '’-]\p{L}+)*$/u;
/** Code ISO 639-1 (2 lettres) ou 639-2 (3 lettres) : « FR », « MG », « HAW ». */
const CODE_PATTERN = /^[A-Za-z]{2,3}$/;

export function validateLangue(values: LangueFormValues): FieldErrors<LangueFormValues> {
  const libelle = normaliserEspaces(values.libelle);
  return compact<LangueFormValues>({
    libelle: !libelle
      ? "La désignation est requise."
      : !LIBELLE_PATTERN.test(libelle)
        ? "La désignation ne doit contenir que des lettres, espaces, tirets ou apostrophes."
        : undefined,
    code: !values.code.trim()
      ? "Le code est requis."
      : !CODE_PATTERN.test(values.code.trim())
        ? "Le code doit contenir 2 ou 3 lettres (code ISO, ex. FR)."
        : undefined,
    idNiveaux: values.idNiveaux.length === 0 ? "Choisissez au moins un niveau ouvert pour cette langue." : undefined,
  });
}
