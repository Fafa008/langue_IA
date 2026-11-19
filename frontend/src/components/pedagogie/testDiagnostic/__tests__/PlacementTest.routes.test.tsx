import { screen } from "@testing-library/react";
import PlacementTest from "@/components/pedagogie/testDiagnostic/PlacementTest";
import { mockFetch } from "@/test/fetch-mock";
import { afficher } from "@/test/rendu-avec-query";

// FE-D1 (décision D1 : reprise retirée pour la démo) : l'écran d'entrée du test diagnostic
// ne doit émettre aucune requête vers les routes absentes du backend.
const ROUTES_ABSENTES = ["/diagnostic/tentatives/en-cours", "/abandonner"];

jest.mock("next/navigation", () => {
  const routeur = { replace: jest.fn(), push: jest.fn(), prefetch: jest.fn(), back: jest.fn() };
  return { useRouter: () => routeur };
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("FE-D1 — écran d'entrée du test diagnostic", () => {
  it("n'appelle ni en-cours ni abandonner, et n'affiche aucun test interrompu", async () => {
    const fetchMock = mockFetch({ body: [] });

    afficher(<PlacementTest />);

    expect(await screen.findByRole("heading", { name: "Évaluez votre niveau" })).toBeInTheDocument();
    expect(screen.queryByText(/Recherche d'un test en cours/)).not.toBeInTheDocument();

    const urls = (fetchMock.mock.calls as unknown[][]).map(([url]) => String(url));
    for (const absente of ROUTES_ABSENTES) {
      expect(urls.filter((url) => url.includes(absente))).toEqual([]);
    }
  });
});
