import { test, expect, type Page } from "@playwright/test";
import { QUESTIONS_TEST } from "../src/mocks/questions-test.mock";
import type { CodeLangue } from "../src/types/langue";
import { loginAs } from "./support/session";
import { mockTestDiagnosticApi } from "./support/test-diagnostic-api";

const URL_TEST = "/espace/apprenant/test-diagnostic";

// Le paramètre ?langue= présélectionne la langue tant que le profil ne stocke pas de préférence.
async function ouvrir(
  page: Page,
  langue: CodeLangue,
  options?: { failFirstAnswer?: boolean; forceIncorrect?: boolean },
) {
  await mockTestDiagnosticApi(page, options);
  await page.context().grantPermissions(["microphone"]);
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

/** Répond à la question affichée (juste ou fausse) et valide. */
async function repondre(page: Page, langue: CodeLangue, correcte: boolean) {
  const id = await page.getByTestId("question-card").getAttribute("data-question-id");
  const question = QUESTIONS_TEST[langue].find((q) => q.id === id)!;
  if (question.competence === "ecoute") {
    const lectureAudio = page.getByRole("button", { name: "Écouter l’extrait" });
    await expect(lectureAudio).toBeVisible();
    await lectureAudio.click();
  }
  if (question.typeReponse === "texte") {
    await page.getByLabel("Votre réponse").fill(correcte ? "Lifelong learning helps people adapt." : "A short answer.");
    await page.getByRole("button", { name: /Valider et continuer/ }).click();
    return;
  }
  if (question.typeReponse === "audio") {
    await page.getByRole("button", { name: /Enregistrer ma réponse|Réenregistrer/ }).click();
    await expect(page.getByRole("status")).toContainText("Enregistrement en cours");
    await page.getByRole("button", { name: /Arrêter l’enregistrement/ }).click();
    await expect(page.getByRole("status")).toContainText("Enregistrement prêt");
    await page.getByRole("button", { name: /Valider et continuer/ }).click();
    return;
  }
  const choix = question.choix ?? [];
  const faux = choix.findIndex((_, i) => i !== question.bonneReponse);
  await page.getByTestId(`option-${correcte ? question.bonneReponse : faux}`).click();
  await page.getByRole("button", { name: /Valider et continuer|Valider la réponse/ }).click();
}

async function totalQuestions(page: Page) {
  return Number(await page.getByRole("progressbar").getAttribute("aria-valuemax"));
}

async function jouerTout(page: Page, langue: CodeLangue, correcte: boolean) {
  const total = await totalQuestions(page);
  for (let i = 0; i < total; i++) {
    await repondre(page, langue, correcte);
    await page.getByRole("button", { name: /Question suivante|Voir mon résultat/ }).click();
  }
}

/** Aucun défilement horizontal : la page tient dans la largeur de l'écran. */
async function expectSansDebordement(page: Page) {
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(deborde).toBe(false);
}

test.describe("Test de positionnement adaptatif", () => {
  test("préselectionne la langue indiquée dans l'URL", async ({ page }) => {
    await ouvrir(page, "fr");
    await expect(page.getByRole("radio", { name: /Français/ })).toBeChecked();
    await expect(page.getByRole("button", { name: /Continuer/ })).toBeEnabled();
  });

  test("permet de changer de langue avant de commencer", async ({ page }) => {
    await ouvrir(page, "fr");
    await page.getByTestId("language-option-en").click();
    await expect(page.getByRole("radio", { name: /Anglais/ })).toBeChecked();
    await demarrer(page);
    await expect(page.getByTestId("question-card")).toHaveAttribute("data-language", "en");
  });

  test("signale si la langue n'a pas de questions", async ({ page }) => {
    await ouvrir(page, "zh");
    await page.getByRole("button", { name: /Continuer/ }).click();
    await page.getByRole("button", { name: /Commencer le test IA/ }).click();
    await expect(page.getByRole("alert").filter({ hasText: "pas encore disponible" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Test indisponible" })).toBeDisabled();
  });

  test("augmente la difficulté après une bonne réponse", async ({ page }) => {
    await ouvrir(page, "en");
    await demarrer(page);
    const progression = page.getByRole("progressbar", { name: "Progression du test" });
    await expect(progression).toHaveAttribute("aria-valuenow", "0");
    await expect(page.getByTestId("level-scale")).toHaveAttribute("data-level", "B1");
    await repondre(page, "en", true);
    await expect(page.getByTestId("feedback")).toContainText("Bonne réponse");
    await expect(progression).toHaveAttribute("aria-valuenow", "1");
    await page.getByRole("button", { name: "Question suivante" }).click();
    await expect(page.getByTestId("progress-label")).toHaveText("Question 2 sur 10");
    await expect(page.getByTestId("level-scale")).toHaveAttribute("data-level", "B2");
    await expect(progression).toHaveAttribute("aria-valuenow", "1");
  });

  test("baisse la difficulté après une mauvaise réponse", async ({ page }) => {
    await ouvrir(page, "en");
    await demarrer(page);
    await repondre(page, "en", false);
    await expect(page.getByTestId("feedback")).toContainText("Réponse incorrecte");
    await page.getByRole("button", { name: "Question suivante" }).click();
    await expect(page.getByTestId("level-scale")).toHaveAttribute("data-level", "A2");
  });

  test("permet de réessayer une réponse après une erreur serveur", async ({ page }) => {
    await ouvrir(page, "en", { failFirstAnswer: true });
    const statutsReponses: number[] = [];
    page.on("response", (response) => {
      if (response.url().includes("/test-diagnostic/sessions/") && response.url().endsWith("/reponses")) {
        statutsReponses.push(response.status());
      }
    });
    await demarrer(page);
    await repondre(page, "en", true);
    await expect(page.getByRole("alert").filter({ hasText: "Le serveur rencontre un problème" })).toBeVisible();
    await page.getByRole("button", { name: "Réessayer" }).click();
    await expect.poll(() => statutsReponses).toEqual([503, 200]);
    await expect(page.getByTestId("feedback")).toContainText("Bonne réponse");
  });

  test("affiche C2 et le score maximal si toutes les réponses sont justes", async ({ page }) => {
    await ouvrir(page, "en");
    await demarrer(page);
    const total = await totalQuestions(page);
    await jouerTout(page, "en", true);
    await expect(page.getByTestId("result-level")).toHaveText("C2");
    await expect(page.getByTestId("result-score")).toHaveText(`${total} / ${total}`);
    await expect(page.getByTestId("result-competence-oral")).toBeVisible();
    await expect(page.getByTestId("result-competence-ecrit")).toBeVisible();
    await expect(page.getByTestId("result-weaknesses")).toContainText("Aucun point faible détecté");
    await expect(page.getByRole("link", { name: "Retour à mon espace apprenant" })).toBeVisible();
  });

  test("affiche A1 si toutes les réponses sont fausses", async ({ page }) => {
    await ouvrir(page, "fr", { forceIncorrect: true });
    await demarrer(page);
    const total = await totalQuestions(page);
    await jouerTout(page, "fr", false);
    await expect(page.getByTestId("result-level")).toHaveText("A1");
    await expect(page.getByTestId("result-score")).toHaveText(`0 / ${total}`);
    await expect(page.getByTestId("result-weaknesses")).toContainText("Grammaire et vocabulaire");
  });

  test("reste lisible sans défilement horizontal (desktop et mobile)", async ({ page }) => {
    await ouvrir(page, "en");
    await expectSansDebordement(page);
    await demarrer(page);
    await expectSansDebordement(page);
    await repondre(page, "en", true);
    await expectSansDebordement(page);
  });
});