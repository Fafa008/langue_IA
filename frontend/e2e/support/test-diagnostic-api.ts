import type { Page } from "@playwright/test";
import { QUESTIONS_TEST, type QuestionMock } from "../../src/mocks/questions-test.mock";
import type { CodeLangue } from "../../src/types/langue";
import type { Question } from "../../src/types/test-diagnostic";
import { handlePreflight, json } from "./session";

interface TentativeE2E {
  id: number;
  langue: CodeLangue;
  niveau: string;
  questions: QuestionMock[];
  reponses: Map<string, { id: number; valeur: string }>;
}

function questionPublique(question: Question) {
  return {
    id_question: question.id,
    niveau: question.niveau,
    competence: question.competence,
    type_reponse: question.typeReponse,
    enonce: question.enonce,
    choix: question.choix,
    support: question.support,
    audio_url: question.audioUrl,
    audio_texte: question.audioTexte,
  };
}

/** Faux backend du flux réel : tentative persistée, questions sans correction et réponse en attente d'évaluation. */
export async function mockTestDiagnosticApi(
  page: Page,
  { failFirstAnswer = false }: { failFirstAnswer?: boolean } = {},
) {
  const tentatives = new Map<number, TentativeE2E>();
  let idTentative = 0;
  let idReponse = 0;
  let firstAnswerFails = failFirstAnswer;

  await page.route("**/api/v1/diagnostic/**", async (route) => {
    if (await handlePreflight(route)) return;
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "POST" && url.pathname === "/api/v1/diagnostic/tentatives") {
      const { code_langue: langue } = request.postDataJSON() as { code_langue: CodeLangue };
      const banque = QUESTIONS_TEST[langue];
      const niveaux = [...new Set(banque.map((question) => question.niveau))];
      const niveau = niveaux.find((code) => banque.some(
        (question) => question.niveau === code && question.typeReponse !== "audio",
      ));
      if (!niveau) {
        await json(route, 404, { detail: "Aucune question enregistrable n'est disponible pour cette langue." });
        return;
      }
      const id = ++idTentative;
      tentatives.set(id, {
        id,
        langue,
        niveau,
        questions: banque.filter((question) => question.niveau === niveau && question.typeReponse !== "audio"),
        reponses: new Map(),
      });
      await json(route, 201, { id_tentative: id, code_langue: langue, code_niveau: niveau });
      return;
    }

    if (request.method() === "GET" && url.pathname === "/api/v1/diagnostic/questions") {
      const codeLangue = url.searchParams.get("code_langue") as CodeLangue | null;
      const codeNiveau = url.searchParams.get("code_niveau");
      const questions = codeLangue
        ? QUESTIONS_TEST[codeLangue]
          .filter((question) => question.niveau === codeNiveau && question.typeReponse !== "audio")
          .map(questionPublique)
        : [];
      await json(route, 200, questions);
      return;
    }

    if (request.method() === "POST" && url.pathname === "/api/v1/diagnostic/reponse") {
      if (firstAnswerFails) {
        firstAnswerFails = false;
        await json(route, 503, { detail: "Service temporairement indisponible" });
        return;
      }
      const corps = request.postDataJSON() as {
        id_tentative: number;
        id_question: string;
        reponse_fournie: string;
      };
      const tentative = tentatives.get(corps.id_tentative);
      const question = tentative?.questions.find((item) => item.id === corps.id_question);
      if (!tentative || !question) {
        await json(route, 404, { detail: "Tentative ou question introuvable." });
        return;
      }
      const precedente = tentative.reponses.get(corps.id_question);
      if (precedente && precedente.valeur !== corps.reponse_fournie) {
        await json(route, 409, { detail: "Une réponse différente existe déjà pour cette question." });
        return;
      }
      const reponse = precedente ?? { id: ++idReponse, valeur: corps.reponse_fournie };
      tentative.reponses.set(corps.id_question, reponse);
      await json(route, 201, {
        id_reponse: reponse.id,
        id_tentative: tentative.id,
        id_question: corps.id_question,
        reponse_fournie: reponse.valeur,
      });
      return;
    }

    await json(route, 404, { detail: "Route de diagnostic inconnue." });
  });
}
