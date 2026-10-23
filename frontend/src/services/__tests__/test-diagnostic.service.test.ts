import { configureApiClient } from "@/lib/api-client";
import { QUESTIONS_TEST } from "@/mocks/questions-test.mock";
import { httpTestDiagnosticService } from "@/services/test-diagnostic.service";
import { fetchCall, mockFetch } from "@/test/fetch-mock";

const API = "http://localhost:8000/api/v1";

beforeEach(() => {
  configureApiClient({ getToken: () => "jwt-test", onUnauthorized: jest.fn() });
});

describe("httpTestDiagnosticService", () => {
  it("crée une tentative puis charge les questions de son niveau", async () => {
    const fetchMock = mockFetch({
      status: 201,
      body: {
        id_tentative: 42,
        code_langue: "en",
        code_niveau: "A1",
      },
    }, {
      body: [{
        id_question: "1",
        niveau: "A1",
        competence: "grammaire",
        type_reponse: "choix",
        enonce: "She ___ a student.",
        choix: ["is", "are"],
      }],
    });

    await expect(httpTestDiagnosticService.demarrer("en", "professionnel", ["matin"])).resolves.toEqual({
      id: "42",
      langue: "en",
      niveaux: ["A1"],
      numeroQuestion: 1,
      totalQuestions: 1,
      question: {
        id: "1",
        niveau: "A1",
        competence: "grammaire",
        typeReponse: "choix",
        enonce: "She ___ a student.",
        choix: ["is", "are"],
      },
      questions: [{
        id: "1",
        niveau: "A1",
        competence: "grammaire",
        typeReponse: "choix",
        enonce: "She ___ a student.",
        choix: ["is", "are"],
      }],
    });
    const debut = fetchCall(fetchMock, 0);
    const questions = fetchCall(fetchMock, 1);
    expect([debut.url, debut.init.method, debut.body]).toEqual([
      `${API}/diagnostic/tentatives`,
      "POST",
      { code_langue: "en" },
    ]);
    expect([questions.url, questions.init.method]).toEqual([
      `${API}/diagnostic/questions?code_langue=en&code_niveau=A1`,
      "GET",
    ]);
    expect(debut.headers.Authorization).toBeDefined();
  });

  it("enregistre la réponse sans simuler son évaluation", async () => {
    const fetchMock = mockFetch({
      body: {
        id_reponse: 81,
        id_tentative: 42,
        id_question: "1",
        reponse_fournie: "is",
      },
    });

    await expect(
      httpTestDiagnosticService.repondre(
        "42",
        "1",
        { type: "choix", choix: 0 },
        "is",
        { numeroQuestion: 1, totalQuestions: 3, questionSuivante: null },
      ),
    ).resolves.toMatchObject({
      typeReponse: "en_attente",
      questionSuivante: null,
      resultat: null,
    });
    const { url, init, body } = fetchCall(fetchMock);
    expect([url, init.method, body]).toEqual([
      `${API}/diagnostic/reponse`,
      "POST",
      { id_tentative: 42, id_question: "1", reponse_fournie: "is" },
    ]);
  });

  it("refuse l'envoi de réponses audio tant qu'aucun stockage média n'est disponible", async () => {
    await expect(
      httpTestDiagnosticService.repondre("42", "1", { type: "audio", audio: new Blob(["audio"]) }),
    ).rejects.toThrow("stockage des médias");
  });

  it("charge le faux backend uniquement quand le mode simulé est activé", async () => {
    const originalMock = process.env.NEXT_PUBLIC_API_MOCK;
    process.env.NEXT_PUBLIC_API_MOCK = "true";
    jest.resetModules();
    try {
      const { testDiagnosticService } = await import("@/services/test-diagnostic.service");
      const session = await testDiagnosticService.demarrer("en", "professionnel", []);
      const question = QUESTIONS_TEST.en.find((item) => item.id === session.question.id);
      if (!question) throw new Error(`Question de test absente : ${session.question.id}`);
      expect(session.question).not.toHaveProperty("bonneReponse");

      await expect(
        testDiagnosticService.repondre(session.id, session.question.id, { type: "choix", choix: question.bonneReponse }),
      ).resolves.toMatchObject({ correcte: true });
    } finally {
      if (originalMock === undefined) delete process.env.NEXT_PUBLIC_API_MOCK;
      else process.env.NEXT_PUBLIC_API_MOCK = originalMock;
      jest.resetModules();
    }
  });
});
