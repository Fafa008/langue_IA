import { fireEvent, render, screen, within } from "@testing-library/react";
import TestInterrompu, { minutesRestantes } from "@/components/pedagogie/testDiagnostic/TestInterrompu";
import type { TestInterrompu as TestInterrompuType } from "@/types/test-diagnostic";

const MINUTE = 60_000;

const test: TestInterrompuType = {
  idSession: "42",
  langue: "en",
  debut: Date.now() - 6 * MINUTE,
  totalQuestions: 12,
  reponses: [
    { idQuestion: "1", niveau: "A1", competence: "grammaire", typeReponse: "choix" },
    { idQuestion: "2", niveau: "A1", competence: "grammaire", typeReponse: "choix" },
    { idQuestion: "3", niveau: "A1", competence: "lecture", typeReponse: "choix" },
  ],
  session: null,
};

describe("TestInterrompu", () => {
  it("identifie le test interrompu : langue, réponses enregistrées et temps restant", () => {
    render(<TestInterrompu test={test} onReprendre={jest.fn()} onAbandonner={jest.fn()} />);

    const carte = screen.getByTestId("test-interrompu");
    expect(within(carte).getByRole("heading", { name: "Test interrompu" })).toBeInTheDocument();
    expect(carte).toHaveTextContent("Votre test d'anglais commencé le");
    expect(screen.getByTestId("test-interrompu-detail")).toHaveTextContent("3 réponses enregistrées sur 12 : elles sont conservées.");
    expect(screen.getByTestId("test-interrompu-detail")).toHaveTextContent("Il vous reste environ 9 min pour terminer.");
  });

  it("accorde le français et signale un temps écoulé", () => {
    render(
      <TestInterrompu
        test={{ ...test, langue: "fr", debut: Date.now() - 20 * MINUTE, reponses: test.reponses.slice(0, 1) }}
        onReprendre={jest.fn()}
        onAbandonner={jest.fn()}
      />,
    );

    expect(screen.getByTestId("test-interrompu")).toHaveTextContent("Votre test de français");
    expect(screen.getByTestId("test-interrompu-detail")).toHaveTextContent("1 réponse enregistrée sur 12");
    expect(screen.getByTestId("test-interrompu-detail")).toHaveTextContent("Le temps est écoulé");
  });

  it("reprend le test", () => {
    const onReprendre = jest.fn();
    render(<TestInterrompu test={test} onReprendre={onReprendre} onAbandonner={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Reprendre le test" }));
    expect(onReprendre).toHaveBeenCalled();
  });

  it("demande confirmation avant d'abandonner le test pour en commencer un nouveau", () => {
    const onAbandonner = jest.fn();
    render(<TestInterrompu test={test} onReprendre={jest.fn()} onAbandonner={onAbandonner} />);

    fireEvent.click(screen.getByRole("button", { name: "Commencer un nouveau test" }));
    const dialogue = screen.getByRole("dialog", { name: "Commencer un nouveau test ?" });
    expect(dialogue).toHaveTextContent("ses réponses ne seront pas prises en compte");

    fireEvent.click(within(dialogue).getByRole("button", { name: "Annuler" }));
    expect(onAbandonner).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Commencer un nouveau test" }));
    fireEvent.click(screen.getByRole("button", { name: "Abandonner et recommencer" }));
    expect(onAbandonner).toHaveBeenCalled();
  });

  it("bloque les actions pendant la reprise et affiche l'erreur", () => {
    render(
      <TestInterrompu test={test} onReprendre={jest.fn()} onAbandonner={jest.fn()} repriseEnCours erreur="Le service est indisponible." />,
    );

    expect(screen.getByRole("button", { name: "Calcul de votre résultat…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Commencer un nouveau test" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Le service est indisponible.");
  });

  it("calcule les minutes restantes sur les 15 minutes du test", () => {
    expect(minutesRestantes(0, 0)).toBe(15);
    expect(minutesRestantes(0, 14 * MINUTE + 1)).toBe(1);
    expect(minutesRestantes(0, 15 * MINUTE)).toBe(0);
  });
});
