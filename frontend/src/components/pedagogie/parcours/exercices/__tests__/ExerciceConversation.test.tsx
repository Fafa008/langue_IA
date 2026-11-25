import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
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

type EvenementReconnaissance = {
  results: {
    length: number;
    [index: number]: { length: number; [index: number]: { transcript: string } };
  };
};

function installerReconnaissanceVocale() {
  let reconnaissance: {
    onresult: ((evenement: EvenementReconnaissance) => void) | null;
    onerror: ((evenement: { error: string }) => void) | null;
    onend: (() => void) | null;
  } | null = null;

  class ReconnaissanceFactice {
    onresult: ((evenement: EvenementReconnaissance) => void) | null = null;
    onerror: ((evenement: { error: string }) => void) | null = null;
    onend: (() => void) | null = null;
    start = jest.fn();
    stop = jest.fn();
    abort = jest.fn();

    constructor() {
      reconnaissance = this;
    }
  }

  Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: ReconnaissanceFactice });
  return { reconnaissance: () => reconnaissance };
}

function installerSyntheseVocale() {
  class EnonceFactice {
    lang = "";
    rate = 1;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(readonly text: string) {}
  }
  const parler = jest.fn((_enonce: EnonceFactice) => undefined);
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: { cancel: jest.fn(), speak: parler },
  });
  Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: EnonceFactice });
  return { parler };
}

function rendre(modeVocalParTours = false) {
  return afficher(
    <ExerciceConversation
      contenu={contenu}
      langue="fr"
      enCours={false}
      verrouille={false}
      modeVocalParTours={modeVocalParTours}
      onSoumettre={jest.fn()}
    />,
  );
}

describe("US72/US74-FE — chat avec le tuteur IA", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "SpeechRecognition");
    Reflect.deleteProperty(window, "speechSynthesis");
    Reflect.deleteProperty(window, "SpeechSynthesisUtterance");
  });

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

  it("affiche une icône micro compacte et envoie la transcription avant de lire la réponse", async () => {
    const reconnaissance = installerReconnaissanceVocale();
    const synthese = installerSyntheseVocale();
    const chatbot = jest.spyOn(mockParcoursPersonnaliseService, "chatbot");
    chatbot.mockClear();
    rendre(true);

    const boutonMicro = await screen.findByRole("button", { name: "Parler" });
    expect(boutonMicro.textContent).toBe("");
    expect(boutonMicro.querySelector("svg")).not.toBeNull();
    fireEvent.click(boutonMicro);

    act(() => {
      reconnaissance.reconnaissance()?.onresult?.({
        results: { length: 1, 0: { length: 1, 0: { transcript: "Je m'appelle Rova" } } },
      });
      reconnaissance.reconnaissance()?.onend?.();
    });

    await waitFor(() => expect(chatbot).toHaveBeenCalledWith("Je m'appelle Rova", expect.any(Array)));
    await waitFor(() => expect(synthese.parler).toHaveBeenCalledWith(expect.objectContaining({ text: expect.any(String) })));
  });

  it("conserve la dictée manuelle dans les exercices de conversation", async () => {
    const reconnaissance = installerReconnaissanceVocale();
    const chatbot = jest.spyOn(mockParcoursPersonnaliseService, "chatbot");
    chatbot.mockClear();
    rendre();

    const boutonDictee = await screen.findByRole("button", { name: "Dicter" });
    expect(boutonDictee.textContent).toContain("Dicter");
    fireEvent.click(boutonDictee);

    act(() => {
      reconnaissance.reconnaissance()?.onresult?.({
        results: { length: 1, 0: { length: 1, 0: { transcript: "Bonjour" } } },
      });
      reconnaissance.reconnaissance()?.onend?.();
    });

    expect(screen.getByPlaceholderText(/Écrivez ou dictez/)).toHaveValue("Bonjour");
    expect(chatbot).not.toHaveBeenCalled();
  });

  it("n'envoie pas de message si la reconnaissance vocale échoue", async () => {
    const reconnaissance = installerReconnaissanceVocale();
    const chatbot = jest.spyOn(mockParcoursPersonnaliseService, "chatbot");
    chatbot.mockClear();
    rendre(true);

    fireEvent.click(await screen.findByRole("button", { name: "Parler" }));

    act(() => {
      reconnaissance.reconnaissance()?.onerror?.({ error: "network" });
      reconnaissance.reconnaissance()?.onend?.();
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("La reconnaissance vocale a besoin d'une connexion internet.");
    expect(chatbot).not.toHaveBeenCalled();
  });
});
