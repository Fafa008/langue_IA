import { appliquerModeAnalyse, MODE_ANALYSE_SIMULEE } from "@/mocks/test-diagnostic.mock";
import type { ResultatTest } from "@/types/test-diagnostic";

// F-07 : le mode « complet » reste fidèle à l'analyse complète ; le mode « partielle » ne montre pas ce qu'une
// analyse réelle incomplète ne fournirait pas.
const complet: ResultatTest = {
  niveau: "B1",
  score: 60,
  total: 100,
  cadre: "CECRL",
  competences: [{ competence: "grammaire", score: 2, total: 5 }],
  lacunes: ["grammaire"],
  pointsFaibles: [{ domaine: "grammaire", detail: "Accords du participe passé." }],
  phaseAssimil: "activation",
  justification: { resume: "Vos réponses correspondent au niveau B1.", sources: [] },
};

describe("F-07 — mode de l'analyse simulée", () => {
  it("le mode complet renvoie le résultat sans modification", () => {
    expect(appliquerModeAnalyse(complet, "complete")).toEqual(complet);
  });

  it("le mode partiel retire la justification et le détail des points faibles, et garde la phase", () => {
    const partiel = appliquerModeAnalyse(complet, "partielle");
    expect(partiel.justification).toBeUndefined();
    expect(partiel.pointsFaibles).toEqual([{ domaine: "grammaire" }]);
    expect(partiel.phaseAssimil).toBe("activation");
    expect(partiel.niveau).toBe("B1");
    expect(partiel.score).toBe(60);
  });

  it("le mode partiel ne renvoie pas de points faibles quand il n'y en a pas", () => {
    expect(appliquerModeAnalyse({ ...complet, pointsFaibles: undefined }, "partielle").pointsFaibles).toBeUndefined();
  });

  it("le mode par défaut est le mode complet quand la variable n'est pas définie", () => {
    expect(MODE_ANALYSE_SIMULEE).toBe("complete");
  });
});
