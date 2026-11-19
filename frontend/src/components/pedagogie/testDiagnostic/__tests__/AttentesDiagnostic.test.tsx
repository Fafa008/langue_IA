import { act, fireEvent, render, screen } from "@testing-library/react";
import AnalyseEnCours from "@/components/pedagogie/testDiagnostic/AnalyseEnCours";
import ErreurReessayable from "@/components/pedagogie/testDiagnostic/ErreurReessayable";
import { ApiError } from "@/lib/api-client";
import { ATTENTE_CLOTURE } from "@/lib/attentesDiagnostic";
import { messageErreurDiagnostic } from "@/lib/erreursDiagnostic";

// F-05 : les trois états d'attente de la clôture sont lisibles et annoncés aux lecteurs d'écran.
describe("F-05 — états d'attente lisibles", () => {
  it("annonce la clôture avec le délai attendu, dès le lancement de l'analyse", () => {
    render(<AnalyseEnCours titre={ATTENTE_CLOTURE.titre} message={ATTENTE_CLOTURE.message} />);
    const statut = screen.getByRole("status");
    expect(statut).toHaveAttribute("aria-live", "polite");
    expect(statut).toHaveTextContent("Analyse de vos réponses");
    expect(statut).toHaveTextContent("Cela peut prendre jusqu'à une minute.");
  });

  it("rassure après un délai plus long, sans effacer le texte d'attente", () => {
    jest.useFakeTimers();
    render(<AnalyseEnCours titre={ATTENTE_CLOTURE.titre} message={ATTENTE_CLOTURE.message} delaiLongMs={8000} />);
    act(() => jest.advanceTimersByTime(8000));
    expect(screen.getByRole("status")).toHaveTextContent("plus long que d'habitude");
    expect(screen.getByRole("status")).toHaveTextContent("Vos réponses sont conservées");
    jest.useRealTimers();
  });

  it("propose « Réessayer » après un délai dépassé, et l'action est appelée", () => {
    const reessayer = jest.fn();
    const erreur = new ApiError(0, "délai dépassé", undefined, true);
    render(<ErreurReessayable message={messageErreurDiagnostic(erreur, "analyse")} onReessayer={reessayer} />);
    const alerte = screen.getByRole("alert");
    expect(alerte).toHaveTextContent("L'analyse de vos réponses prend plus de temps que prévu. Réessayez dans un instant.");
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(reessayer).toHaveBeenCalledTimes(1);
  });
});
