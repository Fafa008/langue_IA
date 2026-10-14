import { formatTelephone, initiales } from "@/lib/saisie";
import { validateProfil, validateTelephone } from "@/lib/validation/profil";
import type { ProfilFormValues } from "@/types/profil";

const valid: ProfilFormValues = {
  prenom: "Finoana",
  nom: "RASOLOFO",
  email: "finoana.rasolofo@gmail.com",
  telephone: "034 12 345 67",
  motDePasseActuel: "",
  motDePasse: "",
  confirmation: "",
};

describe("validateProfil", () => {
  it("accepte un profil complet sans changement de mot de passe", () => {
    expect(validateProfil(valid)).toEqual({});
  });

  it("exige les champs obligatoires", () => {
    expect(Object.keys(validateProfil({ ...valid, prenom: "", nom: "", email: "" }))).toEqual(["prenom", "nom", "email"]);
  });

  it("accepte un téléphone vide, mais contrôle son format s'il est saisi", () => {
    expect(validateProfil({ ...valid, telephone: "" })).toEqual({});
    expect(validateProfil({ ...valid, telephone: "   " })).toEqual({});
    expect(validateProfil({ ...valid, telephone: "12" }).telephone).toMatch(/Numéro de téléphone invalide/);
  });

  it("exige le mot de passe actuel pour en changer", () => {
    expect(validateProfil({ ...valid, motDePasse: "Nouveau2026", confirmation: "Nouveau2026" }).motDePasseActuel).toBe(
      "Saisissez votre mot de passe actuel.",
    );
    expect(
      validateProfil({ ...valid, motDePasseActuel: "Actuel2026", motDePasse: "Nouveau2026", confirmation: "Nouveau2026" }),
    ).toEqual({});
  });

  it("contrôle le nouveau mot de passe et sa confirmation", () => {
    const changement = { ...valid, motDePasseActuel: "Actuel2026" };
    expect(validateProfil({ ...changement, motDePasse: "court" }).motDePasse).toMatch(/8 caractères/);
    expect(validateProfil({ ...changement, motDePasse: "Langue2026", confirmation: "Autre2026" }).confirmation).toBe(
      "Les mots de passe ne correspondent pas.",
    );
    expect(validateProfil({ ...changement, confirmation: "Langue2026" }).motDePasse).toBe("Le mot de passe est requis.");
  });

  it("refuse un nouveau mot de passe identique à l'actuel", () => {
    expect(
      validateProfil({ ...valid, motDePasseActuel: "Langue2026", motDePasse: "Langue2026", confirmation: "Langue2026" })
        .motDePasse,
    ).toBe("Le nouveau mot de passe doit être différent de l'actuel.");
  });

  it("ne contrôle aucun mot de passe si les trois champs sont vides", () => {
    expect(validateProfil(valid)).toEqual({});
  });
});

describe("validateTelephone", () => {
  it.each(["034 12 345 67", "032 98 765 43", "020 22 123 45", "0341234567"])("accepte %s", (tel) => {
    expect(validateTelephone(tel)).toBeUndefined();
  });

  it.each(["034 12 345", "134 12 345 67", "12"])("refuse %s", (tel) => {
    expect(validateTelephone(tel)).toBe("Numéro de téléphone invalide : 10 chiffres, au format 030 00 000 00.");
  });
});

describe("formatTelephone", () => {
  it("groupe les chiffres en 030 00 000 00 au fil de la saisie", () => {
    expect(formatTelephone("0")).toBe("0");
    expect(formatTelephone("030")).toBe("030");
    expect(formatTelephone("0301")).toBe("030 1");
    expect(formatTelephone("03012")).toBe("030 12");
    expect(formatTelephone("030123")).toBe("030 12 3");
    expect(formatTelephone("0301234567")).toBe("030 12 345 67");
  });

  it("ne garde que les chiffres : les lettres et symboles tapés n'apparaissent pas", () => {
    expect(formatTelephone("03a4b")).toBe("034");
    expect(formatTelephone("034-12.345/67")).toBe("034 12 345 67");
  });

  it("s'arrête à 10 chiffres", () => {
    expect(formatTelephone("034123456789")).toBe("034 12 345 67");
  });

  it("ramène un numéro international au format local", () => {
    expect(formatTelephone("+261 34 12 345 67")).toBe("034 12 345 67");
    expect(formatTelephone("+261341234567")).toBe("034 12 345 67");
  });

  it("la mise en forme d'un début de saisie est le début de la mise en forme complète", () => {
    const complet = formatTelephone("0341234567");
    for (let i = 0; i <= 10; i++) expect(complet.startsWith(formatTelephone("0341234567".slice(0, i)))).toBe(true);
  });
});
