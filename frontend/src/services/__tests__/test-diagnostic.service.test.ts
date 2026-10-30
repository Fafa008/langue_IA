import { configureApiClient } from "@/lib/api-client";
import { API_URL } from "@/lib/env";
import { QUESTIONS_TEST } from "@/mocks/questions-test.mock";
import { httpTestDiagnosticService } from "@/services/test-diagnostic.service";
import { fetchCall, mockFetch } from "@/test/fetch-mock";

const API = `${API_URL}/api/v1`;

beforeEach(() => {
  configureApiClient({ getToken: () => "jwt-test", onUnauthorized: jest.fn() });
});

describe("httpTestDiagnosticService", () => {
  it("charge les langues du test et ne propose que celles qui ont des questions", async () => {
    const fetchMock = mockFetch({
      body: [
        { code: "en", libelle: "Anglais", cadre: "CECRL", niveaux: ["A1", "A2"], nombre_questions: 12, disponible: true },
        { code: "es", libelle: "Espagnol", cadre: "CECRL", niveaux: ["A1"], nombre_questions: 0, disponible: true },
      ],
    });

    await expect(httpTestDiagnosticService.langues()).resolves.toEqual([
      { code: "en", libelle: "Anglais", cadre: "CECRL", niveaux: ["A1", "A2"], nombreQuestions: 12, disponible: true },
      { code: "es", libelle: "Espagnol", cadre: "CECRL", niveaux: ["A1"], nombreQuestions: 0, disponible: false },
    ]);
    const { url, init, headers } = fetchCall(fetchMock);
    expect([url, init.method ?? "GET"]).toEqual([`${API}/diagnostic/langues`, "GET"]);
    expect(headers.Authorization).toBe("Bearer jwt-test");
  });

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
      plan: [{ etape: "qcm", nombreQuestions: 1 }],
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

  it("range les questions dans l'ordre des étapes et en déduit le plan du test", async () => {
    const question = (id_question: string, competence: string, type_reponse = "choix") => ({
      id_question, niveau: "A1", competence, type_reponse, enonce: id_question, choix: ["a", "b"],
    });
    mockFetch({ status: 201, body: { id_tentative: 7, code_langue: "en", code_niveau: "A1" } }, {
      body: [
        question("ecrit", "ecrit", "texte"),
        question("oral", "oral", "audio"),
        question("ecoute", "ecoute"),
        question("grammaire", "grammaire"),
        question("lecture", "lecture"),
      ],
    });

    const session = await httpTestDiagnosticService.demarrer("en", "professionnel", []);

    expect(session.questions?.map((q) => q.id)).toEqual(["grammaire", "lecture", "ecoute", "ecrit"]);
    expect(session.plan).toEqual([
      { etape: "qcm", nombreQuestions: 2 },
      { etape: "comprehension_orale", nombreQuestions: 1 },
      { etape: "expression_ecrite", nombreQuestions: 1 },
    ]);
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

  it("termine la tentative et transforme le résultat du scoring pour l'écran", async () => {
    const fetchMock = mockFetch({
      body: {
        id_tentative: 42,
        score: 66.67,
        max_score: 100,
        percentage: 66.67,
        level: "B2",
        framework: "CECRL",
      },
    });

    await expect(httpTestDiagnosticService.terminer("42")).resolves.toEqual({
      niveau: "B2",
      score: 66.67,
      total: 100,
      cadre: "CECRL",
      competences: [],
      lacunes: [],
    });
    expect(fetchCall(fetchMock)).toMatchObject({
      url: `${API}/diagnostic/tentatives/42/terminer`,
      init: { method: "POST" },
    });
  });

  it("refuse un résultat de scoring incohérent avec la tentative", async () => {
    mockFetch({
      body: {
        id_tentative: 41,
        score: 66.67,
        max_score: 100,
        percentage: 66.67,
        level: "B2",
        framework: "CECRL",
      },
    });

    await expect(httpTestDiagnosticService.terminer("42")).rejects.toThrow("résultat de scoring");
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
      const langues = await testDiagnosticService.langues();
      expect(langues.find((l) => l.code === "en")).toMatchObject({ cadre: "CECRL", disponible: true });
      expect(langues.find((l) => l.code === "zh")).toMatchObject({ cadre: "HSK", disponible: false, nombreQuestions: 0 });

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
