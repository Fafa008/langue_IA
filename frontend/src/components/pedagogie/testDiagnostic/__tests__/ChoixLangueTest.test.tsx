import { fireEvent, render, screen } from "@testing-library/react";
import ChoixLangueTest from "@/components/pedagogie/testDiagnostic/ChoixLangueTest";
import type { LangueDiagnostic } from "@/types/test-diagnostic";

const langues: LangueDiagnostic[] = [
  { code: "fr", libelle: "Français", cadre: "CECRL", niveaux: ["A1", "A2"], nombreQuestions: 8, disponible: true },
  { code: "en", libelle: "Anglais", cadre: "CECRL", niveaux: ["A1"], nombreQuestions: 0, disponible: false },
];

describe("ChoixLangueTest", () => {
  it("affiche les langues inscrites en radios avec leurs drapeaux et sélectionne une langue disponible", () => {
    const onChange = jest.fn();
    const { container } = render(
      <ChoixLangueTest langues={langues} value={null} onChange={onChange} labelledBy="titre-langues" />,
    );

    expect(screen.getByRole("radio", { name: /Français/ })).toBeEnabled();
    expect(screen.getByRole("radio", { name: /Anglais/ })).toBeDisabled();
    expect(container.querySelectorAll("img")).toHaveLength(2);
    fireEvent.click(screen.getByRole("radio", { name: /Français/ }));
    expect(onChange).toHaveBeenCalledWith("fr");
  });

  it("annonce quand aucune langue n'est associée à l'inscription", () => {
    render(<ChoixLangueTest langues={[]} value={null} onChange={jest.fn()} labelledBy="titre-langues" />);
    expect(screen.getByText("Aucune langue n'est associée à votre inscription.")).toBeInTheDocument();
  });

  it("présente une langue unique directement sans radio", () => {
    render(
      <ChoixLangueTest langues={[langues[0]]} value="fr" onChange={jest.fn()} labelledBy="titre-langues" />,
    );
    expect(screen.getByText("Français")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});
