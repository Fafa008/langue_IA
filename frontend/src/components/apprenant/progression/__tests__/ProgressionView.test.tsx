import { render, screen, within } from "@testing-library/react";
import ProgressionView from "@/components/apprenant/progression/ProgressionView";
import { NAVIGATION } from "@/lib/navigation";
import { ROUTES } from "@/lib/routes";
import { PROGRESSION_SIMULEE } from "@/mocks/progression-apprenant.mock";

// US51-FE : indicateurs calculés à partir des données locales, graphique sans bibliothèque, état vide.
describe("US51-FE — tableau de bord de l'apprenant", () => {
  it("affiche la progression, le score, la dernière leçon et la série", () => {
    render(<ProgressionView />);
    expect(screen.getByTestId("kpi-progression")).toHaveTextContent("41 %");
    expect(screen.getByTestId("kpi-score")).toHaveTextContent("78/100");
    expect(screen.getByTestId("kpi-derniere-lecon")).toHaveTextContent("Leçon 23");
    expect(screen.getByText("Le passé composé")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-serie")).toHaveTextContent("5 jours");
  });

  it("étiquette les données comme simulées", () => {
    render(<ProgressionView />);
    expect(screen.getByTestId("donnees-simulees")).toHaveTextContent("Données simulées");
  });

  it("trace une colonne par jour, décrite de façon accessible", () => {
    render(<ProgressionView />);
    const graphique = screen.getByRole("img", { name: /Lun : 3, Mar : 0, Mer : 4/ });
    expect(graphique.children).toHaveLength(PROGRESSION_SIMULEE.exercicesParJour.length);
  });

  it("affiche un message d'accueil quand il n'y a encore aucune progression", () => {
    render(<ProgressionView progression={null} />);
    expect(screen.getByText("Votre progression apparaîtra dès votre premier exercice.")).toBeInTheDocument();
    expect(screen.queryByTestId("kpi-score")).not.toBeInTheDocument();
  });

  it("garde la page fille de l'accueil dans le menu, active", () => {
    const entree = NAVIGATION.APPRENANT.find((item) => item.href === ROUTES.apprenant.progression);
    expect(entree).toMatchObject({ label: "Ma progression" });
    expect(entree?.bientot).toBeUndefined();
    expect(within(document.body).queryByText("Bientôt")).not.toBeInTheDocument();
  });
});
