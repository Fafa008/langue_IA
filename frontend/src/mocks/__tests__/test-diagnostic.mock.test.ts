import { etapeDe } from "@/lib/etapesTest";
import { ApiError } from "@/lib/api-client";
import { QUESTIONS_TEST, type QuestionMock } from "@/mocks/questions-test.mock";
import { POINTS_PAR_EXERCICE, testDiagnosticMockService } from "@/mocks/test-diagnostic.mock";
import type { CodeLangue } from "@/types/langue";
import type { Question, ReponseTest, RetourReponse, SessionTest } from "@/types/test-diagnostic";

const LANGUES: CodeLangue[] = ["de", "en", "fr", "it", "zh"];

// La correction simulée d'une réponse libre attend 1,2 s ; un parcours complet de 20 exercices dépasse 5 s.
jest.setTimeout(60_000);

/** Réponse conforme à la correction du mock, ou volontairement fausse. */
function reponsePour(question: QuestionMock, juste: boolean): ReponseTest {
  if (question.typeReponse === "choix") {
    const bonne = question.bonneReponse ?? 0;
    return { type: "choix", choix: juste ? bonne : (bonne + 1) % (question.choix?.length ?? 2) };
  }
  if (question.format === "texte_a_trous" || question.format === "dictee") {
    return { type: "texte", texte: juste ? question.reponseAttendue ?? "" : "réponse fausse" };
  }
  if (question.typeReponse === "audio") return { type: "audio", audio: new Blob(["son"], { type: "audio/webm" }) };
  return { type: "texte", texte: juste ? "Une réponse." : "Faux." };
}

async function parcourir(session: SessionTest, juste: boolean, langue: CodeLangue): Promise<RetourReponse | null> {
  const banque = QUESTIONS_TEST[langue];
  let courante: Question | null = session.question;
  let retour: RetourReponse | null = null;
  while (courante) {
    const mock = banque.find((item) => item.id === courante?.id);
    if (!mock) throw new Error(`Question de test absente : ${courante.id}`);
    retour = await testDiagnosticMockService.repondre(session.id, courante.id, reponsePour(mock, juste));
    courante = retour.questionSuivante;
  }
  return retour;
}

/** Parcours de démonstration : l'apprenant abandonne chaque exercice avec « Passer ». */
async function parcourirEnAutomatique(session: SessionTest): Promise<RetourReponse | null> {
  let courante: Question | null = session.question;
  let retour: RetourReponse | null = null;
  while (courante) {
    retour = await testDiagnosticMockService.repondre(session.id, courante.id, { type: "automatique" });
    courante = retour.questionSuivante;
  }
  return retour;
}

