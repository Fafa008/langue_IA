import { expect, test, type Page, type Route } from "@playwright/test";
import { handlePreflight, json, loginAs, type UtilisateurDto } from "./support/session";

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

type TourHistorique = { role: string; contenu: string };
type CorpsChatbot = { message: string; identifiant_session: string; historique: TourHistorique[] };
type CorpsTraduction = { identifiant_session: string; id_message: string; message: string };
type CorpsExercice = { identifiant_session: string; type_erreur: string; erreur: string };

/** Toutes les requêtes chat : le frontend n'appelle que le backend, jamais le service IA. */
type RequetesChat = {
  message: CorpsChatbot[];
  correction: CorpsChatbot[];
  traduction: CorpsTraduction[];
  exercice: CorpsExercice[];
  sessionsFermees: string[];
};

const nouvelleCapture = (): RequetesChat => ({ message: [], correction: [], traduction: [], exercice: [], sessionsFermees: [] });

/** La langue du chat vient du parcours : le test doit donc simuler GET /parcours/en-cours. */
const PARCOURS_DTO = {
  id_parcours: 4,
  statut: "EN_COURS",
  date_creation: "2026-10-02T09:30:00Z",
  code_langue: "en",
  libelle_langue: "Anglais",
  cadre: "CECRL",
  niveaux_cadre: ["A1", "A2", "B1", "B2", "C1", "C2"],
  niveau_depart: "A1",
  niveau_vise: "A2",
  lecon_atteinte: 15,
  phase: "ACTIVE",
  est_lecon_de_revision: false,
  modules: [],
};

const REPONSE_TUTEUR = "Très bien ! Et après, qu'avez-vous fait ?";
const CORRECTION_DETAIL = "« Aller » se conjugue avec l'auxiliaire être au passé composé.";
const TRADUCTION_DETAIL = "« Et après » sert à demander la suite d'un récit.";

async function intercepterParcours(page: Page, statut = 200, corps: unknown = PARCOURS_DTO) {
  await page.route("**/api/v1/parcours/en-cours", async (route: Route) => {
    if (await handlePreflight(route)) return;
    await json(route, statut, corps);
  });
}

/**
 * US-IA-CHAT-05 : trois tâches LLM distinctes. Les champs groupés de `/chatbot/message` restent volontairement
 * « périmés » dans la réponse simulée : s'ils s'affichent, le test échoue et la bascule n'est pas effective.
 */
async function intercepterChatbot(page: Page, requetes: RequetesChat, secondairesEnEchec = false) {
  await page.route("**/api/v1/chatbot/message", async (route: Route) => {
    if (await handlePreflight(route)) return;
    const corps = route.request().postDataJSON() as CorpsChatbot;
    requetes.message.push(corps);
    await json(route, 200, {
      reponse: REPONSE_TUTEUR,
      corrections: [{ extrait: "ANCIEN extrait groupé", correction: "ANCIENNE correction groupée", explication: "ANCIENNE explication groupée" }],
      traduction: "ANCIENNE traduction groupée",
      explication: "ANCIENNE explication groupée",
      quota_restant: 19,
      version_prompt: "chatbot/conversation@1.2.0",
    });
  });
  await page.route("**/api/v1/chatbot/correction", async (route: Route) => {
    if (await handlePreflight(route)) return;
    requetes.correction.push(route.request().postDataJSON() as CorpsChatbot);
    if (secondairesEnEchec) return json(route, 503, { detail: "Correcteur indisponible" });
    await json(route, 200, {
      corrections: [{ type: "grammaire", extrait: "j'ai allé", correction: "je suis allé", explication: CORRECTION_DETAIL }],
      version_prompt: "chatbot/correction@1.0.0",
    });
  });
  await page.route("**/api/v1/chatbot/traduction", async (route: Route) => {
    if (await handlePreflight(route)) return;
    requetes.traduction.push(route.request().postDataJSON() as CorpsTraduction);
    if (secondairesEnEchec) return json(route, 503, { detail: "Traducteur indisponible" });
    const corps = requetes.traduction[requetes.traduction.length - 1];
    await json(route, 200, {
      id_message: corps.id_message,
      traduction: "Très bien ! Et ensuite, qu'as-tu fait ?",
      explication: TRADUCTION_DETAIL,
      version_prompt: "chatbot/traduction@1.0.0",
    });
  });
  await page.route("**/api/v1/chatbot/exercice", async (route: Route) => {
    if (await handlePreflight(route)) return;
    requetes.exercice.push(route.request().postDataJSON() as CorpsExercice);
    await json(route, 200, {
      id_exercice: 42,
      enonce: "Hier, je ___ au cinéma.",
      consigne: "Choisissez le passé composé.",
      descripteur_id: "cecrl-a1-grammaire-1",
      niveau: "A1",
    });
  });
  await page.route("**/api/v1/chatbot/session/*", async (route: Route) => {
    if (await handlePreflight(route)) return;
    requetes.sessionsFermees.push(route.request().url().split("/session/")[1] ?? "");
    await json(route, 200, { supprime: true });
  });
}

