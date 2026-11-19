import { act, fireEvent, render, screen } from "@testing-library/react";
import AnalyseEnCours from "@/components/pedagogie/testDiagnostic/AnalyseEnCours";
import ErreurReessayable from "@/components/pedagogie/testDiagnostic/ErreurReessayable";

describe("états de l'analyse", () => {
  it("rassure l'apprenant quand l'analyse dure plus longtemps que d'habitude", () => {
    jest.useFakeTimers();
    render(<AnalyseEnCours titre="Analyse de vos réponses" message="Calcul en cours." delaiLongMs={8000} />);
    expect(screen.getByRole("status")).toHaveTextContent("Calcul en cours.");

    act(() => jest.advanceTimersByTime(8000));
    expect(screen.getByRole("status")).toHaveTextContent("plus long que d'habitude");
    expect(screen.getByRole("status")).toHaveTextContent("Vos réponses sont conservées");
    jest.useRealTimers();
  });

  it("propose une nouvelle tentative et rappelle que les réponses sont conservées", () => {
    const onReessayer = jest.fn();
    render(<ErreurReessayable message="Votre réponse n'a pas pu être envoyée." onReessayer={onReessayer} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Vos réponses déjà saisies sont conservées");
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(onReessayer).toHaveBeenCalled();
  });

  it("sans nouvelle tentative possible, n'affiche que le message", () => {
    render(<ErreurReessayable message="Votre session a expiré." />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
