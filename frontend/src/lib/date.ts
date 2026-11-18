/** Date du jour au format AAAA-MM-JJ (valeur d'un <input type="date">), en heure locale. */
export function dateDuJourIso(): string {
  const now = new Date();
  // toISOString() renvoie la date UTC : on la décale du fuseau horaire local
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

/** « 2025-01-12T08:30:00Z » → « 12/01/2025 » */
export function formatDateCourte(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dateCourte.format(date);
}
