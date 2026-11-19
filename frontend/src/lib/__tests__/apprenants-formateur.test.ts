import { APPRENANTS_SIMULES } from "@/mocks/apprenants-formateur.mock";
import { filtrerApprenants, languesDe } from "@/lib/apprenants-formateur";

describe("US49-FE — filtres de la liste des apprenants", () => {
  it("sans filtre, renvoie tous les apprenants", () => {
    expect(filtrerApprenants(APPRENANTS_SIMULES, { recherche: "", codeLangue: null })).toHaveLength(APPRENANTS_SIMULES.length);
  });

  it("filtre par langue", () => {
    const anglais = filtrerApprenants(APPRENANTS_SIMULES, { recherche: "", codeLangue: "en" });
    expect(anglais.map((a) => a.prenom)).toEqual(["Rova", "Tiana"]);
  });

  it("recherche sans tenir compte de la casse ni des accents", () => {
    const trouves = filtrerApprenants(APPRENANTS_SIMULES, { recherche: "  RAKOTO ", codeLangue: null });
    expect(trouves.map((a) => a.nom)).toEqual(["Rakoto"]);
    expect(filtrerApprenants(APPRENANTS_SIMULES, { recherche: "miora", codeLangue: null })).toHaveLength(1);
  });

  it("combine recherche et langue, et renvoie une liste vide sans correspondance", () => {
    expect(filtrerApprenants(APPRENANTS_SIMULES, { recherche: "Rova", codeLangue: "fr" })).toEqual([]);
  });

  it("liste chaque langue une seule fois, triée", () => {
    const langues = languesDe(APPRENANTS_SIMULES).map((l) => l.libelle);
    expect(langues).toEqual([...new Set(langues)]);
    expect(langues).toEqual([...langues].sort((a, b) => a.localeCompare(b, "fr")));
  });
});
