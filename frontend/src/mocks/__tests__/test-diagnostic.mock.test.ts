import { ApiError } from "@/lib/api-client";
import { etapeDe } from "@/lib/etapesTest";
import { QUESTIONS_TEST } from "@/mocks/questions-test.mock";
import { testDiagnosticMockService } from "@/mocks/test-diagnostic.mock";
import type { Question, RetourReponse } from "@/types/test-diagnostic";

describe("testDiagnosticMockService", () => {
  it("ne livre pas la bonne réponse avant validation", async () => {
    const session = await testDiagnosticMockService.demarrer("en", "professionnel", []);
    expect(session.question).not.toHaveProperty("bonneReponse");
    expect(session).toMatchObject({ langue: "en", numeroQuestion: 1, totalQuestions: 12 });
  });

  it("pilote les questions et calcule le résultat comme une session backend", async () => {
    let session = await testDiagnosticMockService.demarrer("en", "scolaire", ["soirée"]);
    let resultatFinal = null;

    for (let numero = 0; numero < session.totalQuestions; numero++) {
      const question = QUESTIONS_TEST.en.find((item) => item.id === session.question.id);
      if (!question) throw new Error(`Question de test absente : ${session.question.id}`);
      const reponse = question.typeReponse === "choix"
        ? { type: "choix" as const, choix: question.bonneReponse }
        : question.typeReponse === "texte"
          ? { type: "texte" as const, texte: "This is my response." }
          : { type: "audio" as const, audio: new Blob(["recorded answer"], { type: "audio/webm" }) };
      const retour = await testDiagnosticMockService.repondre(session.id, session.question.id, reponse);
      if (numero === 0) {
        const mauvaiseReponse = question.typeReponse === "choix"
          ? { type: "choix" as const, choix: (question.bonneReponse + 1) % (question.choix?.length ?? 1) }
          : { type: "texte" as const, texte: "réponse différente" };
        await expect(testDiagnosticMockService.repondre(session.id, session.question.id, reponse))
          .resolves.toEqual(retour);
        await expect(testDiagnosticMockService.repondre(session.id, session.question.id, mauvaiseReponse))
          .rejects.toMatchObject({ status: 409 });
      }
      resultatFinal = retour.resultat;
      if (retour.questionSuivante) {
        session = { ...session, question: retour.questionSuivante };
      }
    }

    expect(resultatFinal).toMatchObject({
      niveau: "C2",
      score: 12,
      total: 12,
      lacunes: [],
    });
    expect(resultatFinal?.competences.map(({ competence }) => competence)).toEqual([
      "grammaire",
      "lecture",
      "ecoute",
      "ecrit",
      "oral",
    ]);
  });

  it("réduit la difficulté après une réponse incorrecte et signale les compétences faibles", async () => {
    const session = await testDiagnosticMockService.demarrer("en", "professionnel", []);
    const question = QUESTIONS_TEST.en.find((item) => item.id === session.question.id);
    if (!question || question.typeReponse !== "choix") throw new Error("Question à choix attendue.");

    const premiereReponse = await testDiagnosticMockService.repondre(session.id, session.question.id, {
      type: "choix",
      choix: (question.bonneReponse + 1) % (question.choix?.length ?? 1),
    });

    if (premiereReponse.typeReponse !== "choix") throw new Error("Réponse à choix attendue.");
    expect(premiereReponse.correcte).toBe(false);
    expect(premiereReponse.questionSuivante?.niveau).toBe("A2");

    let prochaineQuestion = premiereReponse.questionSuivante;
    let resultatFinal = premiereReponse.resultat;
    while (prochaineQuestion && !resultatFinal) {
      const courante = prochaineQuestion;
      const mockQuestion = QUESTIONS_TEST.en.find((item) => item.id === courante.id);
      if (!mockQuestion) throw new Error(`Question de test absente : ${courante.id}`);
      const reponse = mockQuestion.typeReponse === "choix"
        ? { type: "choix" as const, choix: (mockQuestion.bonneReponse + 1) % (mockQuestion.choix?.length ?? 1) }
        : mockQuestion.typeReponse === "texte"
          ? { type: "texte" as const, texte: "My response." }
          : { type: "audio" as const, audio: new Blob(["recorded answer"], { type: "audio/webm" }) };
      const suivant = await testDiagnosticMockService.repondre(session.id, courante.id, reponse);
      prochaineQuestion = suivant.questionSuivante;
      resultatFinal = suivant.resultat;
    }
    expect(resultatFinal?.lacunes).toContain("grammaire");
  });

  it("signale explicitement une langue non disponible", async () => {
    await expect(testDiagnosticMockService.demarrer("zh", "professionnel", [])).rejects.toEqual(
      new ApiError(404, "Aucune question n'est disponible pour cette langue."),
    );
  });
});

