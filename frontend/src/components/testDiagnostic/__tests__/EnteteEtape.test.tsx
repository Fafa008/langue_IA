import { fireEvent, render, screen } from "@testing-library/react";
import EnteteEtape from "@/components/testDiagnostic/EnteteEtape";

const props = {
  etape: "expression_orale" as const,
  position: { numero: 3, total: 4 },
  progression: { numero: 11, faites: 10, total: 12 },
  onQuitter: jest.fn(),
};

describe("EnteteEtape", () => {
  it("affiche l'étape, la progression et le temps restant", () => {
    render(<EnteteEtape {...props} secondesRestantes={754} />);
    expect(screen.getByRole("heading", { name: "Étape 3/4 : Expression orale" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Progression du test" })).toHaveAttribute("aria-valuetext", "83 %");
    expect(screen.getByTestId("progress-label")).toHaveTextContent("Question 11 sur 12");
    expect(screen.getByRole("timer")).toHaveTextContent("12:34");
  });

  it("signale les deux dernières minutes et permet de quitter", () => {
    const onQuitter = jest.fn();
    render(<EnteteEtape {...props} onQuitter={onQuitter} secondesRestantes={90} />);
    expect(screen.getByRole("timer")).toHaveClass("text-warning");
    fireEvent.click(screen.getByRole("button", { name: "Quitter le test" }));
    expect(onQuitter).toHaveBeenCalled();
  });
});
