import { expect, test, type Page } from "@playwright/test";
import { ACCESS_TOKEN, handlePreflight, json, loginAs, type UtilisateurDto } from "./support/session";

/*
 * User story : « En tant qu'administrateur, je veux lister/rechercher/filtrer les utilisateurs, afin de gérer la base. »
 * Critères : pagination + recherche + filtre par rôle. Tâches : table + pagination + filtres.
 *
 * L'API est simulée avec page.route : elle filtre et pagine comme le backend.
 */

// Expression régulière : dans un motif glob, « ? » désigne un caractère quelconque
const USERS_API = /\/api\/v1\/users\?/;
const PAGE_URL = "/espace/admin/utilisateurs";

const ADMIN: UtilisateurDto = {
  id_user: 1000,
  nom: "ADMIN",
  prenom: "Paul",
  email: "admin@digitheque.mg",
  telephone: null,
  role: "ADMINISTRATEUR",
  statut: "ACTIF",
  date_inscription: "2024-12-18T10:00:00Z",
};

const ROLES = ["APPRENANT", "FORMATEUR", "ADMINISTRATEUR"] as const;

/** 47 utilisateurs : 5 pages de 10. L'utilisateur n° 1 s'appelle « Utilisateur01 RAKOTO ». */
const UTILISATEURS: UtilisateurDto[] = Array.from({ length: 47 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  const role = ROLES[i % 3];
  return {
    id_user: i + 1,
    prenom: `Utilisateur${n}`,
    nom: i < 3 ? "RAKOTO" : "RABE",
    email: `utilisateur${n}@exemple.com`,
    telephone: null,
    role,
    statut: i === 4 ? "INACTIF" : "ACTIF",
    date_inscription: "2025-01-12T10:00:00Z",
  };
});

interface UsersRequest {
  params: Record<string, string>;
  authorization: string | undefined;
}

/**
 * Simule GET /users avec recherche, filtre de rôle et pagination ; renvoie les requêtes reçues.
 * `db` : base simulée, partagée avec mockModification pour que la liste reflète les modifications.
 */
