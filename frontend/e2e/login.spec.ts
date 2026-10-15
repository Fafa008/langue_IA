import { expect, test, type Page } from "@playwright/test";

/*
 * User story : « En tant qu'utilisateur, je veux me connecter via une page dédiée, afin d'accéder au système. »
 * Critères : gestion des erreurs (mot de passe incorrect, compte inactif). Tâches : page Login, stockage JWT.
 *
 * L'API est simulée avec page.route : ces tests ne dépendent pas du backend.
 */

const LOGIN_API = "**/api/v1/auth/login";
const STORAGE_KEY = "digitheque-auth";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

/** JWT non signé valable 1 h (le frontend lit seulement sa date d'expiration). */
const ACCESS_TOKEN = [
  Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
  Buffer.from(JSON.stringify({ sub: "1", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url"),
  "signature",
].join(".");

const utilisateur = (statut: "ACTIF" | "INACTIF" | "SUSPENDU" = "ACTIF") => ({
  id_user: 1,
  nom: "RAKOTO",
  prenom: "Rova",
  email: "rova@exemple.com",
  telephone: null,
  role: "APPRENANT",
  statut,
  date_inscription: "2026-10-07T10:00:00Z",
});

/** Simule l'endpoint de connexion ; renvoie les corps de requête reçus. */
async function mockLogin(page: Page, status: number, body: unknown) {
  const requests: unknown[] = [];
  await page.route(LOGIN_API, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS_HEADERS });
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status, headers: CORS_HEADERS, contentType: "application/json", body: JSON.stringify(body) });
  });
  return requests;
}

const emailField = (page: Page) => page.getByLabel("Adresse e-mail");
const passwordField = (page: Page) => page.getByLabel("Mot de passe", { exact: true });
const submit = (page: Page) => page.getByRole("button", { name: "Se connecter" }).click();

async function fillCredentials(page: Page, email = "Rova@Exemple.com", motDePasse = "Langue2026") {
  await emailField(page).fill(email);
  await passwordField(page).fill(motDePasse);
}

/** Session enregistrée par le frontend dans localStorage ou sessionStorage. */
const storedSession = (page: Page, storage: "localStorage" | "sessionStorage") =>
  page.evaluate(([s, key]) => window[s as "localStorage" | "sessionStorage"].getItem(key), [storage, STORAGE_KEY]);

