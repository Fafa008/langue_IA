import { mockFetch } from "@/test/fetch-mock";

// FE-D5 (option B) : un build de démo peut simuler le parcours seul, sans simuler le reste de l'API.
// Les variables NEXT_PUBLIC_* sont lues au chargement du module : chaque cas recharge le module.
const ENV = { API_MOCK: process.env.NEXT_PUBLIC_API_MOCK, PARCOURS: process.env.NEXT_PUBLIC_PARCOURS_MOCK };

function charger(env: { api?: string; parcours?: string }) {
  process.env.NEXT_PUBLIC_API_MOCK = env.api;
  process.env.NEXT_PUBLIC_PARCOURS_MOCK = env.parcours;
  let charge!: typeof import("@/lib/env") & { parcoursPersonnaliseService: { enCours: () => Promise<unknown> } };
  jest.isolateModules(() => {
    charge = { ...require("@/lib/env"), parcoursPersonnaliseService: require("@/services/parcours-personnalise.service").parcoursPersonnaliseService };
  });
  return charge;
}

afterEach(() => {
  process.env.NEXT_PUBLIC_API_MOCK = ENV.API_MOCK;
  process.env.NEXT_PUBLIC_PARCOURS_MOCK = ENV.PARCOURS;
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
});
