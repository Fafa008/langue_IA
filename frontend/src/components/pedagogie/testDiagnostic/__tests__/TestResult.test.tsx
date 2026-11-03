import { fireEvent, render, screen, within } from "@testing-library/react";
import TestResult from "@/components/pedagogie/testDiagnostic/TestResult";
import { ROUTES } from "@/lib/routes";
import type { EtatTest, ResultatTest } from "@/types/test-diagnostic";

const replace = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const recommencer = jest.fn();
let etat: Pick<EtatTest, "phase" | "langue" | "niveaux" | "resultat">;
jest.mock("@/hooks/useTestDiagnostic", () => ({ useTestDiagnostic: () => ({ etat, recommencer }) }));

const complet: ResultatTest = {
  niveau: "A2",
  score: 40,
  total: 100,
  cadre: "CECRL",
  competences: [
    { competence: "grammaire", score: 4, total: 5 },
    { competence: "oral", score: 0, total: 1 },
  ],
  lacunes: ["oral"],
  pointsFaibles: [
    { domaine: "vocabulaire", detail: "Le vocabulaire reste limité aux situations du quotidien." },
    { domaine: "expression_orale" },
  ],
  phaseAssimil: "impregnation",
  justification: {
    resume: "Vos réponses correspondent aux descripteurs du niveau A2.",
    sources: [{ id: "s1", referentiel: "CECRL", niveau: "A2", titre: "Échelle globale — niveau A2", extrait: "Comprend des phrases isolées." }],
  },
};

const afficher = (resultat: ResultatTest | null) => {
  etat = { phase: resultat ? "resultat" : "intro", langue: "en", niveaux: ["A1"], resultat };
  return render(<TestResult />);
};

beforeEach(() => jest.clearAllMocks());

describe("TestResult", () => {
  it("affiche le niveau, la phase Assimil, les compétences, les points faibles et la justification", () => {
    afficher(complet);

    expect(screen.getByRole("heading", { name: "Résultat de votre diagnostic", level: 1 })).toBeInTheDocument();
    expect(screen.getByTestId("result-level")).toHaveTextContent("A2");
    expect(screen.getByTestId("result-framework")).toHaveTextContent("CECRL");
    expect(screen.getByTestId("result-score")).toHaveTextContent("40 / 100");
    expect(screen.getByTestId("result-phase")).toHaveTextContent("Imprégnation");

    // Échelle complète du référentiel, niveau atteint mis en évidence
    const echelle = screen.getByRole("heading", { name: "Échelle des niveaux" }).closest("section")!;
    expect(within(echelle).getAllByRole("listitem")).toHaveLength(6);
    expect(within(echelle).getByText("A2")).toHaveAttribute("aria-current", "step");
    expect(echelle).toHaveTextContent("Prochain niveau visé : B1");

    expect(screen.getByTestId("result-competence-grammaire")).toHaveTextContent("4 / 5");
    expect(screen.getByTestId("point-faible-vocabulaire")).toHaveTextContent("vocabulaire reste limité");
    expect(screen.getByTestId("point-faible-expression_orale")).toBeInTheDocument();
    expect(screen.getByTestId("justification-resume")).toHaveTextContent("descripteurs du niveau A2");
    expect(screen.getAllByTestId("source-referentiel")).toHaveLength(1);

    expect(screen.queryByTestId("resultat-partiel")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("résultat partiel : garde le niveau et liste ce que l'analyse n'a pas encore fourni", () => {
    afficher({ niveau: "B1", score: 50, total: 100, cadre: "CECRL", competences: [], lacunes: [] });

    expect(screen.getByTestId("result-level")).toHaveTextContent("B1");
    const partiel = screen.getByTestId("resultat-partiel");
    expect(partiel).toHaveTextContent("Résultat partiel");
    expect(partiel).toHaveTextContent("le détail par compétence, les points faibles, la phase Assimil, la justification du niveau");
    expect(screen.getByTestId("result-phase")).toHaveTextContent("Non déterminée");
  });

  it("propose de commencer le parcours ou de refaire le test", () => {
    afficher(complet);

    expect(screen.getByRole("link", { name: "Commencer mon parcours" })).toHaveAttribute("href", ROUTES.apprenant.dashboard);
    fireEvent.click(screen.getByRole("button", { name: "Refaire le test" }));
    expect(recommencer).toHaveBeenCalled();
  });

  it("sans test terminé, renvoie au démarrage sans rien afficher", () => {
    const { container } = afficher(null);

    expect(container).toBeEmptyDOMElement();
    expect(replace).toHaveBeenCalledWith(ROUTES.apprenant.testDiagnostic.demarrage);
  });
});
