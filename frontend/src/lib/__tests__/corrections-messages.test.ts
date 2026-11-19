import { repererErreurs } from "@/lib/corrections-messages";

// US74-FE : corrections en marge simulées ; aucune correction vide n'est produite.
describe("US74-FE — repérage des erreurs d'un message", () => {
  it("relève l'extrait fautif, sa correction et la règle", () => {
    expect(repererErreurs("hier j'ai allé au cinéma")).toEqual([
      expect.objectContaining({ extrait: "j'ai allé", correction: "je suis allé(e)" }),
    ]);
  });

  it("ne relève rien dans un message correct", () => {
    expect(repererErreurs("Je m'appelle Rova.")).toEqual([]);
  });
});
