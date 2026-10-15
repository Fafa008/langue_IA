import { expect, test, type Page } from "@playwright/test";
import { ACCESS_TOKEN, handlePreflight, json, loginAs, type UtilisateurDto } from "./support/session";

/*
 * Un espace par rôle : après la connexion, chaque rôle arrive sur son tableau de bord,
 * voit son propre menu et ne peut pas ouvrir les pages des autres rôles.
 */

type Role = UtilisateurDto["role"];

const COMPTES: Record<Role, UtilisateurDto> = {
  APPRENANT: compte(1, "APPRENANT", "Rova", "apprenant@digitheque.mg"),
  FORMATEUR: compte(2, "FORMATEUR", "Hery", "formateur@digitheque.mg"),
  ADMINISTRATEUR: compte(3, "ADMINISTRATEUR", "Fanja", "admin@digitheque.mg"),
};

function compte(id_user: number, role: Role, prenom: string, email: string): UtilisateurDto {
  return { id_user, role, prenom, email, nom: "DEMO", telephone: null, statut: "ACTIF", date_inscription: "2025-01-06T08:00:00Z" };
}

/**
 * Accueil attendu, son titre et une entrée de menu propre à chaque rôle.
 * L'administrateur a son propre tableau de bord (KPI) au lieu de l'accueil par raccourcis.
 */
const ESPACES: Record<Role, { accueil: string; titre: string; rubrique: string }> = {
  APPRENANT: { accueil: "/espace/apprenant", titre: "Bonjour Rova", rubrique: "Mes inscriptions" },
  FORMATEUR: { accueil: "/espace/formateur", titre: "Bonjour Hery", rubrique: "Mes séances" },
  ADMINISTRATEUR: { accueil: "/espace/admin", titre: "Tableau de bord", rubrique: "Utilisateurs" },
};

/** Statistiques minimales du tableau de bord administrateur. */
async function mockStatistiques(page: Page) {
  await page.route(/\/api\/v1\/admin\/statistiques/, async (route) => {
    if (await handlePreflight(route)) return;
    if (route.request().url().includes("/inscriptions")) return json(route, 200, []);
    return json(route, 200, {
      totaux: { utilisateurs: 3, apprenants: 1, formateurs: 1, ateliers_programmes: 0 },
      apprenants_par_langue: [],
      dernieres_inscriptions: [],
    });
  });
}

/** Simule la connexion : le compte renvoyé dépend de l'adresse saisie. */
async function mockLogin(page: Page) {
  await page.route("**/api/v1/auth/login", async (route) => {
    if (await handlePreflight(route)) return;
    const { email } = route.request().postDataJSON();
    const utilisateur = Object.values(COMPTES).find((c) => c.email === email);
    return utilisateur
      ? json(route, 200, { access_token: ACCESS_TOKEN, token_type: "bearer", utilisateur })
      : json(route, 401, { detail: "Incorrect email or password" });
  });
}

async function seConnecter(page: Page, email: string) {
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill("Demo2026");
  await page.getByRole("button", { name: "Se connecter" }).click();
}

for (const role of Object.keys(COMPTES) as Role[]) {
  const { email } = COMPTES[role];
  const { accueil, titre, rubrique } = ESPACES[role];

  test(`${role.toLowerCase()} : arrive sur son espace après la connexion`, async ({ page }, testInfo) => {
    await mockLogin(page);
    await mockStatistiques(page);
    await page.goto("/login");

    await seConnecter(page, email);

    await expect(page).toHaveURL(accueil);
    await expect(page.getByRole("heading", { name: titre, level: 1 })).toBeVisible();
    // Raccourci (ou carte KPI pour l'administrateur) propre au rôle sur le tableau de bord
    await expect(page.getByRole("main").getByText(rubrique, { exact: true })).toBeVisible();

    // Menu du compte : lien vers son espace
    await page.getByRole("button", { name: "Menu du compte" }).click();
    await expect(page.getByRole("menuitem", { name: "Mon espace" })).toHaveAttribute("href", accueil);

    if (testInfo.project.name === "desktop") {
      const nav = page.getByRole("navigation", { name: "Espace personnel" });
      await expect(nav.getByText(rubrique, { exact: true })).toBeVisible();
      // Le menu ne montre pas les rubriques des autres rôles
      for (const autre of (Object.keys(ESPACES) as Role[]).filter((r) => r !== role)) {
        await expect(nav.getByText(ESPACES[autre].rubrique, { exact: true })).toHaveCount(0);
      }
    }
  });
}

