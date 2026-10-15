import { expect, test, type Page } from "@playwright/test";
import { handlePreflight, json, loginAs, type UtilisateurDto } from "./support/session";

/*
 * User story : « En tant qu'administrateur, je veux gérer les langues, afin de maintenir le catalogue. »
 * Critère : interface CRUD. Tâche : page Admin Langues (table Langue : code et libellé), et niveaux ouverts
 * pour chaque langue (association Langue — Niveau, table LangueNiveau).
 *
 * L'API est simulée avec page.route sur une base propre à chaque test (ajouts, modifications et
 * suppressions sont reflétés dans la liste).
 */

const PAGE_URL = "/espace/admin/langues";

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

interface LangueDto {
  id_langue: number;
  code: string;
  libelle: string;
}

/** Ligne de la base simulée : la langue et les identifiants de ses niveaux (LangueNiveau). */
type LigneLangue = LangueDto & { id_niveaux: number[] };

const NIVEAUX = [
  { id_niveau: 1, code: "A1", libelle: "Débutant" },
  { id_niveau: 2, code: "A2", libelle: "Élémentaire" },
  { id_niveau: 3, code: "B1", libelle: "Intermédiaire" },
  { id_niveau: 4, code: "B2", libelle: "Intermédiaire avancé" },
  { id_niveau: 5, code: "C1", libelle: "Avancé" },
  { id_niveau: 6, code: "C2", libelle: "Maîtrise" },
  { id_niveau: 7, code: "HSK 1", libelle: "Mandarin – débutant" },
  { id_niveau: 8, code: "HSK 2", libelle: "Mandarin – élémentaire" },
];

/** Niveaux ouverts par langue : HSK pour le mandarin, A1–B2 pour l'allemand, aucun pour les autres. */
const NIVEAUX_INITIAUX: Record<string, number[]> = {
  fr: [1, 2, 3, 4, 5, 6],
  en: [1, 2, 3, 4, 5, 6],
  zh: [7, 8],
  de: [1, 2, 3, 4],
};

/** Réponse de l'API : la langue avec ses niveaux. */
const enReponse = ({ id_niveaux, ...langue }: LigneLangue) => ({
  ...langue,
  niveaux: NIVEAUX.filter((n) => id_niveaux.includes(n.id_niveau)),
});

/** 12 langues : 2 pages de 10. */
const LANGUES: LangueDto[] = [
  ["fr", "Français"],
  ["en", "Anglais"],
  ["zh", "Mandarin"],
  ["it", "Italien"],
  ["de", "Allemand"],
  ["es", "Espagnol"],
  ["pt", "Portugais"],
  ["ja", "Japonais"],
  ["ko", "Coréen"],
  ["ar", "Arabe"],
  ["ru", "Russe"],
  ["mg", "Malgache"],
].map(([code, libelle], i) => ({ id_langue: i + 1, code, libelle }));


/** Langues utilisées par des formules : le serveur refuse leur suppression. */
const UTILISEES = new Set(["fr", "en"]);

interface Requete {
  method: string;
  id?: number;
  body?: unknown;
}

/** Simule l'API des langues sur une copie de LANGUES ; renvoie les écritures reçues (POST, PATCH, DELETE). */
async function mockLangues(page: Page, { conflitCode = false }: { conflitCode?: boolean } = {}) {
  const db: LigneLangue[] = LANGUES.map((l) => ({ ...l, id_niveaux: NIVEAUX_INITIAUX[l.code] ?? [] }));
  const ecritures: Requete[] = [];

  await page.route(/\/api\/v1\/niveaux$/, async (route) => {
    if (await handlePreflight(route)) return;
    return json(route, 200, NIVEAUX);
  });

  await page.route(/\/api\/v1\/langues(\?.*)?$/, async (route) => {
    if (await handlePreflight(route)) return;
    const request = route.request();
    if (request.method() === "POST") {
      const body = request.postDataJSON();
      ecritures.push({ method: "POST", body });
      if (conflitCode) return json(route, 409, { detail: "Language code already exists" });
      const langue: LigneLangue = { id_langue: 100 + db.length, ...body };
      db.push(langue);
      return json(route, 201, enReponse(langue));
    }
    const params = Object.fromEntries(new URL(request.url()).searchParams);
    const [pageNum, size] = [Number(params.page), Number(params.page_size)];
    const search = (params.search ?? "").toLowerCase();
    const resultats = db.filter((l) => !search || l.libelle.toLowerCase().includes(search));
    const items = resultats.slice((pageNum - 1) * size, pageNum * size).map(enReponse);
    return json(route, 200, { items, total: resultats.length, page: pageNum, page_size: size });
  });

  await page.route(/\/api\/v1\/langues\/\d+$/, async (route) => {
    if (await handlePreflight(route)) return;
    const request = route.request();
    const id = Number(request.url().split("/").pop());
    const index = db.findIndex((l) => l.id_langue === id);
    if (request.method() === "DELETE") {
      ecritures.push({ method: "DELETE", id });
      if (UTILISEES.has(db[index].code)) return json(route, 409, { detail: "Language in use" });
      db.splice(index, 1);
      return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
    }
    const body = request.postDataJSON();
    ecritures.push({ method: "PATCH", id, body });
    db[index] = { ...db[index], ...body };
    return json(route, 200, enReponse(db[index]));
  });

  return ecritures;
}

