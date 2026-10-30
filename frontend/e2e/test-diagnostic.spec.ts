import { expect, test, type Page } from "@playwright/test";
import { ACCESS_TOKEN, json, loginAs, type UtilisateurDto } from "./support/session";
import { DETAIL_TECHNIQUE, mockTestDiagnosticApi, type OptionsApiDiagnostic } from "./support/test-diagnostic-api";

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

/** Ouvre l'écran d'accueil, avec la langue présélectionnée par l'URL si elle est donnée. */
async function ouvrir(
  page: Page,
  langue?: string,
  options?: OptionsApiDiagnostic,
) {
  await mockTestDiagnosticApi(page, options);
  await loginAs(page, APPRENANT);
  await page.goto(langue ? `${URL_TEST}?langue=${langue}` : URL_TEST);
}

const boutonCommencer = (page: Page) => page.getByRole("button", { name: "Commencer le test", exact: true });

/** Accueil → personnalisation → création de la tentative. */
async function demarrer(page: Page) {
  await boutonCommencer(page).click();
  await page.getByRole("button", { name: /Lancer le test/ }).click();
  await expect(page).toHaveURL(`${URL_TEST}/test`);
}

async function repondre(page: Page) {
  await page.getByTestId("option-0").click();
  await page.getByRole("button", { name: /Valider et (continuer|finaliser)/ }).click();
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
    // langues, tentative, questions, réponse
    expect(autorisations.length).toBeGreaterThanOrEqual(4);
    expect(new Set(autorisations)).toEqual(new Set([`Bearer ${ACCESS_TOKEN}`]));
  });
});

