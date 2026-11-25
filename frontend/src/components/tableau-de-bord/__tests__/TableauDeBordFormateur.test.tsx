import { render, screen } from "@testing-library/react";
import TableauDeBord from "@/components/tableau-de-bord/TableauDeBord";

jest.mock("@/hooks/useSession", () => ({
  useSession: () => ({ utilisateur: { role: "FORMATEUR", prenom: "Hery" } }),
}));

describe("Tableau de bord formateur", () => {
  it("propose un accueil professionnel sans modifier les pages existantes", () => {
    render(<TableauDeBord />);

    expect(screen.getByRole("heading", { name: "Bonjour, Hery" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vos outils" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Consulter mes apprenants/ })).toHaveAttribute(
      "href",
      "/espace/formateur/apprenants",
    );
    expect(screen.getByRole("link", { name: /Synthèse des erreurs/ })).toHaveAttribute(
      "href",
      "/espace/formateur/synthese-erreurs",
    );
    expect(screen.getByText(/Les outils marqués « Démonstration » affichent actuellement des données simulées/)).toBeInTheDocument();
    expect(screen.getAllByText("Bientôt")).toHaveLength(2);
    expect(screen.queryByRole("link", { name: /Mes séances/ })).not.toBeInTheDocument();
  });
});
