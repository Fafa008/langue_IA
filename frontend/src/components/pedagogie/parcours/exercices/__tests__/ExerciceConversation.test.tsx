import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import ExerciceConversation from "@/components/pedagogie/parcours/exercices/ExerciceConversation";
import { mockParcoursPersonnaliseService } from "@/services/parcours-personnalise.service";
import { mockFetch } from "@/test/fetch-mock";
import { afficher } from "@/test/rendu-avec-query";

// US72/US74-FE : chat avec le tuteur IA simulé, traduction et explication à côté de chaque réponse. Réemploi de ExerciceConversation (décision D2).
jest.mock("@/mocks/delay", () => ({ delay: () => Promise.resolve() }));
jest.mock("@/lib/env", () => ({ API_MOCK: false, API_URL: "http://localhost:8000", PARCOURS_MOCK: true }));
jest.mock("@/services/parcours-personnalise.service", () => {
  const actuel = jest.requireActual("@/services/parcours-personnalise.service");
  return { ...actuel, parcoursPersonnaliseService: actuel.mockParcoursPersonnaliseService };
});

const contenu = {
  format: "conversation" as const,
  consigne: "Discutez avec le tuteur IA.",
  sujet: "Se présenter",
  messageInitial: "Bonjour ! Comment vous appelez-vous ?",
  echangesMinimum: 3,
};

function rendre() {
  return afficher(
    <ExerciceConversation contenu={contenu} langue="fr" enCours={false} verrouille={false} onSoumettre={jest.fn()} />,
  );
}

describe("US72/US74-FE — chat avec le tuteur IA", () => {
  it("étiquette le tuteur comme simulé quand le parcours est simulé", () => {
    rendre();
    expect(screen.getByText(/tuteur IA simulé \(démonstration\)/)).toBeInTheDocument();
  });

  it("affiche le message d'accueil, puis la question et la réponse simulée", async () => {
    rendre();
    const journal = screen.getByRole("log", { name: "Conversation avec le tuteur IA" });
    expect(within(journal).getByText("Bonjour ! Comment vous appelez-vous ?")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Écrivez ou dictez/), { target: { value: "Je m'appelle Rova" } });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));

    expect(within(journal).getByText("Je m'appelle Rova")).toBeInTheDocument();
    await waitFor(() => expect(within(journal).getAllByText(/Très bien|D'accord|Intéressant/).length).toBeGreaterThan(0));
    expect(screen.getByText(/1\/3 échanges/)).toBeInTheDocument();
  });

  it("affiche la traduction et l'explication françaises hors du fil, dans un panneau à gauche", async () => {
    rendre();

    fireEvent.change(screen.getByPlaceholderText(/Écrivez ou dictez/), { target: { value: "Je m'appelle Rova" } });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));

    const panneau = await screen.findByTestId("traduction-explication");
    expect(panneau).toHaveAccessibleName("Traduction et explication en français");
    expect(within(panneau).getByTestId("traduction-chat")).toHaveTextContent(/Traduction française \(démonstration\)/);
    expect(within(panneau).getByTestId("explication-chat")).toHaveTextContent(/Explication \(démonstration\)/);
    expect(within(screen.getByRole("log", { name: "Conversation avec le tuteur IA" })).queryByTestId("traduction-explication")).toBeNull();
  });

  it("appelle le tuteur, la correction et la traduction via trois routes distinctes", async () => {
    const chatbot = jest.spyOn(mockParcoursPersonnaliseService, "chatbot");
    const correction = jest.spyOn(mockParcoursPersonnaliseService, "corrigerChatbot");
    const traduction = jest.spyOn(mockParcoursPersonnaliseService, "traduireChatbot");
    rendre();

    fireEvent.change(screen.getByPlaceholderText(/Écrivez ou dictez/), { target: { value: "Je m'appelle Rova" } });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));

    await screen.findByTestId("traduction-explication");
    expect(chatbot).toHaveBeenCalledTimes(1);
    expect(correction).toHaveBeenCalledTimes(1);
    expect(traduction).toHaveBeenCalledTimes(1);
    const idMessage = traduction.mock.calls[0][0];
    expect(idMessage).toMatch(/^[0-9a-f-]{36}$/i);
    expect(traduction.mock.calls[0][1]).toMatch(/^(Très bien|D'accord|Intéressant)/);
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
