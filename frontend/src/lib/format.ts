const ariary = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** 150000 → « 150 000 Ar » */
export function formatAriary(montant: number): string {
  return `${ariary.format(montant)} Ar`;
}

/** pluriel(1, "atelier") → « 1 atelier » ; pluriel(3, "atelier") → « 3 ateliers » */
export function pluriel(nombre: number, mot: string): string {
  return `${nombre} ${mot}${nombre > 1 ? "s" : ""}`;
}
