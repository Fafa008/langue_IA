import { expect, test, type Page } from "@playwright/test";
import { loginAs, type UtilisateurDto } from "./support/session";
import { mockTestDiagnosticApi } from "./support/test-diagnostic-api";

const URL_TEST = "/espace/apprenant/test-diagnostic";

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

/** Démarre le test d'anglais (2 questions à choix) et enregistre la réponse à la première question. */
async function commencerEtRepondreUneFois(page: Page) {
  await mockTestDiagnosticApi(page);
  await loginAs(page, APPRENANT);
  await page.goto(`${URL_TEST}?langue=en`);
  await page.getByRole("button", { name: "Commencer le test", exact: true }).click();
  await page.getByRole("button", { name: /Lancer le test/ }).click();
  await expect(page).toHaveURL(`${URL_TEST}/test`);

  await page.getByTestId("option-0").click();
  await page.getByRole("button", { name: "Valider et continuer" }).click();
  await expect(page.getByTestId("feedback")).toContainText("Réponse enregistrée");
  await page.getByRole("button", { name: "Question suivante" }).click();
  await expect(page.getByTestId("progress-label")).toHaveText("Question 2 sur 2");
}

/** Onglet fermé puis rouvert : le test n'est plus connu du navigateur, seulement du serveur. */
async function rouvrirSansMemoireLocale(page: Page) {
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(URL_TEST);
}

test.describe("Reprise d'un test interrompu", () => {
  test("le test interrompu est identifié, puis repris avec ses réponses restaurées depuis le serveur", async ({ page }) => {
    await commencerEtRepondreUneFois(page);
    await rouvrirSansMemoireLocale(page);

    const carte = page.getByTestId("test-interrompu");
    await expect(carte.getByRole("heading", { name: "Test interrompu" })).toBeVisible();
    await expect(carte).toContainText("Votre test d'anglais commencé le");
    await expect(page.getByTestId("test-interrompu-detail")).toContainText("1 réponse enregistrée sur 2");
    await expect(page.getByTestId("test-interrompu-detail")).toContainText("Il vous reste environ");
    // Le choix de la langue n'est pas proposé tant que le test interrompu n'est ni repris ni abandonné
    await expect(page.getByRole("button", { name: "Commencer le test", exact: true })).toHaveCount(0);

    await carte.getByRole("button", { name: "Reprendre le test" }).click();
    await expect(page).toHaveURL(`${URL_TEST}/test`);
    // Reprise à la question sans réponse : la première n'est pas reposée
    await expect(page.getByTestId("progress-label")).toHaveText("Question 2 sur 2");
    await expect(page.getByTestId("question-card")).toHaveAttribute("data-question-id", "en-a1-2");

    await page.getByTestId("option-1").click();
    await page.getByRole("button", { name: "Valider et finaliser" }).click();
    await page.getByRole("button", { name: "Finaliser le test" }).click();
    await expect(page).toHaveURL(`${URL_TEST}/resultats`);
    // Les deux réponses (dont celle restaurée) sont justes
    await expect(page.getByTestId("result-score")).toHaveText(/100\s*\/\s*100/);
  });

  test("commencer un nouveau test abandonne le test interrompu", async ({ page }) => {
    await commencerEtRepondreUneFois(page);
    const abandon = page.waitForRequest((request) =>
      request.method() === "POST" && /\/diagnostic\/tentatives\/\d+\/abandonner$/.test(request.url()),
    );
    await rouvrirSansMemoireLocale(page);

    await page.getByRole("button", { name: "Commencer un nouveau test" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Abandonner et recommencer" }).click();
    await abandon;

    await expect(page.getByTestId("test-interrompu")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "1. Choisissez la langue" })).toBeVisible();
  });

  test("« Quitter le test » abandonne la tentative : elle n'est plus proposée à la reprise", async ({ page }) => {
    await commencerEtRepondreUneFois(page);
    await page.getByTestId("test-back").click();
    await page.getByRole("dialog").getByRole("button", { name: "Quitter le test" }).click();
    await expect(page).toHaveURL(URL_TEST);

    await rouvrirSansMemoireLocale(page);
    await expect(page.getByRole("heading", { name: "1. Choisissez la langue" })).toBeVisible();
    await expect(page.getByTestId("test-interrompu")).toHaveCount(0);
  });
});

test.describe("Confirmation avant de quitter la page du test", () => {
  test("un lien de l'application demande confirmation ; le test quitté se reprend ensuite", async ({ page }) => {
    await commencerEtRepondreUneFois(page);
    const lienAccueil = page.getByRole("banner").getByRole("link").first();

    await lienAccueil.click();
    const dialogue = page.getByRole("dialog", { name: "Quitter la page du test ?" });
    await expect(dialogue).toContainText("Vos réponses déjà validées sont enregistrées");
    await dialogue.getByRole("button", { name: "Annuler" }).click();
    await expect(page).toHaveURL(`${URL_TEST}/test`);
    await expect(page.getByTestId("progress-label")).toHaveText("Question 2 sur 2");

    await lienAccueil.click();
    await page.getByRole("dialog").getByRole("button", { name: "Quitter la page" }).click();
    await expect(page).not.toHaveURL(/test-diagnostic/);

    // Retour au test : il reprend à la même question
    await page.goto(URL_TEST);
    await expect(page).toHaveURL(`${URL_TEST}/test`);
    await expect(page.getByTestId("progress-label")).toHaveText("Question 2 sur 2");
  });

  test("fermer l'onglet pendant le test déclenche l'avertissement du navigateur", async ({ page }) => {
    await commencerEtRepondreUneFois(page);
    const avertissement = page.waitForEvent("dialog");
    await page.close({ runBeforeUnload: true });
    const dialog = await avertissement;
    expect(dialog.type()).toBe("beforeunload");
    await dialog.accept();
  });

  test("hors du test, aucune confirmation n'est demandée", async ({ page }) => {
    await mockTestDiagnosticApi(page);
    await loginAs(page, APPRENANT);
    await page.goto(URL_TEST);
    await page.getByRole("banner").getByRole("link").first().click();
    await expect(page).not.toHaveURL(/test-diagnostic/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
