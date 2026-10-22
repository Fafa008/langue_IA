import { ApiError } from "@/lib/api-client";
import { QUESTIONS_TEST } from "@/mocks/questions-test.mock";
import { testDiagnosticMockService } from "@/mocks/test-diagnostic.mock";

describe("testDiagnosticMockService", () => {
  it("ne livre pas la bonne réponse avant validation", async () => {
    const session = await testDiagnosticMockService.demarrer("en", "professionnel", []);
    expect(session.question).not.toHaveProperty("bonneReponse");
    expect(session).toMatchObject({ langue: "en", numeroQuestion: 1, totalQuestions: 10 });
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
      score: 10,
      total: 10,
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
