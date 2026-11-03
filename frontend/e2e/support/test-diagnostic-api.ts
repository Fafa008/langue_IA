import type { Page } from "@playwright/test";
import { ECHELLES, cadreDeLangue } from "../../src/lib/referentiels";
import { QUESTIONS_TEST, type QuestionMock } from "../../src/mocks/questions-test.mock";
import type { Question } from "../../src/types/test-diagnostic";
import { handlePreflight, json } from "./session";

interface TentativeE2E {
  id: number;
  langue: string;
  niveau: string;
  questions: QuestionMock[];
  reponses: Map<string, { id: number; valeur: string }>;
  statut: "EN_COURS" | "TERMINE";
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
    duree_minimale_secondes: question.dureeMinimaleSecondes,
    mots_minimum: question.motsMinimum,
  };
}

/** Langues renvoyées par GET /diagnostic/langues : celles de la banque, plus l'espagnol sans questions (sans drapeau). */
const LANGUES_API = [
  { code: "en", libelle: "Anglais" },
  { code: "fr", libelle: "Français" },
  { code: "zh", libelle: "Chinois" },
  { code: "es", libelle: "Espagnol" },
];

/** Sujet d'expression écrite ajouté au test quand l'option `avecRedaction` est active. */
const REDACTION: QuestionMock = {
  id: "e2e-ecrit",
  niveau: "A1",
  competence: "ecrit",
  typeReponse: "texte",
  enonce: "Présentez-vous en quelques phrases.",
  motsMinimum: 5,
  bonneReponse: 0,
};

/** Question de compréhension orale ajoutée au test quand l'option `avecEcoute` est active. */
export const ECOUTE: QuestionMock = {
  id: "e2e-ecoute",
  niveau: "A1",
  competence: "ecoute",
  typeReponse: "choix",
  enonce: "Where is the speaker going?",
  choix: ["To work", "To the beach", "To the cinema", "Home"],
  audioTexte: "Good morning! I am taking the bus to work.",
  bonneReponse: 0,
};

/** Premier niveau ayant des questions enregistrables, et ces questions (même règle que le backend). */
function niveauDeDepart(langue: string) {
  const banque = (QUESTIONS_TEST as Record<string, QuestionMock[] | undefined>)[langue] ?? [];
  const niveaux = [...new Set(banque.map((question) => question.niveau))];
  const niveau = niveaux.find((code) => banque.some(
    (question) => question.niveau === code && question.typeReponse !== "audio",
  ));
  const questions = banque.filter((question) => question.niveau === niveau && question.typeReponse !== "audio");
  return { niveau, questions };
}

export interface OptionsApiDiagnostic {
  /** La première réponse échoue (503). */
  failFirstAnswer?: boolean;
  /** La première réponse n'obtient jamais de réponse du serveur (délai dépassé côté client). */
  premiereReponseSansReponse?: boolean;
  /** GET /diagnostic/langues échoue (503). */
  languesEnErreur?: boolean;
  /**
   * Première demande de résultat : « panne » (500 avec un détail technique qui ne doit pas s'afficher),
   * « en_attente » (202, analyse LLM non terminée) ou « sans_reponse » (délai dépassé).
   */
  premiereTerminaison?: "panne" | "en_attente" | "sans_reponse";
  /** Ajoute un sujet d'expression écrite après les questions à choix. */
  avecRedaction?: boolean;
  /** Ajoute une question de compréhension orale (étape entre le QCM et l'expression écrite). */
  avecEcoute?: boolean;
  /** Le résultat inclut l'analyse détaillée (LLM + RAG) : compétences, points faibles, phase Assimil, justification. */
  avecAnalyse?: boolean;
}

/** Analyse détaillée renvoyée avec `avecAnalyse` ; un lien `javascript:` vérifie qu'il n'est jamais cliquable. */
export const ANALYSE_E2E = {
  competences: [{ competence: "grammaire", score: 1, total: 2 }],
  points_faibles: [
    { domaine: "vocabulaire", detail: "Le vocabulaire reste limité aux situations du quotidien." },
    { domaine: "expression_orale", detail: null },
  ],
  phase_assimil: "activation",
  justification: {
    resume: "Vos réponses correspondent aux descripteurs du niveau B1, avec un vocabulaire à enrichir.",
    sources: [
      {
        id: 12,
        referentiel: "CECRL",
        niveau: "B1",
        titre: "Échelle globale — niveau B1",
        extrait: "Comprend l'essentiel de sujets familiers et produit un discours simple et cohérent.",
        url: "https://www.coe.int/fr/web/common-european-framework-reference-languages",
      },
      {
        id: 13,
        referentiel: "CECRL",
        niveau: "B1",
        competence: "vocabulaire",
        titre: "Étendue du vocabulaire",
        extrait: "Possède un vocabulaire suffisant pour des besoins courants.",
        url: "javascript:alert(1)",
      },
    ],
  },
};

/** Détail renvoyé par la panne simulée : il ne doit jamais apparaître à l'écran. */
export const DETAIL_TECHNIQUE = "Traceback: LLMTimeoutError at llm_client.py:42 (OPENAI_API_KEY=sk-secret)";