test.describe("Écran d'accueil du diagnostic", () => {
  test("liste les langues chargées depuis l'API, avec leur échelle", async ({ page }) => {
    const appelsLangues = page.waitForRequest((request) => request.url().endsWith("/api/v1/diagnostic/langues"));
    await ouvrir(page);
    await appelsLangues;
    await page.getByTestId("language-select").click();
    await expect(page.getByRole("option")).toHaveCount(4);
    await expect(page.getByTestId("language-option-en")).toContainText("Échelle CECRL, A1 à C2");
    await expect(page.getByTestId("language-option-fr")).toContainText("Échelle CECRL, A1 à C2");
    await expect(page.getByTestId("language-option-zh")).toContainText("Bientôt disponible");
    await expect(page.getByTestId("language-option-es")).toContainText("Espagnol");
    await expect(page.getByTestId("language-option-es")).toContainText("Bientôt disponible");
  });

  test("affiche les consignes avant le démarrage", async ({ page }) => {
    await ouvrir(page);
    await expect(page.getByRole("heading", { name: "Évaluez votre niveau" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "2. Avant de commencer" })).toBeVisible();
    await expect(page.getByTestId("consignes").getByRole("listitem")).toHaveCount(5);
    await expect(page.getByTestId("consignes")).toContainText("Le test dure 15 minutes et comporte 4 étapes");
    await expect(page.getByTestId("consignes")).toContainText("sans dictionnaire ni traducteur");
  });

  test("ne permet pas de démarrer sans langue choisie", async ({ page }) => {
    await ouvrir(page);
    await expect(page.getByTestId("language-select")).toContainText("Choisissez une langue");
    await expect(boutonCommencer(page)).toBeDisabled();
    await expect(page.getByText("Choisissez une langue pour commencer.")).toBeVisible();
    await expect(page.getByTestId("chiffres-test").getByRole("definition")).toHaveText(["–", "–", "–"]);
  });

  test("une langue « Bientôt disponible » ne peut pas être choisie", async ({ page }) => {
    await ouvrir(page, "zh");
    await expect(page.getByTestId("language-select")).toContainText("Choisissez une langue");
    await page.getByTestId("language-select").click();
    await expect(page.getByTestId("language-option-zh")).toHaveAttribute("aria-disabled", "true");
    // Clic forcé : l'option est désactivée, le clic ne doit rien choisir
    await page.getByTestId("language-option-zh").click({ force: true });
    await expect(page.getByTestId("language-select")).toContainText("Choisissez une langue");
    await expect(boutonCommencer(page)).toBeDisabled();
  });

  test("le choix d'une langue affiche le nombre de questions, la durée et les niveaux", async ({ page }) => {
    await ouvrir(page);
    await page.getByTestId("language-select").click();
    await page.getByTestId("language-option-en").click();
    const chiffres = page.getByTestId("chiffres-test");
    await expect(chiffres.getByRole("term")).toHaveText(["questions", "de durée estimée", "niveaux estimés"]);
    await expect(chiffres.getByRole("definition")).toHaveText(["2", "15 min", "6"]);
    await expect(boutonCommencer(page)).toBeEnabled();
    await expect(page.getByText("Choisissez une langue pour commencer.")).toHaveCount(0);
  });

  test("préselectionne la langue indiquée dans l'URL", async ({ page }) => {
    await ouvrir(page, "fr");
    await expect(page.getByTestId("language-select")).toContainText("Français");
    await expect(boutonCommencer(page)).toBeEnabled();
  });

  test("permet de chercher et changer la langue avant de commencer", async ({ page }) => {
    await ouvrir(page, "fr");
    await page.getByTestId("language-select").click();
    await page.getByRole("combobox", { name: "Rechercher une langue" }).fill("angl");
    await expect(page.getByRole("option")).toHaveCount(1);
    await page.getByTestId("language-option-en").click();
    await expect(page.getByTestId("language-select")).toContainText("Anglais");
  });

  test("propose de réessayer si les langues ne se chargent pas", async ({ page }) => {
    await ouvrir(page, undefined, { languesEnErreur: true });
    const alerte = page.getByRole("alert").filter({ hasText: "Les langues n'ont pas pu être chargées" });
    await expect(alerte).toBeVisible();
    await expect(boutonCommencer(page)).toBeDisabled();
    await page.unrouteAll({ behavior: "wait" });
    await mockTestDiagnosticApi(page);
    await alerte.getByRole("button", { name: "Réessayer" }).click();
    await expect(page.getByTestId("language-select")).toBeVisible();
  });

  test("« Commencer le test » mène à la personnalisation, puis au test", async ({ page }) => {
    await ouvrir(page, "en");
    await boutonCommencer(page).click();
    await expect(page.getByRole("heading", { name: /Quelques questions avant de commencer/ })).toBeVisible();
    await page.getByTestId("test-back").click();
    await expect(page.getByTestId("language-select")).toContainText("Anglais");
    await demarrer(page);
  });
});

