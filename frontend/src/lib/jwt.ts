/*
 * Lecture du JWT renvoyé par le backend. Le token n'est PAS vérifié ici (pas de clé côté navigateur) :
 * on lit seulement sa date d'expiration pour ne pas garder une session déjà expirée.
 */

/** Date d'expiration (en ms) lue dans le champ `exp` du JWT, ou null si elle est absente ou illisible. */
export function getJwtExpiry(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const { exp } = JSON.parse(json);
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Un token illisible ou sans date d'expiration ne peut pas être considéré comme valide côté navigateur. */
export function isJwtExpired(token: string, now: number = Date.now()): boolean {
  const expiry = getJwtExpiry(token);
  if (expiry === null) return true;
  return expiry <= now;
}
