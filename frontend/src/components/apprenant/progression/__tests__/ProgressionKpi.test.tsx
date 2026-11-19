import { render, screen } from "@testing-library/react";
import ProgressionView from "@/components/apprenant/progression/ProgressionView";
import type { ProgressionApprenant } from "@/mocks/progression-apprenant.mock";

// US55-QA : valeurs affichées par les KPI de US51, cas nuls compris.
const base: ProgressionApprenant = {
  leconAtteinte: 23,
  leconsTotal: 56,
  scoreMoyen: 78,
  derniereLecon: { numero: 23, intitule: "Le passé composé" },
  serieJours: 5,
  exercicesParJour: [{ jour: "Lun", nombre: 0 }, { jour: "Mar", nombre: 5 }],
};

const avec = (champs: Partial<ProgressionApprenant>) => render(<ProgressionView progression={{ ...base, ...champs }} />);

describe("US55-QA — valeurs affichées", () => {
  it("calcule le pourcentage arrondi de la progression", () => {
    avec({ leconAtteinte: 23, leconsTotal: 56 });
    expect(screen.getByTestId("kpi-progression")).toHaveTextContent("41 %");
  });

  it("affiche 100 % quand la dernière leçon est atteinte", () => {
    avec({ leconAtteinte: 56, leconsTotal: 56, derniereLecon: { numero: 56, intitule: "Révision finale" } });
    expect(screen.getByTestId("kpi-progression")).toHaveTextContent("100 %");
    expect(screen.getByTestId("kpi-derniere-lecon")).toHaveTextContent("Leçon 56");
  });

  it("affiche le score moyen tel quel, y compris 0", () => {
    avec({ scoreMoyen: 0 });
    expect(screen.getByTestId("kpi-score")).toHaveTextContent("0/100");
  });

  it("accorde le mot « jour » au singulier et au pluriel", () => {
    const { unmount } = avec({ serieJours: 1 });
    expect(screen.getByTestId("kpi-serie")).toHaveTextContent(/^1 jour$/);
    unmount();
    avec({ serieJours: 0 });
    expect(screen.getByTestId("kpi-serie")).toHaveTextContent(/^0 jour$/);
  });
});

describe("US55-QA — cas nuls", () => {
  it("n'affiche jamais NaN ni Infinity quand le total de leçons est nul", () => {
    const { container } = avec({ leconsTotal: 0 });
    expect(screen.getByTestId("kpi-progression")).toHaveTextContent("0 %");
    expect(container.textContent).not.toMatch(/NaN|Infinity/);
  });

  it("dessine les colonnes à hauteur nulle quand aucun exercice n'a été fait", () => {
    avec({ exercicesParJour: [{ jour: "Lun", nombre: 0 }, { jour: "Mar", nombre: 0 }] });
    const graphique = screen.getByRole("img", { name: /Lun : 0, Mar : 0/ });
    for (const colonne of Array.from(graphique.children)) {
      expect(colonne.firstElementChild).toHaveStyle({ height: "0%" });
    }
  });

  it("proportionne les colonnes au maximum arrondi de l'échelle", () => {
    avec({ exercicesParJour: [{ jour: "Lun", nombre: 4 }, { jour: "Mar", nombre: 2 }] });
    const graphique = screen.getByRole("img", { name: /Lun : 4, Mar : 2/ });
    // Échelle de graduations(4) = 0 à 4 : 4 occupe 100 %, 2 occupe 50 %
    expect(graphique.children[0].firstElementChild).toHaveStyle({ height: "100%" });
    expect(graphique.children[1].firstElementChild).toHaveStyle({ height: "50%" });
  });
});
