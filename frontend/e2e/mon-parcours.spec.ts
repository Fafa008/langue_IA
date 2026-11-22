import { expect, test } from "@playwright/test";
import { json, loginAs, type UtilisateurDto } from "./support/session";
import { exerciceDto, parcoursDto, servirParcours } from "./support/parcours";

// US41 : « Mon parcours » — vue par niveau et par langue, mode passif/actif, exercices (client HTTP réel).
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

const EXERCICES = [exerciceDto(231, 23, "Le passé composé", "REUSSI", 85)];

test.describe("Mon parcours (US41)", () => {
  test("affiche la langue, le niveau visé, la leçon atteinte et le mode passif", async ({ page }) => {
    await loginAs(page, APPRENANT);
    await servirParcours(page, { parcours: parcoursDto(23, "PASSIVE"), exercices: EXERCICES });
    await page.goto("/espace/apprenant/parcours");

    await expect(page.getByRole("heading", { level: 1, name: "Bonjour, Rova !" })).toBeVisible();
    await expect(page.getByText("Votre parcours de Français vers le niveau B1.")).toBeVisible();

    const niveaux = page.getByRole("list", { name: "Niveaux du CECRL" });
    await expect(niveaux.getByRole("listitem").filter({ hasText: "B1" })).toHaveAttribute("aria-current", "step");
    await expect(niveaux.getByRole("listitem").filter({ hasText: "A2" })).toContainText("Départ");

    await expect(page.getByRole("heading", { name: "Mode d'apprentissage" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Phases du parcours" }).getByRole("listitem").first()).toHaveAttribute(
      "aria-current",
      "step",
    );
    await expect(page.getByText(/Encore \d+ leçons? avant le mode actif\./)).toBeVisible();

    await expect(page.getByRole("heading", { name: "Tous les exercices du parcours" })).toBeVisible();
    // Les leçons sont repliées par défaut : on déplie la leçon 23 pour voir son exercice
    await page.locator("details").filter({ hasText: "Ouvrir la leçon 23" }).locator("summary").click();
    await expect(page.getByText("Le passé composé").first()).toBeVisible();
  });

  test("en phase active, le mode actif est mis en évidence et le compte à rebours disparaît", async ({ page }) => {
    await loginAs(page, APPRENANT);
    await servirParcours(page, { parcours: parcoursDto(56, "ACTIVE"), exercices: [] });
    await page.goto("/espace/apprenant/parcours");

    const phases = page.getByRole("list", { name: "Phases du parcours" });
    await expect(phases.getByRole("listitem").nth(1)).toHaveAttribute("aria-current", "step");
    await expect(phases.getByRole("listitem").nth(0)).not.toHaveAttribute("aria-current", "step");
    await expect(page.getByText(/avant le mode actif/)).toHaveCount(0);
  });

  test("sans parcours (404), invite à passer le test de positionnement", async ({ page }) => {
    await loginAs(page, APPRENANT);
    await servirParcours(page, { parcours: null, exercices: [] });
    await page.goto("/espace/apprenant/parcours");

    await expect(page.getByRole("link", { name: "Passer le test de positionnement" })).toBeVisible();
  });

  test("ne déborde pas horizontalement (largeur téléphone comprise)", async ({ page }) => {
    await loginAs(page, APPRENANT);
    await servirParcours(page, { parcours: parcoursDto(23, "PASSIVE"), exercices: EXERCICES });
    await page.goto("/espace/apprenant/parcours");
    await expect(page.getByRole("heading", { name: "Mes modules" })).toBeVisible();

    const { largeurPage, largeurFenetre } = await page.evaluate(() => ({
      largeurPage: document.documentElement.scrollWidth,
      largeurFenetre: document.documentElement.clientWidth,
    }));
    expect(largeurPage).toBeLessThanOrEqual(largeurFenetre);
  });
});

/** REC-03 : le frontend appelle la route POST explicite et affiche la réponse validée par le backend. */
test.describe("Recommandations pédagogiques (REC-03)", () => {
  const recommandationComplete = {
    statut: "COMPLET",
    code_langue: "fr",
    referentiel: "CECRL",
    niveau_cible: "B1",
    recommandations: [
      {
        domaine: "grammaire",
        type_exercice: "GRAMMAIRE",
        action: "Refaire un exercice sur le passé composé.",
        justification: "Les formes au passé restent hésitantes.",
        priorite: 1,
      },
    ],
    resume: "Une action courte : conjugaison au passé.",
    confiance: 0.72,
  };

  test("affiche les actions après une demande explicite et les relit au rechargement", async ({ page }) => {
    await loginAs(page, APPRENANT);
    const parcours = parcoursDto(23, "PASSIVE");
    await servirParcours(page, { parcours, exercices: EXERCICES });
    let appels = 0;
    await page.route("**/api/v1/parcours/7/recommandations", async (route) => {
      appels += 1;
      parcours.recommandation = recommandationComplete;
      await json(route, 200, recommandationComplete);
    });

    await page.goto("/espace/apprenant/parcours");
    await expect(page.getByText("Aucune recommandation pour le moment.")).toBeVisible();
    await page.getByRole("button", { name: "Afficher mes recommandations" }).click();

    await expect(page.getByRole("list", { name: "Actions recommandées" })).toContainText(
      "Refaire un exercice sur le passé composé.",
    );
    expect(appels).toBe(1);

    await page.reload();
    // Le backend persiste la réponse : GET /parcours/en-cours la renvoie, sans nouvel appel POST.
    await expect(page.getByRole("list", { name: "Actions recommandées" })).toContainText(
      "Refaire un exercice sur le passé composé.",
    );
    expect(appels).toBe(1);
  });

  test("un statut PARTIEL est un message simple, jamais une erreur visible", async ({ page }) => {
    await loginAs(page, APPRENANT);
    await servirParcours(page, { parcours: parcoursDto(23, "PASSIVE"), exercices: EXERCICES });
    await page.route("**/api/v1/parcours/7/recommandations", async (route) => {
      await json(route, 200, {
        statut: "PARTIEL",
        code_langue: "fr",
        referentiel: "CECRL",
        niveau_cible: "B1",
        recommandations: [],
        resume: "Les recommandations ne sont pas disponibles pour le moment.",
        confiance: 0,
      });
    });

    await page.goto("/espace/apprenant/parcours");
    await page.getByRole("button", { name: "Afficher mes recommandations" }).click();

    const section = page.getByRole("region", { name: "Mes recommandations" });
    await expect(section.getByRole("list", { name: "Actions recommandées" })).toHaveCount(0);
    await expect(section.getByText("Les recommandations ne sont pas disponibles pour le moment.")).toBeVisible();
    // Aucune alerte d'erreur dans la section : PARTIEL n'est pas une panne visible par l'apprenant.
    await expect(section.getByRole("alert")).toHaveCount(0);
  });
});
