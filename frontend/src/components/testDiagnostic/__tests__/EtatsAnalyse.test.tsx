import { act, fireEvent, render, screen } from "@testing-library/react";
import AnalyseEnCours from "@/components/testDiagnostic/AnalyseEnCours";
import ErreurReessayable from "@/components/testDiagnostic/ErreurReessayable";
import ResultatEnAttente from "@/components/testDiagnostic/ResultatEnAttente";

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

  it("indique un résultat en attente et bloque le bouton pendant la vérification", () => {
    const { rerender } = render(<ResultatEnAttente verificationEnCours={false} onVerifier={jest.fn()} intervalleSecondes={10} />);
    expect(screen.getByRole("heading", { name: "Résultat en attente" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("toutes les 10 secondes");

    rerender(<ResultatEnAttente verificationEnCours onVerifier={jest.fn()} intervalleSecondes={10} />);
    expect(screen.getByRole("button", { name: "Vérifier mon résultat" })).toBeDisabled();
  });

  it("une fois la vérification automatique arrêtée, invite à vérifier plus tard", () => {
    render(<ResultatEnAttente verificationEnCours={false} onVerifier={jest.fn()} intervalleSecondes={null} />);
    expect(screen.getByRole("status")).toHaveTextContent("Revenez dans quelques minutes");
    expect(screen.getByRole("button", { name: "Vérifier mon résultat" })).toBeEnabled();
  });
});