test.describe("Chat apprenant — routes séparées US-IA-CHAT-05", () => {
  test("affiche l'historique, le fil et les corrections sans chevauchement", async ({ page }, testInfo) => {
    await loginAs(page, APPRENANT);
    await intercepterParcours(page);
    await page.goto("/espace/apprenant/chat");

    const main = await page.locator("main").boundingBox();
    const historique = await page.getByRole("complementary", { name: "History" }).boundingBox();
    const fil = await page.getByRole("log").boundingBox();
    const corrections = await page.getByTestId("corrections-marge").boundingBox();
    expect(main).not.toBeNull();
    expect(historique).not.toBeNull();
    expect(fil).not.toBeNull();
    expect(corrections).not.toBeNull();
    await expect(page.getByRole("region", { name: "Conversation" })).toBeVisible();

    expect(historique!.x).toBeGreaterThanOrEqual(main!.x);
    expect(corrections!.x + corrections!.width).toBeLessThanOrEqual(main!.x + main!.width);
    if (testInfo.project.name === "desktop") {
      expect(historique!.x + historique!.width).toBeLessThanOrEqual(fil!.x);
      expect(fil!.x + fil!.width).toBeLessThanOrEqual(corrections!.x);
    } else {
      expect(historique!.y + historique!.height).toBeLessThanOrEqual(fil!.y);
      expect(fil!.y + fil!.height).toBeLessThanOrEqual(corrections!.y);
    }
  });

  test("affiche la correction et la traduction des routes dédiées, pas les champs groupés", async ({ page }) => {
    const requetes = nouvelleCapture();
    await loginAs(page, APPRENANT);
    await intercepterParcours(page);
    await intercepterChatbot(page, requetes);
    await page.goto("/espace/apprenant/chat");

    await expect(page.getByTestId("contexte-chat")).toContainText("English");
    await expect(page.getByRole("log")).toContainText("Hello! What is your name?");
    await expect(page.getByRole("log")).not.toContainText("Comment vous appelez-vous ?");
    await expect(page.getByTestId("avertissement-chat-rg11")).toContainText("personal details");
    await page.getByPlaceholder("Write or dictate your reply…").fill("hier j'ai allé au cinéma");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page.getByTestId("corrections-marge")).toContainText("j'ai allé");
    await expect(page.getByTestId("corrections-marge")).toContainText("je suis allé");
    await expect(page.getByTestId("corrections-marge")).toContainText(CORRECTION_DETAIL);
    await expect(page.getByRole("log")).toContainText(REPONSE_TUTEUR);
    const marge = page.getByTestId("traduction-explication");
    await expect(marge).toHaveAttribute("aria-label", "Traduction et explication en français");
    await expect(marge.getByTestId("traduction-chat")).toContainText("Très bien ! Et ensuite, qu'as-tu fait ?");
    await expect(marge.getByTestId("explication-chat")).toContainText(TRADUCTION_DETAIL);
    // Les champs groupés du relais historique ne doivent plus piloter l'affichage.
    await expect(page.locator("main")).not.toContainText("ANCIEN");
    await expect(page.getByTestId("quota-chat")).toContainText("Messages left in this session: 19");
    await expect(page.getByPlaceholder("Write or dictate your reply…")).toBeEnabled();

    expect(requetes.message).toHaveLength(1);
    expect(requetes.message[0].message).toBe("hier j'ai allé au cinéma");
    expect(requetes.message[0].historique.length).toBeGreaterThan(0);
    expect(requetes.message[0].historique.length).toBeLessThanOrEqual(20);
    expect(requetes.correction).toHaveLength(1);
    expect(requetes.correction[0].message).toBe(requetes.message[0].message);
    expect(requetes.correction[0].identifiant_session).toBe(requetes.message[0].identifiant_session);
    expect(requetes.traduction).toHaveLength(1);
    expect(requetes.traduction[0].id_message).toMatch(/^[0-9a-f-]{36}$/i);
    expect(requetes.traduction[0].message).toBe(REPONSE_TUTEUR);
    expect(requetes.traduction[0].identifiant_session).toBe(requetes.message[0].identifiant_session);
  });

  test("génère un exercice ciblé depuis la correction via la route backend dédiée", async ({ page }) => {
    const requetes = nouvelleCapture();
    await loginAs(page, APPRENANT);
    await intercepterParcours(page);
    await intercepterChatbot(page, requetes);
    await page.goto("/espace/apprenant/chat");

    await page.getByPlaceholder("Write or dictate your reply…").fill("hier j'ai allé au cinéma");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByTestId("corrections-marge")).toContainText("je suis allé");
    await page.getByTestId("exercice-cible").click();

    const resultat = page.getByTestId("exercice-cible-result");
    await expect(resultat).toContainText("A1");
    await expect(resultat).toContainText("Hier, je ___ au cinéma.");
    await expect(resultat).toContainText("cecrl-a1-grammaire-1");
    expect(requetes.exercice).toHaveLength(1);
    expect(requetes.exercice[0]).toEqual({
      identifiant_session: requetes.message[0].identifiant_session,
      type_erreur: "grammaire",
      erreur: "j'ai allé",
    });
  });

  test("correction et traduction indisponibles : la réponse du tuteur reste affichée", async ({ page }) => {
    const requetes = nouvelleCapture();
    await loginAs(page, APPRENANT);
    await intercepterParcours(page);
    await intercepterChatbot(page, requetes, true);
    await page.goto("/espace/apprenant/chat");

    await page.getByPlaceholder("Write or dictate your reply…").fill("bonjour");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page.getByRole("log")).toContainText(REPONSE_TUTEUR);
    await expect(page.getByTestId("traduction-explication")).toHaveCount(0);
    const corrections = page.getByTestId("corrections-marge");
    await expect(corrections).toBeVisible();
    await expect(corrections.getByRole("status").filter({ hasText: "could not be loaded" })).toBeVisible();
    expect(requetes.traduction).toHaveLength(1);
  });

  test("ferme la session, affiche une synthèse puis ouvre une nouvelle session", async ({ page }) => {
    const requetes = nouvelleCapture();
    await loginAs(page, APPRENANT);
    await intercepterParcours(page);
    await intercepterChatbot(page, requetes);
    await page.goto("/espace/apprenant/chat");

    await page.getByPlaceholder("Write or dictate your reply…").fill("bonjour");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByTestId("corrections-marge")).toBeVisible();

    await page.getByRole("button", { name: "Finish and view the report" }).click();
    const rapport = page.getByTestId("rapport-chat");
    await expect(rapport).toContainText("Indicative summary");
    await expect(rapport).toContainText("Your messages");
    await expect(rapport).toContainText("1");
    expect(requetes.sessionsFermees).toEqual([requetes.message[0].identifiant_session]);

    await rapport.getByRole("button", { name: /Start a new conversation/ }).click();
    await page.getByPlaceholder("Write or dictate your reply…").fill("encore bonjour");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(requetes.message).toHaveLength(2);
    expect(requetes.message[1].identifiant_session).not.toBe(requetes.message[0].identifiant_session);
  });

  test("sans parcours, affiche le détail du backend et propose le test de positionnement", async ({ page }) => {
    await loginAs(page, APPRENANT);
    await intercepterParcours(page, 404, { detail: "Aucun parcours en cours. Passez le test de positionnement." });
    await page.goto("/espace/apprenant/chat");

    const alerte = page.getByTestId("alerte-sans-parcours");
    await expect(alerte).toContainText("Aucun parcours en cours. Passez le test de positionnement.");
    await expect(alerte).not.toContainText("Ce contenu n'existe pas.");
    await expect(alerte.getByRole("link", { name: /test de positionnement/i })).toHaveAttribute(
      "href",
      "/espace/apprenant/test-diagnostic",
    );
  });
});