/** Faux backend du flux API : conserve les réponses et renvoie le résultat de scoring à la clôture. */
export async function mockTestDiagnosticApi(
  page: Page,
  {
    failFirstAnswer = false,
    premiereReponseSansReponse = false,
    languesEnErreur = false,
    premiereTerminaison,
    avecRedaction = false,
    avecEcoute = false,
    avecAnalyse = false,
  }: OptionsApiDiagnostic = {},
) {
  const tentatives = new Map<number, TentativeE2E>();
  let idTentative = 0;
  let idReponse = 0;
  let firstAnswerFails = failFirstAnswer;
  let reponseSansReponse = premiereReponseSansReponse;
  let terminaisonSpeciale = premiereTerminaison;
  const questionsDuTest = (langue: string) => {
    const { niveau, questions } = niveauDeDepart(langue);
    if (!niveau) return { niveau, questions };
    return {
      niveau,
      questions: [...questions, ...(avecEcoute ? [ECOUTE] : []), ...(avecRedaction ? [REDACTION] : [])],
    };
  };

  await page.route("**/api/v1/diagnostic/**", async (route) => {
    if (await handlePreflight(route)) return;
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "GET" && url.pathname === "/api/v1/diagnostic/langues") {
      if (languesEnErreur) {
        await json(route, 503, { detail: "Service temporairement indisponible" });
        return;
      }
      await json(route, 200, LANGUES_API.map(({ code, libelle }) => {
        const cadre = cadreDeLangue(code);
        const { questions } = questionsDuTest(code);
        return {
          code,
          libelle,
          cadre,
          niveaux: ECHELLES[cadre],
          nombre_questions: questions.length,
          disponible: questions.length > 0,
        };
      }));
      return;
    }

    if (request.method() === "POST" && url.pathname === "/api/v1/diagnostic/tentatives") {
      const { code_langue: langue } = request.postDataJSON() as { code_langue: string };
      const { niveau, questions } = questionsDuTest(langue);
      if (!niveau) {
        await json(route, 404, { detail: "Aucune question enregistrable n'est disponible pour cette langue." });
        return;
      }
      const id = ++idTentative;
      tentatives.set(id, {
        id,
        langue,
        niveau,
        questions,
        reponses: new Map(),
        statut: "EN_COURS",
      });
      await json(route, 201, { id_tentative: id, code_langue: langue, code_niveau: niveau });
      return;
    }

    if (request.method() === "GET" && url.pathname === "/api/v1/diagnostic/questions") {
      const { niveau, questions: enregistrables } = questionsDuTest(url.searchParams.get("code_langue") ?? "");
      const questions = niveau === url.searchParams.get("code_niveau") ? enregistrables.map(questionPublique) : [];
      await json(route, 200, questions);
      return;
    }

    if (request.method() === "POST" && url.pathname === "/api/v1/diagnostic/reponse") {
      if (reponseSansReponse) {
        // Le serveur ne répond jamais : le client abandonne au bout de son délai
        reponseSansReponse = false;
        await new Promise(() => {});
        return;
      }
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

    const terminaison = url.pathname.match(/^\/api\/v1\/diagnostic\/tentatives\/(\d+)\/terminer$/);
    if (request.method() === "POST" && terminaison) {
      const speciale = terminaisonSpeciale;
      terminaisonSpeciale = undefined;
      if (speciale === "sans_reponse") {
        await new Promise(() => {});
        return;
      }
      if (speciale === "panne") {
        await json(route, 500, { detail: DETAIL_TECHNIQUE });
        return;
      }
      if (speciale === "en_attente") {
        await json(route, 202, { id_tentative: Number(terminaison[1]), statut: "en_attente" });
        return;
      }
      const tentative = tentatives.get(Number(terminaison[1]));
      if (!tentative) {
        await json(route, 404, { detail: "Tentative introuvable." });
        return;
      }
      const questionsCorrigeables = tentative.questions.filter((question) => question.typeReponse === "choix");
      if (questionsCorrigeables.length === 0) {
        await json(route, 409, { detail: "Aucune question à choix n'est disponible pour le scoring." });
        return;
      }
      const correctes = questionsCorrigeables.filter((question) => {
        const valeur = tentative.reponses.get(question.id)?.valeur;
        return valeur !== undefined && question.choix?.[question.bonneReponse] === valeur;
      }).length;
      const percentage = Math.round((correctes / questionsCorrigeables.length) * 10_000) / 100;
      const level = percentage < 20 ? "A1"
        : percentage < 40 ? "A2"
          : percentage < 60 ? "B1"
            : percentage < 75 ? "B2"
              : percentage < 90 ? "C1"
                : "C2";
      tentative.statut = "TERMINE";
      await json(route, 200, {
        id_tentative: tentative.id,
        score: percentage,
        max_score: 100,
        percentage,
        level: tentative.langue === "zh"
          ? ["HSK 1", "HSK 2", "HSK 3", "HSK 4", "HSK 5", "HSK 6"][["A1", "A2", "B1", "B2", "C1", "C2"].indexOf(level)]
          : level,
        framework: tentative.langue === "zh" ? "HSK" : "CECRL",
        ...(avecAnalyse ? ANALYSE_E2E : {}),
      });
      return;
    }

    await json(route, 404, { detail: "Route de diagnostic inconnue." });
  });
}
