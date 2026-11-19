import { expect, test, type Page, type Route } from "@playwright/test";
import { handlePreflight, json, loginAs, type UtilisateurDto } from "./support/session";

// FE-D6 : états d'erreur de la correction par le professeur IA sur le parcours de démo (client HTTP réel).
const APPRENANT: UtilisateurDto = {
  id_user: 1,
  nom: "Rakoto",
  prenom: "Rova",
  email: "rova@exemple.com",
  telephone: null,
  role: "APPRENANT",
  statut: "ACTIF",
  date_inscription: "2025-01-12T10:00:00Z",
};

const PARCOURS = {
  id_parcours: 7,
  statut: "EN_COURS",
  date_creation: "2026-10-02T09:30:00Z",
  code_langue: "fr",
  libelle_langue: "Français",
  cadre: "CECRL",
  niveaux_cadre: ["A1", "A2", "B1", "B2", "C1", "C2"],
  niveau_depart: "A2",
  niveau_vise: "B1",
  lecon_atteinte: 23,
  phase: "PASSIVE",
  est_lecon_de_revision: false,
  modules: [{ numero: 1, titre: "Premiers contacts", description: "Saluer.", premiere_lecon: 1, derniere_lecon: 7 }],
};

const EXERCICE_REDACTION = {
  id_parcours_exercice: 231,
  id_exercice: 1231,
  numero_lecon: 23,
  type: "GRAMMAIRE",
  difficulte: 2,
  intitule: "Expression écrite : écrire à un ami",
  statut: "A_FAIRE",
  score_obtenu: null,
  contenu: JSON.stringify({
    format: "redaction",
    consigne: "Rédigez votre réponse ; le professeur IA la corrigera.",
    enonce: "Écrivez un court message à un ami.",
    mots_minimum: 10,
  }),
};

/** Routes du parcours servies par l'API simulée ; la correction répond avec le statut voulu. */
async function servirParcours(page: Page, statutCorrection: number) {
  await page.route("**/api/v1/parcours/en-cours", async (route: Route) => {
    if (await handlePreflight(route)) return;
    await json(route, 200, PARCOURS);
  });
  await page.route("**/api/v1/parcours/7/exercices", async (route: Route) => {
    if (await handlePreflight(route)) return;
    await json(route, 200, [EXERCICE_REDACTION]);
  });
  await page.route("**/api/v1/parcours/7/lecons/23", async (route: Route) => {
    if (await handlePreflight(route)) return;
    await json(route, 200, { numero_lecon: 23, est_lecon_de_revision: false, code_langue: "fr", exercices: [EXERCICE_REDACTION] });
  });
  await page.route("**/api/v1/parcours/7/exercices/231/reponse", async (route: Route) => {
    if (await handlePreflight(route)) return;
    await json(route, statutCorrection, { detail: "Détail technique interne" });
  });
}

test.describe("Parcours de démo — erreurs de la correction par le professeur IA", () => {
  for (const [statut, attendu] of [
    [503, "n'est pas disponible pour le moment"],
    [504, "prend plus de temps que prévu"],
    [502, "n'a pas abouti"],
  ] as const) {
    test(`statut ${statut} : message dédié, réponse conservée, nouvel envoi possible`, async ({ page }) => {
      await loginAs(page, APPRENANT);
      await servirParcours(page, statut);
      await page.goto("/espace/apprenant/parcours/lecons/23");

      const exercice = page.getByRole("region", { name: "Expression écrite : écrire à un ami" });
      const saisie = exercice.getByLabel(/Écrivez un court message à un ami/);
      await saisie.fill("Salut Paul, on va au cinéma samedi ?");
      await exercice.getByRole("button", { name: "Envoyer au professeur IA" }).click();

      const alerte = exercice.getByRole("alert");
      await expect(alerte).toContainText(attendu);
      await expect(alerte).toContainText("Votre réponse est conservée");
      await expect(alerte).not.toContainText("Détail technique interne");
      await expect(saisie).toHaveValue("Salut Paul, on va au cinéma samedi ?");
      await expect(exercice.getByRole("button", { name: "Envoyer au professeur IA" })).toBeEnabled();
    });
  }
});
