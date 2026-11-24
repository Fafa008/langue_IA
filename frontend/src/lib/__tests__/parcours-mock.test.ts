import { mockFetch } from "@/test/fetch-mock";

// FE-D5 (option B) : un build de démo peut simuler le parcours seul, sans simuler le reste de l'API.
// Les variables NEXT_PUBLIC_* sont lues au chargement du module : chaque cas recharge le module.
const ENV = {
  API_MOCK: process.env.NEXT_PUBLIC_API_MOCK,
  PARCOURS: process.env.NEXT_PUBLIC_PARCOURS_MOCK,
  AUTH_REELLE: process.env.NEXT_PUBLIC_AUTH_REELLE,
  PARCOURS_REELLE: process.env.NEXT_PUBLIC_PARCOURS_REELLE,
};

function charger(env: { api?: string; parcours?: string; authReelle?: string; parcoursReelle?: string }) {
  process.env.NEXT_PUBLIC_API_MOCK = env.api;
  process.env.NEXT_PUBLIC_PARCOURS_MOCK = env.parcours;
  process.env.NEXT_PUBLIC_AUTH_REELLE = env.authReelle;
  process.env.NEXT_PUBLIC_PARCOURS_REELLE = env.parcoursReelle;
  let charge!: typeof import("@/lib/env") & { parcoursPersonnaliseService: { enCours: () => Promise<unknown> } };
  jest.isolateModules(() => {
    charge = { ...require("@/lib/env"), parcoursPersonnaliseService: require("@/services/parcours-personnalise.service").parcoursPersonnaliseService };
  });
  return charge;
}

afterEach(() => {
  process.env.NEXT_PUBLIC_API_MOCK = ENV.API_MOCK;
  process.env.NEXT_PUBLIC_PARCOURS_MOCK = ENV.PARCOURS;
  process.env.NEXT_PUBLIC_AUTH_REELLE = ENV.AUTH_REELLE;
  process.env.NEXT_PUBLIC_PARCOURS_REELLE = ENV.PARCOURS_REELLE;
});

describe("FE-D5 — mocks du parcours dans un build de démo", () => {
  it("API réelle sans drapeau du parcours : le parcours n'est pas simulé", () => {
    expect(charger({ api: "false" }).PARCOURS_MOCK).toBe(false);
  });

  it("API réelle avec NEXT_PUBLIC_PARCOURS_MOCK=true : seul le parcours est simulé, sans appel réseau", async () => {
    const env = charger({ api: "false", parcours: "true" });
    expect(env.PARCOURS_MOCK).toBe(true);
    const fetchMock = mockFetch({ body: {} });
    await expect(env.parcoursPersonnaliseService.enCours()).resolves.toMatchObject({ idParcours: 7 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("le mode simulé complet simule aussi le parcours", () => {
    expect(charger({ api: "true" }).PARCOURS_MOCK).toBe(true);
  });

  it("une démo peut garder le test simulé et brancher auth/parcours sur le vrai backend et l'IA", () => {
    const env = charger({ api: "true", authReelle: "true", parcoursReelle: "true" });
    expect(env.API_MOCK).toBe(true); // le test de positionnement reste simulé (bouton « Passer »)
    expect(env.AUTH_MOCK).toBe(false);
    expect(env.PARCOURS_MOCK).toBe(false); // recommandations et chat passent par le backend, puis l'IA
  });
});
