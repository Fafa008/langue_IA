import { expect, test, type Page, type Route } from "@playwright/test";

/*
 * User story : « En tant qu'apprenant, je veux m'inscrire via un formulaire en ligne,
 * afin de gagner du temps. »
 * Critères : champs validés, message de succès. DoD : tests E2E, responsive.
 * À l'inscription, l'apprenant choisit au moins une langue et une formule d'abonnement.
 *
 * L'API est simulée avec page.route : ces tests ne dépendent pas du backend.
 */

const REGISTER_API = "**/api/v1/auth/register";
const FORMULES_API = "**/api/v1/formules";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const FORMULES = [
  {
    id_formule: 1,
    libelle: "Simple",
    prix_mensuel: 60000,
    duree_mois: 1,
    quota_heures: 6,
    quota_ateliers: 1,
    langues: [
      { code: "fr", libelle: "Français" },
      { code: "en", libelle: "Anglais" },
    ],
  },
  { id_formule: 2, libelle: "Luxe", prix_mensuel: 100000, duree_mois: 3, quota_heures: 12, quota_ateliers: 3, langues: [] },
  { id_formule: 3, libelle: "Premium", prix_mensuel: 150000, duree_mois: 6, quota_heures: 24, quota_ateliers: 6, langues: [] },
];

/** Simule un endpoint (et la requête CORS préalable) ; renvoie les corps de requête reçus. */
async function mockApi(page: Page, url: string, status: number, body: unknown) {
  const requests: unknown[] = [];
  await page.route(url, async (route: Route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS_HEADERS });
    if (route.request().method() === "POST") requests.push(route.request().postDataJSON());
    await route.fulfill({ status, headers: CORS_HEADERS, contentType: "application/json", body: JSON.stringify(body) });
  });
  return requests;
}

const chooseLangue = (page: Page, libelle: string) =>
  page.locator("label", { has: page.getByRole("checkbox") }).filter({ hasText: libelle }).click();
const formuleSelect = (page: Page) => page.getByLabel("Formule d'abonnement");
const ID_FORMULE = { Simple: "1", Luxe: "2", Premium: "3" } as const;
const chooseFormule = (page: Page, libelle: keyof typeof ID_FORMULE) => formuleSelect(page).selectOption(ID_FORMULE[libelle]);

