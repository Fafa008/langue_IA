import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import ExerciceConversation from "@/components/pedagogie/parcours/exercices/ExerciceConversation";
import { mockParcoursPersonnaliseService } from "@/services/parcours-personnalise.service";
import { mockFetch } from "@/test/fetch-mock";
import { afficher } from "@/test/rendu-avec-query";

// US72-FE : chat avec le professeur IA simulé. Réemploi de ExerciceConversation (décision D2).
jest.mock("@/mocks/delay", () => ({ delay: () => Promise.resolve() }));
jest.mock("@/lib/env", () => ({ API_MOCK: false, API_URL: "http://localhost:8000", PARCOURS_MOCK: true }));
jest.mock("@/services/parcours-personnalise.service", () => {
  const actuel = jest.requireActual("@/services/parcours-personnalise.service");
  return { ...actuel, parcoursPersonnaliseService: actuel.mockParcoursPersonnaliseService };
});

const contenu = {
  format: "conversation" as const,
  consigne: "Discutez avec le professeur IA.",
  sujet: "Se présenter",
  messageInitial: "Bonjour ! Comment vous appelez-vous ?",
  echangesMinimum: 3,
};

function rendre() {
  return afficher(
    <ExerciceConversation contenu={contenu} langue="fr" enCours={false} verrouille={false} onSoumettre={jest.fn()} />,
  );
}

describe("US72-FE — chat avec le professeur IA", () => {
  it("étiquette le professeur comme simulé quand le parcours est simulé", () => {
    rendre();
    expect(screen.getByText(/professeur IA simulé \(démonstration\)/)).toBeInTheDocument();
  });

  it("affiche le message d'accueil, puis la question et la réponse simulée", async () => {
    rendre();
    const journal = screen.getByRole("log", { name: "Conversation avec le professeur IA" });
    expect(within(journal).getByText("Bonjour ! Comment vous appelez-vous ?")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Écrivez ou dictez/), { target: { value: "Je m'appelle Rova" } });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));

    expect(within(journal).getByText("Je m'appelle Rova")).toBeInTheDocument();
    await waitFor(() => expect(within(journal).getAllByText(/Très bien|D'accord|Intéressant/).length).toBeGreaterThan(0));
    expect(screen.getByText(/1\/3 échanges/)).toBeInTheDocument();
  });

  it("n'envoie rien hors du navigateur : aucun appel réseau pendant l'échange", async () => {
    const fetchMock = mockFetch({ body: {} });
    const chatbot = jest.spyOn(mockParcoursPersonnaliseService, "chatbot");
    rendre();
    fireEvent.change(screen.getByPlaceholderText(/Écrivez ou dictez/), { target: { value: "Bonjour" } });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    await waitFor(() => expect(chatbot).toHaveBeenCalled());
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
