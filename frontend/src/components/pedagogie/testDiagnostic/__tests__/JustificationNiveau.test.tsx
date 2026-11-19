import { fireEvent, render, screen, within } from "@testing-library/react";
import JustificationNiveau from "@/components/pedagogie/testDiagnostic/resultat/JustificationNiveau";
import type { Justification, SourceReferentiel } from "@/types/test-diagnostic";

// FE-D2 (décision D2) : un repère du repli synthétique est étiqueté « repères non officiels ».
const source = (id: string, titre: string): SourceReferentiel => ({
  id,
  referentiel: "CECRL",
  niveau: "A1",
  titre,
  extrait: "Peut écrire des phrases simples.",
});

describe("FE-D2 — repères non officiels", () => {
  it("étiquette un repère du repli et le dit dans l'en-tête des sources", () => {
    const justification: Justification = {
      resume: "Niveau estimé à partir des réponses.",
      sources: [source("synthetique_fallback:en-a1-ecrit", "Repère d'écriture A1")],
    };
    render(<JustificationNiveau justification={justification} />);

    expect(screen.getByTestId("reperes-non-officiels")).toHaveTextContent("Repères non officiels");
    expect(within(screen.getByTestId("source-referentiel")).getByText("Repère non officiel")).toBeInTheDocument();
  });

  it("n'étiquette pas un repère officiel", () => {
    const justification: Justification = {
      resume: "Niveau estimé à partir des réponses.",
      sources: [source("cecrl-a1-ecrit-12", "Descripteur officiel A1")],
    };
    render(<JustificationNiveau justification={justification} />);

    expect(screen.queryByTestId("reperes-non-officiels")).not.toBeInTheDocument();
    expect(screen.queryByText("Repère non officiel")).not.toBeInTheDocument();
  });
});
