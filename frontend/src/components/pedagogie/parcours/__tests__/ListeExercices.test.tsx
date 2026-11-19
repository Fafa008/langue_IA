import { fireEvent, render, screen, within } from "@testing-library/react";
import ListeExercices from "@/components/pedagogie/parcours/ListeExercices";
import type { ExerciceParcours } from "@/types/parcours-personnalise";

// US42-FE : chaque statut du contrat, l'état vide, et les filtres au clavier.
const exercice = (id: number, numeroLecon: number, statut: ExerciceParcours["statut"], scoreObtenu: number | null): ExerciceParcours => ({
  idParcoursExercice: id,
  idExercice: id,
  numeroLecon,
  type: "GRAMMAIRE",
  difficulte: 2,
  intitule: `Exercice ${id}`,
  statut,
  scoreObtenu,
});

describe("US42-FE — statuts des exercices", () => {
  it("affiche À faire sans score pour un exercice non fait (score null)", () => {
    render(<ListeExercices exercices={[exercice(1, 22, "A_FAIRE", null)]} />);
    const ligne = screen.getByText("Exercice 1").closest("li")!;
    expect(within(ligne).getByText("À faire")).toBeInTheDocument();
    expect(ligne).not.toHaveTextContent("/100");
  });

  it("affiche Réussi avec le score pour un exercice réussi", () => {
    render(<ListeExercices exercices={[exercice(2, 22, "REUSSI", 85)]} />);
    const ligne = screen.getByText("Exercice 2").closest("li")!;
    expect(ligne).toHaveTextContent("Réussi");
    expect(ligne).toHaveTextContent("85/100");
  });

  it("affiche À revoir avec le score pour un exercice à revoir", () => {
    render(<ListeExercices exercices={[exercice(3, 22, "A_REVOIR", 40)]} />);
    const ligne = screen.getByText("Exercice 3").closest("li")!;
    expect(ligne).toHaveTextContent("À revoir");
    expect(ligne).toHaveTextContent("40/100");
  });
});

describe("US42-FE — état vide et filtres", () => {
  it("indique qu'aucun exercice n'a encore été ajouté", () => {
    render(<ListeExercices exercices={[]} />);
    expect(screen.getByText("Aucun exercice n'a encore été ajouté à votre parcours.")).toBeInTheDocument();
  });

  it("indique qu'aucun exercice ne correspond au filtre choisi", () => {
    render(<ListeExercices exercices={[exercice(4, 22, "REUSSI", 90)]} />);
    fireEvent.click(screen.getByRole("button", { name: /À revoir/ }));
    expect(screen.getByText("Aucun exercice avec ce statut.")).toBeInTheDocument();
  });

  it("les filtres sont des boutons accessibles au clavier, avec l'état appuyé", () => {
    render(<ListeExercices exercices={[exercice(5, 22, "A_FAIRE", null)]} />);
    const tous = screen.getByRole("button", { name: /Tous/ });
    expect(tous).toHaveAttribute("aria-pressed", "true");
    tous.focus();
    expect(tous).toHaveFocus();
  });
});
