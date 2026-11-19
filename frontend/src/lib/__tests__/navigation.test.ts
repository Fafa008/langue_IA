import { ACCUEIL_PAR_ROLE, estActif, NAVIGATION } from "@/lib/navigation";
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

  it("le test de positionnement est accessible dans l'espace apprenant", () => {
    expect(NAVIGATION.APPRENANT.find((item) => item.href === ROUTES.apprenant.testDiagnostic.demarrage)).toMatchObject({
      label: "Test de positionnement",
    });
  });

  it("le parcours personnalisé est accessible dans l'espace apprenant", () => {
    const parcours = NAVIGATION.APPRENANT.find((item) => item.href === ROUTES.apprenant.parcours.accueil);
    expect(parcours).toMatchObject({ label: "Mon parcours" });
    expect(parcours?.bientot).toBeUndefined();
  });

  it("le professeur IA est accessible depuis le menu, avec sa page (US73-FE)", () => {
    const chat = NAVIGATION.APPRENANT.find((item) => item.href === ROUTES.apprenant.chat);
    expect(chat).toMatchObject({ label: "Professeur IA" });
    expect(chat?.bientot).toBeUndefined();
  });

  it("« Mon parcours » reste en évidence sur les pages des modules et des leçons", () => {
    const parcours = NAVIGATION.APPRENANT.find((item) => item.href === ROUTES.apprenant.parcours.accueil)!;
    expect(estActif(parcours, ROUTES.apprenant.parcours.module(2))).toBe(true);
    expect(estActif(parcours, ROUTES.apprenant.parcours.lecon(12))).toBe(true);
    expect(estActif(parcours, "/espace/apprenant/parcours-autre")).toBe(false);
    // L'accueil de l'apprenant n'est pas mis en évidence sur les pages du parcours
    expect(estActif(NAVIGATION.APPRENANT[0], ROUTES.apprenant.parcours.accueil)).toBe(false);
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
