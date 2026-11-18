import { authMock, EMAIL_COMPTE_INACTIF } from "@/mocks/auth.mock";
import { COMPTES_DEMO, MOT_DE_PASSE_DEMO } from "@/mocks/comptes-demo";
import type { RegisterPayload } from "@/types/auth";

/* Connexion simulée (NEXT_PUBLIC_API_MOCK=true) : un compte de démonstration par rôle. */

/** Lit le contenu (payload) du JWT factice. */
const jwtPayload = (token: string) => JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));

describe("authMock.login", () => {
  it.each(Object.entries(COMPTES_DEMO))("connecte le compte %s avec son rôle", async (role, { utilisateur }) => {
    const session = await authMock.login({ email: utilisateur.email, motDePasse: MOT_DE_PASSE_DEMO });

    expect(session.utilisateur).toMatchObject({ role, email: utilisateur.email, statut: "ACTIF" });
    expect(jwtPayload(session.accessToken)).toMatchObject({ sub: String(utilisateur.idUser), role });
    expect(jwtPayload(session.accessToken).exp * 1000).toBeGreaterThan(Date.now());
  });

  it("refuse un mauvais mot de passe ou une adresse inconnue (401)", async () => {
    await expect(authMock.login({ email: COMPTES_DEMO.ADMINISTRATEUR.utilisateur.email, motDePasse: "Faux2026" })).rejects.toMatchObject({ status: 401 });
    await expect(authMock.login({ email: "inconnu@exemple.com", motDePasse: MOT_DE_PASSE_DEMO })).rejects.toMatchObject({ status: 401 });
  });

  it("refuse un compte non actif (403)", async () => {
    await expect(authMock.login({ email: EMAIL_COMPTE_INACTIF, motDePasse: MOT_DE_PASSE_DEMO })).rejects.toMatchObject({ status: 403 });
  });
});

describe("authMock.register", () => {
  const payload: RegisterPayload = {
    prenom: "Lova",
    nom: "RABE",
    email: "lova@exemple.com",
    motDePasse: "Langue2026",
    dateNaissance: "2001-02-03",
    langues: ["en"],
    idFormule: 1,
  };

  it("crée un apprenant qui peut ensuite se connecter", async () => {
    await authMock.register(payload);
    const session = await authMock.login({ email: payload.email, motDePasse: payload.motDePasse });
    expect(session.utilisateur).toMatchObject({ role: "APPRENANT", prenom: "Lova" });
  });

  it("refuse l'adresse d'un compte existant (409)", async () => {
    await expect(authMock.register({ ...payload, email: COMPTES_DEMO.FORMATEUR.utilisateur.email })).rejects.toMatchObject({ status: 409 });
  });
});
