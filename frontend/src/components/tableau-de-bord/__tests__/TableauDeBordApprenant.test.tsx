import { screen } from "@testing-library/react";
import TableauDeBordApprenant from "@/components/tableau-de-bord/TableauDeBordApprenant";
import { choisirScenarioParcoursMock, parcoursPersonnaliseMock } from "@/mocks/parcours-personnalise.mock";
import { afficher as afficherAvecClient } from "@/test/rendu-avec-query";
import TableauDeBord from "../TableauDeBord";

jest.mock("@/mocks/delay", () => ({ delay: () => Promise.resolve() }));
jest.mock("@/hooks/useSession", () => ({
  useSession: () => ({ utilisateur: { role: "APPRENANT", prenom: "Rova" } }),
}));
jest.mock("@/services/parcours-personnalise.service", () => {
  const actuel = jest.requireActual("@/services/parcours-personnalise.service");
  return { ...actuel, parcoursPersonnaliseService: actuel.mockParcoursPersonnaliseService };
});

const afficher = () => afficherAvecClient(<TableauDeBordApprenant prenom="Rova" />);
const afficherAccueil = () => afficherAvecClient(<TableauDeBord />);

beforeEach(() => choisirScenarioParcoursMock("passif"));

describe("Tableau de bord apprenant", () => {
  it("présente les accès rapides et le parcours en cours sans inventer de recommandations", async () => {
    afficher();

    expect(await screen.findByRole("heading", { name: "Bonjour, Rova !" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Accès rapide" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tuteur IA/ })).toHaveAttribute("href", "/espace/apprenant/chat");
    expect(await screen.findByText("Français · objectif B1")).toBeInTheDocument();
    expect(screen.getByText("Leçon 23")).toBeInTheDocument();
    expect(screen.getByText("Aucune recommandation enregistrée pour le moment.")).toBeInTheDocument();
    expect(screen.getByText("Réservation bientôt disponible")).toBeInTheDocument();
  });

  it("utilise la vue apprenant depuis le tableau de bord partagé", async () => {
    afficherAccueil();

    expect(await screen.findByRole("heading", { name: "Bonjour, Rova !" })).toBeInTheDocument();
    expect(await screen.findByText("Français · objectif B1")).toBeInTheDocument();
  });

  it("affiche une recommandation déjà enregistrée sans la recalculer", async () => {
    await parcoursPersonnaliseMock.recommandations(7);
    afficher();

    expect(await screen.findByText(/Refaire un exercice sur le passé composé/)).toBeInTheDocument();
  });

  it("invite à passer le test si aucun parcours n'existe", async () => {
    choisirScenarioParcoursMock("sans-parcours");
    afficher();

    expect(await screen.findByRole("link", { name: "Passer le test" })).toHaveAttribute(
      "href",
      "/espace/apprenant/test-diagnostic",
    );
    expect(screen.getByRole("link", { name: /Commencer par le test/ })).toBeInTheDocument();
  });

  it("propose de réessayer si le parcours ne peut pas être chargé", async () => {
    choisirScenarioParcoursMock("erreur-serveur");
    afficher();

    expect(await screen.findByRole("alert")).toHaveTextContent("Le chargement de votre parcours n'a pas abouti.");
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });
});
