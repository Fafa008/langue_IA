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

async function intercepterParcours(page: Page, statut = 200, corps: unknown = PARCOURS_DTO) {
  await page.route("**/api/v1/parcours/en-cours", async (route: Route) => {
    if (await handlePreflight(route)) return;
    await json(route, statut, corps);
  });
}

async function intercepterChatbot(page: Page, requetes: CorpsChatbot[], sessionsFermees: string[] = []) {
  await page.route("**/api/v1/chatbot/message", async (route: Route) => {
    if (await handlePreflight(route)) return;
    const corps = route.request().postDataJSON() as CorpsChatbot;
    requetes.push(corps);
    await json(route, 200, {
      reponse: "Très bien ! Et après, qu'avez-vous fait ?",
      corrections: [
        {
          extrait: "j'ai allé",
          correction: "je suis allé",
          explication: "« Aller » se conjugue avec l'auxiliaire être au passé composé.",
        },
      ],
      quota_restant: 19,
      version_prompt: "chatbot/conversation@1.1.0",
    });
  });
  await page.route("**/api/v1/chatbot/session/*", async (route: Route) => {
    if (await handlePreflight(route)) return;
    sessionsFermees.push(route.request().url().split("/session/")[1] ?? "");
    await json(route, 200, { supprime: true });
  });
}

test.describe("Chat apprenant — envoi réel et corrections en marge", () => {
  test("envoie le message au backend et affiche la correction sans couper la conversation", async ({ page }) => {
    const requetes: CorpsChatbot[] = [];
    await loginAs(page, APPRENANT);
    await intercepterParcours(page);
    await intercepterChatbot(page, requetes);
    await page.goto("/espace/apprenant/chat");

    await expect(page.getByTestId("contexte-chat")).toContainText("Anglais");
    await expect(page.getByTestId("avertissement-chat-rg11")).toContainText("aucune donnée personnelle");
    await page.getByPlaceholder("Écrivez ou dictez votre réponse…").fill("hier j'ai allé au cinéma");
    await page.getByRole("button", { name: "Envoyer" }).click();

    await expect(page.getByTestId("corrections-marge")).toContainText("j'ai allé");
    await expect(page.getByTestId("corrections-marge")).toContainText("je suis allé");
    await expect(page.getByRole("log")).toContainText("Très bien ! Et après, qu'avez-vous fait ?");
    await expect(page.getByTestId("quota-chat")).toContainText("Messages restants dans cette session : 19");
    await expect(page.getByPlaceholder("Écrivez ou dictez votre réponse…")).toBeEnabled();

    expect(requetes).toHaveLength(1);
    expect(requetes[0].message).toBe("hier j'ai allé au cinéma");
    expect(requetes[0].identifiant_session).toBeTruthy();
    expect(requetes[0].historique.length).toBeGreaterThan(0);
    expect(requetes[0].historique.length).toBeLessThanOrEqual(20);
  });

  test("ferme la session, affiche une synthèse puis ouvre une nouvelle session", async ({ page }) => {
    const requetes: CorpsChatbot[] = [];
    const sessionsFermees: string[] = [];
    await loginAs(page, APPRENANT);
    await intercepterParcours(page);
    await intercepterChatbot(page, requetes, sessionsFermees);
    await page.goto("/espace/apprenant/chat");

    await page.getByPlaceholder("Écrivez ou dictez votre réponse…").fill("bonjour");
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(page.getByTestId("corrections-marge")).toBeVisible();

    await page.getByRole("button", { name: "Terminer et voir le rapport" }).click();
    const rapport = page.getByTestId("rapport-chat");
    await expect(rapport).toContainText("Synthèse indicative");
    await expect(rapport).toContainText("Vos messages");
    await expect(rapport).toContainText("1");
    expect(sessionsFermees).toEqual([requetes[0].identifiant_session]);

    await rapport.getByRole("button", { name: /Recommencer une conversation/ }).click();
    await page.getByPlaceholder("Écrivez ou dictez votre réponse…").fill("encore bonjour");
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(requetes).toHaveLength(2);
    expect(requetes[1].identifiant_session).not.toBe(requetes[0].identifiant_session);
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
