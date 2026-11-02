import { cadreDeLangue, descriptionEchelle, ECHELLES } from "@/lib/referentiels";

describe("référentiels de niveaux", () => {
  it("évalue le chinois en HSK et les autres langues en CECRL", () => {
    expect(cadreDeLangue("zh")).toBe("HSK");
    expect(cadreDeLangue("en")).toBe("CECRL");
  });

  it("décrit l'échelle d'une langue par son premier et son dernier niveau", () => {
    expect(descriptionEchelle("CECRL", ECHELLES.CECRL)).toBe("Échelle CECRL, A1 à C2");
    expect(descriptionEchelle("HSK", ECHELLES.HSK)).toBe("Échelle HSK, HSK 1 à 6");
    expect(descriptionEchelle("CECRL", [])).toBe("Échelle CECRL");
  });
});
