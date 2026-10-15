import { graduations, indicesEtiquettes, pourcentage } from "@/lib/graphique";

describe("graduations", () => {
  it("choisit un pas rond et dépasse le maximum", () => {
    expect(graduations(64)).toEqual([0, 20, 40, 60, 80]);
    expect(graduations(12)).toEqual([0, 5, 10, 15]);
    expect(graduations(80)).toEqual([0, 20, 40, 60, 80]);
    expect(graduations(3)).toEqual([0, 1, 2, 3]);
  });

  it("garde une échelle lisible quand il n'y a aucune donnée", () => {
    expect(graduations(0)).toEqual([0, 1]);
  });
});

describe("pourcentage", () => {
  it("arrondit à l'entier et gère un total nul", () => {
    expect(pourcentage(71, 186)).toBe(38);
    expect(pourcentage(5, 0)).toBe(0);
  });
});

describe("indicesEtiquettes", () => {
  it("répartit les étiquettes en gardant la première et la dernière", () => {
    expect(indicesEtiquettes(30)).toEqual([0, 7, 15, 22, 29]);
    expect(indicesEtiquettes(3)).toEqual([0, 1, 2]);
  });
});
