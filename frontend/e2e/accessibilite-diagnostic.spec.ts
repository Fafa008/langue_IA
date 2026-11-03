import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { json, loginAs, type UtilisateurDto } from "./support/session";
import { mockTestDiagnosticApi, type OptionsApiDiagnostic } from "./support/test-diagnostic-api";

const URL_TEST = "/espace/apprenant/test-diagnostic";
const REDACTION = "Je m'appelle Rova et j'apprends l'anglais pour mon travail.";

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

/** Parcours complet : QCM (2 questions), compréhension orale, expression écrite, avec l'analyse détaillée. */
const PARCOURS: OptionsApiDiagnostic = { avecEcoute: true, avecRedaction: true, avecAnalyse: true };

async function ouvrir(page: Page, options: OptionsApiDiagnostic = PARCOURS) {
  await mockTestDiagnosticApi(page, options);
  await loginAs(page, APPRENANT);
  await page.goto(`${URL_TEST}?langue=en`);
  await expect(page.getByTestId("language-select")).toContainText("Anglais");
}

async function demarrer(page: Page) {
  await page.getByRole("button", { name: "Commencer le test", exact: true }).click();
  await page.getByRole("button", { name: /Lancer le test/ }).click();
  await expect(page.getByTestId("question-card")).toBeVisible();
}

async function repondreChoix(page: Page, option: number) {
  await page.getByTestId(`option-${option}`).click();
  await page.getByRole("button", { name: "Valider et continuer" }).click();
  await page.getByRole("button", { name: "Question suivante" }).click();
}

/** Aucune violation WCAG 2.1 niveaux A et AA (contrastes, libellés, rôles, noms accessibles…). */
async function expectAccessible(page: Page, ecran: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const resume = violations.map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(resume, `Écran « ${ecran} »`).toEqual([]);
}

/** Pas de défilement horizontal, et les éléments donnés tiennent entièrement dans la largeur de l'écran. */
async function expectAjuste(page: Page, ecran: string, elements: Locator[] = []) {
  const debordement = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(debordement, `Défilement horizontal sur « ${ecran} »`).toBeLessThanOrEqual(0);
  const largeur = page.viewportSize()!.width;
  for (const element of elements) {
    const boite = await element.boundingBox();
    expect(boite, `« ${ecran} » : élément affiché`).not.toBeNull();
    expect(boite!.x, `« ${ecran} » : élément coupé à gauche`).toBeGreaterThanOrEqual(0);
    expect(boite!.x + boite!.width, `« ${ecran} » : élément coupé à droite`).toBeLessThanOrEqual(largeur);
  }
}

/**
 * Parcourt tous les écrans du diagnostic et appelle `verifier` sur chacun : démarrage, liste des langues,
 * personnalisation, trois étapes du test, retour après réponse, boîtes de dialogue et résultats.
 */
async function parcourirLesEcrans(page: Page, verifier: (ecran: string, elements?: Locator[]) => Promise<void>) {
  await ouvrir(page);
  await verifier("démarrage", [page.getByRole("button", { name: "Commencer le test", exact: true })]);

  await page.getByTestId("language-select").click();
  await expect(page.getByRole("listbox", { name: "Langues proposées" })).toBeVisible();
  await verifier("liste des langues", [page.getByRole("combobox", { name: "Rechercher une langue" })]);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Commencer le test", exact: true }).click();
  await verifier("personnalisation", [page.getByRole("button", { name: /Lancer le test/ })]);
  await page.getByRole("button", { name: /Lancer le test/ }).click();

  await expect(page.getByTestId("question-card")).toBeVisible();
  await page.getByTestId("option-0").click();
  await verifier("question à choix", [page.getByRole("timer"), page.getByRole("button", { name: "Valider et continuer" })]);
  await page.getByRole("button", { name: "Valider et continuer" }).click();
  await expect(page.getByTestId("feedback")).toBeVisible();
  await verifier("retour après réponse", [page.getByRole("button", { name: "Question suivante" })]);
  await page.getByRole("button", { name: "Question suivante" }).click();
  await repondreChoix(page, 1);

  await expect(page.getByRole("heading", { name: /Compréhension orale/ })).toBeVisible();
  await verifier("compréhension orale", [page.getByRole("button", { name: "Écouter l’extrait" })]);
  await repondreChoix(page, 0);

  await page.getByLabel("Votre réponse").fill(REDACTION);
  await verifier("expression écrite", [page.getByLabel("Votre réponse"), page.getByRole("button", { name: "Valider et finaliser" })]);

  await page.getByTestId("test-back").click();
  await verifier("confirmation « Quitter le test »", [page.getByRole("dialog").getByRole("button", { name: "Quitter le test" })]);
  await page.keyboard.press("Escape");
  await page.getByRole("banner").getByRole("link").first().click();
  await verifier("confirmation de sortie", [page.getByRole("dialog").getByRole("button", { name: "Quitter la page" })]);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Valider et finaliser" }).click();
  await page.getByRole("button", { name: "Finaliser le test" }).click();
  await expect(page.getByTestId("test-result")).toBeVisible();
  await page.getByTestId("source-referentiel").first().locator("summary").click();
  await verifier("résultats", [
    page.getByTestId("result-level"),
    page.getByRole("link", { name: "Commencer mon parcours" }),
    page.getByRole("button", { name: "Refaire le test" }),
  ]);
}

