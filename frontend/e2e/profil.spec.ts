import { expect, test, type Page } from "@playwright/test";
import { ACCESS_TOKEN, handlePreflight, json, loginAs, type UtilisateurDto } from "./support/session";

/*
 * User story : « En tant qu'utilisateur, je veux éditer mon profil, afin de personnaliser mon compte. »
 * Critères : formulaire prérempli, sauvegarde confirmée. Tâches : page Profile, upload photo.
 *
 * L'API est simulée avec page.route : ces tests ne dépendent pas du backend.
 */

const ME_API = "**/api/v1/users/me";
const PHOTO_API = "**/api/v1/users/me/photo";
/** Photos servies par le backend (chemin renvoyé dans photo_url). */
const PHOTO_FILES = "**/media/photos/**";
const PHOTO_PATH = "/media/photos/1.jpg";

/** Petite image PNG valide (8 × 8 px). */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGNgtPHCihiGlgQAHkshwbgmO+8AAAAASUVORK5CYII=",
  "base64",
);

const PROFIL_DTO: UtilisateurDto = {
  id_user: 1,
  nom: "RASOLOFO",
  prenom: "Finoana",
  email: "finoana.rasolofo@gmail.com",
  telephone: "+261 34 12 345 67",
  role: "APPRENANT",
  statut: "ACTIF",
  date_inscription: "2026-10-07T10:00:00Z",
};

interface MockOptions {
  get?: { status: number; body: unknown };
  patch?: { status: number; body: unknown };
}

/** Simule GET / PATCH /users/me ; renvoie les requêtes PATCH reçues (corps et en-tête Authorization). */
async function mockProfil(page: Page, { get, patch }: MockOptions = {}) {
  const patches: { body: unknown; authorization: string | undefined }[] = [];
  await page.route(ME_API, async (route) => {
    if (await handlePreflight(route)) return;
    const request = route.request();
    if (request.method() === "PATCH") {
      patches.push({ body: request.postDataJSON(), authorization: request.headers().authorization });
      const response = patch ?? { status: 200, body: { ...PROFIL_DTO, ...request.postDataJSON() } };
      return json(route, response.status, response.body);
    }
    return json(route, get?.status ?? 200, get?.body ?? PROFIL_DTO);
  });
  return patches;
}

const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });
const save = (page: Page) => page.getByRole("button", { name: "Enregistrer" }).click();
const toast = (page: Page, message = "Profil mis à jour avec succès.") =>
  page.getByRole("status").filter({ hasText: message });

interface PhotoRequest {
  method: string;
  contentType: string | undefined;
  authorization: string | undefined;
  body: string;
}

