import { drapeauLangue } from "@/lib/languages";
import { formatCodeNiveau, trierNiveaux } from "@/lib/niveaux";
import { formatCodeLangue } from "@/lib/saisie";
import { validateLangue } from "@/lib/validation/langue";
import { validateNiveau } from "@/lib/validation/niveau";

describe("validateLangue", () => {
  const valide = { libelle: "Créole mauricien", code: "MFE", idNiveaux: [1] };

  it("accepte une langue complète", () => {
    expect(validateLangue(valide)).toEqual({});
  });

  it("signale les champs manquants", () => {
    expect(validateLangue({ libelle: "", code: "", idNiveaux: [] })).toEqual({
      libelle: "La désignation est requise.",
      code: "Le code est requis.",
      idNiveaux: "Choisissez au moins un niveau ouvert pour cette langue.",
    });
  });

  it("contrôle le format de la désignation et du code", () => {
    expect(validateLangue({ ...valide, libelle: "Langue 2" }).libelle).toMatch(/que des lettres/);
    expect(validateLangue({ ...valide, code: "F" }).code).toMatch(/2 ou 3 lettres/);
  });
});

describe("niveaux", () => {
  it("formatCodeNiveau met en majuscules et réduit les espaces", () => {
    expect(formatCodeNiveau("  hsk   7")).toBe("HSK 7");
  });

  it("trierNiveaux range par code, les nombres dans l'ordre naturel", () => {
    const niveau = (idNiveau: number, code: string) => ({ idNiveau, code, libelle: code });
    const tries = trierNiveaux([niveau(1, "HSK 10"), niveau(2, "B1"), niveau(3, "HSK 2"), niveau(4, "A2")]);
    expect(tries.map((n) => n.code)).toEqual(["A2", "B1", "HSK 2", "HSK 10"]);
  });

  it("validateNiveau : code et libellé requis, code de 20 caractères au maximum", () => {
    expect(validateNiveau({ code: "A1", libelle: "Débutant" })).toEqual({});
    expect(validateNiveau({ code: " ", libelle: "" })).toEqual({ code: "Le code est requis.", libelle: "Le libellé est requis." });
    expect(validateNiveau({ code: "X".repeat(21), libelle: "Trop long" }).code).toMatch(/20 caractères/);
  });
});

describe("saisie et drapeaux", () => {
  it("formatCodeLangue : lettres en majuscules, 3 au maximum", () => {
    expect(formatCodeLangue("f-r4ance")).toBe("FRA");
  });

  it("drapeauLangue : drapeau connu, sinon null", () => {
    expect(drapeauLangue("FR")).toBe("/flags/fr.jpg");
    expect(drapeauLangue("mg")).toBeNull();
  });
});
