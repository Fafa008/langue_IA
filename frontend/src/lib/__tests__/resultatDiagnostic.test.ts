import { estLienSur, informationsManquantes, lacunesDe, pointsFaiblesDe } from "@/lib/resultatDiagnostic";
import type { ResultatTest } from "@/types/test-diagnostic";

const minimal: ResultatTest = { niveau: "B1", score: 55, total: 100, cadre: "CECRL", competences: [], lacunes: [] };

describe("résultat du diagnostic", () => {
  it("garde les points faibles détaillés par l'analyse", () => {
    const points = [{ domaine: "vocabulaire" as const, detail: "Lexique limité." }];
    expect(pointsFaiblesDe({ ...minimal, pointsFaibles: points })).toBe(points);
  });

  it("déduit les points faibles des compétences en lacune quand l'analyse ne les détaille pas", () => {
    const resultat: ResultatTest = {
      ...minimal,
      competences: [{ competence: "oral", score: 0, total: 1 }, { competence: "grammaire", score: 4, total: 5 }],
      lacunes: ["oral"],
    };
    expect(pointsFaiblesDe(resultat)).toEqual([{ domaine: "expression_orale" }]);
  });

  it("ne prétend pas connaître les points faibles sans analyse ni score par compétence", () => {
    expect(pointsFaiblesDe(minimal)).toBeNull();
  });

  it("liste les informations manquantes d'un résultat partiel, et aucune pour un résultat complet", () => {
    expect(informationsManquantes(minimal)).toEqual(["competences", "points_faibles", "phase", "justification"]);
    expect(informationsManquantes({
      ...minimal,
      competences: [{ competence: "grammaire", score: 3, total: 5 }],
      pointsFaibles: [],
      phaseAssimil: "activation",
      justification: { resume: "Conforme aux descripteurs B1.", sources: [] },
    })).toEqual([]);
  });

  it("classe en lacune les compétences sous la moitié des points", () => {
    expect(lacunesDe([
      { competence: "grammaire", score: 2, total: 5 },
      { competence: "lecture", score: 1, total: 2 },
      { competence: "oral", score: 0, total: 0 },
    ])).toEqual(["grammaire"]);
  });

  it("n'accepte que des liens http(s) pour les sources", () => {
    expect(estLienSur("https://www.coe.int/fr/web/common-european-framework-reference-languages")).toBe(true);
    expect(estLienSur("javascript:alert(1)")).toBe(false);
    expect(estLienSur("data:text/html,<script>")).toBe(false);
    expect(estLienSur("pas une url")).toBe(false);
    expect(estLienSur(undefined)).toBe(false);
  });
});