/** Simule POST / DELETE /users/me/photo et les fichiers de photo ; renvoie les requêtes reçues. */
async function mockPhoto(page: Page, { status = 200, detail }: { status?: number; detail?: string } = {}) {
  const requests: PhotoRequest[] = [];
  await page.route(PHOTO_API, async (route) => {
    if (await handlePreflight(route)) return;
    const request = route.request();
    requests.push({
      method: request.method(),
      contentType: request.headers()["content-type"],
      authorization: request.headers().authorization,
      body: request.postDataBuffer()?.toString("latin1") ?? "",
    });
    if (status !== 200) return json(route, status, { detail });
    const photo_url = request.method() === "DELETE" ? null : PHOTO_PATH;
    return json(route, 200, { ...PROFIL_DTO, photo_url });
  });
  await page.route(PHOTO_FILES, (route) => route.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  return requests;
}

const photoInput = (page: Page) => page.locator('input[type="file"]');
/** Avatar de la page (le premier est celui de l'en-tête). */
const avatarPage = (page: Page) => page.getByRole("img", { name: "Finoana RASOLOFO" }).last();

test("sans session, la page du profil redirige vers la connexion", async ({ page }) => {
  await page.goto("/espace/profil");
  await expect(page).toHaveURL("/login");
});

test.describe("Mon profil", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, PROFIL_DTO);
  });

  test("l'avatar de l'en-tête ouvre le menu du compte vers le profil", async ({ page }) => {
    await mockProfil(page);
    await page.goto("/");

    const menu = page.getByRole("button", { name: "Menu du compte" });
    await expect(menu.getByRole("img", { name: "Finoana RASOLOFO" })).toHaveText("FR");
    await expect(page.getByRole("link", { name: "Se connecter" })).toHaveCount(0);

    await menu.click();
    await page.getByRole("menuitem", { name: "Mon profil" }).click();

    await expect(page).toHaveURL("/espace/profil");
    await expect(page.getByRole("heading", { name: "Mon profil" })).toBeVisible();
  });

  test("le formulaire est prérempli avec les données du serveur", async ({ page }) => {
    await mockProfil(page, { get: { status: 200, body: { ...PROFIL_DTO, telephone: "+261 33 00 000 00" } } });
    await page.goto("/espace/profil");

    await expect(field(page, "Prénom *")).toHaveValue("Finoana");
    await expect(field(page, "Nom *")).toHaveValue("RASOLOFO");
    await expect(field(page, "Adresse e-mail *")).toHaveValue("finoana.rasolofo@gmail.com");
    // Valeur relue depuis l'API, pas depuis la session, et affichée au format local
    await expect(field(page, "Téléphone")).toHaveValue("033 00 000 00");
    // Champs de mot de passe vides, sans points qui feraient croire qu'ils sont remplis
    for (const label of ["Mot de passe actuel", "Nouveau mot de passe", "Confirmer le nouveau mot de passe"]) {
      await expect(field(page, label)).toHaveValue("");
      await expect(field(page, label)).not.toHaveAttribute("placeholder", /•/);
    }
  });

  test("enregistre les modifications et confirme la sauvegarde", async ({ page }) => {
    const patches = await mockProfil(page);
    await page.goto("/espace/profil");

    await field(page, "Prénom *").fill("rova marie");
    await field(page, "Téléphone").fill("0329876543");
    await expect(field(page, "Téléphone")).toHaveValue("032 98 765 43");
    await save(page);

    await expect(toast(page)).toBeVisible();
    // Données au format de l'API, JWT transmis, mot de passe absent (inchangé)
    expect(patches).toEqual([
      {
        authorization: `Bearer ${ACCESS_TOKEN}`,
        body: { prenom: "Rova Marie", nom: "RASOLOFO", email: "finoana.rasolofo@gmail.com", telephone: "032 98 765 43" },
      },
    ]);
    // L'en-tête reflète le nouveau prénom
    await expect(page.getByRole("img", { name: "Rova Marie RASOLOFO" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Fermer la notification" }).click();
    await expect(toast(page)).toBeHidden();
  });

  test("le téléphone n'accepte que des chiffres, mis en forme 030 00 000 00 pendant la frappe", async ({ page }) => {
    await mockProfil(page, { get: { status: 200, body: { ...PROFIL_DTO, telephone: null } } });
    await page.goto("/espace/profil");
    const telephone = field(page, "Téléphone");
    await expect(telephone).toHaveAttribute("placeholder", "030 00 000 00");

    // Frappe touche par touche : lettres et symboles n'apparaissent pas, les espaces se placent seuls
    await telephone.pressSequentially("03a4-b12");
    await expect(telephone).toHaveValue("034 12");
    await telephone.pressSequentially("x345z67");
    await expect(telephone).toHaveValue("034 12 345 67");
    // Au-delà de 10 chiffres, la saisie est ignorée
    await telephone.pressSequentially("89");
    await expect(telephone).toHaveValue("034 12 345 67");
  });

  test("le téléphone est facultatif : vidé, il est envoyé à null", async ({ page }) => {
    const patches = await mockProfil(page);
    await page.goto("/espace/profil");

    await field(page, "Téléphone").fill("");
    await save(page);

    await expect(toast(page)).toBeVisible();
    expect(patches[0].body).toMatchObject({ telephone: null });
  });

  test("un profil sans téléphone s'affiche et s'enregistre", async ({ page }) => {
    const patches = await mockProfil(page, { get: { status: 200, body: { ...PROFIL_DTO, telephone: null } } });
    await page.goto("/espace/profil");

    await expect(field(page, "Téléphone")).toHaveValue("");
    await field(page, "Prénom *").fill("Rova");
    await save(page);

    await expect(toast(page)).toBeVisible();
    expect(patches[0].body).toMatchObject({ prenom: "Rova", telephone: null });
  });

  test("change le mot de passe avec l'actuel, seulement s'il est confirmé", async ({ page }) => {
    const patches = await mockProfil(page);
    await page.goto("/espace/profil");

    await field(page, "Mot de passe actuel").fill("Actuel2026");
    await field(page, "Nouveau mot de passe").fill("Nouveau2026");
    await field(page, "Confirmer le nouveau mot de passe").fill("Autre2026");
    await save(page);
    await expect(page.getByText("Les mots de passe ne correspondent pas.")).toBeVisible();
    expect(patches).toHaveLength(0);

    await field(page, "Confirmer le nouveau mot de passe").fill("Nouveau2026");
    await save(page);

    await expect(toast(page)).toBeVisible();
    // Le backend reçoit l'actuel pour le vérifier
    expect(patches[0].body).toMatchObject({ mot_de_passe: "Nouveau2026", mot_de_passe_actuel: "Actuel2026" });
    // Les trois champs sont vidés après la sauvegarde
    for (const label of ["Mot de passe actuel", "Nouveau mot de passe", "Confirmer le nouveau mot de passe"]) {
      await expect(field(page, label)).toHaveValue("");
    }
  });

  test("exige le mot de passe actuel pour en changer", async ({ page }) => {
    const patches = await mockProfil(page);
    await page.goto("/espace/profil");

    await field(page, "Nouveau mot de passe").fill("Nouveau2026");
    await field(page, "Confirmer le nouveau mot de passe").fill("Nouveau2026");
    await save(page);

    await expect(page.getByText("Saisissez votre mot de passe actuel.")).toBeVisible();
    await expect(field(page, "Mot de passe actuel")).toBeFocused();
    expect(patches).toHaveLength(0);
  });

  test("signale un mot de passe actuel refusé par le serveur, sans déconnecter", async ({ page }) => {
    await mockProfil(page, { patch: { status: 400, body: { detail: "Incorrect current password" } } });
    await page.goto("/espace/profil");

    await field(page, "Mot de passe actuel").fill("Faux2026");
    await field(page, "Nouveau mot de passe").fill("Nouveau2026");
    await field(page, "Confirmer le nouveau mot de passe").fill("Nouveau2026");
    await save(page);

    await expect(page.getByText("Le mot de passe actuel est incorrect.")).toBeVisible();
    await expect(field(page, "Mot de passe actuel")).toHaveAttribute("aria-invalid", "true");
    await expect(toast(page)).toHaveCount(0);
    await expect(page).toHaveURL("/espace/profil");

    // Le message disparaît dès que l'utilisateur corrige
    await field(page, "Mot de passe actuel").fill("Actuel2026");
    await expect(page.getByText("Le mot de passe actuel est incorrect.")).toBeHidden();
  });

  test("valide les champs avant d'appeler l'API", async ({ page }) => {
    const patches = await mockProfil(page);
    await page.goto("/espace/profil");

    await field(page, "Prénom *").fill("");
    await field(page, "Téléphone").fill("12");
    await save(page);

    await expect(page.getByText("Le prénom est requis.")).toBeVisible();
    await expect(page.getByText("Numéro de téléphone invalide : 10 chiffres, au format 030 00 000 00.")).toBeVisible();
    await expect(field(page, "Prénom *")).toBeFocused();
    expect(patches).toHaveLength(0);
  });

  test("signale une adresse e-mail déjà utilisée", async ({ page }) => {
    await mockProfil(page, { patch: { status: 409, body: { detail: "Email already registered" } } });
    await page.goto("/espace/profil");

    await field(page, "Adresse e-mail *").fill("deja@exemple.com");
    await save(page);

    await expect(page.getByText("Cette adresse e-mail est déjà utilisée par un autre compte.")).toBeVisible();
    await expect(field(page, "Adresse e-mail *")).toHaveAttribute("aria-invalid", "true");
    await expect(toast(page)).toHaveCount(0);
  });

  test("« Annuler » rétablit les valeurs enregistrées", async ({ page }) => {
    await mockProfil(page);
    await page.goto("/espace/profil");

    await field(page, "Nom *").fill("AUTRE");
    await page.getByRole("button", { name: "Annuler" }).click();

    await expect(field(page, "Nom *")).toHaveValue("RASOLOFO");
  });

  test("affiche les initiales, le nom et le rôle sans photo", async ({ page }) => {
    await mockProfil(page);
    await page.goto("/espace/profil");

    const identite = page.getByRole("img", { name: "Finoana RASOLOFO" });
    // Une pastille dans l'en-tête, une sur la page
    await expect(identite).toHaveCount(2);
    for (const avatar of await identite.all()) await expect(avatar).toHaveText("FR");
    await expect(page.getByText("Apprenant", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Supprimer la photo" })).toHaveCount(0);
  });

  test("envoie une photo après un aperçu et confirme la mise à jour", async ({ page }) => {
    await mockProfil(page);
    const requests = await mockPhoto(page);
    await page.goto("/espace/profil");

    // Le bouton « Changer la photo » ouvre le sélecteur de fichiers
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Changer la photo" }).click();
    await (await chooser).setFiles({ name: "moi.png", mimeType: "image/png", buffer: PNG });

    // Aperçu local avant l'envoi : rien n'est encore envoyé
    await expect(avatarPage(page)).toHaveAttribute("src", /^blob:/);
    expect(requests).toHaveLength(0);

    await page.getByRole("button", { name: "Enregistrer la photo" }).click();

    await expect(toast(page, "Photo de profil mise à jour.")).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe("POST");
    expect(requests[0].authorization).toBe(`Bearer ${ACCESS_TOKEN}`);
    // Fichier envoyé en multipart, champ « photo », converti en JPEG
    expect(requests[0].contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(requests[0].body).toContain('name="photo"; filename="photo.jpg"');
    expect(requests[0].body).toContain("Content-Type: image/jpeg");

    // La photo du serveur remplace les initiales, sur la page et dans l'en-tête
    const photoUrl = `http://localhost:8000${PHOTO_PATH}`;
    await expect(avatarPage(page)).toHaveAttribute("src", photoUrl);
    await expect(page.getByRole("button", { name: "Menu du compte" }).locator("img")).toHaveAttribute("src", photoUrl);
  });

  test("refuse un fichier qui n'est pas une image ou qui dépasse 2 Mo, sans appel à l'API", async ({ page }) => {
    await mockProfil(page);
    const requests = await mockPhoto(page);
    await page.goto("/espace/profil");

    await photoInput(page).setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
    await expect(page.getByText("Choisissez une image JPEG, PNG ou WebP.")).toBeVisible();

    await photoInput(page).setInputFiles({ name: "grande.png", mimeType: "image/png", buffer: Buffer.alloc(2 * 1024 * 1024 + 1) });
    await expect(page.getByText("L'image ne doit pas dépasser 2 Mo.")).toBeVisible();

    await expect(page.getByRole("button", { name: "Enregistrer la photo" })).toHaveCount(0);
    expect(requests).toHaveLength(0);
  });

  test("« Annuler » abandonne la nouvelle photo", async ({ page }) => {
    await mockProfil(page);
    const requests = await mockPhoto(page);
    await page.goto("/espace/profil");

    await photoInput(page).setInputFiles({ name: "moi.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByRole("button", { name: "Enregistrer la photo" })).toBeVisible();
    await page.getByRole("button", { name: "Annuler" }).first().click();

    await expect(avatarPage(page)).toHaveText("FR");
    expect(requests).toHaveLength(0);
  });

  test("supprime la photo et revient aux initiales", async ({ page }) => {
    const avecPhoto = { ...PROFIL_DTO, photo_url: PHOTO_PATH };
    await mockProfil(page, { get: { status: 200, body: avecPhoto } });
    const requests = await mockPhoto(page);
    await page.goto("/espace/profil");

    await expect(avatarPage(page)).toHaveAttribute("src", `http://localhost:8000${PHOTO_PATH}`);
    await page.getByRole("button", { name: "Supprimer la photo" }).click();

    await expect(toast(page, "Photo de profil supprimée.")).toBeVisible();
    expect(requests.map((r) => r.method)).toEqual(["DELETE"]);
    await expect(avatarPage(page)).toHaveText("FR");
  });

  test("signale une photo refusée par le serveur", async ({ page }) => {
    await mockProfil(page);
    await mockPhoto(page, { status: 413, detail: "Payload too large" });
    await page.goto("/espace/profil");

    await photoInput(page).setInputFiles({ name: "moi.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("button", { name: "Enregistrer la photo" }).click();

    await expect(page.getByText("L'image est trop lourde pour le serveur.")).toBeVisible();
    await expect(toast(page, "Photo de profil mise à jour.")).toHaveCount(0);
  });

  test("un JWT refusé par le serveur renvoie vers la connexion", async ({ page }) => {
    await mockProfil(page, { get: { status: 401, body: { detail: "Not authenticated" } } });
    await page.goto("/espace/profil");

    await expect(page).toHaveURL(/\/login/);
  });
});
