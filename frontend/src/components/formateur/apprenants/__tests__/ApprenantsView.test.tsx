import { fireEvent, render, screen, within } from "@testing-library/react";
import ApprenantsView from "@/components/formateur/apprenants/ApprenantsView";
import { mockFetch } from "@/test/fetch-mock";

// US49-FE : la vue formateur est simulée, filtrée localement, et n'appelle aucune route.
describe("US49-FE — vue formateur par apprenant", () => {
  let fetchEspion: jest.Mock;
  beforeEach(() => {
    fetchEspion = mockFetch({ body: {} });
  });

  it("affiche l'étiquette « Données simulées » et la liste", () => {
    render(<ApprenantsView />);
    expect(screen.getByTestId("donnees-simulees")).toHaveTextContent("Données simulées");
    expect(screen.getByRole("button", { name: /Rova Rakoto/ })).toBeInTheDocument();
  });

  it("n'appelle aucune route", () => {
    render(<ApprenantsView />);
    fireEvent.click(screen.getByRole("button", { name: /Hanta Ravelo/ }));
    expect(fetchEspion).not.toHaveBeenCalled();
  });

  it("filtre la liste par recherche et par langue", () => {
    render(<ApprenantsView />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "ti" } });
    expect(screen.getByRole("button", { name: /Tiana/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Rova/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Filtrer par langue" }), { target: { value: "it" } });
    expect(screen.getAllByRole("button", { name: /\w+ \w+/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Miora/ })).toBeInTheDocument();
  });

  it("affiche le détail simulé de l'apprenant choisi", () => {
    render(<ApprenantsView />);
    fireEvent.click(screen.getByRole("button", { name: /Hanta Ravelo/ }));
    const detail = screen.getByRole("heading", { name: "Hanta Ravelo" }).closest("section")!;
    expect(within(detail).getByText("Mode actif")).toBeInTheDocument();
    expect(within(detail).getByText("56")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hanta Ravelo/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("indique l'état vide quand aucun apprenant ne correspond", () => {
    render(<ApprenantsView />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });
    expect(screen.getByText("Aucun apprenant ne correspond à ces filtres.")).toBeInTheDocument();
  });
});
