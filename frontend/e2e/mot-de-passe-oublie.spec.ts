import { expect, test, type Page } from "@playwright/test";

/*
 * Mot de passe oublié (lien de la page de connexion) : demande d'un lien par e-mail,
 * puis choix d'un nouveau mot de passe via /reset-password?token=…
 *
 * L'API est simulée avec page.route : ces tests ne dépendent pas du backend.
 */

const FORGOT_API = "**/api/v1/auth/forgot-password";
const RESET_API = "**/api/v1/auth/reset-password";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Simule un endpoint ; renvoie les corps de requête reçus. */
async function mockApi(page: Page, url: string, status: number, body: unknown = null) {
  const requests: unknown[] = [];
  await page.route(url, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS_HEADERS });
    requests.push(route.request().postDataJSON());
    await route.fulfill(
      status === 204
        ? { status, headers: CORS_HEADERS }
        : { status, headers: CORS_HEADERS, contentType: "application/json", body: JSON.stringify(body) },
    );
  });
  return requests;
}

test.describe("Mot de passe oublié", () => {
  test("est accessible depuis la page de connexion", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();

    await expect(page).toHaveURL("/forgot-password");
    await expect(page.getByRole("heading", { name: "Mot de passe oublié ?" })).toBeVisible();
  });

  test("valide l'e-mail avant d'appeler l'API", async ({ page }) => {
    const requests = await mockApi(page, FORGOT_API, 204);
    await page.goto("/forgot-password");

    await page.getByRole("button", { name: "Envoyer le lien" }).click();
    await expect(page.getByText("L'adresse e-mail est requise.")).toBeVisible();

    await page.getByLabel("Adresse e-mail").fill("pas-un-email");
    await page.getByRole("button", { name: "Envoyer le lien" }).click();
    await expect(page.getByText("Adresse e-mail invalide.")).toBeVisible();

    expect(requests).toHaveLength(0);
  });

  test("envoie le lien, confirme l'envoi et permet de le renvoyer", async ({ page }) => {
    const requests = await mockApi(page, FORGOT_API, 204);
    await page.goto("/forgot-password");

    await page.getByLabel("Adresse e-mail").fill("rova@exemple.com");
    await page.getByRole("button", { name: "Envoyer le lien" }).click();

    await expect(page.getByRole("heading", { name: "Vérifiez votre boîte mail" })).toBeVisible();
    await expect(page.getByText("rova@exemple.com")).toBeVisible();
    expect(requests).toEqual([{ email: "rova@exemple.com" }]);

    await page.getByRole("button", { name: "Renvoyer l'e-mail" }).click();
    await expect.poll(() => requests.length).toBe(2);
    await expect(page.getByRole("link", { name: "← Retour à la connexion" })).toHaveAttribute("href", "/login");
  });

  test("affiche un message si le serveur est en panne", async ({ page }) => {
    await mockApi(page, FORGOT_API, 500, {});
    await page.goto("/forgot-password");

    await page.getByLabel("Adresse e-mail").fill("rova@exemple.com");
    await page.getByRole("button", { name: "Envoyer le lien" }).click();

    await expect(page.getByText("Le serveur rencontre un problème. Réessayez plus tard.")).toBeVisible();
  });
});

test.describe("Nouveau mot de passe", () => {
  const motDePasse = (page: Page) => page.getByLabel("Nouveau mot de passe");
  const confirmation = (page: Page) => page.getByLabel("Confirmer le mot de passe");
  const valider = (page: Page) => page.getByRole("button", { name: "Réinitialiser le mot de passe" }).click();

  test("sans token, le lien est signalé invalide", async ({ page }) => {
    await page.goto("/reset-password");

    await expect(page.getByRole("heading", { name: "Lien invalide" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Demander un nouveau lien" })).toHaveAttribute("href", "/forgot-password");
  });

  test("valide le nouveau mot de passe avant d'appeler l'API", async ({ page }) => {
    const requests = await mockApi(page, RESET_API, 204);
    await page.goto("/reset-password?token=abc123");

    await motDePasse(page).fill("court");
    await confirmation(page).fill("autre");
    await valider(page);

    await expect(page.getByText(/Le mot de passe doit contenir/)).toBeVisible();
    await expect(page.getByText("Les mots de passe ne correspondent pas.")).toBeVisible();
    expect(requests).toHaveLength(0);
  });

  test("enregistre le mot de passe puis renvoie vers la connexion", async ({ page }) => {
    const requests = await mockApi(page, RESET_API, 204);
    await page.goto("/reset-password?token=abc123");

    await motDePasse(page).fill("Langue2026");
    await confirmation(page).fill("Langue2026");
    await valider(page);

    await expect(page).toHaveURL("/login?reset=success");
    await expect(page.getByText("Votre mot de passe a été réinitialisé. Vous pouvez vous connecter.")).toBeVisible();
    expect(requests).toEqual([{ token: "abc123", nouveau_mot_de_passe: "Langue2026" }]);
  });

  test("signale un lien expiré", async ({ page }) => {
    await mockApi(page, RESET_API, 400, { detail: "Invalid or expired token" });
    await page.goto("/reset-password?token=expire");

    await motDePasse(page).fill("Langue2026");
    await confirmation(page).fill("Langue2026");
    await valider(page);

    await expect(page.getByText("Ce lien de réinitialisation est invalide ou a expiré.")).toBeVisible();
    await expect(page).toHaveURL("/reset-password?token=expire");
  });
});
