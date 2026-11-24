/**
 * Règles de gestion des contenus (RG-GP-01 à RG-GP-09, docs/gestion-pedagogique.md).
 * Fonctions pures, sans React : appelées par les formulaires et par le service (qui revalide, comme le ferait l'API).
 */
import type { FieldErrors } from "@/types/form";
import { LIBELLES_STATUT, NOMS_ENTITE, accorder, libelleEntite } from "./libelles";
import type {
  Activite,
  ActiviteSaisie,
  ContenusLangue,
  Entite,
  Langue,
  Lecon,
  LeconSaisie,
  Module,
  ModuleSaisie,
  Parcours,
  ParcoursElement,
  ParcoursSaisie,
  PhaseAssimil,
  Statut,
  TypeEntite,
} from "./types";

/** Premier numéro de leçon de la phase active (Assimil) : passive de 1 à 49, active à partir de 50. */
export const DEBUT_PHASE_ACTIVE = 50;
export const DIFFICULTE_MIN = 1;
export const DIFFICULTE_MAX = 5;

function compact<T>(errors: FieldErrors<T>): FieldErrors<T> {
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v)) as FieldErrors<T>;
}

/** « 12 » → 12 ; vide, décimal, négatif ou nul → null. */
export function lireEntierPositif(valeur: string): number | null {
  const v = valeur.trim();
  if (!/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n > 0 && Number.isSafeInteger(n) ? n : null;
}

/** Phase Assimil d'une leçon, calculée depuis son numéro d'ordre ; null si le numéro n'est pas valide. */
export function phaseAssimil(ordre: number | null): PhaseAssimil | null {
  if (ordre === null || !Number.isInteger(ordre) || ordre < 1) return null;
  return ordre >= DEBUT_PHASE_ACTIVE ? "active" : "passive";
}

/** RG-GP-02 : le niveau appartient à la langue. */
export function niveauAppartientALangue(idNiveau: string, langue: Langue): boolean {
  return langue.niveaux.some((n) => n.id === idNiveau);
}

/** RG-GP-01 : numéro d'ordre déjà utilisé par une autre entité de la langue (l'entité modifiée est ignorée). */
export function ordreDejaPris(ordre: number, existants: { id: string; ordre: number }[], idCourant?: string): boolean {
  return existants.some((e) => e.ordre === ordre && e.id !== idCourant);
}

/**
 * Statuts proposés dans un formulaire, selon le statut actuel (null : création).
 * Brouillon → Publié → Archivé, sans retour en arrière ; l'archivage passe par l'action « Archiver ».
 */
export function statutsAccessibles(actuel: Statut | null): Statut[] {
  switch (actuel) {
    case null:
    case "BROUILLON":
      return ["BROUILLON", "PUBLIE"];
    case "PUBLIE":
      return ["PUBLIE"];
    case "ARCHIVE":
      return ["ARCHIVE"];
  }
}

function validerStatut(statut: Statut, actuel: Statut | null): string | undefined {
  if (statutsAccessibles(actuel).includes(statut)) return undefined;
  if (statut === "ARCHIVE") return "L'archivage se fait avec l'action « Archiver ».";
  return `Passage de « ${LIBELLES_STATUT[actuel ?? "BROUILLON"]} » à « ${LIBELLES_STATUT[statut]} » impossible : le cycle de vie est Brouillon → Publié → Archivé.`;
}

function validerOrdre(valeur: string, existants: { id: string; ordre: number }[], idCourant: string | undefined, quoi: string): string | undefined {
  if (!valeur.trim()) return "Le numéro d'ordre est requis.";
  const ordre = lireEntierPositif(valeur);
  if (ordre === null) return "Le numéro d'ordre doit être un entier positif.";
  if (ordreDejaPris(ordre, existants, idCourant)) return `Le numéro ${ordre} est déjà utilisé par ${quoi} de cette langue.`;
}

const requis = (valeur: string, message: string) => (valeur.trim() ? undefined : message);

/** Numéro proposé pour une nouvelle entité : le plus grand numéro de la langue, plus un. */
export function prochainOrdre(existants: { ordre: number }[]): number {
  return existants.reduce((max, e) => Math.max(max, e.ordre), 0) + 1;
}

/* ------------------------------------------------------------------------------------------------------------ */

export function validerModule(v: ModuleSaisie, ctx: ContenusLangue, existant: Module | null = null): FieldErrors<ModuleSaisie> {
  return compact<ModuleSaisie>({
    titre: requis(v.titre, "Le titre est requis."),
    ordre: validerOrdre(v.ordre, ctx.modules, existant?.id, "un autre module"),
    statut: validerStatut(v.statut, existant?.statut ?? null),
  });
}

/** RG-GP-03 : la leçon contient au moins une activité publiée. */
export function aUneActivitePubliee(idLecon: string, activites: Activite[]): boolean {
  return activites.some((a) => a.idLecon === idLecon && a.statut === "PUBLIE");
}

export function validerLecon(v: LeconSaisie, ctx: ContenusLangue, existant: Lecon | null = null): FieldErrors<LeconSaisie> {
  const moduleLecon = ctx.modules.find((m) => m.id === v.idModule);
  return compact<LeconSaisie>({
    idModule: !v.idModule
      ? "Choisissez le module de la leçon."
      : !moduleLecon
        ? "Ce module n'appartient pas à cette langue."
        : moduleLecon.statut === "ARCHIVE" && moduleLecon.id !== existant?.idModule
          ? "Ce module est archivé : choisissez-en un autre."
          : undefined,
    idNiveau: !v.idNiveau
      ? "Choisissez le niveau de la leçon."
      : !niveauAppartientALangue(v.idNiveau, ctx.langue)
        ? `Ce niveau n'est pas ouvert pour la langue ${ctx.langue.libelle}.`
        : undefined,
    titre: requis(v.titre, "Le titre est requis."),
    ordre: validerOrdre(v.ordre, ctx.lecons, existant?.id, "une autre leçon"),
    statut:
      validerStatut(v.statut, existant?.statut ?? null) ??
      (v.statut === "PUBLIE" && !(existant && aUneActivitePubliee(existant.id, ctx.activites))
        ? existant
          ? "Publication refusée : une leçon publiée doit contenir au moins une activité publiée. Publiez d'abord une activité de cette leçon."
          : "Publication refusée : une leçon publiée doit contenir au moins une activité publiée. Enregistrez la leçon en brouillon, ajoutez-lui une activité publiée, puis publiez-la."
        : undefined),
  });
}

export function validerActivite(v: ActiviteSaisie, ctx: ContenusLangue, existant: Activite | null = null): FieldErrors<ActiviteSaisie> {
  const lecon = ctx.lecons.find((l) => l.id === v.idLecon);
  const difficulte = lireEntierPositif(v.difficulte);
  return compact<ActiviteSaisie>({
    idLecon: !v.idLecon
      ? "Choisissez la leçon de l'activité."
      : !lecon
        ? "Cette leçon n'appartient pas à cette langue."
        : !niveauAppartientALangue(lecon.idNiveau, ctx.langue)
          ? `Le niveau de cette leçon n'est pas ouvert pour la langue ${ctx.langue.libelle}.`
          : lecon.statut === "ARCHIVE" && lecon.id !== existant?.idLecon
            ? "Cette leçon est archivée : choisissez-en une autre."
            : undefined,
    type: v.type ? undefined : "Choisissez le type d'activité.",
    competence: v.competence ? undefined : "Choisissez la compétence travaillée.",
    difficulte: !v.difficulte.trim()
      ? "La difficulté est requise."
      : difficulte === null || difficulte < DIFFICULTE_MIN || difficulte > DIFFICULTE_MAX
        ? `La difficulté est un entier de ${DIFFICULTE_MIN} à ${DIFFICULTE_MAX}.`
        : undefined,
    consigne: requis(v.consigne, "La consigne est requise."),
    critereCorrection:
      v.type === "PRODUCTION_LIBRE" ? requis(v.critereCorrection, "Une activité de production libre doit avoir une réponse de référence ou un critère de correction.") : undefined,
    statut: validerStatut(v.statut, existant?.statut ?? null),
  });
}

/** Entité référencée par un élément de parcours, si elle existe dans la langue. */
export function trouverElement(element: ParcoursElement, ctx: Pick<ContenusLangue, "lecons" | "activites">): Lecon | Activite | undefined {
  return element.type === "lecon" ? ctx.lecons.find((l) => l.id === element.id) : ctx.activites.find((a) => a.id === element.id);
}

/** RG-GP-06 : un élément archivé ne peut pas être ajouté à un parcours. */
export function peutEtreAjouteAuParcours(element: { statut: Statut }): boolean {
  return element.statut !== "ARCHIVE";
}

export function validerParcours(v: ParcoursSaisie, ctx: ContenusLangue, existant: Parcours | null = null): FieldErrors<ParcoursSaisie> {
  const dejaPresents = new Set(existant?.elements.map((e) => `${e.type}:${e.id}`));
  const entites = v.elements.map((e) => ({ element: e, entite: trouverElement(e, ctx) }));

  const introuvable = entites.some((e) => !e.entite);
  // Un élément archivé après son ajout reste toléré dans un brouillon ; on refuse seulement d'en ajouter un nouveau
  const archiveAjoute = entites.find((e) => e.entite && !peutEtreAjouteAuParcours(e.entite) && !dejaPresents.has(`${e.element.type}:${e.element.id}`));
  const nonPublies = entites.filter((e) => e.entite && e.entite.statut !== "PUBLIE");

  return compact<ParcoursSaisie>({
    titre: requis(v.titre, "Le titre est requis."),
    idNiveauCible: !v.idNiveauCible
      ? "Choisissez le niveau cible du parcours."
      : !niveauAppartientALangue(v.idNiveauCible, ctx.langue)
        ? `Ce niveau n'est pas ouvert pour la langue ${ctx.langue.libelle}.`
        : undefined,
    elements:
      v.elements.length === 0
        ? "Un parcours contient au moins un élément (leçon ou activité)."
        : introuvable
          ? "Un élément du parcours n'existe plus dans cette langue."
          : archiveAjoute
            ? `« ${libelleEntite(archiveAjoute.element.type, archiveAjoute.entite!)} » est ${accorder(archiveAjoute.element.type, "archivé")} : ${NOMS_ENTITE[archiveAjoute.element.type].feminin ? "elle" : "il"} ne peut pas être ${accorder(archiveAjoute.element.type, "ajouté")} au parcours.`
            : v.statut === "PUBLIE" && nonPublies.length > 0
              ? `Publication refusée : un parcours publié ne contient que des éléments publiés (${nonPublies.length} élément${nonPublies.length > 1 ? "s" : ""} non publié${nonPublies.length > 1 ? "s" : ""}).`
              : undefined,
    statut: validerStatut(v.statut, existant?.statut ?? null),
  });
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Archivage et suppression (RG-GP-08, RG-GP-09)                                                                  */

export interface Utilisation {
  /** Parcours qui référencent l'entité. */
  parcours: Parcours[];
  /** Leçons d'un module, activités d'une leçon : les supprimer laisserait ces contenus sans parent. */
  enfants: number;
}

export function utilisation(type: TypeEntite, id: string, ctx: Pick<ContenusLangue, "lecons" | "activites" | "parcours">): Utilisation {
  const parcours = type === "lecon" || type === "activite" ? ctx.parcours.filter((p) => p.elements.some((e) => e.type === type && e.id === id)) : [];
  const enfants =
    type === "module" ? ctx.lecons.filter((l) => l.idModule === id).length : type === "lecon" ? ctx.activites.filter((a) => a.idLecon === id).length : 0;
  return { parcours, enfants };
}

export const estUtilise = (u: Utilisation) => u.parcours.length > 0 || u.enfants > 0;

export type ActionRetrait = "archiver" | "supprimer";

/** Actions proposées : une entité utilisée s'archive seulement (RG-GP-08) ; une entité non utilisée peut aussi être supprimée (RG-GP-09). */
export function retraitsPossibles(type: TypeEntite, entite: Entite, ctx: Pick<ContenusLangue, "lecons" | "activites" | "parcours">): ActionRetrait[] {
  const actions: ActionRetrait[] = [];
  if (entite.statut !== "ARCHIVE") actions.push("archiver");
  if (!estUtilise(utilisation(type, entite.id, ctx))) actions.push("supprimer");
  return actions;
}

/** Message de refus d'un archivage ou d'une suppression, ou null si l'action est permise. */
export function refusRetrait(action: ActionRetrait, type: TypeEntite, entite: Entite, ctx: Pick<ContenusLangue, "lecons" | "activites" | "parcours">): string | null {
  if (retraitsPossibles(type, entite, ctx).includes(action)) return null;
  if (action === "archiver") return "Cet élément est déjà archivé.";
  return "Cet élément est utilisé : il ne peut pas être supprimé, seulement archivé.";
}
