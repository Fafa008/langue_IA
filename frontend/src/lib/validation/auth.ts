import { libelleLangue } from "@/lib/languages";
import { normaliserEspaces } from "@/lib/saisie";
import { validatePassword } from "@/lib/password";
import type { Formule } from "@/types/formule";
import type { LoginFormValues, RegisterFormValues, ResetPasswordFormValues } from "@/types/auth";
import type { FieldErrors } from "@/types/form";

/**
 * prenom.nom+tag@sous.domaine.mg
 * - partie locale : lettres, chiffres, _ % + -, avec des points ni au début, ni à la fin, ni doublés ;
 * - domaine : parties séparées par des points, sans tiret au début ou à la fin ;
 * - extension : au moins 2 lettres.
 */
const EMAIL_PATTERN = /^[A-Za-z0-9_%+-]+(?:\.[A-Za-z0-9_%+-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;
const EMAIL_MAX_LENGTH = 254;

/** Lettres (accents compris), séparées par un espace, un tiret ou une apostrophe : « Jean-Pierre », « N'Diaye ». */
const NOM_PATTERN = /^\p{L}+(?:[ '’-]\p{L}+)*$/u;

export function validateEmail(email: string): string | undefined {
  const value = email.trim();
  if (!value) return "L'adresse e-mail est requise.";
  if (value.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(value)) return "Adresse e-mail invalide.";
}

/** `champ` complète les messages : « Le prénom est requis. » */
function validateNomPersonne(value: string, champ: "prénom" | "nom"): string | undefined {
  const nom = normaliserEspaces(value);
  if (!nom) return `Le ${champ} est requis.`;
  if (!NOM_PATTERN.test(nom)) return `Le ${champ} ne doit contenir que des lettres, espaces, tirets ou apostrophes.`;
}

/** Date de naissance obligatoire, au format AAAA-MM-JJ (valeur d'un <input type="date">). */
export function validateBirthDate(value: string, today: Date = new Date()): string | undefined {
  if (!value) return "La date de naissance est requise.";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Date invalide.";
  if (date > today) return "La date de naissance ne peut pas être dans le futur.";
  if (today.getFullYear() - date.getFullYear() > 120) return "Date de naissance invalide.";
}

/**
 * Formule obligatoire ; si elle ne couvre que certaines langues, toutes les
 * langues choisies doivent en faire partie (Formule.langues dans l'UML).
 */
export function validateFormule(
  idFormule: number | null,
  langues: RegisterFormValues["langues"],
  formules: Formule[],
): string | undefined {
  if (idFormule === null) return "Choisissez une formule d'abonnement.";
  const formule = formules.find((f) => f.idFormule === idFormule);
  if (!formule || formule.langues.length === 0) return;
  const nonCouvertes = langues.filter((code) => !formule.langues.includes(code));
  if (nonCouvertes.length === 0) return;
  return `La formule « ${formule.libelle} » ne couvre pas : ${nonCouvertes.map(libelleLangue).join(", ")}.`;
}

function validateConfirmation(password: string, confirm: string): string | undefined {
  if (!confirm) return "Veuillez confirmer le mot de passe.";
  if (confirm !== password) return "Les mots de passe ne correspondent pas.";
}

/** Retire les clés sans erreur pour que `Object.keys(errors).length` reflète la validité. */
function compact<T>(errors: FieldErrors<T>): FieldErrors<T> {
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v)) as FieldErrors<T>;
}

export function validateLogin(values: LoginFormValues): FieldErrors<LoginFormValues> {
  return compact<LoginFormValues>({
    email: validateEmail(values.email),
    motDePasse: values.motDePasse ? undefined : "Le mot de passe est requis.",
  });
}

export function validateRegister(
  values: RegisterFormValues,
  formules: Formule[] = [],
): FieldErrors<RegisterFormValues> {
  return compact<RegisterFormValues>({
    prenom: validateNomPersonne(values.prenom, "prénom"),
    nom: validateNomPersonne(values.nom, "nom"),
    email: validateEmail(values.email),
    dateNaissance: validateBirthDate(values.dateNaissance),
    langues: values.langues.length > 0 ? undefined : "Choisissez au moins une langue.",
    idFormule: validateFormule(values.idFormule, values.langues, formules),
    motDePasse: validatePassword(values.motDePasse),
    confirmation: validateConfirmation(values.motDePasse, values.confirmation),
    accepteConditions: values.accepteConditions ? undefined : "Vous devez accepter les conditions.",
  });
}

export function validateForgotPassword(values: { email: string }): FieldErrors<{ email: string }> {
  return compact({ email: validateEmail(values.email) });
}

export function validateResetPassword(values: ResetPasswordFormValues): FieldErrors<ResetPasswordFormValues> {
  return compact<ResetPasswordFormValues>({
    motDePasse: validatePassword(values.motDePasse),
    confirmation: validateConfirmation(values.motDePasse, values.confirmation),
  });
}
