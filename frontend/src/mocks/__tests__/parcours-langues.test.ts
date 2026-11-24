import { choisirLangueParcoursMock, choisirScenarioParcoursMock, parcoursPersonnaliseMock } from "@/mocks/parcours-personnalise.mock";
import { packParcoursMock } from "@/mocks/parcours-langues";

jest.mock("@/mocks/delay", () => ({ delay: () => Promise.resolve() }));

const CAS: [string, string, string, string, string][] = [
  ["fr", "Français", "CECRL", "Premiers contacts", "Comprendre un message"],
  ["en", "Anglais", "CECRL", "First contacts", "Understanding a message"],
  ["it", "Italien", "CECRL", "Primi contatti", "Capire un messaggio"],
  ["de", "Allemand", "CECRL", "Erste Kontakte", "Eine Nachricht verstehen"],
  ["zh", "Mandarin", "HSK", "初次接触", "理解留言"],
];

describe("langues du parcours simulé", () => {
  it.each(CAS)("affiche le contenu en %s quand le parcours backend est en %s", async (code, libelle, cadre, module, exercice) => {
    choisirScenarioParcoursMock("passif", code);
    const parcours = await parcoursPersonnaliseMock.enCours();
    expect(parcours).toMatchObject({ code_langue: code, libelle_langue: libelle, cadre });
    expect(parcours.modules[0].titre).toBe(module);
    expect(parcours.niveaux_cadre[0]).toBe(cadre === "HSK" ? "HSK 1" : "A1");

    const lecon = await parcoursPersonnaliseMock.lecon(7, 23);
    expect(lecon.code_langue).toBe(code);
    expect(lecon.exercices[0].intitule).toBe(exercice);
  });

  it("génère des recommandations dans la langue du parcours", async () => {
    choisirScenarioParcoursMock("passif", "zh");
    const recommandation = await parcoursPersonnaliseMock.recommandations(7);
    expect(recommandation).toMatchObject({ code_langue: "zh", referentiel: "HSK", niveau_cible: "HSK 3" });
    expect(recommandation.recommandations[0].action).toContain("了");
  });

  it("retombe sur le français pour un code non prévu", () => {
    expect(packParcoursMock(undefined).code).toBe("fr");
    expect(packParcoursMock("es").code).toBe("fr");
    expect(choisirLangueParcoursMock("zh-CN")).toBe("zh");
  });
});