async function mockUsers(page: Page, { status = 200, db = UTILISATEURS }: { status?: number; db?: UtilisateurDto[] } = {}) {
  const requests: UsersRequest[] = [];
  await page.route(USERS_API, async (route) => {
    if (await handlePreflight(route)) return;
    const url = new URL(route.request().url());
    const params = Object.fromEntries(url.searchParams);
    requests.push({ params, authorization: route.request().headers().authorization });
    if (status !== 200) return json(route, status, { detail: "Erreur" });

    const pageNum = Number(params.page);
    const size = Number(params.page_size);
    const search = (params.search ?? "").toLowerCase();
    const results = db.filter(
      (u) =>
        (!params.role || u.role === params.role) &&
        (!search || `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(search)),
    );
    return json(route, 200, {
      items: results.slice((pageNum - 1) * size, pageNum * size),
      total: results.length,
      page: pageNum,
      page_size: size,
    });
  });
  return requests;
}

/** Simule PATCH /users/{id} sur `db` ; renvoie les requêtes reçues (identifiant et corps). */
async function mockModification(page: Page, db: UtilisateurDto[], { status = 200 }: { status?: number } = {}) {
  const patches: { idUser: number; body: Partial<UtilisateurDto> }[] = [];
  await page.route(/\/api\/v1\/users\/\d+$/, async (route) => {
    if (await handlePreflight(route)) return;
    const idUser = Number(route.request().url().split("/").pop());
    const body = route.request().postDataJSON();
    patches.push({ idUser, body });
    if (status !== 200) return json(route, status, { detail: "Email already registered" });
    const index = db.findIndex((u) => u.id_user === idUser);
    db[index] = { ...db[index], ...body };
    return json(route, 200, db[index]);
  });
  return patches;
}

const rows = (page: Page) => page.getByRole("region", { name: "Liste des utilisateurs" }).locator("tbody tr");
const nextButton = (page: Page) => page.getByRole("button", { name: /^(Suivant|Page suivante)$/ });
const previousButton = (page: Page) => page.getByRole("button", { name: /^(Précédent|Page précédente)$/ });
const searchField = (page: Page) => page.getByRole("searchbox", { name: "Rechercher par nom ou e-mail" });
const roleFilter = (page: Page) => page.getByLabel("Filtrer par rôle");

test("sans session, la page redirige vers la connexion", async ({ page }) => {
  await page.goto(PAGE_URL);
  await expect(page).toHaveURL("/login");
});

test("un apprenant n'a pas accès à la gestion des utilisateurs", async ({ page }) => {
  const requests = await mockUsers(page);
  await loginAs(page, { ...ADMIN, role: "APPRENANT" });
  await page.goto(PAGE_URL);

  await expect(page.getByRole("heading", { name: "Accès réservé" })).toBeVisible();
  expect(requests).toHaveLength(0);
});

test.describe("Gestion des utilisateurs", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN);
  });

  test("affiche la première page du tableau", async ({ page }) => {
    const requests = await mockUsers(page);
    await page.goto(PAGE_URL);

    await expect(page.getByRole("heading", { name: "Gestion des utilisateurs" })).toBeVisible();
    await expect(rows(page)).toHaveCount(10);
    expect(requests[0]).toEqual({ params: { page: "1", page_size: "10" }, authorization: `Bearer ${ACCESS_TOKEN}` });

    const first = rows(page).first();
    await expect(first).toContainText("Utilisateur01 RAKOTO");
    await expect(first).toContainText("utilisateur01@exemple.com");
    await expect(first).toContainText("Apprenant");
    await expect(first).toContainText("Actif");
    await expect(first).toContainText("12/01/2025");
    await expect(rows(page).nth(4)).toContainText("Inactif");

    await expect(page.getByText("1–10 sur 47 utilisateurs")).toBeVisible();
    await expect(previousButton(page)).toBeDisabled();
  });

  test("navigue entre les pages", async ({ page }) => {
    const requests = await mockUsers(page);
    await page.goto(PAGE_URL);
    await expect(rows(page)).toHaveCount(10);

    await nextButton(page).click();
    await expect(page).toHaveURL(`${PAGE_URL}?page=2`);
    await expect(rows(page).first()).toContainText("Utilisateur11");
    expect(requests.at(-1)?.params).toEqual({ page: "2", page_size: "10" });

    await previousButton(page).click();
    await expect(page).toHaveURL(PAGE_URL);
    await expect(rows(page).first()).toContainText("Utilisateur01");
  });

  test("la dernière page est incomplète et « Suivant » y est désactivé", async ({ page }) => {
    await mockUsers(page);
    await page.goto(`${PAGE_URL}?page=5`);

    await expect(rows(page)).toHaveCount(7);
    await expect(page.getByText("41–47 sur 47 utilisateurs")).toBeVisible();
    await expect(nextButton(page)).toBeDisabled();
  });

  test("les numéros de page mènent directement à la page choisie", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "Sur mobile, seule la position « 1 / 5 » est affichée");
    await mockUsers(page);
    await page.goto(PAGE_URL);

    await page.getByRole("button", { name: "Page 3" }).click();

    await expect(page.getByRole("button", { name: "Page 3" })).toHaveAttribute("aria-current", "page");
    await expect(rows(page).first()).toContainText("Utilisateur21");
  });

  test("recherche par nom ou e-mail et revient à la première page", async ({ page }) => {
    const requests = await mockUsers(page);
    await page.goto(`${PAGE_URL}?page=2`);
    await expect(rows(page)).toHaveCount(10);

    await searchField(page).fill("rakoto");

    await expect(page).toHaveURL(`${PAGE_URL}?recherche=rakoto`);
    await expect(rows(page)).toHaveCount(3);
    await expect(page.getByText("1–3 sur 3 utilisateurs")).toBeVisible();
    // Une seule requête une fois la frappe terminée (pas une par lettre)
    expect(requests.filter((r) => r.params.search)).toEqual([
      { params: { page: "1", page_size: "10", search: "rakoto" }, authorization: `Bearer ${ACCESS_TOKEN}` },
    ]);
  });

  test("le lien « Utilisateurs » du menu efface la recherche, qui ne revient pas", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "Menu latéral affiché sur grand écran uniquement");
    await mockUsers(page);
    await page.goto(PAGE_URL);
    await searchField(page).fill("rakoto");
    await expect(page).toHaveURL(`${PAGE_URL}?recherche=rakoto`);

    await page.getByRole("navigation", { name: "Espace personnel" }).getByRole("link", { name: "Utilisateurs" }).click();

    await expect(page).toHaveURL(PAGE_URL);
    await expect(searchField(page)).toHaveValue("");
    // Après le délai de frappe, l'ancienne recherche ne doit pas être remise
    await page.waitForTimeout(600);
    await expect(page).toHaveURL(PAGE_URL);
    await expect(rows(page)).toHaveCount(10);
  });

  test("filtre par rôle", async ({ page }) => {
    const requests = await mockUsers(page);
    await page.goto(PAGE_URL);

    await roleFilter(page).selectOption({ label: "Formateur" });

    await expect(page).toHaveURL(`${PAGE_URL}?role=FORMATEUR`);
    await expect(page.getByText("1–10 sur 16 utilisateurs")).toBeVisible();
    expect(requests.at(-1)?.params).toEqual({ page: "1", page_size: "10", role: "FORMATEUR" });
    for (const row of await rows(page).all()) await expect(row).toContainText("Formateur");

    await roleFilter(page).selectOption({ label: "Tous les rôles" });
    await expect(page.getByText("1–10 sur 47 utilisateurs")).toBeVisible();
  });

  test("combine recherche, filtre et pagination restaurés depuis l'URL", async ({ page }) => {
    const requests = await mockUsers(page);
    await page.goto(`${PAGE_URL}?recherche=utilisateur&role=APPRENANT&page=2`);

    await expect(searchField(page)).toHaveValue("utilisateur");
    await expect(roleFilter(page)).toHaveValue("APPRENANT");
    await expect(page.getByText("11–16 sur 16 utilisateurs")).toBeVisible();
    expect(requests[0].params).toEqual({ page: "2", page_size: "10", search: "utilisateur", role: "APPRENANT" });
  });

  test("change le nombre d'utilisateurs par page", async ({ page }) => {
    const requests = await mockUsers(page);
    await page.goto(`${PAGE_URL}?page=3`);
    await expect(rows(page)).toHaveCount(10);

    await page.getByLabel("Afficher").selectOption("20");

    await expect(page).toHaveURL(`${PAGE_URL}?taille=20`);
    await expect(rows(page)).toHaveCount(20);
    expect(requests.at(-1)?.params).toEqual({ page: "1", page_size: "20" });
  });

  test("indique qu'aucun utilisateur ne correspond", async ({ page }) => {
    await mockUsers(page);
    await page.goto(PAGE_URL);

    await searchField(page).fill("introuvable");

    await expect(page.getByText("Aucun utilisateur ne correspond à votre recherche.")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Pagination" })).toHaveCount(0);
  });

  test("affiche un message si le serveur est en panne", async ({ page }) => {
    await mockUsers(page, { status: 500 });
    await page.goto(PAGE_URL);

    await expect(page.getByText("Le serveur rencontre un problème. Réessayez plus tard.")).toBeVisible();
  });

  test("le menu latéral de l'administrateur signale la page courante", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "Menu latéral masqué sur mobile");
    await mockUsers(page);
    await page.goto(PAGE_URL);

    const nav = page.getByRole("navigation", { name: "Espace personnel" });
    await expect(nav.getByRole("link", { name: "Utilisateurs" })).toHaveAttribute("aria-current", "page");
    // Rubrique pas encore développée : affichée sans lien
    await expect(nav.getByText("Rapports")).toBeVisible();
    await expect(nav.getByRole("link", { name: /Rapports/ })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Mes cours" })).toHaveCount(0);
  });
});

test.describe("Actions sur un utilisateur", () => {
  /** Copie de la base pour chaque test : les modifications ne fuient pas d'un test à l'autre. */
  let db: UtilisateurDto[];

  test.beforeEach(async ({ page }) => {
    db = structuredClone(UTILISATEURS);
    await loginAs(page, ADMIN);
    await mockUsers(page, { db });
  });

  /** Boutons d'action affichés sur la ligne d'un utilisateur. */
  const actions = (page: Page, nom: string) => page.getByRole("group", { name: `Actions pour ${nom}` });

  test("chaque ligne affiche directement son action : Modifier", async ({ page }) => {
    await page.goto(PAGE_URL);

    await expect(actions(page, "Utilisateur01 RAKOTO").getByRole("button")).toHaveText(["Modifier"]);
  });

  test("modifie un utilisateur depuis le formulaire prérempli", async ({ page }) => {
    const patches = await mockModification(page, db);
    await page.goto(PAGE_URL);

    await actions(page, "Utilisateur01 RAKOTO").getByRole("button", { name: "Modifier" }).click();
    const dialog = page.getByRole("dialog", { name: "Modifier l'utilisateur" });
    await expect(dialog.getByLabel("Prénom *")).toHaveValue("Utilisateur01");
    await expect(dialog.getByLabel("Adresse e-mail *")).toHaveValue("utilisateur01@exemple.com");
    await expect(dialog.getByLabel("Rôle")).toHaveValue("APPRENANT");

    await dialog.getByLabel("Prénom *").fill("jean");
    await dialog.getByLabel("Rôle").selectOption("FORMATEUR");
    await dialog.getByRole("button", { name: "Enregistrer" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: "Les informations de Jean RAKOTO ont été mises à jour." })).toBeVisible();
    expect(patches).toEqual([
      {
        idUser: 1,
        body: { prenom: "Jean", nom: "RAKOTO", email: "utilisateur01@exemple.com", telephone: null, role: "FORMATEUR" },
      },
    ]);
    // La liste est rechargée avec les nouvelles valeurs
    await expect(rows(page).first()).toContainText("Jean RAKOTO");
    await expect(rows(page).first()).toContainText("Formateur");
  });

  test("valide le formulaire avant d'appeler l'API, et Annuler ferme sans rien envoyer", async ({ page }) => {
    const patches = await mockModification(page, db);
    await page.goto(PAGE_URL);

    await actions(page, "Utilisateur01 RAKOTO").getByRole("button", { name: "Modifier" }).click();
    const dialog = page.getByRole("dialog", { name: "Modifier l'utilisateur" });
    await dialog.getByLabel("Adresse e-mail *").fill("");
    await dialog.getByLabel("Téléphone").fill("12");
    await dialog.getByRole("button", { name: "Enregistrer" }).click();

    await expect(dialog.getByText("L'adresse e-mail est requise.")).toBeVisible();
    await expect(dialog.getByText("Numéro de téléphone invalide : 10 chiffres, au format 030 00 000 00.")).toBeVisible();

    await dialog.getByRole("button", { name: "Annuler" }).click();
    await expect(dialog).toBeHidden();
    expect(patches).toHaveLength(0);
  });

  test("signale une adresse e-mail déjà utilisée", async ({ page }) => {
    await mockModification(page, db, { status: 409 });
    await page.goto(PAGE_URL);

    await actions(page, "Utilisateur01 RAKOTO").getByRole("button", { name: "Modifier" }).click();
    const dialog = page.getByRole("dialog", { name: "Modifier l'utilisateur" });
    // Prénom de test avec chiffres : remplacé pour passer la validation
    await dialog.getByLabel("Prénom *").fill("Jean");
    await dialog.getByLabel("Adresse e-mail *").fill("utilisateur02@exemple.com");
    await dialog.getByRole("button", { name: "Enregistrer" }).click();

    await expect(dialog.getByText("Cette adresse e-mail est déjà utilisée par un autre compte.")).toBeVisible();
    await expect(dialog.getByLabel("Adresse e-mail *")).toHaveAttribute("aria-invalid", "true");
  });

  test("l'administrateur ne peut pas changer son propre rôle", async ({ page }) => {
    db.unshift(ADMIN);
    await page.goto(PAGE_URL);

    const ligne = actions(page, "Paul ADMIN");

    await ligne.getByRole("button", { name: "Modifier" }).click();
    await expect(page.getByRole("dialog").getByLabel("Rôle")).toBeDisabled();
    await expect(page.getByText("Vous ne pouvez pas modifier votre propre rôle.")).toBeVisible();
  });
});