test.describe("Test de positionnement — réponses et score déterministe", () => {
  test("crée une tentative et charge les questions depuis le backend", async ({ page }) => {
    await ouvrir(page, "en");
    await demarrer(page);
    await expect(page.getByTestId("question-card")).toHaveAttribute("data-question-id", "en-a1-1");
    await expect(page.getByTestId("progress-label")).toHaveText("Question 1 sur 2");
    await expect(page.getByTestId("feedback")).toHaveCount(0);
  });

  test("affiche l'étape en cours et le temps restant", async ({ page }) => {
    await ouvrir(page, "en");
    await demarrer(page);
    await expect(page.getByRole("heading", { name: "Étape 1/1 : Grammaire et lexique" })).toBeVisible();
    await expect(page.getByRole("timer")).toHaveText(/^1[45]:\d\d$/);
    await expect(page.getByRole("button", { name: "Valider et continuer" })).toBeDisabled();
  });

  test("termine le test et affiche le résultat quand les 15 minutes sont écoulées", async ({ page }) => {
    await page.clock.install();
    await ouvrir(page, "en");
    await demarrer(page);
    const terminaison = page.waitForResponse((response) =>
      response.url().includes("/api/v1/diagnostic/tentatives/1/terminer") && response.request().method() === "POST",
    );
    await page.clock.fastForward("15:01");
    expect((await terminaison).status()).toBe(200);
    await expect(page).toHaveURL(`${URL_TEST}/resultats`);
    await expect(page.getByTestId("result-level")).toHaveText("A1");
  });

  test("enregistre les réponses, termine la tentative et affiche le score du backend", async ({ page }) => {
    await ouvrir(page, "en");
    await demarrer(page);

    await repondre(page);
    await expect(page.getByTestId("feedback")).toContainText("Réponse enregistrée");
    await expect(page.getByTestId("feedback")).toContainText("score sera calculé à la fin");
    await expect(page.getByTestId("feedback")).not.toContainText("Bonne réponse");
    // Une réponse validée ne peut pas être renvoyée
    await expect(page.getByRole("button", { name: /Valider et/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Question suivante" }).click();

    await expect(page.getByTestId("question-card")).toHaveAttribute("data-question-id", "en-a1-2");
    await repondre(page);
    const terminaison = page.waitForResponse((response) =>
      response.url().includes("/api/v1/diagnostic/tentatives/1/terminer") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Finaliser le test" }).click();
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
    await expect(page.getByTestId("erreur-diagnostic")).toContainText(
      "Votre réponse n'a pas pu être envoyée. Le service est momentanément indisponible.",
    );
    await page.getByRole("button", { name: "Réessayer" }).click();
    await expect.poll(() => statutsReponses).toEqual([503, 201]);
    await expect(page.getByTestId("feedback")).toContainText("Réponse enregistrée");
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
    await expect(page.getByRole("heading", { name: "Évaluez votre niveau" })).toBeVisible();
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

test.describe("États de l'analyse quand le LLM est lent ou indisponible", () => {
  /** Répond aux deux questions à choix du test d'anglais et clique sur « Finaliser le test ». */
  async function finaliser(page: Page) {
    await repondre(page);
    await page.getByRole("button", { name: "Question suivante" }).click();
    await repondre(page);
    await page.getByRole("button", { name: "Finaliser le test" }).click();
  }

  test("affiche un indicateur de chargement pendant l'analyse des réponses", async ({ page }) => {
    await ouvrir(page, "en");
    // Le service d'analyse met un peu de temps à répondre
    await page.route("**/api/v1/diagnostic/tentatives/*/terminer", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.fallback();
    });
    await demarrer(page);
    await finaliser(page);
    await expect(page.getByTestId("analyse-en-cours")).toContainText("Analyse de vos réponses");
    await expect(page).toHaveURL(`${URL_TEST}/resultats`);
  });

  test("API en timeout sur une réponse : message clair, réponse conservée, nouvelle tentative", async ({ page }) => {
    await page.clock.install();
    await ouvrir(page, "en", { premiereReponseSansReponse: true });
    await demarrer(page);
    await repondre(page);
    await expect(page.getByTestId("analyse-en-cours")).toBeVisible();

    await page.clock.fastForward("00:16");
    const erreur = page.getByTestId("erreur-diagnostic");
    await expect(erreur).toContainText("prend plus de temps que prévu");
    await expect(erreur).toContainText("Vos réponses déjà saisies sont conservées");
    await expect(page.getByTestId("option-0").getByRole("radio")).toBeChecked();

    await erreur.getByRole("button", { name: "Réessayer" }).click();
    await expect(page.getByTestId("feedback")).toContainText("Réponse enregistrée");
  });

  test("API en timeout pendant l'analyse finale : nouvelle tentative jusqu'au résultat", async ({ page }) => {
    await page.clock.install();
    await ouvrir(page, "en", { premiereTerminaison: "sans_reponse" });
    await demarrer(page);
    await finaliser(page);
    await expect(page.getByTestId("analyse-en-cours")).toBeVisible();

    await page.clock.fastForward("01:01");
    const erreur = page.getByTestId("erreur-diagnostic");
    await expect(erreur).toContainText("L'analyse de vos réponses prend plus de temps que prévu");
    await erreur.getByRole("button", { name: "Réessayer" }).click();
    await expect(page).toHaveURL(`${URL_TEST}/resultats`);
  });

  test("panne du service d'analyse : aucun détail technique ni secret affiché", async ({ page }) => {
    await ouvrir(page, "en", { premiereTerminaison: "panne" });
    await demarrer(page);
    await finaliser(page);

    const erreur = page.getByTestId("erreur-diagnostic");
    await expect(erreur).toContainText("L'analyse de vos réponses n'a pas pu aboutir");
    await expect(page.locator("body")).not.toContainText("Traceback");
    await expect(page.locator("body")).not.toContainText("sk-secret");
    await expect(page.locator("body")).not.toContainText(DETAIL_TECHNIQUE);
    await expect(erreur).not.toContainText("500");
    // La question est déjà envoyée : seule la nouvelle tentative est proposée
    await expect(page.getByRole("button", { name: /Valider et/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Finaliser le test" })).toHaveCount(0);

    await erreur.getByRole("button", { name: "Réessayer" }).click();
    await expect(page).toHaveURL(`${URL_TEST}/resultats`);
  });

  test("résultat en attente : vérification manuelle puis automatique", async ({ page }) => {
    await page.clock.install();
    await ouvrir(page, "en", { premiereTerminaison: "en_attente" });
    await demarrer(page);
    await finaliser(page);

    const attente = page.getByTestId("resultat-en-attente");
    await expect(attente).toContainText("Résultat en attente");
    await expect(attente).toContainText("vos réponses sont enregistrées");
    await expect(attente.getByRole("button", { name: "Vérifier mon résultat" })).toBeEnabled();

    // Sans action de l'apprenant, le résultat est redemandé au bout de 10 secondes
    await page.clock.fastForward("00:11");
    await expect(page).toHaveURL(`${URL_TEST}/resultats`);
  });

  test("le bouton « Vérifier mon résultat » redemande le résultat tout de suite", async ({ page }) => {
    await ouvrir(page, "en", { premiereTerminaison: "en_attente" });
    await demarrer(page);
    await finaliser(page);
    await page.getByTestId("resultat-en-attente").getByRole("button", { name: "Vérifier mon résultat" }).click();
    await expect(page).toHaveURL(`${URL_TEST}/resultats`);
  });

  test("une erreur sur une réponse écrite conserve le texte saisi", async ({ page }) => {
    await ouvrir(page, "en", { avecRedaction: true });
    let echec = true;
    await page.route("**/api/v1/diagnostic/reponse", async (route) => {
      const corps = route.request().method() === "POST" ? route.request().postDataJSON() : null;
      if (echec && corps?.id_question === "e2e-ecrit") {
        echec = false;
        await json(route, 503, { detail: DETAIL_TECHNIQUE });
        return;
      }
      await route.fallback();
    });
    await demarrer(page);
    await repondre(page);
    await page.getByRole("button", { name: "Question suivante" }).click();
    await repondre(page);
    await page.getByRole("button", { name: "Question suivante" }).click();

    await expect(page.getByRole("heading", { name: /Expression écrite/ })).toBeVisible();
    const texte = "Je m'appelle Rova et j'apprends l'anglais pour mon travail.";
    await page.getByLabel("Votre réponse").fill(texte);
    await page.getByRole("button", { name: "Valider et finaliser" }).click();

    const erreur = page.getByTestId("erreur-diagnostic");
    await expect(erreur).toContainText("Votre réponse n'a pas pu être envoyée");
    await expect(erreur).not.toContainText("Traceback");
    await expect(page.getByLabel("Votre réponse")).toHaveValue(texte);

    await erreur.getByRole("button", { name: "Réessayer" }).click();
    await expect(page.getByTestId("feedback")).toContainText("Réponse enregistrée");
  });
});
