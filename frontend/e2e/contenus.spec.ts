import { expect, test, type Page } from "@playwright/test";
import { loginAs, type UtilisateurDto } from "./support/session";

/*
 * USPxx : rubrique « Contenus » du formateur (docs/gestion-pedagogique.md).
 * Données simulées en mémoire (lib/contenus/mock-service.ts) : aucune route d'API à intercepter.
 * La navigation se fait dans l'application (liens, onglets) : un rechargement remettrait les données à zéro.
 */

const FORMATEUR: UtilisateurDto = {
  id_user: 2,
  nom: "RANDRIA",
  prenom: "Hery",
  email: "formateur@digitheque.mg",
  telephone: null,
  role: "FORMATEUR",
  statut: "ACTIF",
  date_inscription: "2025-01-06T08:00:00Z",
};

const panneau = (page: Page, titre: string) => page.getByRole("dialog", { name: titre });
const enregistrer = (page: Page, titre: string) => panneau(page, titre).getByRole("button", { name: "Enregistrer" }).click();
const confirmation = (page: Page, texte: string) => expect(page.getByRole("status")).toContainText(texte);

test.beforeEach(async ({ page }) => {
  await loginAs(page, FORMATEUR);
});

test("liste les six langues ; l'espagnol, sans niveau, ne permet aucune création", async ({ page }) => {
  await page.goto("/espace/formateur/contenus");

  await expect(page.getByRole("heading", { name: "Contenus pédagogiques" })).toBeVisible();
  await expect(page.getByText("Données simulées")).toBeVisible();
  for (const langue of ["Français", "Anglais", "Mandarin", "Italien", "Allemand", "Espagnol"]) {
    await expect(page.getByRole("rowheader", { name: langue })).toBeVisible();
  }

  await page.getByRole("link", { name: "Gérer les contenus : Espagnol" }).click();
  await expect(page.getByText("Ajoutez d'abord des niveaux pour cette langue.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Ajouter/ })).toHaveCount(0);
});

test("crée un module, une leçon, une activité et un parcours, en respectant les règles de publication", async ({ page }) => {
  await page.goto("/espace/formateur/contenus/fr");
  await expect(page.getByText("Aucun module pour la langue Français.")).toBeVisible();

  // Module
  await page.getByRole("button", { name: "Ajouter un module" }).click();
  await panneau(page, "Ajouter un module").getByLabel("Titre *").fill("Module 1");
  await enregistrer(page, "Ajouter un module");
  await confirmation(page, "Le module « Module 1 » a été ajouté.");

  // Leçon : la publication est refusée tant qu'elle n'a pas d'activité publiée (RG-GP-03)
  await page.getByRole("tab", { name: /Leçons/ }).click();
  await page.getByRole("button", { name: "Ajouter une leçon" }).click();
  const lecon = panneau(page, "Ajouter une leçon");
  await lecon.getByLabel("Module *").selectOption({ label: "1. Module 1" });
  await lecon.getByLabel("Niveau *").selectOption({ label: "A1" });
  await lecon.getByLabel("Titre *").fill("Leçon 1");
  await expect(lecon.getByLabel("Phase Assimil")).toHaveValue("Passive");
  await lecon.getByLabel("Statut *").selectOption({ label: "Publié" });
  await enregistrer(page, "Ajouter une leçon");
  await expect(lecon.getByText(/^Publication refusée : une leçon publiée doit contenir au moins une activité publiée/)).toBeVisible();
  await lecon.getByLabel("Statut *").selectOption({ label: "Brouillon" });
  await enregistrer(page, "Ajouter une leçon");
  await confirmation(page, "La leçon « Leçon 1 » a été ajoutée.");

  // Activité, depuis le détail de la leçon : une production libre exige un critère de correction (RG-GP-04)
  await page.getByRole("link", { name: "Leçon 1" }).click();
  await expect(page.getByRole("heading", { name: "Leçon 1" })).toBeVisible();
  await page.getByRole("button", { name: "Ajouter une activité" }).click();
  const activite = panneau(page, "Ajouter une activité");
  await activite.getByLabel("Type *").selectOption({ label: "Production libre" });
  await activite.getByLabel("Compétence *").selectOption({ label: "Écriture" });
  await activite.getByLabel("Consigne *").fill("[Consigne à rédiger par le formateur]");
  await activite.getByLabel("Statut *").selectOption({ label: "Publié" });
  await enregistrer(page, "Ajouter une activité");
  await expect(activite.getByText("Une activité de production libre doit avoir une réponse de référence ou un critère de correction.")).toBeVisible();
  await activite.getByLabel("Réponse de référence ou critère de correction *").fill("[Critère à rédiger par le formateur]");
  await enregistrer(page, "Ajouter une activité");
  await confirmation(page, "a été ajoutée.");

  // La leçon peut maintenant être publiée
  await page.getByRole("link", { name: /^Leçons/ }).click();
  await page.getByRole("group", { name: "Actions pour « Leçon 1 »" }).getByRole("button", { name: "Modifier" }).click();
  const modification = panneau(page, "Modifier la leçon");
  await modification.getByLabel("Statut *").selectOption({ label: "Publié" });
  await enregistrer(page, "Modifier la leçon");
  await confirmation(page, "La leçon « Leçon 1 » a été mise à jour.");

  // Parcours publié contenant la leçon publiée
  await page.getByRole("tab", { name: /Parcours/ }).click();
  await page.getByRole("button", { name: "Ajouter un parcours" }).click();
  const parcours = panneau(page, "Ajouter un parcours");
  await parcours.getByLabel("Titre *").fill("Parcours A1");
  await parcours.getByLabel("Niveau cible *").selectOption({ label: "A1" });
  await parcours.getByLabel("Élément à ajouter").selectOption({ label: "Leçon 1 – Leçon 1" });
  await parcours.getByRole("button", { name: "Ajouter au parcours" }).click();
  await parcours.getByLabel("Statut *").selectOption({ label: "Publié" });
  await enregistrer(page, "Ajouter un parcours");
  await confirmation(page, "Le parcours « Parcours A1 » a été ajouté.");

  // La leçon est désormais utilisée : elle s'archive, mais ne se supprime plus (RG-GP-08)
  await page.getByRole("tab", { name: /Leçons/ }).click();
  const actions = page.getByRole("group", { name: "Actions pour « Leçon 1 »" });
  await expect(actions.getByRole("button", { name: "Archiver" })).toBeVisible();
  await expect(actions.getByRole("button", { name: "Supprimer" })).toHaveCount(0);
});

test("formulaire d'activité du mandarin : caractères, pinyin et tons attendus pour l'oral", async ({ page }) => {
  await page.goto("/espace/formateur/contenus/zh?onglet=exercices");

  await page.getByRole("button", { name: "Ajouter une activité" }).click();
  const activite = panneau(page, "Ajouter une activité");
  const mandarin = activite.getByRole("group", { name: "Champs du mandarin" });
  await expect(mandarin.getByLabel("Caractères")).toBeVisible();
  await expect(mandarin.getByLabel("Pinyin")).toBeVisible();
  await expect(mandarin.getByLabel("Tons attendus")).toHaveCount(0);
  await activite.getByLabel("Compétence *").selectOption({ label: "Oral" });
  await expect(mandarin.getByLabel("Tons attendus")).toBeVisible();
});
