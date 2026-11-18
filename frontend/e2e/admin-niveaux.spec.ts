import { expect, test, type Page } from "@playwright/test";
import { handlePreflight, json, loginAs, type UtilisateurDto } from "./support/session";

/*
 * Gestion des niveaux d'apprentissage (table Niveau : code et libellé, communs à toutes les langues).
 * L'API est simulée avec page.route sur une base propre à chaque test.
 */

const PAGE_URL = "/espace/admin/niveaux";

const ADMIN: UtilisateurDto = {
  id_user: 1000,
  nom: "RASOA",
  prenom: "Fanja",
  email: "admin@digitheque.mg",
  telephone: null,
  role: "ADMINISTRATEUR",
  statut: "ACTIF",
  date_inscription: "2024-12-18T10:00:00Z",
};

interface NiveauDto {
  id_niveau: number;
  code: string;
  libelle: string;
}

/** Volontairement dans le désordre : la page les trie par code. */
const NIVEAUX: NiveauDto[] = [
  { id_niveau: 1, code: "B1", libelle: "Intermédiaire" },
  { id_niveau: 2, code: "HSK 10", libelle: "Mandarin – expert" },
  { id_niveau: 3, code: "A1", libelle: "Débutant" },
  { id_niveau: 4, code: "HSK 2", libelle: "Mandarin – élémentaire" },
];

/** Niveaux utilisés par des tests ou des parcours : le serveur refuse leur suppression. */
const UTILISES = new Set([3]);

interface Requete {
  method: string;
  id?: number;
  body?: unknown;
}

/** Simule l'API des niveaux sur une copie de NIVEAUX ; renvoie les écritures reçues (POST, PATCH, DELETE). */
async function mockNiveaux(page: Page, { conflitCode = false }: { conflitCode?: boolean } = {}) {
  const db = structuredClone(NIVEAUX);
  const ecritures: Requete[] = [];

  await page.route(/\/api\/v1\/niveaux$/, async (route) => {
    if (await handlePreflight(route)) return;
    const request = route.request();
    if (request.method() === "POST") {
      const body = request.postDataJSON();
      ecritures.push({ method: "POST", body });
      if (conflitCode) return json(route, 409, { detail: "Level code already exists" });
      const niveau = { id_niveau: 100 + db.length, ...body };
      db.push(niveau);
      return json(route, 201, niveau);
    }
    return json(route, 200, db);
  });

  await page.route(/\/api\/v1\/niveaux\/\d+$/, async (route) => {
    if (await handlePreflight(route)) return;
    const request = route.request();
    const id = Number(request.url().split("/").pop());
    const index = db.findIndex((n) => n.id_niveau === id);
    if (request.method() === "DELETE") {
      ecritures.push({ method: "DELETE", id });
      if (UTILISES.has(id)) return json(route, 409, { detail: "Level in use" });
      db.splice(index, 1);
      return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
    }
    const body = request.postDataJSON();
    ecritures.push({ method: "PATCH", id, body });
    db[index] = { id_niveau: id, ...body };
    return json(route, 200, db[index]);
  });

  return ecritures;
}

const rows = (page: Page) => page.getByRole("region", { name: "Liste des niveaux" }).locator("tbody tr");
const panel = (page: Page, titre: string) => page.getByRole("dialog", { name: titre });

async function action(page: Page, code: string, nom: string) {
  await page.getByRole("group", { name: `Actions pour ${code}` }).getByRole("button", { name: nom }).click();
}

test("un apprenant n'a pas accès à la gestion des niveaux", async ({ page }) => {
  await loginAs(page, { ...ADMIN, role: "APPRENANT" });
  await page.goto(PAGE_URL);
  await expect(page.getByRole("heading", { name: "Accès réservé" })).toBeVisible();
});

