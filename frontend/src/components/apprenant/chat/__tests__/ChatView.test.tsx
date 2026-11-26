import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import ChatView from "@/components/apprenant/chat/ChatView";
import { ApiError } from "@/lib/api-client";
import { mockFetch } from "@/test/fetch-mock";
import { afficher } from "@/test/rendu-avec-query";
import type { ParcoursPersonnalise } from "@/types/parcours-personnalise";

// US72/US73-FE : scénario, langue imposée par le parcours, avertissement RG11, chat réel hors démo simulée.
// Lu à la demande (et non à l'import) : le service du parcours lit ce drapeau au chargement de son module.
jest.mock("@/mocks/delay", () => ({ delay: () => Promise.resolve() }));
jest.mock("@/lib/env", () => ({
  API_MOCK: false,
  API_URL: "http://localhost:8000",
  get PARCOURS_MOCK() {
    return (globalThis as { __parcoursSimule?: boolean }).__parcoursSimule !== false;
  },
}));

const PARCOURS: ParcoursPersonnalise = {
  idParcours: 4,
  statut: "EN_COURS",
  dateCreation: "2026-10-02T09:30:00Z",
  langue: { code: "fr", libelle: "Français" },
  cadre: "CECRL",
  niveauxCadre: ["A1", "A2", "B1", "B2", "C1", "C2"],
  niveauDepart: "A1",
  niveauVise: "A2",
  leconAtteinte: 15,
  phase: "ACTIVE",
  estLeconDeRevision: false,
  modules: [],
  recommandation: null,
};

/** La page lit le parcours via React Query ; on pilote uniquement l'état qui l'intéresse. */
let etatParcours: { data?: ParcoursPersonnalise; isError: boolean; error?: unknown };
jest.mock("@/hooks/useParcoursPersonnalise", () => {
  const reel = jest.requireActual("@/hooks/useParcoursPersonnalise");
  return { ...reel, useParcoursPersonnalise: () => etatParcours };
});

function afficherChat(parcours: ParcoursPersonnalise = PARCOURS) {
  etatParcours = { data: parcours, isError: false };
  return afficher(<ChatView />);
}

beforeEach(() => {
  etatParcours = { data: PARCOURS, isError: false };
});

afterEach(() => {
  delete (globalThis as { __parcoursSimule?: boolean }).__parcoursSimule;
  jest.restoreAllMocks();
});

describe("US73/US74-FE — page du chat : scénario et langue du parcours", () => {
  it("présente l'agent comme le tuteur IA", () => {
    afficherChat();
    expect(screen.getByRole("heading", { level: 1, name: "Tuteur IA" })).toBeInTheDocument();
  });

  it("affiche le contexte par défaut et le met à jour au choix du scénario", () => {
    afficherChat();
    expect(screen.getByTestId("contexte-chat")).toHaveTextContent("Contexte : Se présenter · Français");

    fireEvent.change(screen.getByRole("combobox", { name: /Scénario/ }), { target: { value: "restaurant" } });
    expect(screen.getByTestId("contexte-chat")).toHaveTextContent("Contexte : Commander au restaurant · Français");
  });

  it("affiche la langue du parcours sans proposer de choix manuel", () => {
    afficherChat({ ...PARCOURS, langue: { code: "en", libelle: "Anglais" } });
    expect(screen.getByTestId("contexte-chat")).toHaveTextContent("Context: Introducing yourself · English");
    expect(screen.queryByRole("combobox", { name: /Langue|Language/ })).not.toBeInTheDocument();
    expect(screen.getByText("Hello! What is your name?")).toBeInTheDocument();
    expect(screen.queryByText("Bonjour ! Comment vous appelez-vous ?")).not.toBeInTheDocument();
  });

  it("parcours en anglais : scénarios, sous-titre et sujet ne restent pas en français", () => {
    afficherChat({ ...PARCOURS, langue: { code: "en", libelle: "Anglais" } });
    const options = within(screen.getByRole("combobox", { name: /Scenario/ }))
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(options).toEqual(["Introducing yourself", "Ordering at a restaurant", "Asking for directions"]);
    expect(screen.getByText("English · AI language tutor")).toBeInTheDocument();
    expect(screen.getByText(/Topic:/)).toHaveTextContent("Topic: Introducing yourself");
    expect(screen.queryByText(/Se présenter|Tuteur linguistique|Anglais/)).not.toBeInTheDocument();
  });

  it("remet la conversation à zéro quand le scénario change", () => {
    afficherChat();
    expect(screen.getByText("Bonjour ! Comment vous appelez-vous ?")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: /Scénario/ }), { target: { value: "gare" } });
    expect(screen.queryByText("Bonjour ! Comment vous appelez-vous ?")).not.toBeInTheDocument();
    expect(screen.getByText("Bonjour, je peux vous aider à trouver votre chemin.")).toBeInTheDocument();
  });

  it("hors démo simulée : la conversation réelle est proposée sans appel réseau à l'ouverture", () => {
    (globalThis as { __parcoursSimule?: boolean }).__parcoursSimule = false;
    const fetchMock = mockFetch({ body: {} });
    afficherChat();
    expect(screen.getByRole("log")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("affiche un avertissement factuel sur les données avant le premier message", () => {
    afficherChat();
    const avertissement = screen.getByTestId("avertissement-chat-rg11");
    expect(avertissement).toHaveTextContent("20 derniers tours");
    expect(avertissement).toHaveTextContent("aucune donnée personnelle");
    expect(avertissement).toHaveTextContent("aucun texte brut");
  });

  it("en démo simulée, la conversation est proposée sans bouton d'évaluation", () => {
    afficherChat();
    const conversation = screen.getByRole("region", { name: "Conversation" });
    expect(within(conversation).getByRole("log")).toBeInTheDocument();
    expect(within(conversation).queryByRole("button", { name: /Terminer et évaluer/ })).not.toBeInTheDocument();
  });

  it("garde les conversations précédentes en mémoire et permet de les consulter en lecture seule", async () => {
    afficherChat();
    fireEvent.change(screen.getByPlaceholderText(/Écrivez ou dictez/), { target: { value: "hier j'ai allé au cinéma" } });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));

    await screen.findByRole("button", { name: /hier j'ai allé au cinéma/ });
    await screen.findByText("je suis allé(e)");
    await waitFor(() => expect(screen.getByRole("log")).toHaveTextContent(/Très bien|D'accord|Intéressant/));

    fireEvent.click(screen.getByRole("button", { name: /Nouvelle conversation/ }));
    fireEvent.click(screen.getByRole("button", { name: /hier j'ai allé au cinéma/ }));

    expect(within(screen.getByRole("log")).getByText("hier j'ai allé au cinéma")).toBeInTheDocument();
    expect(within(screen.getByTestId("corrections-marge")).getByText("je suis allé(e)")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Écrivez ou dictez/)).not.toBeInTheDocument();
  });

  it("sans parcours, affiche le détail du backend et un accès au test de positionnement", () => {
    etatParcours = {
      isError: true,
      error: new ApiError(404, "Not Found", "Aucun parcours en cours. Passez le test de positionnement."),
    };
    afficher(<ChatView />);

    const alerte = screen.getByRole("alert");
    expect(alerte).toHaveTextContent("Aucun parcours en cours. Passez le test de positionnement.");
    expect(alerte).not.toHaveTextContent("Ce contenu n'existe pas.");
    expect(within(alerte).getByRole("link", { name: /test de positionnement/i })).toHaveAttribute(
      "href",
      "/espace/apprenant/test-diagnostic",
    );
  });
});
