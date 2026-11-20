import { expect, test, type Page } from "@playwright/test";
import { loginAs, type UtilisateurDto } from "./support/session";
import { CONTENU_QCM_VISIBLE, exerciceDto, parcoursDto, servirParcours } from "./support/parcours";

// US42 : liste des exercices du parcours avec leur statut (à faire / réussi / à revoir), sur l'API simulée.
const APPRENANT: UtilisateurDto = {
  id_user: 1,
  nom: "Rakoto",
  prenom: "Rova",
  email: "rova@exemple.com",
  telephone: null,
  role: "APPRENANT",
  statut: "ACTIF",
  date_inscription: "2025-01-12T10:00:00Z",
};

const EXERCICES = [
  exerciceDto(231, 23, "Le passé composé", "REUSSI", 85),
  exerciceDto(232, 23, "Les salutations", "A_REVOIR", 40),
  exerciceDto(233, 23, "À la gare", "A_FAIRE", null),
];

/** Ouvre le détail d'une leçon repliée de la liste « Tous les exercices du parcours ». */
async function ouvrirLecon(page: Page, numero: number) {
  await page.locator("details").filter({ hasText: `Ouvrir la leçon ${numero}` }).locator("summary").click();
}

test.describe("Liste des exercices du parcours (US42)", () => {
  test("chaque exercice affiche son statut en toutes lettres et son score", async ({ page }) => {
    await loginAs(page, APPRENANT);
    await servirParcours(page, { parcours: parcoursDto(23), exercices: EXERCICES });
    await page.goto("/espace/apprenant/parcours");
    await ouvrirLecon(page, 23);

    const liste = page.getByRole("list", { name: "Exercices de la leçon 23" });
    await expect(liste.getByRole("listitem").filter({ hasText: "Le passé composé" })).toContainText("Réussi");
    await expect(liste.getByRole("listitem").filter({ hasText: "Le passé composé" })).toContainText("85/100");
    await expect(liste.getByRole("listitem").filter({ hasText: "Les salutations" })).toContainText("À revoir");
    await expect(liste.getByRole("listitem").filter({ hasText: "À la gare" })).toContainText("À faire");
  });

  test("le filtre « À revoir » ne garde que les exercices à revoir", async ({ page }) => {
    await loginAs(page, APPRENANT);
    await servirParcours(page, { parcours: parcoursDto(23), exercices: EXERCICES });
    await page.goto("/espace/apprenant/parcours");

    // Le filtre ne vaut que pour la section « Tous les exercices » (la leçon du jour affiche toujours tout)
    const section = page.getByRole("region", { name: "Tous les exercices du parcours" });
    const filtres = section.getByRole("group", { name: "Filtrer les exercices par statut" });
    await filtres.getByRole("button", { name: /À revoir/ }).click();

    await expect(filtres.getByRole("button", { name: /À revoir/ })).toHaveAttribute("aria-pressed", "true");
    await expect(section.getByText("Les salutations")).toBeVisible();
    await expect(section.getByText("Le passé composé")).toHaveCount(0);
    await expect(section.getByText("À la gare")).toHaveCount(0);
  });

  test("un filtre sans résultat l'indique", async ({ page }) => {
    await loginAs(page, APPRENANT);
    const sansReussi = EXERCICES.filter((e) => e.statut !== "REUSSI");
    await servirParcours(page, { parcours: parcoursDto(23), exercices: sansReussi });
    await page.goto("/espace/apprenant/parcours");

    await page.getByRole("group", { name: "Filtrer les exercices par statut" }).getByRole("button", { name: /Réussis/ }).click();

    await expect(page.getByText("Aucun exercice avec ce statut.")).toBeVisible();
  });

  test("« Ouvrir la leçon » mène à la leçon du parcours", async ({ page }) => {
    await loginAs(page, APPRENANT);
    await servirParcours(page, {
      parcours: parcoursDto(23),
      exercices: EXERCICES,
      lecons: { 23: { exercices: [{ ...exerciceDto(233, 23, "À la gare", "A_FAIRE", null), contenu: CONTENU_QCM_VISIBLE }] } },
    });
    await page.goto("/espace/apprenant/parcours");
    await ouvrirLecon(page, 23);

    await page.getByRole("link", { name: "Ouvrir la leçon 23" }).click();

    await expect(page).toHaveURL(/\/espace\/apprenant\/parcours\/lecons\/23$/);
  });

  test("au-delà de 5 leçons, les plus anciennes sont repliées derrière un bouton", async ({ page }) => {
    await loginAs(page, APPRENANT);
    const exercices = [1, 2, 3, 4, 5, 6].map((lecon) => exerciceDto(300 + lecon, lecon, `Exercice ${lecon}`, "REUSSI", 90));
    await servirParcours(page, { parcours: parcoursDto(6), exercices });
    await page.goto("/espace/apprenant/parcours");

    await expect(page.getByRole("button", { name: "Afficher les 1 leçon précédente" })).toBeVisible();
    await page.getByRole("button", { name: "Afficher les 1 leçon précédente" }).click();
    await expect(page.getByRole("button", { name: /Afficher les/ })).toHaveCount(0);
  });
});
