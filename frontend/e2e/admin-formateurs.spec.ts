import { expect, test, type Page } from "@playwright/test";
import { handlePreflight, json, loginAs, type UtilisateurDto } from "./support/session";

/*
 * User story : « En tant qu'administrateur, je veux gérer les formateurs, afin de superviser. »
 * Critère : interface CRUD. Tâche : page Admin Formateurs (Utilisateur de rôle FORMATEUR + table Formateur :
 * type de contrat, certifications, langues enseignées). Pas de suppression : désactivation / réactivation.
 *
 * L'API est simulée avec page.route sur une base propre à chaque test (ajouts et modifications sont
 * reflétés dans la liste).
 */

const PAGE_URL = "/espace/admin/formateurs";

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

const LANGUES = [
  { id_langue: 1, code: "fr", libelle: "Français" },
  { id_langue: 2, code: "en", libelle: "Anglais" },
  { id_langue: 3, code: "zh", libelle: "Mandarin" },
  { id_langue: 4, code: "de", libelle: "Allemand" },
];

/** Ligne de la base simulée : le formateur et les identifiants de ses langues (FormateurLangue). */
interface LigneFormateur extends UtilisateurDto {
  type_contrat: string | null;
  certifications: string | null;
  id_langues: number[];
}

const enReponse = ({ id_langues, ...f }: LigneFormateur) => ({
  ...f,
  langues_enseignees: LANGUES.filter((l) => id_langues.includes(l.id_langue)),
});

/** 12 formateurs : 2 pages de 10. */
const FORMATEURS: LigneFormateur[] = [
  ["Hery", "RANDRIA", "CDI", [1, 2]],
  ["Lova", "RABE", "CDD", [3]],
  ["Mialy", "RAKOTO", "VACATAIRE", [2]],
  ["Tiana", "ANDRIAMANANA", "CDI", [1, 4]],
  ["Fanja", "RAZAFY", "PRESTATAIRE", [4]],
  ["Nirina", "RASOA", "CDD", [2]],
  ["Haja", "RAMANANTSOA", "VACATAIRE", [1]],
  ["Voahirana", "RAHARISON", "CDI", [3]],
  ["Andry", "RAJAONA", null, [1]],
  ["Sitraka", "RANAIVO", "CDD", [3]],
  ["Zo", "RAKOTOBE", "VACATAIRE", [2]],
  ["Fara", "RASOLO", "CDI", [1]],
].map(([prenom, nom, type_contrat, id_langues], i) => ({
  id_user: i + 1,
  prenom: prenom as string,
  nom: nom as string,
  email: `${(prenom as string).toLowerCase()}@digitheque.mg`,
  telephone: null,
  role: "FORMATEUR",
  statut: i === 4 ? "INACTIF" : "ACTIF",
  date_inscription: "2025-01-12T10:00:00Z",
  type_contrat: type_contrat as string | null,
  certifications: null,
  id_langues: id_langues as number[],
}));

interface Requete {
  method: string;
  id?: number;
  body?: unknown;
}

