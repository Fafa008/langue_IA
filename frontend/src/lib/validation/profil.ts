import { validatePassword } from "@/lib/password";
import type { FieldErrors } from "@/types/form";
import type { ProfilFormValues } from "@/types/profil";
import { compact, validateConfirmation, validateEmail, validateNomPersonne } from "./auth";

/** Numéro malgache complet : 10 chiffres commençant par 0 (« 034 12 345 67 », « 020 22 123 45 »). */
const TELEPHONE_PATTERN = /^0\d{9}$/;

export function validateTelephone(value: string): string | undefined {
  const chiffres = value.replace(/\D/g, "");
  if (!chiffres) return "Le numéro de téléphone est requis.";
  if (!TELEPHONE_PATTERN.test(chiffres)) return "Numéro de téléphone invalide : 10 chiffres, au format 030 00 000 00.";
}

/** Téléphone facultatif : son format n'est contrôlé que s'il est saisi. */
const validateTelephoneFacultatif = (value: string) => (value.trim() ? validateTelephone(value) : undefined);

/**
 * Les mots de passe ne sont contrôlés que si l'utilisateur veut en changer (un des trois champs est rempli) :
 * l'actuel est alors exigé, et le nouveau doit en être différent.
 */
function validateNouveauMotDePasse(values: ProfilFormValues): string | undefined {
  const erreur = validatePassword(values.motDePasse);
  if (erreur) return erreur;
  if (values.motDePasse === values.motDePasseActuel) return "Le nouveau mot de passe doit être différent de l'actuel.";
}

export function validateProfil(values: ProfilFormValues): FieldErrors<ProfilFormValues> {
  const changePassword = Boolean(values.motDePasseActuel || values.motDePasse || values.confirmation);
  return compact<ProfilFormValues>({
    prenom: validateNomPersonne(values.prenom, "prénom"),
    nom: validateNomPersonne(values.nom, "nom"),
    email: validateEmail(values.email),
    telephone: validateTelephoneFacultatif(values.telephone),
    motDePasseActuel: changePassword && !values.motDePasseActuel ? "Saisissez votre mot de passe actuel." : undefined,
    motDePasse: changePassword ? validateNouveauMotDePasse(values) : undefined,
    confirmation: changePassword ? validateConfirmation(values.motDePasse, values.confirmation) : undefined,
  });
}
