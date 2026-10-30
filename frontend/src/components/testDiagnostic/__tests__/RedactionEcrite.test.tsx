import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import RedactionEcrite from "@/components/testDiagnostic/RedactionEcrite";

function Redaction({ motsMinimum }: { motsMinimum: number }) {
  const [texte, setTexte] = useState("");
  return <RedactionEcrite id="reponse" valeur={texte} onChange={setTexte} motsMinimum={motsMinimum} />;
}

describe("RedactionEcrite", () => {
  it("compte les mots et signale quand le minimum est atteint", () => {
    render(<Redaction motsMinimum={3} />);
    const champ = screen.getByLabelText("Votre réponse");

    fireEvent.change(champ, { target: { value: "Bonjour Rova" } });
    expect(screen.getByTestId("compteur-mots")).toHaveTextContent("2 mots · au moins 3 mots attendus");

    fireEvent.change(champ, { target: { value: "Bonjour Rova, bienvenue" } });
    expect(screen.getByTestId("compteur-mots")).toHaveTextContent("3 mots · minimum atteint");
  });

  it("n'affiche pas de compteur pour une réponse courte", () => {
    render(<Redaction motsMinimum={1} />);
    expect(screen.queryByTestId("compteur-mots")).not.toBeInTheDocument();
  });
});
