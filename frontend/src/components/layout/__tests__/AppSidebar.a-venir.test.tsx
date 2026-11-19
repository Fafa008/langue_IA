import { render, screen, within } from "@testing-library/react";
import AppSidebar from "@/components/layout/AppSidebar";

// FE-D4 / US73-FE : le menu n'affiche aucune entrée « À venir » inutile ; le professeur IA est un lien.
jest.mock("next/navigation", () => ({ usePathname: () => "/espace/apprenant" }));
jest.mock("@/hooks/useSession", () => ({
  useSession: () => ({ ready: true, isAuthenticated: true, utilisateur: { prenom: "Rova", nom: "Rakoto", role: "APPRENANT" } }),
}));

describe("FE-D4 — entrées « à venir » du menu", () => {
  it("le professeur IA est un lien vers sa page (US73-FE)", () => {
    render(<AppSidebar />);
    expect(screen.getByRole("link", { name: "Professeur IA" })).toHaveAttribute("href", "/espace/apprenant/chat");
    expect(screen.queryByText("À venir")).not.toBeInTheDocument();
  });

  it("garde « Mon parcours » cliquable", () => {
    render(<AppSidebar />);
    expect(screen.getByRole("link", { name: "Mon parcours" })).toHaveAttribute("href", "/espace/apprenant/parcours");
  });
});
