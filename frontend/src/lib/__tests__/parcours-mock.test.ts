import { mockFetch } from "@/test/fetch-mock";

// Deux presets seulement : "reel" (backend partout) et "demo" (mocks + IA réelle).
// NEXT_PUBLIC_MODE est lu au chargement du module : chaque cas recharge le module.
const MODE_INITIAL = process.env.NEXT_PUBLIC_MODE;

function charger(mode: "reel" | "demo") {
  process.env.NEXT_PUBLIC_MODE = mode;
  type Service = typeof import("@/services/parcours-personnalise.service")["parcoursPersonnaliseService"];
  let charge!: typeof import("@/lib/env") & { parcoursPersonnaliseService: Service };
  jest.isolateModules(() => {
    charge = {
      ...require("@/lib/env"),
      parcoursPersonnaliseService: require("@/services/parcours-personnalise.service").parcoursPersonnaliseService,
    };
  });
  return charge;
}

afterEach(() => {
  if (MODE_INITIAL === undefined) delete process.env.NEXT_PUBLIC_MODE;
  else process.env.NEXT_PUBLIC_MODE = MODE_INITIAL;
});

describe("presets frontend — reel / demo", () => {
  it("le preset réel n'utilise aucun mock", async () => {
    const env = charger("reel");
    expect(env.API_MOCK).toBe(false);
    expect(env.AUTH_MOCK).toBe(false);
    expect(env.PARCOURS_MOCK).toBe(false);
    const fetchMock = mockFetch({ body: {} });
    await expect(env.parcoursPersonnaliseService.enCours()).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalled(); // la réponse vide est volontaire : seul le chemin HTTP est vérifié ici
  });

  it("le preset demo simule le parcours affiché sans appel réseau pour enCours", async () => {
    const env = charger("demo");
    expect(env.API_MOCK).toBe(true); // test de positionnement simulé, bouton « Passer »
    expect(env.AUTH_MOCK).toBe(false); // JWT réel du compte de seed, pour autoriser le chat
    expect(env.PARCOURS_MOCK).toBe(true);
    const fetchMock = mockFetch({ body: {} });
    await expect(env.parcoursPersonnaliseService.enCours()).resolves.toMatchObject({ idParcours: 7 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("en demo, le chat passe par le backend puis le service IA", async () => {
    const env = charger("demo");
    const fetchMock = mockFetch({ body: { reponse: "Bonjour", corrections: [] } });
    await expect(env.parcoursPersonnaliseService.chatbot("Bonjour", [])).resolves.toMatchObject({
      reponse: "Bonjour",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