test.describe("Connexion", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("valide les champs avant d'appeler l'API", async ({ page }) => {
    const requests = await mockLogin(page, 200, {});

    await submit(page);

    await expect(page.getByText("L'adresse e-mail est requise.")).toBeVisible();
    await expect(page.getByText("Le mot de passe est requis.")).toBeVisible();
    await expect(emailField(page)).toBeFocused();
    expect(requests).toHaveLength(0);
  });

  test("connecte l'utilisateur, enregistre le JWT et redirige", async ({ page }) => {
    const requests = await mockLogin(page, 200, {
      access_token: ACCESS_TOKEN,
      token_type: "bearer",
      utilisateur: utilisateur(),
    });

    await fillCredentials(page);
    await submit(page);

    await expect(page).toHaveURL("/espace/apprenant");
    // Données envoyées au format de l'API (e-mail en minuscules)
    expect(requests).toEqual([{ email: "rova@exemple.com", mot_de_passe: "Langue2026" }]);
    // « Se souvenir de moi » est coché par défaut : JWT dans localStorage
    const session = JSON.parse((await storedSession(page, "localStorage")) ?? "null");
    expect(session.state.accessToken).toBe(ACCESS_TOKEN);
    expect(session.state.utilisateur.email).toBe("rova@exemple.com");
    expect(await storedSession(page, "sessionStorage")).toBeNull();
  });

  test("sans « Se souvenir de moi », le JWT est gardé pour la session du navigateur uniquement", async ({ page }) => {
    await mockLogin(page, 200, { access_token: ACCESS_TOKEN, token_type: "bearer", utilisateur: utilisateur() });

    await fillCredentials(page);
    await page.getByLabel("Se souvenir de moi").uncheck();
    await submit(page);

    await expect(page).toHaveURL("/espace/apprenant");
    expect(JSON.parse((await storedSession(page, "sessionStorage")) ?? "null").state.accessToken).toBe(ACCESS_TOKEN);
    expect(await storedSession(page, "localStorage")).toBeNull();
  });

  test("signale un mot de passe incorrect", async ({ page }) => {
    await mockLogin(page, 401, { detail: "Incorrect email or password" });

    await fillCredentials(page, "rova@exemple.com", "Mauvais2026");
    await submit(page);

    await expect(page.getByText("E-mail ou mot de passe incorrect.")).toBeVisible();
    await expect(passwordField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL("/login");
    expect(await storedSession(page, "localStorage")).toBeNull();

    // Le message disparaît dès que l'utilisateur corrige sa saisie
    await passwordField(page).fill("Langue2026");
    await expect(page.getByText("E-mail ou mot de passe incorrect.")).toBeHidden();
  });

  test("signale un compte inactif refusé par le serveur", async ({ page }) => {
    await mockLogin(page, 403, { detail: "Inactive account" });

    await fillCredentials(page);
    await submit(page);

    await expect(page.getByText(/Votre compte est inactif ou suspendu/)).toBeVisible();
    // Les identifiants ne sont pas en cause : les champs ne sont pas marqués en erreur
    await expect(passwordField(page)).toHaveAttribute("aria-invalid", "false");
    expect(await storedSession(page, "localStorage")).toBeNull();
  });

  for (const statut of ["INACTIF", "SUSPENDU"] as const) {
    test(`n'ouvre pas de session pour un compte ${statut.toLowerCase()} même si le serveur l'accepte`, async ({ page }) => {
      await mockLogin(page, 200, { access_token: ACCESS_TOKEN, token_type: "bearer", utilisateur: utilisateur(statut) });

      await fillCredentials(page);
      await submit(page);

      await expect(page.getByText(/Votre compte est inactif ou suspendu/)).toBeVisible();
      await expect(page).toHaveURL("/login");
      expect(await storedSession(page, "localStorage")).toBeNull();
    });
  }

  test("affiche un message générique si le serveur est en panne", async ({ page }) => {
    await mockLogin(page, 500, {});

    await fillCredentials(page);
    await submit(page);

    await expect(page.getByText("Le serveur rencontre un problème. Réessayez plus tard.")).toBeVisible();
    await expect(passwordField(page)).toHaveAttribute("aria-invalid", "false");
  });

  test("propose les liens vers l'inscription et le mot de passe oublié", async ({ page }) => {
    await expect(page.getByRole("link", { name: "S'inscrire" })).toHaveAttribute("href", "/register");
    await expect(page.getByRole("link", { name: "Mot de passe oublié ?" })).toHaveAttribute("href", "/forgot-password");
  });
});

test("une session dont le JWT a expiré est effacée au chargement", async ({ page }) => {
  const expired = [
    "xxx",
    Buffer.from(JSON.stringify({ sub: "1", exp: Math.floor(Date.now() / 1000) - 60 })).toString("base64url"),
    "signature",
  ].join(".");
  await page.addInitScript(
    ([key, token]) => {
      // N'écrit la session expirée qu'au premier chargement
      if (sessionStorage.getItem("init")) return;
      sessionStorage.setItem("init", "1");
      localStorage.setItem(key, JSON.stringify({ state: { utilisateur: null, accessToken: token, remember: true }, version: 0 }));
    },
    [STORAGE_KEY, expired],
  );

  await page.goto("/login");

  await expect
    .poll(async () => JSON.parse((await storedSession(page, "localStorage")) ?? "null")?.state?.accessToken ?? null)
    .toBeNull();
});
