import { expect, test, type Page } from "@playwright/test";
import type { CodeLangue } from "../src/types/langue";
import { ACCESS_TOKEN, loginAs, type UtilisateurDto } from "./support/session";
import { mockTestDiagnosticApi } from "./support/test-diagnostic-api";

const URL_TEST = "/espace/apprenant/test-diagnostic";
/** Les trois pages du module : démarrage, test, résultats. */
const PAGES_DIAGNOSTIC = [URL_TEST, `${URL_TEST}/test`, `${URL_TEST}/resultats`];

const APPRENANT: UtilisateurDto = {
  id_user: 1,
  nom: "RAKOTO",
  prenom: "Rova",
  email: "rova@exemple.com",
  telephone: null,
  role: "APPRENANT",
  statut: "ACTIF",
  date_inscription: "2026-10-07T10:00:00Z",
};

async function ouvrir(
  page: Page,
  langue: CodeLangue,
  options?: { failFirstAnswer?: boolean },
) {
  await mockTestDiagnosticApi(page, options);
  await loginAs(page, APPRENANT);
  await page.goto(`${URL_TEST}?langue=${langue}`);
}

async function demarrer(page: Page) {
  await page.getByRole("button", { name: /Continuer/ }).click();
  await page.getByRole("button", { name: /Commencer le test IA/ }).click();
  await expect(page).toHaveURL(`${URL_TEST}/test`);
}

async function repondre(page: Page) {
  await page.getByTestId("option-0").click();
  await page.getByRole("button", { name: /Valider la réponse|Valider et continuer/ }).click();
}

async function expectSansDebordement(page: Page) {
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(deborde).toBe(false);
}

test.describe("Accès au module Diagnostic", () => {
  for (const url of PAGES_DIAGNOSTIC) {
    test(`sans session, ${url} redirige vers la connexion`, async ({ page }) => {
      await page.goto(url);
      await expect(page).toHaveURL("/login");
    });

    test(`un formateur n'a pas accès à ${url}`, async ({ page }) => {
      const appels: string[] = [];
      await page.route("**/api/v1/diagnostic/**", (route) => {
        appels.push(route.request().url());
        return route.abort();
      });
      await loginAs(page, { ...APPRENANT, role: "FORMATEUR" });
      await page.goto(url);
      await expect(page.getByRole("heading", { name: "Accès réservé" })).toBeVisible();
      expect(appels).toHaveLength(0);
    });
  }

  test("chaque appel au backend porte le JWT de l'apprenant", async ({ page }) => {
    const autorisations: (string | undefined)[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/v1/diagnostic/") && request.method() !== "OPTIONS") {
        autorisations.push(request.headers().authorization);
      }
    });
    await ouvrir(page, "en");
    await demarrer(page);
    await repondre(page);
    await expect(page.getByTestId("feedback")).toBeVisible();
    // tentative, questions, réponse
    expect(autorisations.length).toBeGreaterThanOrEqual(3);
    expect(new Set(autorisations)).toEqual(new Set([`Bearer ${ACCESS_TOKEN}`]));
  });
});

test.describe("Test de positionnement — réponses et score déterministe", () => {
  test("préselectionne la langue indiquée dans l'URL", async ({ page }) => {
    await ouvrir(page, "fr");
    await expect(page.getByTestId("language-select")).toContainText("Français");
    await expect(page.getByRole("button", { name: /Continuer/ })).toBeEnabled();
  });

  test("permet de chercher et changer la langue avant de commencer", async ({ page }) => {
    await ouvrir(page, "fr");
    await page.getByTestId("language-select").click();
    await page.getByRole("combobox", { name: "Rechercher une langue" }).fill("angl");
    await expect(page.getByRole("option")).toHaveCount(1);
    await page.getByTestId("language-option-en").click();
    await expect(page.getByTestId("language-select")).toContainText("Anglais");
  });

  test("crée une tentative et charge les questions depuis le backend", async ({ page }) => {
    await ouvrir(page, "en");
    await demarrer(page);
    await expect(page.getByTestId("question-card")).toHaveAttribute("data-question-id", "en-a1-1");
    await expect(page.getByTestId("progress-label")).toHaveText("Question 1 sur 2");
    await expect(page.getByTestId("feedback")).toHaveCount(0);
  });

  test("enregistre les réponses, termine la tentative et affiche le score du backend", async ({ page }) => {
    await ouvrir(page, "en");
    await demarrer(page);

    await repondre(page);
    await expect(page.getByTestId("feedback")).toContainText("Réponse enregistrée");
    await expect(page.getByTestId("feedback")).toContainText("score sera calculé à la fin");
    await expect(page.getByTestId("feedback")).not.toContainText("Bonne réponse");
    await page.getByRole("button", { name: "Question suivante" }).click();

    await expect(page.getByTestId("question-card")).toHaveAttribute("data-question-id", "en-a1-2");
    await repondre(page);
    const terminaison = page.waitForResponse((response) =>
      response.url().includes("/api/v1/diagnostic/tentatives/1/terminer") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Terminer" }).click();
    expect((await terminaison).status()).toBe(200);
    await expect(page).toHaveURL(`${URL_TEST}/resultats`);
    await expect(page.getByTestId("test-result")).toBeVisible();
    await expect(page.getByTestId("result-level")).toHaveText("B1");
    await expect(page.getByTestId("result-framework")).toHaveText("CECRL");
    await expect(page.getByTestId("result-score")).toHaveText(/50\s*\/\s*100/);
    await expect(page.getByRole("link", { name: "Commencer mon parcours" })).toBeVisible();
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

  test("renvoie au démarrage si le test ou le résultat est ouvert sans tentative", async ({ page }) => {
    await ouvrir(page, "en");
    await page.goto(`${URL_TEST}/test`);
    await expect(page).toHaveURL(URL_TEST);
    await page.goto(`${URL_TEST}/resultats`);
    await expect(page).toHaveURL(URL_TEST);
  });

  test("reprend la tentative en cours après un rechargement de la page", async ({ page }) => {
    await ouvrir(page, "en");
    await demarrer(page);
    await page.reload();
    await expect(page.getByTestId("question-card")).toHaveAttribute("data-question-id", "en-a1-1");
    await page.goto(URL_TEST);
    await expect(page).toHaveURL(`${URL_TEST}/test`);
  });

  test("quitter le test ramène au démarrage", async ({ page }) => {
    await ouvrir(page, "en");
    await demarrer(page);
    await page.getByTestId("test-back").click();
    await page.getByRole("dialog").getByRole("button", { name: "Quitter le test" }).click();
    await expect(page).toHaveURL(URL_TEST);
    await expect(page.getByRole("heading", { name: "Évaluons votre niveau" })).toBeVisible();
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
