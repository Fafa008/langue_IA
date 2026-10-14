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

/** E-mail envoyé à l'API : sans espaces autour et en minuscules. */
export function normaliserEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Retire les espaces en trop avant l'envoi : «  Rova   Marie » → « Rova Marie » */
export function normaliserEspaces(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Initiales affichées à la place de la photo : « Finoana », « RASOLOFO » → « FR ». */
export function initiales(prenom: string, nom: string): string {
  return `${prenom.trim().charAt(0)}${nom.trim().charAt(0)}`.toLocaleUpperCase(LOCALE);
}

/** Nombre de chiffres d'un numéro malgache au format local (« 034 12 345 67 »). */
export const TELEPHONE_CHIFFRES = 10;

/**
 * Téléphone au format malgache « 030 00 000 00 » : seuls les chiffres sont gardés (une lettre tapée
 * n'apparaît pas), groupés 3-2-3-2, 10 chiffres au plus. Un numéro international collé ou déjà
 * enregistré (« +261 34 12 345 67 ») est ramené au format local (« 034 12 345 67 »).
 */
export function formatTelephone(value: string): string {
  let chiffres = value.replace(/\D/g, "");
  if (chiffres.startsWith("261") && chiffres.length > TELEPHONE_CHIFFRES) chiffres = `0${chiffres.slice(3)}`;
  chiffres = chiffres.slice(0, TELEPHONE_CHIFFRES);
  return [chiffres.slice(0, 3), chiffres.slice(3, 5), chiffres.slice(5, 8), chiffres.slice(8)].filter(Boolean).join(" ");
}