/** Simule l'API des formateurs (et la liste des langues) ; renvoie les écritures reçues (POST, PATCH). */
async function mockFormateurs(page: Page, { emailPris = false }: { emailPris?: boolean } = {}) {
  const db: LigneFormateur[] = FORMATEURS.map((f) => ({ ...f, id_langues: [...f.id_langues] }));
  const ecritures: Requete[] = [];

  await page.route(/\/api\/v1\/langues(\?.*)?$/, async (route) => {
    if (await handlePreflight(route)) return;
    return json(route, 200, { items: LANGUES.map((l) => ({ ...l, niveaux: [] })), total: LANGUES.length, page: 1, page_size: 50 });
  });

  await page.route(/\/api\/v1\/formateurs(\?.*)?$/, async (route) => {
    if (await handlePreflight(route)) return;
    const request = route.request();
    if (request.method() === "POST") {
      const body = request.postDataJSON();
      ecritures.push({ method: "POST", body });
      if (emailPris) return json(route, 409, { detail: "Email already registered" });
      const formateur: LigneFormateur = {
        ...body,
        id_user: 500 + db.length,
        role: "FORMATEUR",
        statut: "ACTIF",
        date_inscription: "2026-10-15T10:00:00Z",
      };
      db.push(formateur);
      return json(route, 201, enReponse(formateur));
    }
    const params = Object.fromEntries(new URL(request.url()).searchParams);
    const [pageNum, size] = [Number(params.page), Number(params.page_size)];
    const search = (params.search ?? "").toLowerCase();
    const resultats = db.filter(
      (f) => (!params.statut || f.statut === params.statut) && (!search || `${f.prenom} ${f.nom} ${f.email}`.toLowerCase().includes(search)),
    );
    const items = resultats.slice((pageNum - 1) * size, pageNum * size).map(enReponse);
    return json(route, 200, { items, total: resultats.length, page: pageNum, page_size: size });
  });

  await page.route(/\/api\/v1\/formateurs\/\d+$/, async (route) => {
    if (await handlePreflight(route)) return;
    const request = route.request();
    const id = Number(request.url().split("/").pop());
    const index = db.findIndex((f) => f.id_user === id);
    const body = request.postDataJSON();
    ecritures.push({ method: "PATCH", id, body });
    db[index] = { ...db[index], ...body };
    return json(route, 200, enReponse(db[index]));
  });

  return ecritures;
}

const rows = (page: Page) => page.getByRole("region", { name: "Liste des formateurs" }).locator("tbody tr");
const row = (page: Page, nom: string) => rows(page).filter({ hasText: nom });
const panel = (page: Page, titre: string) => page.getByRole("dialog", { name: titre });
const languesDe = (page: Page, nom: string) => page.getByRole("list", { name: `Langues enseignées par ${nom}` }).getByRole("listitem");

async function action(page: Page, nom: string, libelle: string) {
  await page.getByRole("group", { name: `Actions pour ${nom}` }).getByRole("button", { name: libelle }).click();
}

test("un formateur n'a pas accès à la gestion des formateurs", async ({ page }) => {
  await loginAs(page, { ...ADMIN, role: "FORMATEUR" });
  await page.goto(PAGE_URL);
  await expect(page.getByRole("heading", { name: "Accès réservé" })).toBeVisible();
});