/** États secondaires : erreur d'envoi, résultat en attente, minuteur presque écoulé, test interrompu, résultat partiel. */
async function parcourirLesEtats(page: Page, verifier: (ecran: string, elements?: Locator[]) => Promise<void>) {
  await page.clock.install();
  await ouvrir(page, { failFirstAnswer: true, premiereTerminaison: "en_attente" });
  await demarrer(page);

  await page.getByTestId("option-0").click();
  await page.getByRole("button", { name: "Valider et continuer" }).click();
  await expect(page.getByTestId("erreur-diagnostic")).toBeVisible();
  await verifier("erreur d'envoi", [page.getByTestId("erreur-diagnostic").getByRole("button", { name: "Réessayer" })]);
  await page.getByTestId("erreur-diagnostic").getByRole("button", { name: "Réessayer" }).click();
  await page.getByRole("button", { name: "Question suivante" }).click();

  // Deux dernières minutes : le minuteur change de couleur
  await page.clock.fastForward("13:30");
  await expect(page.getByRole("timer")).toHaveClass(/text-warning-dark/);
  await verifier("minuteur presque écoulé", [page.getByRole("timer")]);

  await page.getByTestId("option-1").click();
  await page.getByRole("button", { name: "Valider et finaliser" }).click();
  await page.getByRole("button", { name: "Finaliser le test" }).click();
  await expect(page.getByTestId("resultat-en-attente")).toBeVisible();
  await verifier("résultat en attente", [page.getByRole("button", { name: "Vérifier mon résultat" })]);
  await page.getByRole("button", { name: "Vérifier mon résultat" }).click();
  await expect(page.getByTestId("resultat-partiel")).toBeVisible();
  await verifier("résultat partiel");

  // Test interrompu (nouvelle tentative, onglet rouvert sans mémoire locale)
  await page.getByRole("button", { name: "Refaire le test" }).click();
  await demarrer(page);
  await repondreChoix(page, 0);
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(URL_TEST);
  await expect(page.getByTestId("test-interrompu")).toBeVisible();
  await verifier("test interrompu", [
    page.getByRole("button", { name: "Reprendre le test" }),
    page.getByRole("button", { name: "Commencer un nouveau test" }),
  ]);
}

test.describe("Accessibilité des écrans du diagnostic (WCAG 2.1 AA)", () => {
  test("parcours complet : aucune violation (contrastes, libellés, rôles)", async ({ page }) => {
    await parcourirLesEcrans(page, (ecran) => expectAccessible(page, ecran));
  });

  test("erreurs, attente, minuteur et test interrompu : aucune violation", async ({ page }) => {
    await parcourirLesEtats(page, (ecran) => expectAccessible(page, ecran));
  });
});

test.describe("Affichage sur un téléphone de 360 px", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Largeur fixée à 360 px : un seul projet suffit");
  });

  test("tous les écrans du parcours tiennent dans la largeur", async ({ page }) => {
    await parcourirLesEcrans(page, (ecran, elements) => expectAjuste(page, ecran, elements));
  });

  test("les états secondaires tiennent dans la largeur", async ({ page }) => {
    await parcourirLesEtats(page, (ecran, elements) => expectAjuste(page, ecran, elements));
  });
});

