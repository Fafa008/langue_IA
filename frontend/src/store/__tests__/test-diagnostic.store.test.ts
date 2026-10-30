import { selectTestEnCours, useTestDiagnosticStore } from "@/store/test-diagnostic.store";
import type { SessionTest } from "@/types/test-diagnostic";

const session: SessionTest = {
  id: "session-1",
  langue: "en",
  niveaux: ["A1", "A2", "B1"],
  numeroQuestion: 1,
  totalQuestions: 3,
  plan: [{ etape: "expression_orale", nombreQuestions: 3 }],
  question: { id: "q-1", niveau: "A2", competence: "oral", typeReponse: "audio", enonce: "Parlez" },
};

describe("store du test de positionnement", () => {
  beforeEach(() => {
    sessionStorage.clear();
    useTestDiagnosticStore.getState().reinitialiser();
  });

  it("applique les transitions du réducteur et signale le test en cours", () => {
    const { dispatch } = useTestDiagnosticStore.getState();
    expect(selectTestEnCours(useTestDiagnosticStore.getState())).toBe(false);
    dispatch({ type: "demarrer", session, debut: 0 });
    expect(useTestDiagnosticStore.getState().etat).toMatchObject({ phase: "question", sessionId: "session-1" });
    expect(selectTestEnCours(useTestDiagnosticStore.getState())).toBe(true);
  });

  it("conserve la session dans sessionStorage, sans l'enregistrement audio", () => {
    const { dispatch } = useTestDiagnosticStore.getState();
    dispatch({ type: "demarrer", session, debut: 0 });
    dispatch({ type: "choisirAudio", audio: new Blob(["son"]) });
    expect(useTestDiagnosticStore.getState().etat.audioEnregistre).not.toBeNull();
    const enregistre = JSON.parse(sessionStorage.getItem("digitheque-test-diagnostic") ?? "{}");
    expect(enregistre.state.etat).toMatchObject({ sessionId: "session-1", audioEnregistre: null });
  });

  it("repart d'un test vierge après réinitialisation", () => {
    useTestDiagnosticStore.getState().dispatch({ type: "demarrer", session, debut: 0 });
    useTestDiagnosticStore.getState().reinitialiser();
    expect(useTestDiagnosticStore.getState().etat).toMatchObject({ phase: "intro", langue: null, sessionId: null });
  });
});