const rows = (page: Page) => page.getByRole("region", { name: "Liste des langues" }).locator("tbody tr");
const row = (page: Page, libelle: string) => rows(page).filter({ hasText: libelle });
const panel = (page: Page, titre: string) => page.getByRole("dialog", { name: titre });
const niveauxDe = (page: Page, libelle: string) => page.getByRole("list", { name: `Niveaux de ${libelle}` }).getByRole("listitem");
const caseNiveau = (formulaire: ReturnType<typeof panel>, code: string) => formulaire.getByRole("checkbox", { name: new RegExp(`^${code} – `) });

async function action(page: Page, libelle: string, nom: string) {
  await page.getByRole("group", { name: `Actions pour ${libelle}` }).getByRole("button", { name: nom }).click();
}

test("un formateur n'a pas accès à la gestion des langues", async ({ page }) => {
  await loginAs(page, { ...ADMIN, role: "FORMATEUR" });
  await page.goto(PAGE_URL);
  await expect(page.getByRole("heading", { name: "Accès réservé" })).toBeVisible();
});

test.describe("Gestion des langues", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN);
  });

  test("liste les langues (désignation et code), sur plusieurs pages", async ({ page }) => {
    await mockLangues(page);
    await page.goto(PAGE_URL);

    await expect(page.getByRole("heading", { name: "Gestion des langues" })).toBeVisible();
    await expect(rows(page)).toHaveCount(10);
    await expect(page.getByText("1–10 sur 12 langues")).toBeVisible();
    await expect(row(page, "Français")).toContainText("FR");
    // Niveaux ouverts propres à chaque langue (LangueNiveau) ; pas de statut : il n'existe pas dans la table Langue
    await expect(page.getByRole("columnheader")).toHaveText(["Langue", "Code", "Niveaux", "Actions"]);
    await expect(niveauxDe(page, "Mandarin")).toHaveText(["HSK 1", "HSK 2"]);
    await expect(niveauxDe(page, "Allemand")).toHaveText(["A1", "A2", "B1", "B2"]);
    await expect(row(page, "Espagnol")).toContainText("Aucun niveau");
    await expect(page.getByLabel("Filtrer par statut")).toHaveCount(0);

    await page.getByRole("button", { name: /^(Suivant|Page suivante)$/ }).click();
    await expect(rows(page)).toHaveCount(2);
  });

  test("chaque langue affiche directement ses actions : Modifier et Supprimer", async ({ page }) => {
    await mockLangues(page);
    await page.goto(PAGE_URL);

    await expect(page.getByRole("group", { name: "Actions pour Italien" }).getByRole("button")).toHaveText(["Modifier", "Supprimer"]);
  });

  test("recherche une langue", async ({ page }) => {
    await mockLangues(page);
    await page.goto(PAGE_URL);

    await page.getByRole("searchbox", { name: "Rechercher une langue" }).fill("man");
    await expect(page).toHaveURL(`${PAGE_URL}?recherche=man`);
    await expect(rows(page)).toHaveCount(2); // Mandarin, Allemand
  });

  test("ajoute une langue", async ({ page }) => {
    const ecritures = await mockLangues(page);
    await page.goto(PAGE_URL);

    await page.getByRole("button", { name: "Ajouter une langue" }).click();
    const formulaire = panel(page, "Ajouter une langue");
    await formulaire.getByLabel("Désignation *").fill("Swahili");
    await formulaire.getByLabel("Code *").fill("sw");
    await expect(formulaire.getByLabel("Code *")).toHaveValue("SW");
    // Une nouvelle langue n'ouvre d'abord que les niveaux choisis
    await caseNiveau(formulaire, "A1").check();
    await caseNiveau(formulaire, "A2").check();
    await formulaire.getByRole("button", { name: "Enregistrer" }).click();

    await expect(formulaire).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: "La langue « Swahili » a été ajoutée." })).toBeVisible();
    // Code enregistré en minuscules (ISO 639), niveaux envoyés par identifiant
    expect(ecritures).toEqual([{ method: "POST", body: { libelle: "Swahili", code: "sw", id_niveaux: [1, 2] } }]);
    await expect(page.getByText("1–10 sur 13 langues")).toBeVisible();
  });

  test("valide le formulaire avant d'appeler l'API", async ({ page }) => {
    const ecritures = await mockLangues(page);
    await page.goto(PAGE_URL);

    await page.getByRole("button", { name: "Ajouter une langue" }).click();
    const formulaire = panel(page, "Ajouter une langue");
    await formulaire.getByRole("button", { name: "Enregistrer" }).click();

    await expect(formulaire.getByText("La désignation est requise.")).toBeVisible();
    await expect(formulaire.getByText("Le code est requis.")).toBeVisible();
    await expect(formulaire.getByText("Choisissez au moins un niveau ouvert pour cette langue.")).toBeVisible();
    await expect(formulaire.getByLabel("Désignation *")).toBeFocused();
    expect(ecritures).toHaveLength(0);
  });

  test("signale un code déjà utilisé", async ({ page }) => {
    await mockLangues(page, { conflitCode: true });
    await page.goto(PAGE_URL);

    await page.getByRole("button", { name: "Ajouter une langue" }).click();
    const formulaire = panel(page, "Ajouter une langue");
    await formulaire.getByLabel("Désignation *").fill("Frison");
    await formulaire.getByLabel("Code *").fill("FR");
    await caseNiveau(formulaire, "A1").check();
    await formulaire.getByRole("button", { name: "Enregistrer" }).click();

    await expect(formulaire.getByText("Ce code est déjà utilisé par une autre langue.")).toBeVisible();
    await expect(formulaire.getByLabel("Code *")).toHaveAttribute("aria-invalid", "true");
  });

  test("modifie une langue depuis le panneau prérempli", async ({ page }) => {
    const ecritures = await mockLangues(page);
    await page.goto(PAGE_URL);

    await action(page, "Mandarin", "Modifier");
    const formulaire = panel(page, "Modifier la langue");
    await expect(formulaire.getByLabel("Désignation *")).toHaveValue("Mandarin");
    await expect(formulaire.getByLabel("Code *")).toHaveValue("ZH");
    await expect(caseNiveau(formulaire, "HSK 1")).toBeChecked();
    await expect(caseNiveau(formulaire, "A1")).not.toBeChecked();

    await formulaire.getByLabel("Désignation *").fill("Chinois mandarin");
    await formulaire.getByRole("button", { name: "Enregistrer" }).click();

    await expect(page.getByRole("status").filter({ hasText: "La langue « Chinois mandarin » a été mise à jour." })).toBeVisible();
    expect(ecritures).toEqual([{ method: "PATCH", id: 3, body: { libelle: "Chinois mandarin", code: "zh", id_niveaux: [7, 8] } }]);
    await expect(row(page, "Chinois mandarin")).toHaveCount(1);
  });

  test("ouvre et ferme des niveaux pour une langue", async ({ page }) => {
    const ecritures = await mockLangues(page);
    await page.goto(PAGE_URL);

    await action(page, "Allemand", "Modifier");
    const formulaire = panel(page, "Modifier la langue");
    await caseNiveau(formulaire, "C1").check();
    await caseNiveau(formulaire, "A1").uncheck();
    await formulaire.getByRole("button", { name: "Enregistrer" }).click();

    await expect(page.getByRole("status").filter({ hasText: "La langue « Allemand » a été mise à jour." })).toBeVisible();
    expect(ecritures.at(-1)).toMatchObject({ method: "PATCH", id: 5, body: { id_niveaux: [2, 3, 4, 5] } });
    await expect(niveauxDe(page, "Allemand")).toHaveText(["A2", "B1", "B2", "C1"]);
  });

  test("« Tout cocher » ouvre tous les niveaux, « Tout décocher » les ferme", async ({ page }) => {
    await mockLangues(page);
    await page.goto(PAGE_URL);

    await action(page, "Espagnol", "Modifier");
    const formulaire = panel(page, "Modifier la langue");
    await formulaire.getByRole("button", { name: "Tout cocher" }).click();
    await expect(formulaire.getByRole("checkbox", { checked: true })).toHaveCount(NIVEAUX.length);

    await formulaire.getByRole("button", { name: "Tout décocher" }).click();
    await expect(formulaire.getByRole("checkbox", { checked: true })).toHaveCount(0);
  });

  test("supprime une langue inutilisée, et explique le refus pour une langue utilisée", async ({ page }) => {
    const ecritures = await mockLangues(page);
    await page.goto(PAGE_URL);

    await action(page, "Italien", "Supprimer");
    await page.getByRole("dialog", { name: "Supprimer la langue ?" }).getByRole("button", { name: "Supprimer" }).click();
    await expect(page.getByRole("status").filter({ hasText: "La langue « Italien » a été supprimée." })).toBeVisible();
    await expect(row(page, "Italien")).toHaveCount(0);

    await action(page, "Français", "Supprimer");
    const confirmation = page.getByRole("dialog", { name: "Supprimer la langue ?" });
    await confirmation.getByRole("button", { name: "Supprimer" }).click();
    await expect(confirmation.getByText(/utilisée par des formules ou des parcours/)).toBeVisible();
    await expect(row(page, "Français")).toHaveCount(1);
    expect(ecritures.map((e) => e.method)).toEqual(["DELETE", "DELETE"]);
  });

  test("Échap ferme le panneau sans rien enregistrer", async ({ page }) => {
    const ecritures = await mockLangues(page);
    await page.goto(PAGE_URL);

    await action(page, "Français", "Modifier");
    await panel(page, "Modifier la langue").getByLabel("Désignation *").fill("Autre");
    await page.keyboard.press("Escape");

    await expect(panel(page, "Modifier la langue")).toBeHidden();
    expect(ecritures).toHaveLength(0);
  });
});
