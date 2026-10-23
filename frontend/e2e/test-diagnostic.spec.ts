import { expect, test, type Page } from "@playwright/test";
import type { CodeLangue } from "../src/types/langue";
import { loginAs } from "./support/session";
import { mockTestDiagnosticApi } from "./support/test-diagnostic-api";

const URL_TEST = "/espace/apprenant/test-diagnostic";

async function ouvrir(
  page: Page,
  langue: CodeLangue,
  options?: { failFirstAnswer?: boolean },
) {
  await mockTestDiagnosticApi(page, options);
  await loginAs(page, {
    id_user: 1,
    nom: "RAKOTO",
    prenom: "Rova",
    email: "rova@exemple.com",
    telephone: null,
    role: "APPRENANT",
    statut: "ACTIF",
    date_inscription: "2026-10-07T10:00:00Z",
  });
  await page.goto(`${URL_TEST}?langue=${langue}`);
}

async function demarrer(page: Page) {
  await page.getByRole("button", { name: /Continuer/ }).click();
  await page.getByRole("button", { name: /Commencer le test IA/ }).click();
}

async function repondre(page: Page) {
  await page.getByTestId("option-0").click();
  await page.getByRole("button", { name: /Valider la réponse|Valider et continuer/ }).click();
}

async function expectSansDebordement(page: Page) {
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(deborde).toBe(false);
}

test.describe("Test de positionnement — échanges API sans évaluation IA", () => {
  test("préselectionne la langue indiquée dans l'URL", async ({ page }) => {
    await ouvrir(page, "fr");
    await expect(page.getByRole("radio", { name: /Français/ })).toBeChecked();
    await expect(page.getByRole("button", { name: /Continuer/ })).toBeEnabled();
  });

  test("crée une tentative et charge les questions depuis le backend", async ({ page }) => {
    await ouvrir(page, "en");
    await demarrer(page);
    await expect(page.getByTestId("question-card")).toHaveAttribute("data-question-id", "en-a1-1");
    await expect(page.getByTestId("progress-label")).toHaveText("Question 1 sur 2");
    await expect(page.getByTestId("feedback")).toHaveCount(0);
  });

  test("enregistre les réponses et affiche une évaluation en attente au lieu d'une correction simulée", async ({ page }) => {
    await ouvrir(page, "en");
    await demarrer(page);

    await repondre(page);
    await expect(page.getByTestId("feedback")).toContainText("Réponse enregistrée");
    await expect(page.getByTestId("feedback")).toContainText("service IA sera disponible");
    await expect(page.getByTestId("feedback")).not.toContainText("Bonne réponse");
    await page.getByRole("button", { name: "Question suivante" }).click();

    await expect(page.getByTestId("question-card")).toHaveAttribute("data-question-id", "en-a1-2");
    await repondre(page);
    await page.getByRole("button", { name: "Terminer" }).click();
    await expect(page.getByTestId("evaluation-pending")).toContainText("Vos réponses ont été sauvegardées");
    await expect(page.getByTestId("result-level")).toHaveCount(0);
  });

  test("permet de réessayer l'enregistrement après une erreur serveur", async ({ page }) => {
    await ouvrir(page, "en", { failFirstAnswer: true });
    const statutsReponses: number[] = [];
    page.on("response", (response) => {
      if (response.url().endsWith("/api/v1/diagnostic/reponse")) {
        statutsReponses.push(response.status());
      }
    });
    await demarrer(page);
    await repondre(page);
    await expect(page.getByRole("alert").filter({ hasText: "Le serveur rencontre un problème" })).toBeVisible();
    await page.getByRole("button", { name: "Réessayer" }).click();
    await expect.poll(() => statutsReponses).toEqual([503, 201]);
    await expect(page.getByTestId("feedback")).toContainText("Réponse enregistrée");
  });

  test("signale les langues sans question disponible", async ({ page }) => {
    await ouvrir(page, "zh");
    await page.getByRole("button", { name: /Continuer/ }).click();
    await page.getByRole("button", { name: /Commencer le test IA/ }).click();
    await expect(page.getByRole("alert").filter({ hasText: "pas encore disponible" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Test indisponible" })).toBeDisabled();
  });

  test("reste lisible sans défilement horizontal (desktop et mobile)", async ({ page }) => {
    await ouvrir(page, "en");
    await expectSansDebordement(page);
    await demarrer(page);
    await expectSansDebordement(page);
    await repondre(page);
    await expectSansDebordement(page);
  });
});
