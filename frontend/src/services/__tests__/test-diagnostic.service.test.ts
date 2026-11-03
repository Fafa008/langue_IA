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
      statut: "termine",
      resultat: {
        niveau: "B2",
        score: 66.67,
        total: 100,
        cadre: "CECRL",
        competences: [],
        lacunes: [],
      },
    });
    expect(fetchCall(fetchMock)).toMatchObject({
      url: `${API}/diagnostic/tentatives/42/terminer`,
      init: { method: "POST" },
    });
  });

  it("lit l'analyse détaillée : points faibles, phase Assimil et sources du référentiel", async () => {
    mockFetch({
      body: {
        id_tentative: 42, score: 40, max_score: 100, percentage: 40, level: "A2", framework: "CECRL",
        points_faibles: [
          { domaine: "vocabulaire", detail: "  Lexique limité.  " },
          { domaine: "orthographe", detail: "domaine inconnu, ignoré" },
          { domaine: "expression_orale" },
        ],
        phase_assimil: "impregnation",
        justification: {
          resume: "Vos réponses correspondent au niveau A2.",
          sources: [
            { id: "s1", referentiel: "CECRL", niveau: "A2", titre: "Échelle globale", extrait: "Comprend des phrases isolées.", url: "https://www.coe.int/cecrl" },
            { id: "s2", referentiel: "CECRL", niveau: "A2", titre: "Lien piégé", extrait: "Extrait.", url: "javascript:alert(1)" },
            { id: "s3", referentiel: "CECRL", niveau: "A2", titre: "", extrait: "Sans titre : écartée." },
          ],
        },
      },
    });

    const issue = await httpTestDiagnosticService.terminer("42");

    expect(issue).toMatchObject({
      statut: "termine",
      resultat: {
        pointsFaibles: [{ domaine: "vocabulaire", detail: "Lexique limité." }, { domaine: "expression_orale" }],
        phaseAssimil: "impregnation",
        justification: {
          resume: "Vos réponses correspondent au niveau A2.",
          sources: [
            { id: "s1", url: "https://www.coe.int/cecrl" },
            { id: "s2", titre: "Lien piégé", url: undefined },
          ],
        },
      },
    });
    if (issue.statut === "termine") expect(issue.resultat.justification?.sources).toHaveLength(2);
  });

  it("garde un résultat utilisable quand l'analyse détaillée manque ou est invalide", async () => {
    mockFetch({
      body: {
        id_tentative: 42, score: 40, max_score: 100, percentage: 40, level: "A2", framework: "CECRL",
        phase_assimil: "inconnue",
        justification: { resume: "   ", sources: null },
      },
    });

    const issue = await httpTestDiagnosticService.terminer("42");

    expect(issue).toMatchObject({ statut: "termine", resultat: { niveau: "A2", score: 40 } });
    if (issue.statut === "termine") {
      expect(issue.resultat.pointsFaibles).toBeUndefined();
      expect(issue.resultat.phaseAssimil).toBeUndefined();
      expect(issue.resultat.justification).toBeUndefined();
    }
  });

  it("lit le score par compétence et en déduit les lacunes, en écartant les valeurs invalides", async () => {
    mockFetch({
      body: {
        id_tentative: 42, score: 40, max_score: 100, percentage: 40, level: "A2", framework: "CECRL",
        competences: [
          { competence: "grammaire", score: 4, total: 5 },
          { competence: "oral", score: 0, total: 1 },
          { competence: "dessin", score: 1, total: 1 },
          { competence: "lecture", score: 3, total: 2 },
          { competence: "ecoute", score: 1, total: 0 },
        ],
      },
    });

    const issue = await httpTestDiagnosticService.terminer("42");

    expect(issue).toMatchObject({
      statut: "termine",
      resultat: {
        competences: [{ competence: "grammaire", score: 4, total: 5 }, { competence: "oral", score: 0, total: 1 }],
        lacunes: ["oral"],
      },
    });
  });

  it("écarte les doublons de l'analyse et accepte un identifiant de source numérique", async () => {
    mockFetch({
      body: {
        id_tentative: 42, score: 40, max_score: 100, percentage: 40, level: "A2", framework: "CECRL",
        points_faibles: [{ domaine: "grammaire", detail: "Accords." }, { domaine: "grammaire", detail: "Doublon." }],
        phase_assimil: "toString",
        justification: {
          resume: "Niveau A2.",
          sources: [
            { id: 7, referentiel: "CECRL", niveau: "A2", titre: "Échelle globale", extrait: "Extrait." },
            { id: "7", referentiel: "CECRL", niveau: "A2", titre: "Doublon", extrait: "Extrait." },
          ],
        },
      },
    });

    const issue = await httpTestDiagnosticService.terminer("42");

    if (issue.statut !== "termine") throw new Error("résultat attendu");
    expect(issue.resultat.pointsFaibles).toEqual([{ domaine: "grammaire", detail: "Accords." }]);
    expect(issue.resultat.phaseAssimil).toBeUndefined();
    expect(issue.resultat.justification?.sources.map((source) => source.id)).toEqual(["7"]);
  });

  it("signale un résultat en attente quand l'analyse par le LLM n'est pas terminée (202)", async () => {
    mockFetch({ status: 202, body: { id_tentative: 42, statut: "en_attente" } });
    await expect(httpTestDiagnosticService.terminer("42")).resolves.toEqual({ statut: "en_attente" });
  });

  it("laisse 60 secondes à l'analyse finale avant d'abandonner", async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted")))),
    ) as unknown as typeof fetch;
    let terminee = false;

    const terminaison = httpTestDiagnosticService.terminer("42");
    terminaison.catch(() => { terminee = true; });
    jest.advanceTimersByTime(15_000);
    await Promise.resolve();
    expect(terminee).toBe(false);
    jest.advanceTimersByTime(45_000);

    await expect(terminaison).rejects.toMatchObject({ status: 0, delaiDepasse: true });
    jest.useRealTimers();
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
  describe("reprise d'un test interrompu", () => {
    const questions = [
      { id_question: "1", niveau: "A1", competence: "grammaire", type_reponse: "choix", enonce: "Q1", choix: ["is", "are"] },
      { id_question: "2", niveau: "A1", competence: "grammaire", type_reponse: "choix", enonce: "Q2", choix: ["a", "b"] },
      { id_question: "3", niveau: "A1", competence: "ecrit", type_reponse: "texte", enonce: "Présentez-vous." },
    ];
    const tentative = {
      id_tentative: 42,
      code_langue: "en",
      code_niveau: "A1",
      date_debut: "2026-11-03T08:00:00Z",
      reponses: [{ id_question: 1, reponse_fournie: "is" }],
    };

    it("restaure les réponses enregistrées et reprend à la première question sans réponse", async () => {
      const fetchMock = mockFetch({ body: tentative }, { body: questions });

      const test = await httpTestDiagnosticService.testEnCours();

      expect(fetchCall(fetchMock).url).toBe(`${API}/diagnostic/tentatives/en-cours`);
      expect(fetchCall(fetchMock, 1).url).toBe(`${API}/diagnostic/questions?code_langue=en&code_niveau=A1`);
      expect(test).toMatchObject({
        idSession: "42",
        langue: "en",
        debut: Date.parse("2026-11-03T08:00:00Z"),
        totalQuestions: 3,
        reponses: [{ idQuestion: "1", niveau: "A1", competence: "grammaire", typeReponse: "choix" }],
        session: {
          id: "42",
          numeroQuestion: 2,
          totalQuestions: 3,
          question: { id: "2" },
          plan: [{ etape: "qcm", nombreQuestions: 2 }, { etape: "expression_ecrite", nombreQuestions: 1 }],
        },
      });
      expect(test?.session?.questions?.map((question) => question.id)).toEqual(["2", "3"]);
    });

    it("sans suite quand toutes les questions ont déjà une réponse", async () => {
      mockFetch({
        body: { ...tentative, reponses: questions.map(({ id_question }) => ({ id_question, reponse_fournie: "x" })) },
      }, { body: questions });

      const test = await httpTestDiagnosticService.testEnCours();

      expect(test?.reponses).toHaveLength(3);
      expect(test?.session).toBeNull();
    });

    it("renvoie null quand aucun test n'est en cours (204)", async () => {
      const fetchMock = mockFetch({ status: 204 });
      await expect(httpTestDiagnosticService.testEnCours()).resolves.toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("refuse une tentative incomplète", async () => {
      mockFetch({ body: { id_tentative: 42, code_langue: "en" } });
      await expect(httpTestDiagnosticService.testEnCours()).rejects.toThrow("invalide");
    });

    it("abandonne la tentative", async () => {
      const fetchMock = mockFetch({ status: 204 });
      await httpTestDiagnosticService.abandonner("42");
      const { url, init } = fetchCall(fetchMock);
      expect([url, init.method]).toEqual([`${API}/diagnostic/tentatives/42/abandonner`, "POST"]);
    });
  });
});