/** Répond à la question : bonne réponse (ou réponse libre valide) si `juste`, sinon la première option fausse. */
async function repondre(idSession: string, question: Question, juste: boolean): Promise<RetourReponse> {
  if (question.typeReponse === "texte") return testDiagnosticMockService.repondre(idSession, question.id, { type: "texte", texte: "Une réponse." });
  if (question.typeReponse === "audio") return testDiagnosticMockService.repondre(idSession, question.id, { type: "audio", audio: new Blob(["son"]) });
  const bonne = QUESTIONS_TEST.en.find((item) => item.id === question.id)!.bonneReponse;
  return testDiagnosticMockService.repondre(idSession, question.id, { type: "choix", choix: juste ? bonne : (bonne + 1) % 4 });
}

describe("test simulé en quatre étapes", () => {
  it("propose les langues avec le nombre de questions de leur plan", async () => {
    const langues = await testDiagnosticMockService.langues();
    expect(langues.find((l) => l.code === "en")).toMatchObject({ nombreQuestions: 12, disponible: true });
    expect(langues.find((l) => l.code === "it")).toMatchObject({ nombreQuestions: 0, disponible: false });
  });

  it("enchaîne QCM, compréhension orale, expression orale puis écrite, et termine avec un résultat", async () => {
    const session = await testDiagnosticMockService.demarrer("en", "professionnel", []);
    expect(session.plan.map((p) => p.etape)).toEqual(["qcm", "comprehension_orale", "expression_orale", "expression_ecrite"]);

    const etapes: string[] = [];
    let question: Question | null = session.question;
    let retour: RetourReponse | null = null;
    while (question) {
      etapes.push(etapeDe(question.competence));
      retour = await repondre(session.id, question, true);
      question = retour.questionSuivante;
    }

    expect(etapes).toEqual([...Array(8).fill("qcm"), "comprehension_orale", "comprehension_orale", "expression_orale", "expression_ecrite"]);
    expect(retour?.resultat).toMatchObject({ score: 12, total: 12 });
  });

  it("choisit les sujets d'expression au niveau atteint pendant le QCM", async () => {
    const session = await testDiagnosticMockService.demarrer("en", "professionnel", []);
    let question: Question | null = session.question;
    const sujets: Question[] = [];
    while (question) {
      if (question.typeReponse !== "choix") sujets.push(question);
      // Toutes les réponses à choix sont fausses : le niveau estimé descend au plus bas
      question = (await repondre(session.id, question, false)).questionSuivante;
    }
    expect(sujets.map((s) => s.niveau)).toEqual(["A2", "A2"]);
  });

  it("termine avant la fin quand le temps est écoulé, les questions sans réponse comptant comme fausses", async () => {
    const session = await testDiagnosticMockService.demarrer("en", "professionnel", []);
    await repondre(session.id, session.question, true);
    await expect(testDiagnosticMockService.terminer(session.id)).resolves.toMatchObject({ score: 1, total: 12 });
  });
});
