import { getPasswordStrength, validatePassword } from "@/lib/password";
import { formatEmail, formatNom, formatPrenom, normaliserEspaces } from "@/lib/saisie";
import { validateBirthDate, validateEmail, validateFormule, validateLogin, validateRegister } from "@/lib/validation/auth";
import type { RegisterFormValues } from "@/types/auth";
import type { Formule } from "@/types/formule";

describe("getPasswordStrength", () => {
  it("renvoie 'empty' pour un mot de passe vide", () => {
    expect(getPasswordStrength("").level).toBe("empty");
  });

  it("compte les règles respectées", () => {
    expect(getPasswordStrength("abcdefgh").score).toBe(1);
    expect(getPasswordStrength("Abcdefg1").score).toBe(3);
    expect(getPasswordStrength("Abcdef1!").level).toBe("strong");
  });
});

describe("validatePassword", () => {
  it("n'exige pas le caractère spécial", () => {
    expect(validatePassword("Abcdefg1")).toBeUndefined();
  });

  it("refuse un mot de passe sans chiffre", () => {
    expect(validatePassword("Abcdefgh")).toMatch(/chiffre/);
  });
});

describe("validateEmail", () => {
  it.each(["rova@exemple.com", "rova.rakoto+test@mail.exemple.mg", "r_2@sous-domaine.co"])("accepte %s", (email) => {
    expect(validateEmail(email)).toBeUndefined();
  });

  it.each([
    "rova@exemple",
    "rova@exemple.c",
    ".rova@exemple.com",
    "rova.@exemple.com",
    "rova..rakoto@exemple.com",
    "ro va@exemple.com",
    "rova@-exemple.com",
    "rova@exemple..com",
    "rova@@exemple.com",
  ])("refuse %s", (email) => {
    expect(validateEmail(email)).toBe("Adresse e-mail invalide.");
  });
});

describe("mise en forme des noms", () => {
  it("met le nom en majuscules", () => {
    expect(formatNom("rakoto-andria")).toBe("RAKOTO-ANDRIA");
  });

  it("met une majuscule à chaque prénom", () => {
    expect(formatPrenom("rova marie")).toBe("Rova Marie");
    expect(formatPrenom("jean-PIERRE")).toBe("Jean-Pierre");
    expect(formatPrenom("élodie")).toBe("Élodie");
  });

  it("met l'e-mail en minuscules et retire les caractères interdits", () => {
    expect(formatEmail("Rova.Rakoto@Exemple.COM")).toBe("rova.rakoto@exemple.com");
    expect(formatEmail("ro va(é)@exemple.mg")).toBe("rova@exemple.mg");
  });

  it("retire les espaces en trop", () => {
    expect(normaliserEspaces("  Rova   Marie ")).toBe("Rova Marie");
  });
});

describe("validateBirthDate", () => {
  const today = new Date("2026-10-06T12:00:00");

  it("est obligatoire", () => {
    expect(validateBirthDate("", today)).toMatch(/requise/);
  });

  it("refuse une date dans le futur", () => {
    expect(validateBirthDate("2030-01-01", today)).toMatch(/futur/);
  });

  it("accepte une date passée", () => {
    expect(validateBirthDate("2000-05-12", today)).toBeUndefined();
  });
});

describe("validateLogin", () => {
  it("ne renvoie aucune erreur pour des valeurs valides", () => {
    expect(validateLogin({ email: "a@b.co", motDePasse: "x", seSouvenir: false })).toEqual({});
  });

  it("signale un e-mail invalide", () => {
    expect(validateLogin({ email: "pas-un-mail", motDePasse: "x", seSouvenir: false }).email).toBeDefined();
  });
});

const FORMULES: Formule[] = [
  { idFormule: 1, libelle: "Essentiel", prixMensuel: 80000, dureeMois: 1, quotaHeures: 8, quotaAteliers: 2, langues: ["fr", "en"] },
  { idFormule: 2, libelle: "Intégral", prixMensuel: 150000, dureeMois: 3, quotaHeures: 20, quotaAteliers: 6, langues: [] },
];

describe("validateFormule", () => {
  it("exige une formule", () => {
    expect(validateFormule(null, ["fr"], FORMULES)).toMatch(/formule/);
  });

  it("accepte les langues couvertes par la formule", () => {
    expect(validateFormule(1, ["fr", "en"], FORMULES)).toBeUndefined();
  });

  it("signale les langues non couvertes", () => {
    expect(validateFormule(1, ["fr", "zh"], FORMULES)).toBe("La formule « Essentiel » ne couvre pas : Mandarin.");
  });

  it("une formule sans liste de langues les couvre toutes", () => {
    expect(validateFormule(2, ["zh", "de"], FORMULES)).toBeUndefined();
  });
});

describe("validateRegister", () => {
  const valid: RegisterFormValues = {
    prenom: "Rova",
    nom: "Rakoto",
    email: "rova@exemple.com",
    dateNaissance: "2000-05-12",
    langues: ["fr"],
    idFormule: 1,
    motDePasse: "Abcdefg1",
    confirmation: "Abcdefg1",
    accepteConditions: true,
  };

  it("accepte un formulaire complet", () => {
    expect(validateRegister(valid, FORMULES)).toEqual({});
  });

  it("détecte une confirmation différente et des conditions non acceptées", () => {
    const errors = validateRegister({ ...valid, confirmation: "autre", accepteConditions: false }, FORMULES);
    expect(Object.keys(errors).sort()).toEqual(["accepteConditions", "confirmation"]);
  });

  it("refuse les chiffres dans le nom et le prénom", () => {
    const errors = validateRegister({ ...valid, prenom: "Rova2", nom: "RAKOTO" }, FORMULES);
    expect(errors.prenom).toMatch(/que des lettres/);
    expect(errors.nom).toBeUndefined();
  });

  it("exige au moins une langue, une formule et la date de naissance", () => {
    const errors = validateRegister({ ...valid, langues: [], idFormule: null, dateNaissance: "" }, FORMULES);
    expect(Object.keys(errors).sort()).toEqual(["dateNaissance", "idFormule", "langues"]);
  });
});
