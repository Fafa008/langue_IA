import { configureApiClient } from "@/lib/api-client";
import { QUESTIONS_TEST } from "@/mocks/questions-test.mock";
import { httpTestDiagnosticService } from "@/services/test-diagnostic.service";
import { fetchCall, mockFetch } from "@/test/fetch-mock";

const API = "http://localhost:8000/api/v1";

beforeEach(() => {
  configureApiClient({ getToken: () => "jwt-test", onUnauthorized: jest.fn() });
});

describe("httpTestDiagnosticService", () => {
  it("démarre une session et convertit les champs de l'API", async () => {
    const fetchMock = mockFetch({
      status: 201,
      body: {
        id_session: "session-42",
        code_langue: "en",
        niveaux: ["A1", "A2", "B1"],
        numero_question: 1,
        total_questions: 10,
        question: {
          id_question: "question-1",
          niveau: "B1",
          competence: "grammaire",
          type_reponse: "choix",
          enonce: "She ___ a student.",
          choix: ["is", "are"],
        },
      },
    });

    await expect(httpTestDiagnosticService.demarrer("en", "professionnel", ["matin"])).resolves.toEqual({
      id: "session-42",
      langue: "en",
      niveaux: ["A1", "A2", "B1"],
      numeroQuestion: 1,
      totalQuestions: 10,
      question: {
        id: "question-1",
        niveau: "B1",
        competence: "grammaire",
        typeReponse: "choix",
        enonce: "She ___ a student.",
        choix: ["is", "are"],
      },
    });
    const { url, init, headers, body } = fetchCall(fetchMock);
    expect([url, init.method, body]).toEqual([
      `${API}/test-diagnostic/sessions`,
      "POST",
      { code_langue: "en", objectif: "professionnel", creneaux: ["matin"] },
    ]);
    expect(headers.Authorization).toBeDefined();
  });

  it("envoie la réponse et ne reçoit la correction qu'après validation", async () => {
    const fetchMock = mockFetch({
      body: {
        type_reponse: "choix",
        correcte: false,
        bonne_reponse: 1,
        numero_question: 1,
        total_questions: 10,
        question_suivante: {
          id_question: "question-2",
          niveau: "A2",
          competence: "grammaire",
          type_reponse: "choix",
          enonce: "Question suivante",
          choix: ["A", "B"],
        },
        resultat: null,
      },
    });

    await expect(httpTestDiagnosticService.repondre("session/42", "question-1", { type: "choix", choix: 0 })).resolves.toMatchObject({
      correcte: false,
      bonneReponse: 1,
      questionSuivante: { id: "question-2", niveau: "A2" },
      resultat: null,
    });
    const { url, init, body } = fetchCall(fetchMock);
    expect([url, init.method, body]).toEqual([
      `${API}/test-diagnostic/sessions/session%2F42/reponses`,
      "POST",
      { id_question: "question-1", choix: 0 },
    ]);
  });

  it("refuse une réponse serveur sans question suivante ni résultat final", async () => {
    mockFetch({
      body: {
        correcte: true,
        type_reponse: "choix",
        bonne_reponse: 0,
        numero_question: 1,
        total_questions: 10,
        question_suivante: null,
        resultat: null,
      },
    });

    await expect(httpTestDiagnosticService.repondre("session-1", "question-1", { type: "choix", choix: 0 })).rejects.toThrow(
      "Réponse invalide du serveur pour le test de positionnement.",
    );
  });

  it("convertit les compétences évaluées et les lacunes du résultat final", async () => {
    mockFetch({
      body: {
        type_reponse: "choix",
        correcte: false,
        bonne_reponse: 1,
        numero_question: 10,
        total_questions: 10,
        question_suivante: null,
        resultat: {
          niveau: "A2",
          score: 4,
          total: 10,
          competences: [{ competence: "grammaire", score: 2, total: 6 }],
          lacunes: ["grammaire"],
        },
      },
    });

    await expect(
      httpTestDiagnosticService.repondre("session-1", "question-10", { type: "choix", choix: 0 }),
    ).resolves.toMatchObject({
      resultat: {
        niveau: "A2",
        score: 4,
        competences: [{ competence: "grammaire", score: 2, total: 6 }],
        lacunes: ["grammaire"],
      },
    });
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
