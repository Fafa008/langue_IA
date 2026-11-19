import { screen } from "@testing-library/react";
import MonParcours from "@/components/pedagogie/parcours/MonParcours";
import { choisirScenarioParcoursMock } from "@/mocks/parcours-personnalise.mock";
import { afficher as afficherAvecClient } from "@/test/rendu-avec-query";

// US41-FE : états de l'écran « Mon parcours » et règles d'accessibilité de base.
jest.mock("@/mocks/delay", () => ({ delay: () => Promise.resolve() }));
jest.mock("@/services/parcours-personnalise.service", () => {
  const actuel = jest.requireActual("@/services/parcours-personnalise.service");
  return { ...actuel, parcoursPersonnaliseService: actuel.mockParcoursPersonnaliseService };
});
jest.mock("@/hooks/useSession", () => ({
  useSession: () => ({ ready: true, isAuthenticated: true, utilisateur: { prenom: "Rova" } }),
}));

const afficher = () => afficherAvecClient(<MonParcours />);

beforeEach(() => choisirScenarioParcoursMock("passif"));

describe("Mon parcours — états", () => {
  it("affiche un chargement tant que le parcours n'est pas reçu", () => {
    afficher();
    expect(screen.getByText("Chargement de votre parcours…")).toBeInTheDocument();
  });

  it("garde le message « aucun parcours » du contrat sur 404 (décision validée)", async () => {
    choisirScenarioParcoursMock("sans-parcours");
    afficher();
    expect(await screen.findByText(/Votre parcours personnalisé est construit à partir du test de positionnement/)).toBeInTheDocument();
    expect(screen.queryByText(/sera disponible prochainement/)).not.toBeInTheDocument();
  });

  it("affiche l'erreur sans backend, avec une action de reprise", async () => {
    choisirScenarioParcoursMock("exercices-indisponibles");
    afficher();
    expect(await screen.findByRole("heading", { level: 1, name: /Bonjour, Rova/ })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});

describe("Mon parcours — accessibilité de base", () => {
  it("a un seul titre de niveau 1 et des sections nommées", async () => {
    afficher();
    await screen.findByRole("heading", { level: 1, name: "Bonjour, Rova !" });
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Mes modules" })).toBeInTheDocument();
  });
});
