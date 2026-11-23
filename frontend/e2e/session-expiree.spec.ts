import { expect, test } from "@playwright/test";
import { CORS_HEADERS, json, loginAs, type UtilisateurDto } from "./support/session";

/* Session expirée : message dédié à la connexion et purge automatique sur 401 authentifié. */

const utilisateur: UtilisateurDto = {
  id_user: 1,
  nom: "RAKOTO",
  prenom: "Rova",
  email: "rova@exemple.com",
  telephone: null,
  role: "APPRENANT",
  statut: "ACTIF",
  date_inscription: "2026-10-07T10:00:00Z",
};

test.describe("Session expirée", () => {
  test("affiche un message explicite quand on revient de /login?session=expiree", async ({ page }) => {
    await page.goto("/login?session=expiree");
    await expect(page.getByRole("alert").filter({ hasText: "Votre session a expiré" })).toContainText("Votre session a expiré");
  });

  test("un 401 sur /users/me efface la session et ramène à la connexion", async ({ page }) => {
    await loginAs(page, utilisateur);
    await page.route("**/api/v1/users/me", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: CORS_HEADERS });
        return;
      }
      await json(route, 401, { detail: "Session expirée ou invalide" });
    });

    await page.goto("/espace/apprenant");

    await expect(page).toHaveURL(/\/login\?session=expiree/);
    await expect(page.getByRole("alert").filter({ hasText: "Votre session a expiré" })).toContainText("Votre session a expiré");
    const stored = await page.evaluate(() => window.localStorage.getItem("digitheque-auth"));
    expect(stored).toBeNull();
  });
});
