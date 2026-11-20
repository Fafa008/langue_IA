import type { Page, Route } from "@playwright/test";
import { handlePreflight, json } from "./session";

/* Outils partagés des tests E2E du parcours personnalisé : réponses de l'API simulée au format du backend (snake_case). */

export const ID_PARCOURS = 7;

export interface ParcoursDto {
  id_parcours: number;
  statut: string;
  date_creation: string;
  code_langue: string;
  libelle_langue: string;
  cadre: string;
  niveaux_cadre: string[];
  niveau_depart: string;
  niveau_vise: string;
  lecon_atteinte: number;
  phase: "PASSIVE" | "ACTIVE";
  est_lecon_de_revision: boolean;
  modules: unknown[];
}

export interface ExerciceDto {
  id_parcours_exercice: number;
  id_exercice: number;
  numero_lecon: number;
  type: string;
  difficulte: number;
  intitule: string | null;
  statut: "A_FAIRE" | "REUSSI" | "A_REVOIR";
  score_obtenu: number | null;
}

/** Correction renvoyée par POST …/reponse (mode AUTOMATIQUE : pas de phase ni de leçon). */
export interface CorrectionDto {
  statut: "REUSSI" | "A_REVOIR";
  score_obtenu: number;
  mode_correction: "AUTOMATIQUE" | "IA";
  commentaire: string;
  reponse_attendue: string | null;
  explication: string | null;
  points_forts: string[];
  erreurs: unknown[];
  conseil: string | null;
}

/** Parcours de l'apprenant, à la leçon `leconAtteinte` (passif par défaut). */
export function parcoursDto(leconAtteinte = 23, phase: ParcoursDto["phase"] = "PASSIVE"): ParcoursDto {
  return {
    id_parcours: ID_PARCOURS,
    statut: "EN_COURS",
    date_creation: "2026-10-02T09:30:00Z",
    code_langue: "fr",
    libelle_langue: "Français",
    cadre: "CECRL",
    niveaux_cadre: ["A1", "A2", "B1", "B2", "C1", "C2"],
    niveau_depart: "A2",
    niveau_vise: "B1",
    lecon_atteinte: leconAtteinte,
    phase,
    est_lecon_de_revision: false,
    modules: [],
  };
}

/** Ligne de `GET /parcours/{id}/exercices` ; `intitule` vient de la clé `intitule` du contenu côté backend. */
export function exerciceDto(
  idLigne: number,
  numeroLecon: number,
  intitule: string,
  statut: ExerciceDto["statut"],
  score: number | null,
): ExerciceDto {
  return {
    id_parcours_exercice: idLigne,
    id_exercice: idLigne + 1000,
    numero_lecon: numeroLecon,
    type: "GRAMMAIRE",
    difficulte: 2,
    intitule,
    statut,
    score_obtenu: score,
  };
}

/** Contenu d'un QCM tel que le backend le renvoie dans `GET /parcours/{id}/lecons/{n}` : sans réponse ni explication. */
export const CONTENU_QCM_VISIBLE = {
  format: "choix",
  consigne: "Choisissez la bonne forme.",
  enonce: "Hier, je ___ au marché.",
  choix: ["suis allé", "vais aller"],
};

/** Corrections simulées du backend (US43-BE) pour la réponse « suis allé » (juste) ou « vais aller » (fausse). */
export const CORRECTION_JUSTE: CorrectionDto = {
  statut: "REUSSI",
  score_obtenu: 100,
  mode_correction: "AUTOMATIQUE",
  commentaire: "Bonne réponse.",
  reponse_attendue: null,
  explication: "« Aller » se conjugue avec être au passé composé.",
  points_forts: [],
  erreurs: [],
  conseil: null,
};

export const CORRECTION_FAUSSE: CorrectionDto = {
  ...CORRECTION_JUSTE,
  statut: "A_REVOIR",
  score_obtenu: 0,
  commentaire: "Ce n'est pas la bonne réponse.",
  reponse_attendue: "suis allé",
};

export interface ServeurParcours {
  /** `null` : l'apprenant n'a pas encore de parcours (404 sur `GET /parcours/en-cours`). */
  parcours: ParcoursDto | null;
  exercices: ExerciceDto[];
  /** Contenu visible par numéro de leçon (réponse `GET /parcours/{id}/lecons/{n}`). */
  lecons?: Record<number, { exercices: (ExerciceDto & { contenu: object })[] }>;
  /** Correction par identifiant de ligne d'exercice (réponse `POST …/reponse`). */
  corrections?: Record<number, CorrectionDto>;
}

/** Sert les routes du parcours. Les lignes sans correction prévue répondent 500 si elles sont soumises. */
export async function servirParcours(page: Page, donnees: ServeurParcours) {
  await page.route("**/api/v1/parcours/en-cours", async (route: Route) => {
    if (await handlePreflight(route)) return;
    if (donnees.parcours === null) return json(route, 404, { detail: "Aucun parcours en cours." });
    await json(route, 200, donnees.parcours);
  });
  await page.route(`**/api/v1/parcours/${ID_PARCOURS}/exercices`, async (route: Route) => {
    if (await handlePreflight(route)) return;
    await json(route, 200, donnees.exercices);
  });
  await page.route(`**/api/v1/parcours/${ID_PARCOURS}/lecons/*`, async (route: Route) => {
    if (await handlePreflight(route)) return;
    const numero = Number(new URL(route.request().url()).pathname.split("/").pop());
    const lecon = donnees.lecons?.[numero];
    if (!lecon) return json(route, 403, { detail: "Leçon non atteinte" });
    // Le contenu est un texte JSON dans la réponse du backend (voir docs/api/contrat-frontend.md)
    await json(route, 200, {
      numero_lecon: numero,
      est_lecon_de_revision: false,
      code_langue: "fr",
      exercices: lecon.exercices.map((e) => ({ ...e, contenu: JSON.stringify(e.contenu) })),
    });
  });
  await page.route(`**/api/v1/parcours/${ID_PARCOURS}/exercices/*/reponse`, async (route: Route) => {
    if (await handlePreflight(route)) return;
    const idLigne = Number(route.request().url().match(/exercices\/(\d+)\/reponse/)?.[1]);
    const correction = donnees.corrections?.[idLigne];
    if (!correction) return json(route, 500, { detail: "Pas de correction prévue" });
    await json(route, 200, correction);
  });
}
