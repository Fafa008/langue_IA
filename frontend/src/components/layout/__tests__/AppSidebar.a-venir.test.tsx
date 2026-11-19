import { render, screen, within } from "@testing-library/react";
import AppSidebar from "@/components/layout/AppSidebar";

// FE-D4 (décision D6) : le professeur IA n'a pas encore de page : il est affiché « À venir », sans lien.
jest.mock("next/navigation", () => ({ usePathname: () => "/espace/apprenant" }));
jest.mock("@/hooks/useSession", () => ({
  useSession: () => ({ ready: true, isAuthenticated: true, utilisateur: { prenom: "Rova", nom: "Rakoto", role: "APPRENANT" } }),
}));

describe("FE-D4 — entrées « à venir » du menu", () => {
  it("affiche le professeur IA avec l'état « À venir », sans lien", () => {
    render(<AppSidebar />);
    const entree = screen.getByText("Professeur IA").closest("span[aria-disabled]") as HTMLElement;
    expect(entree).not.toBeNull();
    expect(within(entree).getByText("À venir")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Professeur IA/ })).not.toBeInTheDocument();
  });

  it("garde « Mon parcours » cliquable", () => {
    render(<AppSidebar />);
    expect(screen.getByRole("link", { name: "Mon parcours" })).toHaveAttribute("href", "/espace/apprenant/parcours");
  });
});