describe("testDiagnosticMockService — banque quatre compétences", () => {
  it("couvre les cinq langues avec cinq exercices par compétence", async () => {
    const langues = await testDiagnosticMockService.langues();
    for (const code of LANGUES) {
      const exercices = QUESTIONS_TEST[code];
      expect(exercices).toHaveLength(20);
      for (const competence of ["lecture", "ecoute", "ecrit", "oral"] as const) {
        expect(exercices.filter((question) => question.competence === competence)).toHaveLength(5);
      }
      expect(langues.find((item) => item.code === code)).toMatchObject({
        nombreQuestions: 20,
        disponible: true,
      });
    }
  });

  it("ne livre ni la bonne réponse ni la réponse attendue avant validation", async () => {
    const session = await testDiagnosticMockService.demarrer("en", "professionnel", []);
    expect(session.question).not.toHaveProperty("bonneReponse");
    expect(session.question).not.toHaveProperty("reponseAttendue");
    expect(session).toMatchObject({ langue: "en", numeroQuestion: 1, totalQuestions: 20 });
  });

  it("refuse une langue sans exercice", async () => {
    await expect(testDiagnosticMockService.demarrer("es", "professionnel", [])).rejects.toEqual(
      new ApiError(404, "Aucune question n'est disponible pour cette langue."),
    );
  });

  it("donne une note sur 100 reproductible et un score par compétence cohérent", async () => {
    const premier = await testDiagnosticMockService.demarrer("fr", "scolaire", ["soirée"]);
    const resultat = await parcourir(premier, true, "fr");
    expect(resultat?.resultat).toMatchObject({ score: 100, total: 100, lacunes: [] });
    expect(resultat?.resultat?.competences).toEqual([
      { competence: "lecture", score: 25, total: 25 },
      { competence: "ecoute", score: 25, total: 25 },
      { competence: "ecrit", score: 25, total: 25 },
      { competence: "oral", score: 25, total: 25 },
    ]);

    const second = await testDiagnosticMockService.demarrer("fr", "professionnel", []);
    const autre = await parcourir(second, true, "fr");
    expect(autre?.resultat?.score).toBe(resultat?.resultat?.score);
  });

  it("compte les exercices « Passer » comme abandonnés (0 point) sans révéler la correction", async () => {
    const session = await testDiagnosticMockService.demarrer("en", "professionnel", []);
    const premiere = session.question;
    expect(premiere).not.toHaveProperty("bonneReponse");
    expect(premiere).not.toHaveProperty("reponseAttendue");

    const premierRetour = await testDiagnosticMockService.repondre(session.id, premiere.id, { type: "automatique" });
    if (premierRetour.typeReponse !== "en_attente") throw new Error("Un exercice abandonné doit rester en attente.");
    expect(premierRetour.abandonnee).toBe(true);
    // Aucune bonne réponse n'est renvoyée au composant, même après le passage.
    expect(premierRetour).not.toHaveProperty("bonneReponse");
    expect(premierRetour).not.toHaveProperty("evaluation");

    const resultat = await parcourirEnAutomatique({ ...session, question: premierRetour.questionSuivante! });
    expect(resultat?.resultat).toMatchObject({ score: 0, total: 100 });
    expect(resultat?.resultat?.competences).toEqual([
      { competence: "lecture", score: 0, total: 25 },
      { competence: "ecoute", score: 0, total: 25 },
      { competence: "ecrit", score: 0, total: 25 },
      { competence: "oral", score: 0, total: 25 },
    ]);
    expect(resultat?.resultat?.donneesAnalyse).toHaveLength(20);
    expect(resultat?.resultat?.donneesAnalyse?.every((donnee) => !donnee.justesse)).toBe(true);
    expect(resultat?.questionSuivante).toBeNull();
  });

  it("ne marque pas un temps écoulé comme un abandon explicite", async () => {
    const session = await testDiagnosticMockService.demarrer("it", "professionnel", []);
    const retour = await testDiagnosticMockService.repondre(session.id, session.question.id, { type: "sans_reponse" });
    if (retour.typeReponse !== "en_attente") throw new Error("Un temps écoulé doit rester en attente.");
    expect(retour.abandonnee).toBe(false);
  });

  it("corrige la dictée et le texte à trous exactement", async () => {
    const session = await testDiagnosticMockService.demarrer("en", "professionnel", []);
    const banque = QUESTIONS_TEST.en;
    let courante: Question | null = session.question;
    let vueFausse = false;
    let vueJuste = false;
    while (courante) {
      const mock = banque.find((item) => item.id === courante?.id)!;
      if (mock.format === "dictee" || mock.format === "texte_a_trous") {
        const faux = await testDiagnosticMockService.repondre(session.id, courante.id, {
          type: "texte", texte: "réponse fausse",
        });
        expect(faux.typeReponse).toBe("texte");
        if (faux.typeReponse === "texte") expect(faux.evaluation).toContain("Réponse incorrecte");
        // L'exercice est validé : on reprend le test depuis le début pour vérifier la bonne réponse.
        vueFausse = true;
        break;
      }
      courante = (await testDiagnosticMockService.repondre(session.id, courante.id, reponsePour(mock, true))).questionSuivante;
    }
    expect(vueFausse).toBe(true);

    const autre = await testDiagnosticMockService.demarrer("en", "professionnel", []);
    courante = autre.question;
    while (courante) {
      const mock = banque.find((item) => item.id === courante?.id)!;
      if (mock.format === "dictee" || mock.format === "texte_a_trous") {
        const juste = await testDiagnosticMockService.repondre(autre.id, courante.id, {
          type: "texte", texte: mock.reponseAttendue ?? "",
        });
        if (juste.typeReponse === "texte") expect(juste.evaluation).toBe("Bonne réponse.");
        vueJuste = true;
        break;
      }
      courante = (await testDiagnosticMockService.repondre(autre.id, courante.id, reponsePour(mock, true))).questionSuivante;
    }
    expect(vueJuste).toBe(true);
  });

  it("transmet à l'analyse les faits par exercice, sans calcul de score", async () => {
    const session = await testDiagnosticMockService.demarrer("de", "professionnel", []);
    const resultat = (await parcourir(session, true, "de"))?.resultat;
    expect(resultat?.donneesAnalyse).toHaveLength(20);
    expect(resultat?.donneesAnalyse?.[0]).toMatchObject({
      competence: expect.stringMatching(/^(lecture|ecoute|ecrit|oral)$/),
      format: expect.stringMatching(/^(qcm|vrai_faux|texte_a_trous|dictee|parler)$/),
      justesse: true,
    });
    expect(resultat?.donneesAnalyse?.[0]).not.toHaveProperty("score");
  });

  it("compte un temps écoulé comme une mauvaise réponse et passe à la suite", async () => {
    const session = await testDiagnosticMockService.demarrer("it", "professionnel", []);
    const premiere = await testDiagnosticMockService.repondre(session.id, session.question.id, { type: "sans_reponse" });
    expect(premiere.questionSuivante).not.toBeNull();
    expect(premiere.typeReponse).toBe("en_attente");
    const resultat = await parcourir({ ...session, question: premiere.questionSuivante! }, true, "it");
    expect(resultat?.resultat?.score).toBe(95);
  });

  it("termine avant la fin avec les seules réponses données", async () => {
    const session = await testDiagnosticMockService.demarrer("en", "professionnel", []);
    const mock = QUESTIONS_TEST.en.find((item) => item.id === session.question.id)!;
    await testDiagnosticMockService.repondre(session.id, session.question.id, reponsePour(mock, true));
    await expect(testDiagnosticMockService.terminer(session.id)).resolves.toMatchObject({
      statut: "termine",
      resultat: { score: POINTS_PAR_EXERCICE, total: 100 },
    });
  });

  it("signale les compétences en lacune et justifie le niveau", async () => {
    const session = await testDiagnosticMockService.demarrer("en", "professionnel", []);
    const resultat = (await parcourir(session, false, "en"))?.resultat;
    expect(resultat?.lacunes).toEqual(expect.arrayContaining(["lecture"]));
    expect(resultat?.pointsFaibles?.map((point) => point.domaine)).toEqual(
      // L'oral est compté comme réussi tant que la transcription STT n'existe pas : l'enregistrement seul est validé.
      expect.arrayContaining(["comprehension_ecrite", "comprehension_orale", "expression_ecrite"]),
    );
    expect(resultat?.justification?.sources[0]).toMatchObject({ referentiel: "CECRL" });
    expect(resultat?.phaseAssimil).toBe("impregnation");
  });

  it("enchaîne les quatre étapes dans l'ordre", async () => {
    const session = await testDiagnosticMockService.demarrer("en", "professionnel", []);
    expect(session.plan.map((item) => item.etape)).toEqual([
      "qcm", "comprehension_orale", "expression_orale", "expression_ecrite",
    ]);
    const etapes = new Set<string>();
    let courante: Question | null = session.question;
    while (courante) {
      etapes.add(etapeDe(courante.competence));
      const mock = QUESTIONS_TEST.en.find((item) => item.id === courante?.id)!;
      courante = (await testDiagnosticMockService.repondre(session.id, courante.id, reponsePour(mock, true))).questionSuivante;
    }
    expect([...etapes]).toEqual(["qcm", "comprehension_orale", "expression_orale", "expression_ecrite"]);
  });
});