test.describe("Navigation au clavier", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Parcours au clavier physique");
  });

  /** Tabulations jusqu'à l'élément voulu (40 au plus) : il doit être atteignable au clavier. */
  async function tabulerJusqua(page: Page, cible: Locator) {
    for (let i = 0; i < 40; i++) {
      if (await cible.evaluate((el) => el === document.activeElement)) return;
      await page.keyboard.press("Tab");
    }
    throw new Error("Élément inaccessible au clavier");
  }

  test("tout le test se passe au clavier, du choix de la langue au résultat", async ({ page }) => {
    await mockTestDiagnosticApi(page, PARCOURS);
    await loginAs(page, APPRENANT);
    await page.goto(URL_TEST);

    // Choix de la langue : ouverture, recherche, sélection à l'Entrée
    await tabulerJusqua(page, page.getByTestId("language-select"));
    await page.keyboard.press("Enter");
    await expect(page.getByRole("combobox", { name: "Rechercher une langue" })).toBeFocused();
    await page.keyboard.type("angl");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("language-select")).toContainText("Anglais");

    await tabulerJusqua(page, page.getByRole("button", { name: "Commencer le test", exact: true }));
    await page.keyboard.press("Enter");
    await tabulerJusqua(page, page.getByRole("button", { name: /Lancer le test/ }));
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("question-card")).toBeVisible();

    // Questions à choix : flèches pour choisir, Entrée pour valider et continuer
    for (const option of [0, 1, 0]) {
      await tabulerJusqua(page, page.getByRole("radio").first());
      for (let i = 0; i < option; i++) await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Space");
      await expect(page.getByRole("radio").nth(option)).toBeChecked();
      await tabulerJusqua(page, page.getByRole("button", { name: "Valider et continuer" }));
      await page.keyboard.press("Enter");
      await tabulerJusqua(page, page.getByRole("button", { name: "Question suivante" }));
      await page.keyboard.press("Enter");
    }

    // Expression écrite
    await tabulerJusqua(page, page.getByLabel("Votre réponse"));
    await page.keyboard.type(REDACTION);
    await tabulerJusqua(page, page.getByRole("button", { name: "Valider et finaliser" }));
    await page.keyboard.press("Enter");
    await tabulerJusqua(page, page.getByRole("button", { name: "Finaliser le test" }));
    await page.keyboard.press("Enter");

    // Résultats : les sources du référentiel se déplient au clavier
    await expect(page.getByTestId("test-result")).toBeVisible();
    const source = page.getByTestId("source-referentiel").first();
    await tabulerJusqua(page, source.locator("summary"));
    await page.keyboard.press("Enter");
    await expect(source).toHaveAttribute("open", "");
    await tabulerJusqua(page, page.getByRole("link", { name: "Commencer mon parcours" }));
  });

  test("les boîtes de dialogue prennent le focus et se ferment avec Échap", async ({ page }) => {
    await ouvrir(page);
    await demarrer(page);

    await tabulerJusqua(page, page.getByTestId("test-back"));
    await page.keyboard.press("Enter");
    const dialogue = page.getByRole("dialog", { name: "Quitter le test ?" });
    await expect(dialogue).toBeVisible();
    // Le focus entre dans la boîte (le reste de la page est inerte) et en parcourt les boutons dans l'ordre
    await expect(dialogue.getByRole("button", { name: "Fermer" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialogue.getByRole("button", { name: "Annuler" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialogue.getByRole("button", { name: "Quitter le test" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialogue).toHaveCount(0);
    await expect(page.getByTestId("question-card")).toBeVisible();
  });

  test("une erreur d'envoi annonce son message et garde le bouton « Réessayer » au clavier", async ({ page }) => {
    await ouvrir(page);
    let echec = true;
    await page.route("**/api/v1/diagnostic/reponse", async (route) => {
      if (echec && route.request().method() === "POST") {
        echec = false;
        await json(route, 503, { detail: "Service indisponible" });
        return;
      }
      await route.fallback();
    });
    await demarrer(page);
    await page.getByTestId("option-0").click();
    await page.getByRole("button", { name: "Valider et continuer" }).click();

    // Message annoncé aux lecteurs d'écran (role="alert")
    const erreur = page.getByTestId("erreur-diagnostic");
    await expect(erreur).toHaveAttribute("role", "alert");
    await expect(erreur).toContainText("Votre réponse n'a pas pu être envoyée");
    await tabulerJusqua(page, erreur.getByRole("button", { name: "Réessayer" }));
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("feedback")).toContainText("Réponse enregistrée");
  });
});
