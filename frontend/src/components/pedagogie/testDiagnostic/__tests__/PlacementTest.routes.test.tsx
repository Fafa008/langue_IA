import { fireEvent, screen, waitFor } from "@testing-library/react";
import PlacementTest from "@/components/pedagogie/testDiagnostic/PlacementTest";
import { useTestDiagnosticStore } from "@/store/test-diagnostic.store";
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
  beforeEach(() => {
    useTestDiagnosticStore.getState().dispatch({ type: "choisirLangue", langue: null });
  });

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

  it("demande explicitement laquelle évaluer quand plusieurs langues sont inscrites", async () => {
    mockFetch({
      body: [
        { code: "en", libelle: "Anglais", cadre: "CECRL", niveaux: ["A1"], nombre_questions: 8, disponible: true },
        { code: "fr", libelle: "Français", cadre: "CECRL", niveaux: ["A1"], nombre_questions: 8, disponible: true },
      ],
    });

    afficher(<PlacementTest />);

    const anglais = await screen.findByRole("radio", { name: /Anglais/ });
    const francais = screen.getByRole("radio", { name: /Français/ });
    expect(screen.getByText("Vous avez choisi plusieurs langues. Laquelle souhaitez-vous évaluer en premier ?")).toBeInTheDocument();
    expect(anglais).not.toBeChecked();
    expect(francais).not.toBeChecked();
    expect(screen.getByRole("button", { name: /Commencer le test/ })).toBeDisabled();

    fireEvent.click(anglais);
    await waitFor(() => expect(anglais).toBeChecked());
    expect(screen.getByRole("button", { name: /Commencer le test/ })).toBeEnabled();
  });

  it("présente directement l'unique langue inscrite sans demander de choix", async () => {
    mockFetch({
      body: [
        { code: "fr", libelle: "Français", cadre: "CECRL", niveaux: ["A1"], nombre_questions: 8, disponible: true },
      ],
    });

    afficher(<PlacementTest />);

    await screen.findByText("Français");
    expect(screen.getByText(/grammaire, lexique et compréhension écrite/i)).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByText(/Laquelle souhaitez-vous évaluer en premier/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Commencer le test/ })).toBeEnabled();
  });
});
