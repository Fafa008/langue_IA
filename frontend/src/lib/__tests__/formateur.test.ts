import { toTypeContrat } from "@/lib/formateur";
import { validateFormateur } from "@/lib/validation/formateur";
import type { FormateurFormValues } from "@/types/formateur";

const VALIDE: FormateurFormValues = {
  prenom: "Hery",
  nom: "RANDRIA",
  email: "hery@exemple.com",
  telephone: "",
  typeContrat: "CDI",
  certifications: "",
  idLangues: [1],
};

describe("validateFormateur", () => {
  it("accepte un formateur complet, téléphone et certifications facultatifs", () => {
    expect(validateFormateur(VALIDE)).toEqual({});
  });

  it("exige identité, contrat et au moins une langue", () => {
    expect(validateFormateur({ ...VALIDE, prenom: "", nom: "", email: "", typeContrat: "", idLangues: [] })).toEqual({
      prenom: "Le prénom est requis.",
      nom: "Le nom est requis.",
      email: "L'adresse e-mail est requise.",
      typeContrat: "Choisissez le type de contrat.",
      idLangues: "Choisissez au moins une langue enseignée.",
    });
  });

  it("contrôle le téléphone s'il est saisi, et la longueur des certifications", () => {
    const erreurs = validateFormateur({ ...VALIDE, telephone: "12", certifications: "x".repeat(501) });
    expect(Object.keys(erreurs)).toEqual(["telephone", "certifications"]);
  });
});

describe("toTypeContrat", () => {
  it("garde les valeurs connues et ramène les autres à null", () => {
    expect(toTypeContrat("VACATAIRE")).toBe("VACATAIRE");
    expect(toTypeContrat("Stage")).toBeNull();
    expect(toTypeContrat(null)).toBeNull();
  });
});
