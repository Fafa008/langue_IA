import { fireEvent, render, screen, within } from "@testing-library/react";
import RetourCorrection from "@/components/pedagogie/parcours/exercices/RetourCorrection";
import { toCorrectionExercice, type CorrectionExerciceDto } from "@/services/parcours-personnalise.mapper";
import type { CorrectionExercice } from "@/types/parcours-personnalise";

// US44-FE : affichage du feedback, champs absents et mode inconnu.
const base: CorrectionExercice = {
  statut: "A_REVOIR",
  scoreObtenu: 40,
  mode: "AUTOMATIQUE",
  commentaire: "Ce n'est pas la bonne réponse.",
  reponseAttendue: null,
  explication: null,
  pointsForts: [],
  erreurs: [],
  conseil: null,
  phase: null,
  leconAtteinte: null,
  reformulation: null,
};

describe("US44-FE — verdict, origine et réessai", () => {
  it("affiche le verdict, le score et l'origine automatique", () => {
    render(<RetourCorrection correction={base} onReessayer={() => {}} />);
    expect(screen.getByRole("region", { name: "Correction" })).toHaveTextContent("À revoir · 40/100");
    expect(screen.getByText("Correction automatique")).toBeInTheDocument();
  });

  it("affiche l'origine IA quand le professeur a corrigé", () => {
    render(
      <RetourCorrection
        correction={{ ...base, mode: "IA", phase: "PASSIVE", leconAtteinte: 23 }}
        onReessayer={() => {}}
      />,
    );
    expect(screen.getByText("Corrigé par le professeur IA")).toBeInTheDocument();
  });

  it("propose de réessayer, et le libellé change après une réussite", () => {
    const onReessayer = jest.fn();
    const { rerender } = render(<RetourCorrection correction={base} onReessayer={onReessayer} />);
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(onReessayer).toHaveBeenCalledTimes(1);

    rerender(<RetourCorrection correction={{ ...base, statut: "REUSSI", scoreObtenu: 90 }} onReessayer={onReessayer} />);
    expect(screen.getByRole("button", { name: "Refaire l'exercice" })).toBeInTheDocument();
  });
});

describe("US44-FE — champs absents", () => {
  it("n'affiche aucune section vide quand le retour ne contient que le verdict", () => {
    render(<RetourCorrection correction={base} onReessayer={() => {}} />);
    const retour = screen.getByRole("region", { name: "Correction" });
    expect(within(retour).queryByText("Bonne réponse :")).not.toBeInTheDocument();
    expect(within(retour).queryByText("Points forts")).not.toBeInTheDocument();
    expect(within(retour).queryByText(/à corriger/)).not.toBeInTheDocument();
    expect(within(retour).queryByText(/Conseil/)).not.toBeInTheDocument();
    expect(within(retour).queryByText("Version corrigée")).not.toBeInTheDocument();
  });

  it("le mapper accepte un retour sans champs facultatifs et les remplit de valeurs vides", () => {
    const dto: CorrectionExerciceDto = { statut: "REUSSI", score_obtenu: 80, mode_correction: "AUTOMATIQUE", commentaire: "Bien" };
    expect(toCorrectionExercice(dto)).toMatchObject({ pointsForts: [], erreurs: [], conseil: null, reponseAttendue: null });
  });
});

describe("US44-FE — mode inconnu", () => {
  it("refuse une origine de correction inconnue plutôt que de l'afficher", () => {
    const dto = { statut: "REUSSI", score_obtenu: 80, mode_correction: "HUMAIN", commentaire: "Bien" } as unknown as CorrectionExerciceDto;
    expect(() => toCorrectionExercice(dto)).toThrow("Mode de correction non reconnu : HUMAIN");
  });
});
