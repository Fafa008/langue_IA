import { etatInitial, reducteur } from "@/lib/testAdaptatif";
import type { RetourReponse, SessionTest } from "@/types/test-diagnostic";

const session: SessionTest = {
  id: "session-1",
  langue: "en",
  niveaux: ["A1", "A2", "B1", "B2", "C1", "C2"],
  numeroQuestion: 1,
  totalQuestions: 2,
  question: { id: "q-1", niveau: "B1", competence: "grammaire", typeReponse: "choix", enonce: "Question", choix: ["A", "B"] },
};

const retour: RetourReponse = {
  typeReponse: "choix",
  correcte: true,
  bonneReponse: 0,
  numeroQuestion: 1,
  totalQuestions: 2,
  questionSuivante: { id: "q-2", niveau: "B2", competence: "grammaire", typeReponse: "choix", enonce: "Question 2", choix: ["A", "B"] },
  resultat: null,
};

describe("état du test piloté par la session", () => {
  it("démarre dans l'introduction et utilise la session reçue", () => {
    const initial = etatInitial("fr");
    expect(initial.phase).toBe("intro");
    const enCours = reducteur(initial, { type: "demarrer", session });
    expect(enCours).toMatchObject({ phase: "question", sessionId: "session-1", courante: session.question });
  });

  it("ne passe à la question suivante qu'après la validation de la réponse", () => {
    const enCours = reducteur(etatInitial("en"), { type: "demarrer", session });
    const feedback = reducteur(enCours, { type: "repondre", choix: 0, retour });
    expect(feedback).toMatchObject({ phase: "retour", choisie: 0, courante: session.question });
    expect(reducteur(feedback, { type: "suivante" })).toMatchObject({
      phase: "question",
      courante: retour.questionSuivante,
      retour: null,
    });
  });

  it("conserve la réponse sélectionnée en cas d'erreur réseau pour permettre une nouvelle tentative", () => {
    const enCours = reducteur(etatInitial("en"), { type: "demarrer", session });
    expect(reducteur(enCours, { type: "choisirReponse", choix: 1 }).choisie).toBe(1);
    expect(reducteur(enCours, { type: "choisirReponse", choix: 2 })).toBe(enCours);
  });

  it("termine avec le résultat renvoyé par la session", () => {
    const finalRetour: RetourReponse = {
      ...retour,
      numeroQuestion: 2,
      questionSuivante: null,
      resultat: { niveau: "B2", score: 2, total: 2, competences: [], lacunes: [] },
    };
    const enCours = reducteur(etatInitial("en"), { type: "demarrer", session });
    const feedback = reducteur(enCours, { type: "repondre", choix: 0, retour: finalRetour });
    expect(reducteur(feedback, { type: "suivante" })).toMatchObject({
      phase: "resultat",
      resultat: finalRetour.resultat,
    });
  });

  it("termine avec le résultat reçu du service de scoring", () => {
    const enCours = reducteur(etatInitial("en"), { type: "demarrer", session });
    const feedback = reducteur(enCours, { type: "repondre", choix: 0, retour: {
      typeReponse: "en_attente",
      numeroQuestion: 2,
      totalQuestions: 2,
      questionSuivante: null,
      resultat: null,
    } });
    const resultat = {
      niveau: "B2",
      score: 66.67,
      total: 100,
      cadre: "CECRL" as const,
      competences: [],
      lacunes: [],
    };
    expect(reducteur(feedback, { type: "terminer", resultat })).toMatchObject({
      phase: "resultat",
      courante: null,
      resultat,
    });
  });

  it("ne termine pas avant que la réponse finale ait été enregistrée", () => {
    const secondeQuestion = {
      id: "q-2",
      niveau: "B1",
      competence: "lecture" as const,
      typeReponse: "texte" as const,
      enonce: "Question 2",
    };
    const sessionAvecQuestions: SessionTest = {
      ...session,
      questions: [session.question, secondeQuestion],
    };
    const enCours = reducteur(etatInitial("en"), { type: "demarrer", session: sessionAvecQuestions });
    const retourAttente: RetourReponse = {
      typeReponse: "en_attente",
      numeroQuestion: 1,
      totalQuestions: 2,
      questionSuivante: secondeQuestion,
      resultat: null,
    };
    const apresPremiereReponse = reducteur(enCours, { type: "repondre", choix: 0, retour: retourAttente });
    const questionSuivante = reducteur(apresPremiereReponse, { type: "suivante" });

    expect(questionSuivante).toMatchObject({
      phase: "question",
      courante: secondeQuestion,
      questionsRestantes: [],
    });

    const retourFinal = { ...retourAttente, numeroQuestion: 2, questionSuivante: null };
    const apresDerniereReponse = reducteur(questionSuivante, { type: "repondre", choix: null, retour: retourFinal });
    expect(reducteur(apresDerniereReponse, { type: "suivante" })).toMatchObject({
      phase: "retour",
      courante: secondeQuestion,
      resultat: null,
    });
  });

  it("ignore les réponses invalides pour l'étape courante", () => {
    const initial = etatInitial("en");
    expect(reducteur(initial, { type: "repondre", choix: 0, retour })).toBe(initial);
    expect(reducteur(initial, { type: "suivante" })).toBe(initial);
  });
});

describe("réponses enregistrées", () => {
  it("garde l'historique des réponses validées et le remet à zéro au démarrage", () => {
    const enCours = reducteur(etatInitial("en"), { type: "demarrer", session });
    const feedback = reducteur(enCours, { type: "repondre", choix: 0, retour });
    expect(feedback.reponses).toEqual([
      { idQuestion: "q-1", niveau: "B1", competence: "grammaire", typeReponse: "choix", correcte: true },
    ]);
    expect(reducteur(feedback, { type: "demarrer", session }).reponses).toEqual([]);
  });
});