test("sans session, une page protégée redirige vers la connexion, puis vers l'espace du rôle", async ({ page }) => {
  await mockLogin(page);
  await page.goto("/espace/admin/utilisateurs");
  await expect(page).toHaveURL("/login");

  await seConnecter(page, COMPTES.ADMINISTRATEUR.email);
  await expect(page).toHaveURL(ESPACES.ADMINISTRATEUR.accueil);
});

test("un paramètre ?next= vers un autre site est ignoré après connexion", async ({ page }) => {
  await mockLogin(page);
  await page.goto("/login?next=/%5Cexemple.com");

  await seConnecter(page, COMPTES.APPRENANT.email);
  await expect(page).toHaveURL(ESPACES.APPRENANT.accueil);
});

/** Pages réservées à un rôle : [page, rôle autorisé]. */
const PAGES_RESERVEES: [string, Role][] = [
  ["/espace/apprenant", "APPRENANT"],
  ["/espace/formateur", "FORMATEUR"],
  ["/espace/admin", "ADMINISTRATEUR"],
  ["/espace/admin/utilisateurs", "ADMINISTRATEUR"],
];

for (const [chemin, autorise] of PAGES_RESERVEES) {
  for (const role of (Object.keys(COMPTES) as Role[]).filter((r) => r !== autorise)) {
    test(`${role.toLowerCase()} : n'a pas accès à ${chemin}`, async ({ page }) => {
      await loginAs(page, COMPTES[role]);
      await page.goto(chemin);

      await expect(page.getByRole("heading", { name: "Accès réservé" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Retour à mon espace" })).toHaveAttribute("href", ESPACES[role].accueil);
    });
  }
}

for (const role of Object.keys(COMPTES) as Role[]) {
  test(`${role.toLowerCase()} : accède à son profil`, async ({ page }) => {
    await page.route("**/api/v1/users/me", async (route) => {
      if (await handlePreflight(route)) return;
      return json(route, 200, COMPTES[role]);
    });
    await loginAs(page, COMPTES[role]);
    await page.goto("/espace/profil");

    await expect(page.getByLabel("Adresse e-mail *")).toHaveValue(COMPTES[role].email);
  });
}

test("après une déconnexion, le compte suivant ne voit pas le profil du précédent", async ({ page }) => {
  await mockLogin(page);
  // Le profil renvoyé est celui du dernier compte connecté (même JWT simulé pour tous)
  let courant = COMPTES.APPRENANT;
  await page.route("**/api/v1/users/me", async (route) => {
    if (await handlePreflight(route)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
    return json(route, 200, courant);
  });
  const ouvrirProfil = async () => {
    await page.getByRole("button", { name: "Menu du compte" }).click();
    await page.getByRole("menuitem", { name: "Mon profil" }).click();
  };

  await page.goto("/login");
  await seConnecter(page, COMPTES.APPRENANT.email);
  await ouvrirProfil();
  await expect(page.getByLabel("Adresse e-mail *")).toHaveValue(COMPTES.APPRENANT.email);

  await page.getByRole("button", { name: "Menu du compte" }).click();
  await page.getByRole("menuitem", { name: "Se déconnecter" }).click();
  courant = COMPTES.FORMATEUR;
  await seConnecter(page, COMPTES.FORMATEUR.email);
  await expect(page).toHaveURL(ESPACES.FORMATEUR.accueil);
  await ouvrirProfil();

  // Pas de profil en cache : chargement, puis les données du formateur
  await expect(page.getByLabel("Chargement du profil")).toBeVisible();
  await expect(page.getByLabel("Adresse e-mail *")).toHaveValue(COMPTES.FORMATEUR.email);
});
