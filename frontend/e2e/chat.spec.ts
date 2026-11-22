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

async function intercepterChatbot(page: Page, requetes: CorpsChatbot[]) {
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
}

test.describe("Chat apprenant — envoi réel et corrections en marge", () => {
  test("envoie le message au backend et affiche la correction sans couper la conversation", async ({ page }) => {
    const requetes: CorpsChatbot[] = [];
    await loginAs(page, APPRENANT);
    await intercepterChatbot(page, requetes);
    await page.goto("/espace/apprenant/chat");

    await expect(page.getByTestId("avertissement-chat-rg11")).toContainText("aucune donnée personnelle");
    await page.getByPlaceholder("Écrivez ou dictez votre réponse…").fill("hier j'ai allé au cinéma");
    await page.getByRole("button", { name: "Envoyer" }).click();

    await expect(page.getByTestId("corrections-marge")).toContainText("j'ai allé");
    await expect(page.getByTestId("corrections-marge")).toContainText("je suis allé");
    await expect(page.getByRole("log")).toContainText("Très bien ! Et après, qu'avez-vous fait ?");
    await expect(page.getByPlaceholder("Écrivez ou dictez votre réponse…")).toBeEnabled();

    expect(requetes).toHaveLength(1);
    expect(requetes[0].message).toBe("hier j'ai allé au cinéma");
    expect(requetes[0].identifiant_session).toBeTruthy();
    expect(requetes[0].historique.length).toBeGreaterThan(0);
    expect(requetes[0].historique.length).toBeLessThanOrEqual(20);
  });
});
