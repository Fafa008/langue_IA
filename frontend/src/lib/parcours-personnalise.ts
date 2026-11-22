import { ApiError } from "@/lib/api-client";
import type {
  DomaineFaiblesse,
  ExerciceParcours,
  ModuleParcours,
  PhaseParcours,
  StatutEtape,
  StatutExercice,
  StatutParcours,
  TypeExercice,
} from "@/types/parcours-personnalise";

/** Première leçon de la phase active (même règle que backend/app/services/phase_parcours.py). */
export const PREMIERE_LECON_ACTIVE = 50;

export const PHASES: Record<PhaseParcours, { libelle: string; periode: string; explication: string; retourIA: string }> = {
  PASSIVE: {
    libelle: "Mode passif",
    periode: `Leçons 1 à ${PREMIERE_LECON_ACTIVE - 1}`,
    explication: "Vous écoutez, lisez et répétez : vous vous imprégnez de la langue sans chercher à la produire.",
    retourIA: "seules les erreurs essentielles sont relevées.",
  },
  ACTIVE: {
    libelle: "Mode actif",
    periode: `À partir de la leçon ${PREMIERE_LECON_ACTIVE}`,
    explication:
      "Vous produisez la langue vous-même en reprenant les leçons déjà vues ; une leçon sur sept est une révision.",
    retourIA: "votre texte est corrigé en détail.",
  },
};

export const STATUT_PARCOURS_LABELS: Record<StatutParcours, string> = {
  EN_COURS: "En cours",
  TERMINE: "Terminé",
  ABANDONNE: "Abandonné",
};

export const STATUT_EXERCICE_LABELS: Record<StatutExercice, string> = {
  A_FAIRE: "À faire",
  REUSSI: "Réussi",
  A_REVOIR: "À revoir",
};

export const TYPE_EXERCICE_LABELS: Record<TypeExercice, string> = {
  GRAMMAIRE: "Grammaire",
  VOCABULAIRE: "Vocabulaire",
  COMPREHENSION: "Compréhension",
  ECOUTE: "Écoute",
  ORAL: "Oral",
};

/** Libellés des domaines faibles du diagnostic, affichés dans les recommandations pédagogiques. */
export const DOMAINE_FAIBLESSE_LABELS: Record<DomaineFaiblesse, string> = {
  grammaire: "Grammaire",
  vocabulaire: "Vocabulaire",
  comprehension_ecrite: "Compréhension écrite",
  comprehension_orale: "Compréhension orale",
  expression_ecrite: "Expression écrite",
  expression_orale: "Expression orale",
};

export const STATUT_ETAPE_LABELS: Record<StatutEtape, string> = {
  TERMINE: "Terminé",
  EN_COURS: "En cours",
  A_VENIR: "À venir",
};

/** Une leçon est terminée quand l'apprenant l'a dépassée ; la leçon atteinte est en cours ; les suivantes sont à venir. */
export function statutLecon(numero: number, leconAtteinte: number): StatutEtape {
  return numero < leconAtteinte ? "TERMINE" : numero === leconAtteinte ? "EN_COURS" : "A_VENIR";
}

export const nombreLecons = (module: ModuleParcours) => module.derniereLecon - module.premiereLecon + 1;

export function statutModule(module: ModuleParcours, leconAtteinte: number): StatutEtape {
  if (leconAtteinte > module.derniereLecon) return "TERMINE";
  return leconAtteinte >= module.premiereLecon ? "EN_COURS" : "A_VENIR";
}

/** Part des leçons du module déjà terminées, en pourcentage. */
export function progressionModule(module: ModuleParcours, leconAtteinte: number): number {
  const terminees = Math.min(Math.max(leconAtteinte - module.premiereLecon, 0), nombreLecons(module));
  return Math.round((terminees / nombreLecons(module)) * 100);
}

export const moduleDeLecon = (modules: ModuleParcours[], numeroLecon: number) =>
  modules.find((m) => numeroLecon >= m.premiereLecon && numeroLecon <= m.derniereLecon) ?? null;

/** Numéros de leçon d'un module, dans l'ordre. */
export const leconsDuModule = (module: ModuleParcours) =>
  Array.from({ length: nombreLecons(module) }, (_, i) => module.premiereLecon + i);

/** Identifiant numérique tiré d'un segment d'URL ; null s'il n'est pas valide. */
export function numeroDepuisUrl(segment: string | string[] | undefined): number | null {
  const valeur = Number(Array.isArray(segment) ? segment[0] : segment);
  return Number.isInteger(valeur) && valeur > 0 ? valeur : null;
}

/** Nombre de leçons restant avant la phase active (0 si elle est atteinte). */
export const leconsAvantPhaseActive = (leconAtteinte: number) => Math.max(0, PREMIERE_LECON_ACTIVE - leconAtteinte);

export interface LeconExercices {
  numero: number;
  exercices: ExerciceParcours[];
  faits: number;
}

/** Exercices regroupés par leçon, de la plus récente à la plus ancienne (la leçon du jour en premier). */
export function exercicesParLecon(exercices: ExerciceParcours[]): LeconExercices[] {
  const lecons = new Map<number, ExerciceParcours[]>();
  for (const exercice of exercices) {
    lecons.set(exercice.numeroLecon, [...(lecons.get(exercice.numeroLecon) ?? []), exercice]);
  }
  return [...lecons.entries()]
    .sort(([a], [b]) => b - a)
    .map(([numero, liste]) => ({ numero, exercices: liste, faits: liste.filter((e) => e.statut !== "A_FAIRE").length }));
}

export type FiltreStatut = StatutExercice | "TOUS";

/** Nombre d'exercices par statut, pour les filtres. */
export function compterParStatut(exercices: ExerciceParcours[]): Record<FiltreStatut, number> {
  const compte: Record<FiltreStatut, number> = { TOUS: exercices.length, A_FAIRE: 0, A_REVOIR: 0, REUSSI: 0 };
  for (const { statut } of exercices) compte[statut] += 1;
  return compte;
}

/** Message sans détail technique pour une erreur de chargement du parcours. */
export function messageErreurParcours(error: unknown, quoi: string): string {
  if (error instanceof ApiError) {
    if (error.delaiDepasse) return `${quoi} prend plus de temps que prévu. Réessayez dans un instant.`;
    if (error.status === 0) return "Le serveur est injoignable : vérifiez votre connexion, puis réessayez.";
    if (error.status === 401) return "Votre session a expiré. Reconnectez-vous.";
    if (error.status === 403) return error.detail ?? "Ce contenu n'est pas encore disponible.";
    if (error.status === 404) return "Ce contenu n'existe pas.";
    // FE-D6 : le professeur IA est indisponible (503) ou trop lent (504), messages distincts sans détail technique
    if (error.status === 503) return `${quoi} n'est pas disponible pour le moment. Réessayez dans un instant.`;
    if (error.status === 504) return `${quoi} prend plus de temps que prévu. Réessayez dans un instant.`;
  }
  return `${quoi} n'a pas abouti. Réessayez dans un instant.`;
}
