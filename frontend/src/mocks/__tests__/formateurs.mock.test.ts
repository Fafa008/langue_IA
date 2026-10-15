import { formateursMock } from "@/mocks/formateurs.mock";

const TOUS = { recherche: "", statut: null, page: 1, taille: 50 };

const NOUVEAU = {
  prenom: "Lova",
  nom: "RAKOTONIRINA",
  email: "lova.rakotonirina@exemple.com",
  telephone: null,
  typeContrat: "CDD" as const,
  certifications: null,
  idLangues: [3, 1],
};

describe("formateursMock", () => {
  it("recherche sans tenir compte des accents, et filtre par statut", async () => {
    expect((await formateursMock.lister({ ...TOUS, recherche: "RANDRIA" })).items.map((f) => f.email)).toEqual(["formateur@digitheque.mg"]);
    const inactifs = await formateursMock.lister({ ...TOUS, statut: "INACTIF" });
    expect(inactifs.items.every((f) => f.statut === "INACTIF")).toBe(true);
    expect(inactifs.total).toBeGreaterThan(0);
  });

  it("crée, modifie puis désactive un formateur", async () => {
    const cree = await formateursMock.creer(NOUVEAU);
    expect(cree).toMatchObject({ role: "FORMATEUR", statut: "ACTIF", typeContrat: "CDD" });
    // Langues triées par désignation
    expect(cree.languesEnseignees.map((l) => l.libelle)).toEqual(["Français", "Mandarin"]);

    const modifie = await formateursMock.modifier(cree.idUser, { typeContrat: "CDI", idLangues: [2] });
    expect(modifie.typeContrat).toBe("CDI");
    expect(modifie.languesEnseignees.map((l) => l.code)).toEqual(["en"]);
    expect(modifie.prenom).toBe("Lova");

    const desactive = await formateursMock.modifier(cree.idUser, { statut: "INACTIF" });
    expect(desactive.statut).toBe("INACTIF");
  });

  it("refuse un e-mail déjà utilisé (409)", async () => {
    await expect(formateursMock.creer({ ...NOUVEAU, email: "formateur@digitheque.mg" })).rejects.toMatchObject({ status: 409 });
  });
});
