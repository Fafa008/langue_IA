import { render, screen, within } from "@testing-library/react";
import SyntheseErreursView from "@/components/formateur/synthese/SyntheseErreursView";
import { NAVIGATION } from "@/lib/navigation";
import { ROUTES } from "@/lib/routes";
import { ERREURS_SIMULEES } from "@/mocks/synthese-erreurs-formateur.mock";
import { mockFetch } from "@/test/fetch-mock";

// US52-FE : les trois erreurs, l'étiquette « Synthèse simulée », la section réelle « Bientôt », aucun appel réseau.
describe("US52-FE — synthèse des erreurs (formateur)", () => {
  it("affiche les trois erreurs récurrentes avec exemple et conseil", () => {
    render(<SyntheseErreursView />);
    const liste = screen.getByRole("list");
    expect(within(liste).getAllByRole("listitem")).toHaveLength(3);
    for (const erreur of ERREURS_SIMULEES.slice(0, 3)) {
      expect(screen.getByRole("heading", { name: erreur.titre })).toBeInTheDocument();
      expect(screen.getByText(erreur.conseil, { exact: false })).toBeInTheDocument();
    }
  });

  it("étiquette la synthèse comme simulée", () => {
    render(<SyntheseErreursView />);
    expect(screen.getByTestId("synthese-simulee")).toHaveTextContent("Synthèse simulée");
  });

  it("affiche la section réelle en « Bientôt », sans contenu", () => {
    render(<SyntheseErreursView />);
    const reel = screen.getByRole("heading", { name: /Bilan réel des sessions/ }).closest("section")!;
    expect(within(reel).getByText("Bientôt")).toBeInTheDocument();
    expect(reel).toHaveAttribute("aria-disabled", "true");
  });

  it("n'appelle aucune route", () => {
    const fetchMock = mockFetch({ body: {} });
    render(<SyntheseErreursView />);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("est accessible depuis le menu formateur", () => {
    const entree = NAVIGATION.FORMATEUR.find((item) => item.href === ROUTES.formateur.syntheseErreurs);
    expect(entree).toMatchObject({ label: "Synthèse des erreurs" });
    expect(entree?.bientot).toBeUndefined();
  });
});