test.describe("Gestion des formateurs", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN);
  });

  test("une entrée « Formateurs » du menu latéral mène à la page", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "Menu latéral affiché sur grand écran uniquement");
    await mockFormateurs(page);
    await page.goto("/espace/admin");

    const menu = page.getByRole("navigation", { name: "Espace personnel" });
    await menu.getByRole("link", { name: "Formateurs" }).click();
    await expect(page).toHaveURL(PAGE_URL);
    await expect(menu.getByRole("link", { name: "Formateurs" })).toHaveAttribute("aria-current", "page");
  });

  test("liste les formateurs (langues, contrat, statut), sur plusieurs pages", async ({ page }) => {
    await mockFormateurs(page);
    await page.goto(PAGE_URL);

    await expect(page.getByRole("heading", { name: "Gestion des formateurs" })).toBeVisible();
    await expect(page.getByRole("columnheader")).toHaveText(["Formateur", "Langues enseignées", "Contrat", "Statut", "Actions"]);
    await expect(rows(page)).toHaveCount(10);
    await expect(page.getByText("1–10 sur 12 formateurs")).toBeVisible();
    await expect(row(page, "Hery RANDRIA")).toContainText("hery@digitheque.mg");
    await expect(languesDe(page, "Tiana ANDRIAMANANA")).toHaveText(["Allemand", "Français"]);
    await expect(row(page, "Mialy RAKOTO")).toContainText("Vacataire");
    await expect(row(page, "Andry RAJAONA")).toContainText("Non renseigné");
    await expect(row(page, "Fanja RAZAFY")).toContainText("Inactif");

    await page.getByRole("button", { name: /^(Suivant|Page suivante)$/ }).click();
    await expect(rows(page)).toHaveCount(2);
  });

  test("recherche un formateur et filtre par statut", async ({ page }) => {
    await mockFormateurs(page);
    await page.goto(PAGE_URL);

    await page.getByRole("searchbox", { name: "Rechercher un formateur" }).fill("rako");
    await expect(page).toHaveURL(`${PAGE_URL}?recherche=rako`);
    await expect(rows(page)).toHaveCount(2); // RAKOTO, RAKOTOBE

    await page.getByRole("searchbox", { name: "Rechercher un formateur" }).fill("");
    await page.getByLabel("Filtrer par statut").selectOption("INACTIF");
    await expect(page).toHaveURL(`${PAGE_URL}?statut=INACTIF`);
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page)).toContainText("Fanja RAZAFY");
  });

  test("ajoute un formateur", async ({ page }) => {
    const ecritures = await mockFormateurs(page);
    await page.goto(PAGE_URL);

    await page.getByRole("button", { name: "Ajouter un formateur" }).click();
    const formulaire = panel(page, "Ajouter un formateur");
    await formulaire.getByLabel("Prénom *").fill("jean-pierre");
    await formulaire.getByLabel("Nom *", { exact: true }).fill("rakotomalala");
    await formulaire.getByLabel("Adresse e-mail *").fill("JP.Rakotomalala@Digitheque.mg");
    await formulaire.getByLabel("Téléphone").fill("0341234567");
    await formulaire.getByLabel("Type de contrat *").selectOption("VACATAIRE");
    await formulaire.getByRole("checkbox", { name: /Mandarin/ }).check();
    await formulaire.getByRole("checkbox", { name: /Anglais/ }).check();
    await formulaire.getByLabel("Certifications").fill("HSK 6");
    await formulaire.getByRole("button", { name: "Enregistrer" }).click();

    await expect(formulaire).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: "Le formateur Jean-Pierre RAKOTOMALALA a été ajouté." })).toBeVisible();
    // Saisie mise en forme (prénom, nom, e-mail en minuscules), langues envoyées par identifiant
    expect(ecritures).toEqual([
      {
        method: "POST",
        body: {
          prenom: "Jean-Pierre",
          nom: "RAKOTOMALALA",
          email: "jp.rakotomalala@digitheque.mg",
          telephone: "034 12 345 67",
          type_contrat: "VACATAIRE",
          certifications: "HSK 6",
          id_langues: [3, 2],
        },
      },
    ]);
    await expect(page.getByText("1–10 sur 13 formateurs")).toBeVisible();
  });

  test("valide le formulaire avant d'appeler l'API", async ({ page }) => {
    const ecritures = await mockFormateurs(page);
    await page.goto(PAGE_URL);

    await page.getByRole("button", { name: "Ajouter un formateur" }).click();
    const formulaire = panel(page, "Ajouter un formateur");
    await formulaire.getByRole("button", { name: "Enregistrer" }).click();

    await expect(formulaire.getByText("Le prénom est requis.")).toBeVisible();
    await expect(formulaire.getByText("Le nom est requis.")).toBeVisible();
    await expect(formulaire.getByText("L'adresse e-mail est requise.")).toBeVisible();
    await expect(formulaire.getByText("Choisissez le type de contrat.")).toBeVisible();
    await expect(formulaire.getByText("Choisissez au moins une langue enseignée.")).toBeVisible();
    await expect(formulaire.getByLabel("Prénom *")).toBeFocused();
    expect(ecritures).toHaveLength(0);
  });

  test("signale un e-mail déjà utilisé", async ({ page }) => {
    await mockFormateurs(page, { emailPris: true });
    await page.goto(PAGE_URL);

    await page.getByRole("button", { name: "Ajouter un formateur" }).click();
    const formulaire = panel(page, "Ajouter un formateur");
    await formulaire.getByLabel("Prénom *").fill("Hery");
    await formulaire.getByLabel("Nom *", { exact: true }).fill("RANDRIA");
    await formulaire.getByLabel("Adresse e-mail *").fill("hery@digitheque.mg");
    await formulaire.getByLabel("Type de contrat *").selectOption("CDI");
    await formulaire.getByRole("checkbox", { name: /Français/ }).check();
    await formulaire.getByRole("button", { name: "Enregistrer" }).click();

    await expect(formulaire.getByText("Cette adresse e-mail est déjà utilisée par un autre compte.")).toBeVisible();
    await expect(formulaire.getByLabel("Adresse e-mail *")).toHaveAttribute("aria-invalid", "true");
  });

  test("modifie un formateur depuis le panneau prérempli (contrat et langues)", async ({ page }) => {
    const ecritures = await mockFormateurs(page);
    await page.goto(PAGE_URL);

    await action(page, "Lova RABE", "Modifier");
    const formulaire = panel(page, "Modifier le formateur");
    await expect(formulaire.getByLabel("Prénom *")).toHaveValue("Lova");
    await expect(formulaire.getByLabel("Type de contrat *")).toHaveValue("CDD");
    await expect(formulaire.getByRole("checkbox", { name: /Mandarin/ })).toBeChecked();
    await expect(formulaire.getByRole("checkbox", { name: /Anglais/ })).not.toBeChecked();

    await formulaire.getByLabel("Type de contrat *").selectOption("CDI");
    await formulaire.getByRole("checkbox", { name: /Anglais/ }).check();
    await formulaire.getByRole("button", { name: "Enregistrer" }).click();

    await expect(page.getByRole("status").filter({ hasText: "Les informations de Lova RABE ont été mises à jour." })).toBeVisible();
    expect(ecritures.at(-1)).toMatchObject({ method: "PATCH", id: 2, body: { type_contrat: "CDI", id_langues: [3, 2] } });
    await expect(row(page, "Lova RABE")).toContainText("CDI");
    await expect(languesDe(page, "Lova RABE")).toHaveText(["Anglais", "Mandarin"]);
  });

  test("désactive puis réactive un formateur après confirmation", async ({ page }) => {
    const ecritures = await mockFormateurs(page);
    await page.goto(PAGE_URL);

    await action(page, "Mialy RAKOTO", "Désactiver");
    await page.getByRole("dialog", { name: "Désactiver le formateur ?" }).getByRole("button", { name: "Désactiver" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Le compte de Mialy RAKOTO a été désactivé." })).toBeVisible();
    await expect(row(page, "Mialy RAKOTO")).toContainText("Inactif");

    await action(page, "Mialy RAKOTO", "Réactiver");
    await page.getByRole("dialog", { name: "Réactiver le formateur ?" }).getByRole("button", { name: "Réactiver" }).click();
    await expect(row(page, "Mialy RAKOTO")).toContainText("Actif");
    expect(ecritures).toEqual([
      { method: "PATCH", id: 3, body: { statut: "INACTIF" } },
      { method: "PATCH", id: 3, body: { statut: "ACTIF" } },
    ]);
  });

  test("Échap ferme le panneau sans rien enregistrer", async ({ page }) => {
    const ecritures = await mockFormateurs(page);
    await page.goto(PAGE_URL);

    await action(page, "Hery RANDRIA", "Modifier");
    await panel(page, "Modifier le formateur").getByLabel("Nom *", { exact: true }).fill("AUTRE");
    await page.keyboard.press("Escape");

    await expect(panel(page, "Modifier le formateur")).toBeHidden();
    expect(ecritures).toHaveLength(0);
  });
});
