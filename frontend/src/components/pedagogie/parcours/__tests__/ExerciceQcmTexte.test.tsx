import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import LeconVue from "@/components/pedagogie/parcours/LeconVue";
import { choisirScenarioParcoursMock } from "@/mocks/parcours-personnalise.mock";
import { mockParcoursPersonnaliseService } from "@/services/parcours-personnalise.service";
import { afficher } from "@/test/rendu-avec-query";

// US43-FE : QCM et phrase à compléter. La bonne réponse n'est jamais montrée avant soumission, et aucun audio
// n'est enregistré dans ces exercices.
jest.mock("@/mocks/delay", () => ({ delay: () => Promise.resolve() }));
jest.mock("@/services/parcours-personnalise.service", () => {
  const actuel = jest.requireActual("@/services/parcours-personnalise.service");
  return { ...actuel, parcoursPersonnaliseService: actuel.mockParcoursPersonnaliseService };
});
jest.mock("next/navigation", () => ({ usePathname: () => "/espace/apprenant/parcours/lecons/23" }));
jest.mock("@/hooks/useSession", () => ({
  useSession: () => ({ ready: true, isAuthenticated: true, utilisateur: { prenom: "Rova", nom: "Rakoto", role: "APPRENANT" } }),
}));

beforeEach(() => {
  choisirScenarioParcoursMock("passif");
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});
afterEach(() => jest.restoreAllMocks());

describe("US43-FE — QCM", () => {
  it("n'affiche pas la bonne réponse avant soumission, puis envoie le choix et montre la correction", async () => {
    const corriger = jest.spyOn(mockParcoursPersonnaliseService, "corriger");
    afficher(<LeconVue numero={23} />);
    const exercice = await screen.findByRole("region", { name: "Comprendre un message" });

    expect(within(exercice).queryByText(/Bonne réponse/)).not.toBeInTheDocument();
    expect(within(exercice).queryByText(/Votre réponse/)).not.toBeInTheDocument();

    fireEvent.click(within(exercice).getByRole("radio", { name: "Au café" }));
    fireEvent.click(within(exercice).getByRole("button", { name: "Valider ma réponse" }));

    await waitFor(() => expect(corriger).toHaveBeenCalledWith(7, expect.any(Number), { format: "choix", reponse: "Au café" }));
    expect(await within(exercice).findByRole("region", { name: "Correction" })).toHaveTextContent("Bonne réponse : À la gare");
  });
});

describe("US43-FE — phrase à compléter", () => {
  it("n'affiche pas de réponse attendue avant soumission, puis envoie le texte saisi", async () => {
    const corriger = jest.spyOn(mockParcoursPersonnaliseService, "corriger");
    afficher(<LeconVue numero={23} />);
    const exercice = await screen.findByRole("region", { name: "Les salutations" });

    const saisie = within(exercice).getByRole("textbox", { name: "Votre réponse" });
    expect(saisie).toHaveValue("");
    expect(within(exercice).queryByText(/Bonne réponse|Réponse attendue/)).not.toBeInTheDocument();

    fireEvent.change(saisie, { target: { value: "Bonjour" } });
    fireEvent.click(within(exercice).getByRole("button", { name: "Valider ma réponse" }));

    await waitFor(() => expect(corriger).toHaveBeenCalledWith(7, expect.any(Number), { format: "texte", reponse: "Bonjour" }));
    expect(await within(exercice).findByRole("region", { name: "Correction" })).toBeInTheDocument();
  });
});

describe("US43-FE — sans audio", () => {
  it("n'offre aucun bouton d'enregistrement dans les exercices QCM et phrase à compléter", async () => {
    afficher(<LeconVue numero={23} />);
    for (const nom of ["Comprendre un message", "Les salutations"]) {
      const exercice = await screen.findByRole("region", { name: nom });
      expect(within(exercice).queryByRole("button", { name: /enregistr|micro/i })).not.toBeInTheDocument();
    }
  });
});
