import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import ExerciceConversation from "@/components/pedagogie/parcours/exercices/ExerciceConversation";
import { afficher } from "@/test/rendu-avec-query";

// US74-FE : corrections dans le panneau latéral, sans interrompre la conversation.
const drapeau = (globalThis as { __parcoursSimule?: boolean });
jest.mock("@/mocks/delay", () => ({ delay: () => Promise.resolve() }));
jest.mock("@/lib/env", () => ({
  API_MOCK: false,
  API_URL: "http://localhost:8000",
  get PARCOURS_MOCK() {
    return (globalThis as { __parcoursSimule?: boolean }).__parcoursSimule !== false;
  },
}));
jest.mock("@/services/parcours-personnalise.service", () => {
  const actuel = jest.requireActual("@/services/parcours-personnalise.service");
  return { ...actuel, parcoursPersonnaliseService: actuel.mockParcoursPersonnaliseService };
});

const contenu = {
  format: "conversation" as const,
  consigne: "Discutez.",
  sujet: "Le week-end",
  messageInitial: "Qu'avez-vous fait hier ?",
  echangesMinimum: 3,
};

function envoyer(texte: string) {
  fireEvent.change(screen.getByPlaceholderText(/Écrivez ou dictez/), { target: { value: texte } });
  fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
}

afterEach(() => {
  delete (globalThis as { __parcoursSimule?: boolean }).__parcoursSimule;
});

describe("US74-FE — corrections IA", () => {
  it("affiche la correction dans le panneau latéral, avec l'extrait, la forme correcte et la règle", async () => {
    afficher(<ExerciceConversation contenu={contenu} langue="fr" enCours={false} verrouille={false} onSoumettre={jest.fn()} />);
    envoyer("hier j'ai allé au cinéma");

    await screen.findByText("je suis allé(e)");
    await within(screen.getByRole("log")).findByText(/^(Très bien|D'accord|Intéressant)/);
    const marge = await screen.findByTestId("corrections-marge");
    expect(within(marge).getByText("Corrections de l’IA")).toBeInTheDocument();
    expect(within(marge).getByText("j'ai allé")).toBeInTheDocument();
    expect(within(marge).getByText("je suis allé(e)")).toBeInTheDocument();
    expect(within(marge).getByText(/« Aller » se conjugue avec l'auxiliaire être/)).toBeInTheDocument();
  });

  it("n'interrompt pas la conversation : la réponse du professeur arrive et la saisie reste disponible", async () => {
    afficher(<ExerciceConversation contenu={contenu} langue="fr" enCours={false} verrouille={false} onSoumettre={jest.fn()} />);
    envoyer("hier j'ai allé au cinéma");
    await waitFor(() => expect(screen.getByRole("log").textContent).toMatch(/Très bien|D'accord|Intéressant/));
    expect(screen.getByPlaceholderText(/Écrivez ou dictez/)).toBeEnabled();
  });

  it("indique où les corrections apparaîtront quand le message est correct", async () => {
    afficher(<ExerciceConversation contenu={contenu} langue="fr" enCours={false} verrouille={false} onSoumettre={jest.fn()} />);
    envoyer("Hier, je suis allé au cinéma.");
    await within(screen.getByRole("log")).findByText(/^(Très bien|D'accord|Intéressant)/);
    expect(screen.getByTestId("corrections-marge")).toHaveTextContent(
      "Les corrections apparaîtront ici après votre premier message.",
    );
  });

  it("affiche les corrections renvoyées par le service même hors drapeau de démonstration", async () => {
    drapeau.__parcoursSimule = false;
    afficher(<ExerciceConversation contenu={contenu} langue="fr" enCours={false} verrouille={false} onSoumettre={jest.fn()} />);
    envoyer("hier j'ai allé au cinéma");
    await screen.findByText("je suis allé(e)");
    await within(screen.getByRole("log")).findByText(/^(Très bien|D'accord|Intéressant)/);
    expect(screen.getByTestId("corrections-marge")).toBeInTheDocument();
  });
});
