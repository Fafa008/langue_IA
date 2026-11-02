import {
  compterMots,
  etapeDe,
  formaterDuree,
  planDepuisQuestions,
  positionEtape,
  trierParEtape,
} from "@/lib/etapesTest";
import { secondesRestantes } from "@/hooks/useTempsRestant";
import type { CompetenceTest } from "@/types/test-diagnostic";

const q = (id: string, competence: CompetenceTest) => ({ id, competence });

describe("étapes du test", () => {
  it("rattache chaque compétence à son étape", () => {
    expect(etapeDe("grammaire")).toBe("qcm");
    expect(etapeDe("lecture")).toBe("qcm");
    expect(etapeDe("ecoute")).toBe("comprehension_orale");
    expect(etapeDe("oral")).toBe("expression_orale");
    expect(etapeDe("ecrit")).toBe("expression_ecrite");
  });

  it("range les questions dans l'ordre des étapes, sans changer l'ordre à l'intérieur d'une étape", () => {
    const questions = [q("e", "ecrit"), q("g1", "grammaire"), q("o", "oral"), q("c", "ecoute"), q("g2", "lecture")];
    expect(trierParEtape(questions).map(({ id }) => id)).toEqual(["g1", "g2", "c", "o", "e"]);
  });

  it("déduit le plan des questions et numérote les étapes présentes", () => {
    const plan = planDepuisQuestions([q("g", "grammaire"), q("l", "lecture"), q("e", "ecrit")]);
    expect(plan).toEqual([
      { etape: "qcm", nombreQuestions: 2 },
      { etape: "expression_ecrite", nombreQuestions: 1 },
    ]);
    expect(positionEtape(plan, "expression_ecrite")).toEqual({ numero: 2, total: 2 });
  });
});

describe("temps et longueur des réponses", () => {
  it("affiche une durée en minutes et secondes", () => {
    expect(formaterDuree(900)).toBe("15:00");
    expect(formaterDuree(74.2)).toBe("01:15");
    expect(formaterDuree(-3)).toBe("00:00");
  });

  it("compte le temps restant depuis l'heure de début", () => {
    expect(secondesRestantes(null, 15)).toBeNull();
    expect(secondesRestantes(0, 15, 60_000)).toBe(840);
    expect(secondesRestantes(0, 15, 20 * 60_000)).toBe(0);
  });

  it("compte les mots sans la ponctuation isolée, et chaque idéogramme chinois comme un mot", () => {
    expect(compterMots("  Bonjour , je m'appelle Rova !  ")).toBe(4);
    expect(compterMots("")).toBe(0);
    expect(compterMots("我喜欢学习中文")).toBe(7);
  });
});
