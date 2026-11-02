import { fireEvent, render, screen } from "@testing-library/react";
import CarteNiveau from "@/components/testDiagnostic/resultat/CarteNiveau";
import JustificationNiveau from "@/components/testDiagnostic/resultat/JustificationNiveau";
import PointsFaibles from "@/components/testDiagnostic/resultat/PointsFaibles";

const justification = {
  resume: "Vos réponses correspondent aux descripteurs du niveau A2.",
  sources: [
    { id: "s1", referentiel: "CECRL" as const, niveau: "A2", titre: "Échelle globale — niveau A2", extrait: "Comprend des phrases isolées.", url: "https://www.coe.int/cecrl" },
    { id: "s2", referentiel: "CECRL" as const, niveau: "A2", titre: "Production orale générale", extrait: "Décrit simplement des sujets familiers." },
  ],
};

describe("écran de résultats détaillé", () => {
  it("affiche la phase Assimil, ou signale qu'elle n'est pas encore déterminée", () => {
    const { rerender } = render(<CarteNiveau niveau="A2" referentiel="CECRL" libelleLangue="Anglais" phase="impregnation" />);
    expect(screen.getByTestId("result-phase")).toHaveTextContent("Imprégnation");
    expect(screen.getByTestId("result-phase")).toHaveTextContent("Phase passive");

    rerender(<CarteNiveau niveau="A2" referentiel="CECRL" libelleLangue="Anglais" />);
    expect(screen.getByTestId("result-phase")).toHaveTextContent("Non déterminée");
  });

  it("liste les points faibles avec leur explication", () => {
    render(<PointsFaibles points={[{ domaine: "vocabulaire", detail: "Lexique limité." }, { domaine: "expression_orale" }]} />);
    expect(screen.getByTestId("point-faible-vocabulaire")).toHaveTextContent("VocabulaireLexique limité.");
    expect(screen.getByTestId("point-faible-expression_orale")).toHaveTextContent("Expression orale");
  });

  it("distingue « aucun point faible » de « pas encore connus »", () => {
    const { rerender } = render(<PointsFaibles points={[]} />);
    expect(screen.getByTestId("result-weaknesses")).toHaveTextContent("Aucun point faible détecté");
    rerender(<PointsFaibles points={null} />);
    expect(screen.getByTestId("result-weaknesses")).toHaveTextContent("identifiés par l'analyse complète");
  });

  it("rend les sources du référentiel consultables, avec un lien seulement quand il est fourni", () => {
    render(<JustificationNiveau justification={justification} />);
    expect(screen.getByTestId("justification-resume")).toHaveTextContent("descripteurs du niveau A2");
    expect(screen.getByRole("heading", { name: "Sources du référentiel (2)" })).toBeInTheDocument();

    const [premiere, seconde] = screen.getAllByTestId("source-referentiel");
    fireEvent.click(premiere.querySelector("summary")!);
    expect(premiere).toHaveAttribute("open");
    expect(premiere).toHaveTextContent("Comprend des phrases isolées.");
    const lien = screen.getByRole("link", { name: /Consulter le référentiel/ });
    expect(lien).toHaveAttribute("href", "https://www.coe.int/cecrl");
    expect(lien).toHaveAttribute("rel", "noopener noreferrer");
    expect(seconde.querySelector("a")).toBeNull();
  });

  it("ne rend jamais cliquable un lien de source non http(s)", () => {
    render(<JustificationNiveau justification={{
      resume: "Niveau A2.",
      sources: [{ id: "s1", referentiel: "CECRL", niveau: "A2", titre: "Source", extrait: "Extrait.", url: "javascript:alert(1)" }],
    }} />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("annonce la justification à venir quand l'analyse ne l'a pas fournie", () => {
    render(<JustificationNiveau />);
    expect(screen.getByTestId("result-justification")).toHaveTextContent("sera disponible après l'analyse complète");
  });
});
