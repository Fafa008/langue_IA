import type { ErreurRelevee } from "@/types/parcours-personnalise";

/* Erreurs fréquentes que le professeur IA simulé sait repérer (le vrai correcteur est le LLM). */
export const ERREURS_FREQUENTES: { motif: RegExp; correction: string; explication: string }[] = [
  { motif: /\bj'ai allée?s?(?![\p{L}])/iu, correction: "je suis allé(e)", explication: "« Aller » se conjugue avec l'auxiliaire être au passé composé." },
  { motif: /\bil faut que je vais\b/i, correction: "il faut que j'aille", explication: "Après « il faut que », on emploie le subjonctif." },
  { motif: /\bsi j'aurais\b/i, correction: "si j'avais", explication: "Après « si », on n'emploie pas le conditionnel mais l'imparfait." },
  { motif: /\bmalgré que\b/i, correction: "bien que", explication: "« Malgré que » est à éviter : on écrit « bien que » + subjonctif." },
  { motif: /\bje suis d'accord à(?![\p{L}])/iu, correction: "je suis d'accord avec", explication: "On est d'accord « avec » quelqu'un." },
  { motif: /(?<![\p{L}])ça va bien\b/iu, correction: "je vais bien", explication: "Dans un texte écrit, préférez « je vais bien »." },
];

/** Corrections en marge d'un message de l'apprenant (démonstration simulée, US74-FE). Vide si rien à corriger. */
export function repererErreurs(texte: string): ErreurRelevee[] {
  const erreurs: ErreurRelevee[] = [];
  for (const { motif, correction, explication } of ERREURS_FREQUENTES) {
    const trouve = texte.match(motif);
    if (trouve && !erreurs.some((e) => e.extrait === trouve[0])) {
      erreurs.push({ extrait: trouve[0], correction, explication });
    }
  }
  return erreurs;
}
