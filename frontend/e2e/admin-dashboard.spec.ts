import { expect, test, type Page } from "@playwright/test";
import { ACCESS_TOKEN, handlePreflight, json, loginAs, type UtilisateurDto } from "./support/session";

/*
 * User story : « En tant qu'administrateur, je veux voir le tableau de bord admin, afin de piloter la plateforme. »
 * Critère : KPI globaux. Tâche : page Dashboard Admin.
 *
 * L'API est simulée avec page.route (GET /admin/statistiques et GET /admin/statistiques/inscriptions).
 */

const PAGE_URL = "/espace/admin";
const STATS_API = /\/api\/v1\/admin\/statistiques$/;
const INSCRIPTIONS_API = /\/api\/v1\/admin\/statistiques\/inscriptions\?/;

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

/* Fixtures au format des classes du diagramme (Apprenant, Langue, Abonnement, Formule). */

const apprenant = (id_user: number, prenom: string, nom: string, date: string) => ({
  id_user,
  prenom,
  nom,
  email: `${prenom.toLowerCase()}@exemple.com`,
  telephone: null,
  role: "APPRENANT",
  statut: "ACTIF",
  date_inscription: date,
  date_naissance: null,
  pays: null,
  ville: null,
  objectif: null,
});

const LANGUES = {
  fr: { id_langue: 1, code: "fr", libelle: "Français" },
  en: { id_langue: 2, code: "en", libelle: "Anglais" },
  zh: { id_langue: 3, code: "zh", libelle: "Mandarin" },
  it: { id_langue: 4, code: "it", libelle: "Italien" },
  de: { id_langue: 5, code: "de", libelle: "Allemand" },
};

const abonnement = (id_formule: number, libelle: string, statut: "ACTIF" | "EXPIRE" | "SUSPENDU") => ({
  id_abonnement: 500 + id_formule,
  date_debut: "2026-10-01",
  date_fin: "2027-01-01",
  statut,
  quota_heures: 12,
  quota_ateliers: 3,
  formule: { id_formule, libelle, prix_mensuel: 100000, duree_mois: 3, quota_heures: 12, quota_ateliers: 3, langues: [] },
});

const STATISTIQUES = {
  totaux: { utilisateurs: 248, apprenants: 186, formateurs: 42, ateliers_programmes: 18 },
  // Volontairement dans le désordre : le frontend trie par nombre décroissant
  apprenants_par_langue: [
    { langue: LANGUES.en, apprenants: 48 },
    { langue: LANGUES.de, apprenants: 17 },
    { langue: LANGUES.fr, apprenants: 71 },
  ],
  dernieres_inscriptions: [
    {
      apprenant: apprenant(301, "Jean", "DUPONT", "2026-10-12T09:00:00Z"),
      langues: [LANGUES.fr],
      abonnement: abonnement(1, "Simple", "ACTIF"),
    },
    {
      apprenant: apprenant(300, "Tiana", "ANDRIAMIHAJA", "2026-10-10T09:00:00Z"),
      langues: [LANGUES.de, LANGUES.en, LANGUES.zh],
      abonnement: abonnement(3, "Premium", "SUSPENDU"),
    },
    { apprenant: apprenant(299, "Lova", "RAMIARISOA", "2026-10-08T09:00:00Z"), langues: [LANGUES.it], abonnement: null },
  ],
};

