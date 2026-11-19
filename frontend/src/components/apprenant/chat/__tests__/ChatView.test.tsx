import { fireEvent, screen, within } from "@testing-library/react";
import ChatView from "@/components/apprenant/chat/ChatView";
import { mockFetch } from "@/test/fetch-mock";
import { afficher } from "@/test/rendu-avec-query";

// US73-FE : choix du scénario et de la langue, libellé de contexte, aucun appel hors démo simulée.
// Lu à la demande (et non à l'import) : le service du parcours lit ce drapeau au chargement de son module.
jest.mock("@/mocks/delay", () => ({ delay: () => Promise.resolve() }));
jest.mock("@/lib/env", () => ({
  API_MOCK: false,
  API_URL: "http://localhost:8000",
  get PARCOURS_MOCK() {
    return (globalThis as { __parcoursSimule?: boolean }).__parcoursSimule !== false;
  },
}));

afterEach(() => {
  delete (globalThis as { __parcoursSimule?: boolean }).__parcoursSimule;
  jest.restoreAllMocks();
});

describe("US73-FE — page du chat : scénario et langue", () => {
  it("affiche le contexte par défaut et le met à jour au choix du scénario", () => {
    afficher(<ChatView />);
    expect(screen.getByTestId("contexte-chat")).toHaveTextContent("Contexte : Se présenter · Français");

    fireEvent.change(screen.getByRole("combobox", { name: /Scénario/ }), { target: { value: "restaurant" } });
    expect(screen.getByTestId("contexte-chat")).toHaveTextContent("Contexte : Commander au restaurant · Français");
  });

  it("met à jour le contexte au choix de la langue", () => {
    afficher(<ChatView />);
    fireEvent.change(screen.getByRole("combobox", { name: /Langue/ }), { target: { value: "en" } });
    expect(screen.getByTestId("contexte-chat")).toHaveTextContent("Contexte : Se présenter · Anglais");
  });

  it("remet la conversation à zéro quand le scénario change", () => {
    afficher(<ChatView />);
    expect(screen.getByText("Bonjour ! Comment vous appelez-vous ?")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: /Scénario/ }), { target: { value: "gare" } });
    expect(screen.queryByText("Bonjour ! Comment vous appelez-vous ?")).not.toBeInTheDocument();
    expect(screen.getByText("Bonjour, je peux vous aider à trouver votre chemin.")).toBeInTheDocument();
  });

  it("hors démo simulée : aucune conversation, aucun appel réseau", () => {
    (globalThis as { __parcoursSimule?: boolean }).__parcoursSimule = false;
    const fetchMock = mockFetch({ body: {} });
    afficher(<ChatView />);
    expect(screen.getByRole("status")).toHaveTextContent("Le chat avec le professeur IA sera disponible prochainement.");
    expect(screen.queryByRole("log")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("en démo simulée, la conversation est proposée sans bouton d'évaluation", () => {
    afficher(<ChatView />);
    const conversation = screen.getByRole("region", { name: "Conversation" });
    expect(within(conversation).getByRole("log")).toBeInTheDocument();
    expect(within(conversation).queryByRole("button", { name: /Terminer et évaluer/ })).not.toBeInTheDocument();
  });
});
