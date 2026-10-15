import { niveauxMock } from "@/mocks/niveaux.mock";

describe("niveauxMock", () => {
  it("crée, modifie puis supprime un niveau", async () => {
    const cree = await niveauxMock.creer({ code: "HSK 3", libelle: "Mandarin – intermédiaire" });
    expect((await niveauxMock.lister()).map((n) => n.code)).toContain("HSK 3");

    const modifie = await niveauxMock.modifier(cree.idNiveau, { code: "HSK 3", libelle: "Intermédiaire" });
    expect(modifie).toEqual({ idNiveau: cree.idNiveau, code: "HSK 3", libelle: "Intermédiaire" });

    await niveauxMock.supprimer(cree.idNiveau);
    expect((await niveauxMock.lister()).map((n) => n.code)).not.toContain("HSK 3");
  });

  it("refuse un code déjà utilisé (409) et la suppression d'un niveau utilisé (409)", async () => {
    await expect(niveauxMock.creer({ code: "A1", libelle: "Doublon" })).rejects.toMatchObject({ status: 409 });
    await expect(niveauxMock.supprimer(1)).rejects.toMatchObject({ status: 409 });
  });
});
