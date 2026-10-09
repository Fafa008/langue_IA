/* Mise en forme des champs texte, appliquée pendant la saisie (voir la prop `format` de Input). */

const LOCALE = "fr-FR";

/** « rakoto » → « RAKOTO » */
export function formatNom(value: string): string {
  return value.toLocaleUpperCase(LOCALE);
}

/**
 * Majuscule au début de chaque prénom, y compris les prénoms composés :
 * « jean-pierre » → « Jean-Pierre », « rova marie » → « Rova Marie ».
 */
export function formatPrenom(value: string): string {
  return value
    .toLocaleLowerCase(LOCALE)
    .replace(/(^|[\s-])(\p{L})/gu, (_, separateur: string, lettre: string) => separateur + lettre.toLocaleUpperCase(LOCALE));
}

/**
 * E-mail en minuscules, limité aux caractères acceptés par la validation
 * (lettres non accentuées, chiffres, . _ % + - @) : « Rova Rakoto@Exemple.com » → « rovarakoto@exemple.com ».
 */
export function formatEmail(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._%+@-]/g, "");
}

/** Retire les espaces en trop avant l'envoi : «  Rova   Marie » → « Rova Marie » */
export function normaliserEspaces(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
