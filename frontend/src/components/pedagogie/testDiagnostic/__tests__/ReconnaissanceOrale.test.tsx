import { act, fireEvent, render, screen } from "@testing-library/react";
import { useReconnaissanceVocale } from "@/hooks/useReconnaissanceVocale";
import ReconnaissanceOrale from "../ReconnaissanceOrale";

jest.mock("@/hooks/useReconnaissanceVocale", () => ({
  useReconnaissanceVocale: jest.fn(),
}));

const mockUseReconnaissance = jest.mocked(useReconnaissanceVocale);

function configurerReconnaissance(disponible = true) {
  let apresArret: ((texte: string) => void) | undefined;
  const demarrer = (callback?: (texte: string) => void) => {
    apresArret = callback;
  };
  mockUseReconnaissance.mockReturnValue({
    disponible,
    ecoute: false,
    transcription: "",
    setTranscription: jest.fn(),
    erreur: null,
    demarrer,
    arreter: jest.fn(),
  });
  return (texte: string) => apresArret?.(texte);
}

describe("ReconnaissanceOrale", () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("transmet la transcription après la durée minimale, sans produire d'audio", () => {
    jest.useFakeTimers();
    const reconnaitre = configurerReconnaissance();
    const onChange = jest.fn();
    render(<ReconnaissanceOrale langue="en" valeur="" dureeMinimale={2} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Commencer la réponse orale" }));
    act(() => jest.advanceTimersByTime(2_500));
    act(() => reconnaitre("I live in London."));

    expect(onChange).toHaveBeenLastCalledWith("I live in London.");
    expect(screen.getByText(/aucun enregistrement audio n'est conservé/i)).toBeInTheDocument();
  });

  it("n'accepte pas une transcription trop courte", () => {
    jest.useFakeTimers();
    const reconnaitre = configurerReconnaissance();
    const onChange = jest.fn();
    render(<ReconnaissanceOrale langue="fr" valeur="" dureeMinimale={2} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Commencer la réponse orale" }));
    act(() => jest.advanceTimersByTime(500));
    act(() => reconnaitre("Bonjour."));

    expect(onChange).toHaveBeenLastCalledWith("");
    expect(screen.getByRole("alert")).toHaveTextContent("Parlez au moins 2 secondes");
  });

  it("permet une saisie texte de repli quand le navigateur ne prend pas en charge la reconnaissance vocale", () => {
    configurerReconnaissance(false);
    const onChange = jest.fn();
    render(<ReconnaissanceOrale langue="zh" valeur="" dureeMinimale={2} onChange={onChange} />);

    expect(screen.getByRole("status")).toHaveTextContent("Vous pouvez saisir votre réponse");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Votre réponse" }), { target: { value: "你好" } });
    expect(onChange).toHaveBeenCalledWith("你好");
  });
});
