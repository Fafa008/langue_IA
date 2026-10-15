import { languesMock } from "@/mocks/langues.mock";

const TOUTES = { recherche: "", page: 1, taille: 50 };

describe("languesMock", () => {
  it("recherche sans tenir compte des accents", async () => {
    expect((await languesMock.lister({ ...TOUTES, recherche: "coreen" })).items.map((l) => l.libelle)).toEqual(["Coréen"]);
  });

  it("crée, modifie puis supprime une langue", async () => {
    const creee = await languesMock.creer({ code: "sw", libelle: "Swahili", idNiveaux: [1, 2] });
    expect(creee).toMatchObject({ code: "sw", libelle: "Swahili" });
    expect(creee.niveaux.map((n) => n.code)).toEqual(["A1", "A2"]);

    const modifiee = await languesMock.modifier(creee.idLangue, { libelle: "Kiswahili" });
    expect(modifiee).toMatchObject({ code: "sw", libelle: "Kiswahili" });
    // Sans idNiveaux, les niveaux restent ceux d'avant
    expect(modifiee.niveaux).toHaveLength(2);

    const niveauxChanges = await languesMock.modifier(creee.idLangue, { idNiveaux: [3] });
    expect(niveauxChanges.niveaux.map((n) => n.code)).toEqual(["B1"]);

    await languesMock.supprimer(creee.idLangue);
    expect((await languesMock.lister({ ...TOUTES, recherche: "swahili" })).total).toBe(0);
  });

  it("chaque langue n'ouvre que ses propres niveaux (association LangueNiveau)", async () => {
    const { items } = await languesMock.lister(TOUTES);
    const codes = (libelle: string) => items.find((l) => l.libelle === libelle)?.niveaux.map((n) => n.code);
    expect(codes("Mandarin")).toEqual(["HSK 1", "HSK 2"]);
    expect(codes("Français")).toEqual(["A1", "A2", "B1", "B2", "C1", "C2"]);
    expect(codes("Coréen")).toEqual([]);
  });

  it("refuse un code déjà utilisé (409) et la suppression d'une langue utilisée (409)", async () => {
    await expect(languesMock.creer({ code: "fr", libelle: "Autre", idNiveaux: [] })).rejects.toMatchObject({ status: 409 });
    await expect(languesMock.supprimer(1)).rejects.toMatchObject({ status: 409 });
  });
});