test.describe("Gestion des niveaux", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN);
  });

  test("liste les niveaux triés par code (nombres dans l'ordre naturel)", async ({ page }) => {
    await mockNiveaux(page);
    await page.goto(PAGE_URL);

    await expect(page.getByRole("heading", { name: "Gestion des langues et niveaux" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Niveaux", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(rows(page).locator("td:first-child")).toHaveText(["A1", "B1", "HSK 2", "HSK 10"]);
    await expect(rows(page).first()).toContainText("Débutant");
  });

  test("langues et niveaux sont deux onglets d'une même page", async ({ page }) => {
    await mockNiveaux(page);
    await page.route(/\/api\/v1\/langues\?/, async (route) => {
      if (await handlePreflight(route)) return;
      return json(route, 200, { items: [], total: 0, page: 1, page_size: 10 });
    });
    await page.goto("/espace/admin/langues");
    const onglets = page.getByRole("navigation", { name: "Langues et niveaux" });
    await expect(onglets.getByRole("link", { name: "Langues", exact: true })).toHaveAttribute("aria-current", "page");

    await onglets.getByRole("link", { name: "Niveaux", exact: true }).click();

    await expect(page).toHaveURL(PAGE_URL);
    await expect(onglets.getByRole("link", { name: "Niveaux", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(rows(page)).toHaveCount(4);
  });

  test("une seule entrée du menu latéral mène aux langues et niveaux", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "Menu latéral affiché sur grand écran uniquement");
    await mockNiveaux(page);
    await page.goto(PAGE_URL);

    const menu = page.getByRole("navigation", { name: "Espace personnel" });
    await expect(menu.getByRole("link", { name: "Niveaux", exact: true })).toHaveCount(0);
    // L'entrée reste mise en évidence sur l'onglet Niveaux
    await expect(menu.getByRole("link", { name: "Langues et niveaux" })).toHaveAttribute("aria-current", "page");
    await expect(menu.getByRole("link", { name: "Langues et niveaux" })).toHaveAttribute("href", "/espace/admin/langues");
  });

  test("ajoute un niveau (code mis en forme)", async ({ page }) => {
    const ecritures = await mockNiveaux(page);
    await page.goto(PAGE_URL);

    await page.getByRole("button", { name: "Ajouter un niveau" }).click();
    const formulaire = panel(page, "Ajouter un niveau");
    await formulaire.getByLabel("Code *").fill("hsk   3");
    await expect(formulaire.getByLabel("Code *")).toHaveValue("HSK 3");
    await formulaire.getByLabel("Libellé *").fill("Mandarin – intermédiaire");
    await formulaire.getByRole("button", { name: "Enregistrer" }).click();

    await expect(formulaire).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: "Le niveau « HSK 3 » a été ajouté." })).toBeVisible();
    expect(ecritures).toEqual([{ method: "POST", body: { code: "HSK 3", libelle: "Mandarin – intermédiaire" } }]);
    await expect(rows(page).locator("td:first-child")).toHaveText(["A1", "B1", "HSK 2", "HSK 3", "HSK 10"]);
  });

  test("valide le formulaire avant d'appeler l'API", async ({ page }) => {
    const ecritures = await mockNiveaux(page);
    await page.goto(PAGE_URL);

    await page.getByRole("button", { name: "Ajouter un niveau" }).click();
    const formulaire = panel(page, "Ajouter un niveau");
    await formulaire.getByRole("button", { name: "Enregistrer" }).click();

    await expect(formulaire.getByText("Le code est requis.")).toBeVisible();
    await expect(formulaire.getByText("Le libellé est requis.")).toBeVisible();
    expect(ecritures).toHaveLength(0);
  });

  test("signale un code déjà utilisé", async ({ page }) => {
    await mockNiveaux(page, { conflitCode: true });
    await page.goto(PAGE_URL);

    await page.getByRole("button", { name: "Ajouter un niveau" }).click();
    const formulaire = panel(page, "Ajouter un niveau");
    await formulaire.getByLabel("Code *").fill("A1");
    await formulaire.getByLabel("Libellé *").fill("Doublon");
    await formulaire.getByRole("button", { name: "Enregistrer" }).click();

    await expect(formulaire.getByText("Ce code est déjà utilisé par un autre niveau.")).toBeVisible();
    await expect(formulaire.getByLabel("Code *")).toHaveAttribute("aria-invalid", "true");
  });

  test("modifie un niveau depuis le panneau prérempli", async ({ page }) => {
    const ecritures = await mockNiveaux(page);
    await page.goto(PAGE_URL);

    await action(page, "B1", "Modifier");
    const formulaire = panel(page, "Modifier le niveau");
    await expect(formulaire.getByLabel("Code *")).toHaveValue("B1");
    await expect(formulaire.getByLabel("Libellé *")).toHaveValue("Intermédiaire");

    await formulaire.getByLabel("Libellé *").fill("Seuil");
    await formulaire.getByRole("button", { name: "Enregistrer" }).click();

    await expect(page.getByRole("status").filter({ hasText: "Le niveau « B1 » a été mis à jour." })).toBeVisible();
    expect(ecritures).toEqual([{ method: "PATCH", id: 1, body: { code: "B1", libelle: "Seuil" } }]);
    await expect(rows(page).nth(1)).toContainText("Seuil");
  });

  test("supprime un niveau inutilisé, et explique le refus pour un niveau utilisé", async ({ page }) => {
    const ecritures = await mockNiveaux(page);
    await page.goto(PAGE_URL);

    await action(page, "B1", "Supprimer");
    await page.getByRole("dialog", { name: "Supprimer le niveau ?" }).getByRole("button", { name: "Supprimer" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Le niveau « B1 » a été supprimé." })).toBeVisible();
    await expect(rows(page)).toHaveCount(3);

    await action(page, "A1", "Supprimer");
    const confirmation = page.getByRole("dialog", { name: "Supprimer le niveau ?" });
    await confirmation.getByRole("button", { name: "Supprimer" }).click();
    await expect(confirmation.getByText(/utilisé par des tests, des parcours ou des exercices/)).toBeVisible();
    expect(ecritures.map((e) => e.method)).toEqual(["DELETE", "DELETE"]);
  });
});