/** Inscriptions par jour : `jours` points, de 1 à `jours` inscriptions (total = jours × (jours + 1) / 2). */
const inscriptions = (jours: number) =>
  Array.from({ length: jours }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, "0")}`, nombre: i + 1 }));

interface Requete {
  url: URL;
  authorization: string | undefined;
}

async function mockStatistiques(page: Page, { status = 200 }: { status?: number } = {}) {
  const requetes: Requete[] = [];
  await page.route(STATS_API, async (route) => {
    if (await handlePreflight(route)) return;
    requetes.push({ url: new URL(route.request().url()), authorization: route.request().headers().authorization });
    return status === 200 ? json(route, 200, STATISTIQUES) : json(route, status, { detail: "Erreur" });
  });
  return requetes;
}

async function mockInscriptions(page: Page) {
  const requetes: Requete[] = [];
  await page.route(INSCRIPTIONS_API, async (route) => {
    if (await handlePreflight(route)) return;
    const url = new URL(route.request().url());
    requetes.push({ url, authorization: route.request().headers().authorization });
    return json(route, 200, inscriptions(Number(url.searchParams.get("jours"))));
  });
  return requetes;
}

const carte = (page: Page, titre: string) => page.getByRole("region", { name: titre });

test("sans session, le tableau de bord redirige vers la connexion", async ({ page }) => {
  await page.goto(PAGE_URL);
  await expect(page).toHaveURL("/login");
});

test("un formateur n'a pas accès au tableau de bord administrateur", async ({ page }) => {
  const requetes = await mockStatistiques(page);
  await loginAs(page, { ...ADMIN, role: "FORMATEUR" });
  await page.goto(PAGE_URL);

  await expect(page.getByRole("heading", { name: "Accès réservé" })).toBeVisible();
  expect(requetes).toHaveLength(0);
});

test.describe("Tableau de bord administrateur", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN);
    await mockInscriptions(page);
  });

  test("affiche les KPI globaux de la plateforme", async ({ page }) => {
    const requetes = await mockStatistiques(page);
    await page.goto(PAGE_URL);

    await expect(page.getByRole("heading", { name: "Tableau de bord", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Utilisateurs 248" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Apprenants 186" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Formateurs 42" })).toBeVisible();
    // Pas encore de page Ateliers : chiffre affiché, sans lien
    await expect(page.getByRole("listitem").filter({ hasText: "Ateliers programmés" })).toContainText("18");
    await expect(page.getByRole("link", { name: /Ateliers programmés/ })).toHaveCount(0);

    expect(requetes).toHaveLength(1);
    expect(requetes[0].authorization).toBe(`Bearer ${ACCESS_TOKEN}`);
  });

  test("un KPI mène à la liste des utilisateurs filtrée par rôle", async ({ page }) => {
    await mockStatistiques(page);
    await page.route(/\/api\/v1\/users\?/, async (route) => {
      if (await handlePreflight(route)) return;
      return json(route, 200, { items: [], total: 0, page: 1, page_size: 10 });
    });
    await page.goto(PAGE_URL);

    await page.getByRole("link", { name: "Formateurs 42" }).click();

    await expect(page).toHaveURL("/espace/admin/utilisateurs?role=FORMATEUR");
    await expect(page.getByLabel("Filtrer par rôle")).toHaveValue("FORMATEUR");
  });

  test("répartit les apprenants par langue, de la plus suivie à la moins suivie", async ({ page }) => {
    await mockStatistiques(page);
    await page.goto(PAGE_URL);

    const barres = carte(page, "Apprenants par langue").getByRole("meter");
    await expect(barres).toHaveCount(3);
    // Part calculée sur le total des apprenants (186)
    await expect(barres.nth(0)).toHaveAccessibleName("Français : 71 apprenants, 38 %");
    await expect(barres.nth(1)).toHaveAccessibleName("Anglais : 48 apprenants, 26 %");
    await expect(barres.nth(2)).toHaveAccessibleName("Allemand : 17 apprenants, 9 %");
  });

  test("affiche les inscriptions de la période choisie", async ({ page }) => {
    await mockStatistiques(page);
    const requetes = await mockInscriptions(page);
    await page.goto(PAGE_URL);

    const courbe = carte(page, "Évolution des inscriptions");
    // 30 jours par défaut : 1 + 2 + … + 30 = 465
    await expect(courbe).toContainText("465 nouveaux comptes sur 30 jours");
    expect(requetes[0].url.searchParams.get("jours")).toBe("30");
    expect(requetes[0].authorization).toBe(`Bearer ${ACCESS_TOKEN}`);

    await courbe.getByLabel("Période affichée").selectOption("7");

    await expect(courbe).toContainText("28 nouveaux comptes sur 7 jours");
    expect(requetes.at(-1)?.url.searchParams.get("jours")).toBe("7");
    // Mêmes données en tableau pour les lecteurs d'écran
    await expect(courbe.locator("table tbody tr")).toHaveCount(7);
  });

  test("liste les dernières inscriptions d'apprenants avec leurs langues et leur abonnement", async ({ page }) => {
    await mockStatistiques(page);
    await page.goto(PAGE_URL);

    const section = carte(page, "Dernières inscriptions");
    const lignes = section.locator("tbody tr");
    await expect(lignes).toHaveCount(3);

    await expect(lignes.nth(0)).toContainText("Jean DUPONT");
    await expect(lignes.nth(0)).toContainText("jean@exemple.com");
    await expect(lignes.nth(0)).toContainText("Français");
    await expect(lignes.nth(0)).toContainText("Simple");
    await expect(lignes.nth(0).getByRole("cell").nth(2)).toContainText("Actif");
    await expect(lignes.nth(0)).toContainText("12/10/2026");
    await expect(lignes.nth(0)).toContainText("Actif");

    // Au-delà de deux langues : « +1 »
    await expect(lignes.nth(1)).toContainText("Allemand, Anglais");
    await expect(lignes.nth(1)).toContainText("+1");
    // StatutAbonnement affiché sous la formule
    await expect(lignes.nth(1)).toContainText("Premium");
    await expect(lignes.nth(1)).toContainText("Suspendu");
    // Abonnement pas encore créé
    await expect(lignes.nth(2)).toContainText("Aucun abonnement");

    await expect(section.getByRole("link", { name: "Voir tous les apprenants" })).toHaveAttribute(
      "href",
      "/espace/admin/utilisateurs?role=APPRENANT",
    );
  });

  test("une période sans aucune donnée affiche un message au lieu de la courbe", async ({ page }) => {
    await mockStatistiques(page);
    await page.route(INSCRIPTIONS_API, async (route) => {
      if (await handlePreflight(route)) return;
      return json(route, 200, []);
    });
    await page.goto(PAGE_URL);

    await expect(carte(page, "Évolution des inscriptions")).toContainText("Aucune donnée d'inscription pour cette période.");
    // Le reste du tableau de bord reste affiché
    await expect(page.getByRole("link", { name: "Utilisateurs 248" })).toBeVisible();
  });

  test("affiche un message si les statistiques ne peuvent pas être chargées", async ({ page }) => {
    await mockStatistiques(page, { status: 500 });
    await page.goto(PAGE_URL);

    await expect(page.getByRole("alert").filter({ hasText: "Le serveur rencontre un problème" })).toBeVisible();
    // La courbe des inscriptions, chargée à part, reste disponible
    await expect(carte(page, "Évolution des inscriptions")).toContainText("465 nouveaux comptes sur 30 jours");
  });
});