async function fillRequiredFields(page: Page) {
  await page.getByLabel("Prénom", { exact: true }).fill("rova marie");
  await page.getByLabel("Nom", { exact: true }).fill("rakoto");
  await page.getByLabel("Adresse e-mail").fill("Rova@Exemple.com");
  await page.getByLabel("Date de naissance").fill("2000-05-12");
  await chooseLangue(page, "Français");
  await chooseFormule(page, "Simple");
  await page.getByLabel("Mot de passe", { exact: true }).fill("Langue2026");
  await page.getByLabel("Confirmer le mot de passe").fill("Langue2026");
  await page.getByLabel(/J'accepte les/).check();
}

const submit = (page: Page) => page.getByRole("button", { name: "Créer mon compte" }).click();

test.describe("Inscription d'un apprenant", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, FORMULES_API, 200, FORMULES);
    await page.goto("/register");
  });

  test("propose les formules Simple, Luxe et Premium dans une liste déroulante", async ({ page }) => {
    const options = formuleSelect(page).locator("option:not([disabled])");
    await expect(options).toHaveText([/^Simple — 60\s000 Ar \/ mois$/, /^Luxe —/, /^Premium —/]);

    await chooseFormule(page, "Premium");
    await expect(page.getByText("6 mois · 24 h de cours · 6 ateliers · toutes les langues")).toBeVisible();
  });

  test("affiche les erreurs de validation et n'appelle pas l'API si le formulaire est vide", async ({ page }) => {
    const requests = await mockApi(page, REGISTER_API, 201, {});

    await submit(page);

    for (const message of [
      "Le prénom est requis.",
      "Le nom est requis.",
      "L'adresse e-mail est requise.",
      "La date de naissance est requise.",
      "Choisissez au moins une langue.",
      "Choisissez une formule d'abonnement.",
      "Le mot de passe est requis.",
      "Veuillez confirmer le mot de passe.",
      "Vous devez accepter les conditions.",
    ]) {
      await expect(page.getByText(message)).toBeVisible();
    }
    expect(requests).toHaveLength(0);
    // Le premier champ en erreur reçoit le focus
    await expect(page.getByLabel("Prénom", { exact: true })).toBeFocused();
  });

  test("place le focus sur le premier champ en erreur, même plus bas dans le formulaire", async ({ page }) => {
    await fillRequiredFields(page);
    await page.getByLabel("Confirmer le mot de passe").fill("different");
    await page.getByLabel("Prénom", { exact: true }).focus();

    await submit(page);

    await expect(page.getByLabel("Confirmer le mot de passe")).toBeFocused();
  });

  test("met le nom en majuscules et une majuscule à chaque prénom pendant la saisie", async ({ page }) => {
    await page.getByLabel("Prénom", { exact: true }).pressSequentially("jean-pierre rova");
    await page.getByLabel("Nom", { exact: true }).pressSequentially("rakoto");

    await expect(page.getByLabel("Prénom", { exact: true })).toHaveValue("Jean-Pierre Rova");
    await expect(page.getByLabel("Nom", { exact: true })).toHaveValue("RAKOTO");
  });

  test("la mise en forme fonctionne avec un clavier à composition (Android, accents)", async ({ page }) => {
    // Simule un clavier qui « compose » le mot lettre par lettre puis le valide (Gboard, touches mortes)
    const ime = await page.context().newCDPSession(page);
    const nom = page.getByLabel("Nom", { exact: true });
    await nom.click();
    for (const partiel of ["r", "ra", "rak", "rako", "rakot", "rakoto"]) {
      await ime.send("Input.imeSetComposition", { text: partiel, selectionStart: partiel.length, selectionEnd: partiel.length });
    }
    await ime.send("Input.insertText", { text: "rakoto" });

    await expect(nom).toHaveValue("RAKOTO");
  });

  test("met l'e-mail en minuscules et ignore les caractères interdits pendant la saisie", async ({ page }) => {
    const email = page.getByLabel("Adresse e-mail");
    await email.pressSequentially("Rova Rakoto@Exemple.MG");
    await expect(email).toHaveValue("rovarakoto@exemple.mg");

    // Correction au milieu du texte : le curseur reste à sa place
    await email.press("Home");
    for (let i = 0; i < 4; i++) await email.press("ArrowRight");
    await email.pressSequentially(".R");
    await expect(email).toHaveValue("rova.rrakoto@exemple.mg");
  });

  test("l'icône œil affiche puis masque le mot de passe", async ({ page }) => {
    const motDePasse = page.getByLabel("Mot de passe", { exact: true });
    await motDePasse.fill("Langue2026");
    await expect(motDePasse).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: "Afficher le mot de passe" }).first().click();
    await expect(motDePasse).toHaveAttribute("type", "text");

    await page.getByRole("button", { name: "Masquer le mot de passe" }).click();
    await expect(motDePasse).toHaveAttribute("type", "password");
  });

  test("valide le format des champs", async ({ page }) => {
    await fillRequiredFields(page);
    await page.getByLabel("Adresse e-mail").fill("pas-un-email");
    await page.getByLabel("Mot de passe", { exact: true }).fill("court");
    await page.getByLabel("Confirmer le mot de passe").fill("different");

    await submit(page);

    await expect(page.getByText("Adresse e-mail invalide.")).toBeVisible();
    await expect(page.getByText(/Le mot de passe doit contenir/)).toBeVisible();
    await expect(page.getByText("Les mots de passe ne correspondent pas.")).toBeVisible();

    // Les erreurs disparaissent dès que le champ est corrigé
    await page.getByLabel("Adresse e-mail").fill("rova@exemple.com");
    await expect(page.getByText("Adresse e-mail invalide.")).toBeHidden();
  });

  test("refuse une formule qui ne couvre pas les langues choisies", async ({ page }) => {
    await fillRequiredFields(page);
    await chooseLangue(page, "Mandarin");

    await submit(page);
    await expect(page.getByText("La formule « Simple » ne couvre pas : Mandarin.")).toBeVisible();

    await chooseFormule(page, "Luxe");
    await expect(page.getByText(/ne couvre pas/)).toBeHidden();
  });

  test("crée le compte et affiche un message de succès", async ({ page }) => {
    const requests = await mockApi(page, REGISTER_API, 201, {
      id_user: 1,
      prenom: "Rova Marie",
      nom: "RAKOTO",
      email: "rova@exemple.com",
      telephone: null,
      role: "APPRENANT",
      statut: "ACTIF",
      date_inscription: "2026-10-07T10:00:00Z",
      date_naissance: "2000-05-12",
      pays: null,
      ville: null,
      objectif: null,
    });

    await fillRequiredFields(page);
    await chooseLangue(page, "Anglais");
    await submit(page);

    await expect(page.getByRole("heading", { name: "Bienvenue Rova Marie !" })).toBeVisible();
    await expect(page.getByText("Votre compte a bien été créé")).toBeVisible();
    await expect(page.getByRole("link", { name: "Se connecter" })).toHaveAttribute("href", "/login");

    // Données envoyées au format de l'API (Apprenant + Abonnement à la formule)
    expect(requests).toEqual([
      {
        prenom: "Rova Marie",
        nom: "RAKOTO",
        email: "rova@exemple.com",
        mot_de_passe: "Langue2026",
        date_naissance: "2000-05-12",
        langues: ["fr", "en"],
        id_formule: 1,
      },
    ]);
  });

  test("affiche un message si l'adresse e-mail est déjà utilisée", async ({ page }) => {
    await mockApi(page, REGISTER_API, 409, { detail: "Email already registered" });

    await fillRequiredFields(page);
    await submit(page);

    await expect(page.getByText("Un compte existe déjà avec cette adresse e-mail.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Créer mon compte" })).toBeEnabled();

    // Le message disparaît dès que l'utilisateur corrige un champ
    await page.getByLabel("Adresse e-mail").fill("autre@exemple.com");
    await expect(page.getByText("Un compte existe déjà avec cette adresse e-mail.")).toBeHidden();
  });

  test("affiche l'explication du serveur si les données sont refusées", async ({ page }) => {
    await mockApi(page, REGISTER_API, 422, { detail: "La formule choisie n'est plus disponible." });

    await fillRequiredFields(page);
    await submit(page);

    await expect(page.getByText("La formule choisie n'est plus disponible.")).toBeVisible();
  });
});

test("propose de réessayer si les formules ne se chargent pas", async ({ page }) => {
  let calls = 0;
  await page.route(FORMULES_API, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS_HEADERS });
    calls += 1;
    // Échoue au 1er appel et à la nouvelle tentative automatique, puis réussit
    if (calls <= 2) return route.fulfill({ status: 500, headers: CORS_HEADERS, body: "" });
    await route.fulfill({ status: 200, headers: CORS_HEADERS, contentType: "application/json", body: JSON.stringify(FORMULES) });
  });
  await page.goto("/register");

  await expect(page.getByText("Impossible de charger les formules.")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Réessayer" }).click();
  await expect(formuleSelect(page)).toBeEnabled();
});

test.describe("Responsive", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, FORMULES_API, 200, FORMULES);
    await page.goto("/register");
    await expect(formuleSelect(page)).toBeEnabled();
  });

  test("la page ne défile pas horizontalement", async ({ page }) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("le visuel latéral n'apparaît que sur grand écran", async ({ page, isMobile }) => {
    const sidePanel = page.getByText("Le meilleur de l'IA et de l'humain");
    if (isMobile) await expect(sidePanel).toBeHidden();
    else await expect(sidePanel).toBeVisible();
  });
});
