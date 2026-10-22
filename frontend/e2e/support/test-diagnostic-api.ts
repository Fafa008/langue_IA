import type { Page } from "@playwright/test";
import { QUESTIONS_TEST, type QuestionMock } from "../../src/mocks/questions-test.mock";
import type { CodeLangue } from "../../src/types/langue";
import {
  COMPETENCES_TEST,
  type CompetenceResultat,
  type CompetenceTest,
  type Question,
  type ReponseTest,
  type RetourReponse,
} from "../../src/types/test-diagnostic";
import { handlePreflight, json } from "./session";

interface SessionE2E {
  langue: CodeLangue;
  banque: QuestionMock[];
  niveaux: string[];
  total: number;
  courante: QuestionMock;
  dejaPosees: Set<string>;
  niveauVise: number;
  niveauxVises: number[];
  score: number;
  scoresCompetences: Record<CompetenceTest, { score: number; total: number }>;
  terminee: boolean;
  derniereReponse: { idQuestion: string; cleReponse: string; retour: RetourReponse } | null;
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

function choisirQuestion(session: SessionE2E) {
  for (let distance = 0; distance < session.niveaux.length; distance++) {
    const indices = distance === 0
      ? [session.niveauVise]
      : [session.niveauVise - distance, session.niveauVise + distance];
    for (const index of indices) {
      if (index < 0 || index >= session.niveaux.length) continue;
      const candidates = session.banque.filter(
        (candidate) => candidate.niveau === session.niveaux[index] && !session.dejaPosees.has(candidate.id),
      );
      const question = candidates.find((candidate) => session.scoresCompetences[candidate.competence].total === 0)
        ?? candidates[0];
      if (question) return question;
    }
  }
  return null;
}

function creerScoresCompetences(): SessionE2E["scoresCompetences"] {
  return {
    grammaire: { score: 0, total: 0 },
    lecture: { score: 0, total: 0 },
    ecoute: { score: 0, total: 0 },
    ecrit: { score: 0, total: 0 },
    oral: { score: 0, total: 0 },
  };
}

function versRetourDto(retour: RetourReponse) {
  return {
    type_reponse: retour.typeReponse,
    ...(retour.typeReponse === "choix"
      ? { correcte: retour.correcte, bonne_reponse: retour.bonneReponse }
      : { evaluation: retour.evaluation, score_prononciation: retour.scorePrononciation }),
    numero_question: retour.numeroQuestion,
    total_questions: retour.totalQuestions,
    question_suivante: retour.questionSuivante ? questionPublique(retour.questionSuivante) : null,
    resultat: retour.resultat,
  };
}

function resultatCompetences(session: SessionE2E): { competences: CompetenceResultat[]; lacunes: CompetenceTest[] } {
  const competences = COMPETENCES_TEST.reduce<CompetenceResultat[]>((resultats, competence) => {
    const score = session.scoresCompetences[competence];
    if (score.total > 0) resultats.push({ competence, ...score });
    return resultats;
  }, []);
  const lacunes = competences
    .filter(({ score, total }) => score / total < 0.5)
    .map(({ competence }) => competence);
  return { competences, lacunes };
}

/** Faux serveur de session, avec les mêmes formats de réponse que le contrat API. */
export async function mockTestDiagnosticApi(
  page: Page,
  { failFirstAnswer = false, forceIncorrect = false }: { failFirstAnswer?: boolean; forceIncorrect?: boolean } = {},
) {
  const sessions = new Map<string, SessionE2E>();
  let idSession = 0;
  let firstAnswerFails = failFirstAnswer;

  await page.route("**/api/v1/test-diagnostic/sessions**", async (route) => {
    if (await handlePreflight(route)) return;
    const request = route.request();
    const url = new URL(request.url());
    const sessionMatch = url.pathname.match(/^\/api\/v1\/test-diagnostic\/sessions\/([^/]+)\/reponses$/);

    if (request.method() === "POST" && url.pathname === "/api/v1/test-diagnostic/sessions") {
      const { code_langue: langue } = request.postDataJSON() as { code_langue: CodeLangue };
      const banque = QUESTIONS_TEST[langue];
      const niveaux = [...new Set(banque.map((question) => question.niveau))];
      if (banque.length === 0 || niveaux.length === 0) {
        await json(route, 404, { detail: "Aucune question n'est disponible pour cette langue." });
        return;
      }

      const id = `session-${++idSession}`;
      const session: SessionE2E = {
        langue,
        banque,
        niveaux,
        total: Math.min(10, banque.length),
        courante: banque[0],
        dejaPosees: new Set(),
        niveauVise: Math.floor((niveaux.length - 1) / 2),
        niveauxVises: [],
        score: 0,
        scoresCompetences: creerScoresCompetences(),
        terminee: false,
        derniereReponse: null,
      };
      const premiere = choisirQuestion(session);
      if (!premiere) {
        await json(route, 404, { detail: "Aucune question n'est disponible pour cette langue." });
        return;
      }
      session.courante = premiere;
      session.dejaPosees.add(premiere.id);
      sessions.set(id, session);
      await json(route, 201, {
        id_session: id,
        code_langue: langue,
        niveaux,
        numero_question: 1,
        total_questions: session.total,
        question: questionPublique(premiere),
      });
      return;
    }

    if (request.method() === "POST" && sessionMatch) {
      if (firstAnswerFails) {
        firstAnswerFails = false;
        await json(route, 503, { detail: "Service temporairement indisponible" });
        return;
      }
      const id = decodeURIComponent(sessionMatch[1]);
      const session = sessions.get(id);
      if (!session) {
        await json(route, 404, { detail: "Session de test introuvable." });
        return;
      }
      const corpsJson = request.headers()["content-type"]?.includes("application/json")
        ? request.postDataJSON() as { id_question?: string; choix?: number; texte?: string }
        : null;
      const idQuestion = corpsJson?.id_question ?? session.courante.id;
      const cleReponse = session.courante.typeReponse === "choix"
        ? `choix:${corpsJson?.choix}`
        : session.courante.typeReponse === "texte"
          ? `texte:${corpsJson?.texte ?? ""}`
          : "audio";
      if (session.derniereReponse?.idQuestion === idQuestion) {
        if (session.derniereReponse.cleReponse === cleReponse) {
          await json(route, 200, versRetourDto(session.derniereReponse.retour));
          return;
        }
        await json(route, 409, { detail: "Une autre réponse a déjà été enregistrée pour cette question." });
        return;
      }
      if (session.terminee || session.courante.id !== idQuestion) {
        await json(route, 409, { detail: "Cette question a déjà reçu une réponse." });
        return;
      }

      const typeReponse = session.courante.typeReponse;
      const correcte = forceIncorrect
        ? false
        : typeReponse === "choix"
        ? corpsJson?.choix === session.courante.bonneReponse
        : typeReponse === "texte"
          ? Boolean(corpsJson?.texte?.trim())
          : true;
      const bonneReponse = session.courante.bonneReponse;
      const competence = session.courante.competence;
      session.score += Number(correcte);
      session.scoresCompetences[competence].total += 1;
      session.scoresCompetences[competence].score += Number(correcte);
      session.niveauxVises.push(session.niveauVise);
      session.niveauVise = Math.max(0, Math.min(
        session.niveaux.length - 1,
        session.niveauVise + (correcte ? 1 : -1),
      ));
      const suivante = session.niveauxVises.length < session.total ? choisirQuestion(session) : null;
      if (suivante) {
        session.courante = suivante;
        session.dejaPosees.add(suivante.id);
      } else {
        session.terminee = true;
      }

      const niveauxFinaux = [...session.niveauxVises.slice(-5), session.niveauVise];
      const indexFinal = Math.round(niveauxFinaux.reduce((sum, value) => sum + value, 0) / niveauxFinaux.length);
      const resultat = {
        niveau: session.score === session.total
          ? session.niveaux[session.niveaux.length - 1]
          : session.score === 0
            ? session.niveaux[0]
            : session.niveaux[indexFinal],
        score: session.score,
        total: session.niveauxVises.length,
        ...resultatCompetences(session),
      };
      const retour: RetourReponse = typeReponse === "choix"
        ? {
          typeReponse,
          correcte,
          bonneReponse,
          numeroQuestion: session.niveauxVises.length,
          totalQuestions: session.total,
          questionSuivante: suivante,
          resultat: suivante ? null : resultat,
        }
        : {
          typeReponse,
          evaluation: "Réponse enregistrée pour le test.",
          numeroQuestion: session.niveauxVises.length,
          totalQuestions: session.total,
          questionSuivante: suivante,
          resultat: suivante ? null : resultat,
        };
      session.derniereReponse = { idQuestion, cleReponse, retour };
      await json(route, 200, versRetourDto(retour));
      return;
    }

    await json(route, 404, { detail: "Route de test inconnue." });
  });
}
