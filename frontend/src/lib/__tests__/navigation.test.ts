import { ACCUEIL_PAR_ROLE, NAVIGATION } from "@/lib/navigation";
import { ROLES } from "@/lib/roles";
import { ROUTES } from "@/lib/routes";

describe("navigation par rôle", () => {
  it.each(ROLES)("l'accueil du rôle %s est la première entrée, disponible, de son menu", (role) => {
    const [premier] = NAVIGATION[role];
    expect(premier.href).toBe(ACCUEIL_PAR_ROLE[role]);
    expect(premier.bientot).toBeUndefined();
  });

  it("chaque rôle a un accueil différent", () => {
    expect(new Set(Object.values(ACCUEIL_PAR_ROLE)).size).toBe(ROLES.length);
  });

  it("les espaces apprenant et formateur donnent accès au profil", () => {
    expect(NAVIGATION.APPRENANT.map((i) => i.href)).toContain(ROUTES.profil);
    expect(NAVIGATION.FORMATEUR.map((i) => i.href)).toContain(ROUTES.profil);
  });

  it("chaque rôle arrive dans son dossier de l'espace connecté", () => {
    expect(ACCUEIL_PAR_ROLE).toEqual({
      APPRENANT: "/espace/apprenant",
      FORMATEUR: "/espace/formateur",
      ADMINISTRATEUR: "/espace/admin",
    });
  });

  it("toutes les pages d'un rôle sont rangées dans son dossier (sauf le profil, commun)", () => {
    const dossiers = { APPRENANT: "/espace/apprenant", FORMATEUR: "/espace/formateur", ADMINISTRATEUR: "/espace/admin" };
    for (const role of ROLES) {
      for (const { href } of NAVIGATION[role]) {
        if (href !== ROUTES.profil) expect(href.startsWith(dossiers[role])).toBe(true);
      }
    }
  });
});
