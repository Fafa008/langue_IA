import { ApiError } from "@/lib/api-client";
import { ETAPES, etapeDe } from "@/lib/etapesTest";
import { LANGUES } from "@/lib/languages";
import { cadreDeLangue, ECHELLES } from "@/lib/referentiels";
import { QUESTIONS_TEST, type QuestionMock } from "@/mocks/questions-test.mock";
import {
  COMPETENCES_TEST,
  type CompetenceResultat,
  type CompetenceTest,
  type EtapePlan,
  type LangueDiagnostic,
  type ObjectifFormation,
  type Question,
  type ReponseTest,
  type ResultatTest,
  type RetourReponse,
  type SessionTest,
} from "@/types/test-diagnostic";

/** Plan visé d'un test de 15 minutes, réduit si la banque d'une langue n'a pas assez de questions. */
const PLAN_VISE: EtapePlan[] = [
  { etape: "qcm", nombreQuestions: 8 },
  { etape: "comprehension_orale", nombreQuestions: 2 },
  { etape: "expression_orale", nombreQuestions: 1 },
  { etape: "expression_ecrite", nombreQuestions: 1 },
];

/** Banque de questions simulée d'une langue (vide pour une langue inconnue). */
const banqueDe = (langue: string): QuestionMock[] =>
  (QUESTIONS_TEST as Record<string, QuestionMock[] | undefined>)[langue] ?? [];

/** Plan réellement possible avec la banque de la langue. */
const planPour = (banque: QuestionMock[]): EtapePlan[] =>
  PLAN_VISE
    .map(({ etape, nombreQuestions }) => ({
      etape,
      nombreQuestions: Math.min(nombreQuestions, banque.filter((q) => etapeDe(q.competence) === etape).length),
    }))
    .filter(({ nombreQuestions }) => nombreQuestions > 0);

const totalDu = (plan: EtapePlan[]) => plan.reduce((total, { nombreQuestions }) => total + nombreQuestions, 0);

interface SessionMock {
  id: string;
  langue: string;
  banque: QuestionMock[];
  niveaux: string[];
  plan: EtapePlan[];
  total: number;
  questionCourante: QuestionMock;
  dejaPosees: Set<string>;
  /** Niveau estimé (indice dans `niveaux`) : il monte ou descend après chaque réponse à choix. */
  niveauVise: number;
  niveauxVises: number[];
  score: number;
  scoresCompetences: Record<CompetenceTest, { score: number; total: number }>;
  terminee: boolean;
  derniereReponse: { idQuestion: string; reponse: ReponseTest; retour: RetourReponse } | null;
}

const sessions = new Map<string, SessionMock>();
let prochainId = 1;

/** Étape de la prochaine question, d'après le nombre de réponses déjà données. */
function etapeSuivante(session: SessionMock) {
  let dejaRepondues = session.niveauxVises.length;
  for (const { etape, nombreQuestions } of session.plan) {
    if (dejaRepondues < nombreQuestions) return etape;
    dejaRepondues -= nombreQuestions;
  }
  return null;
}

/**
 * Question suivante : dans l'étape en cours, la plus proche du niveau estimé.
 * Les sujets d'expression orale et écrite sont donc choisis au niveau atteint pendant le QCM.
 */
function choisirQuestion(session: SessionMock): QuestionMock | null {
  const etape = etapeSuivante(session);
  if (!etape) return null;
  const candidates = session.banque.filter(
    (item) => ETAPES[etape].competences.includes(item.competence) && !session.dejaPosees.has(item.id),
  );
  const ecart = (item: QuestionMock) => Math.abs(session.niveaux.indexOf(item.niveau) - session.niveauVise);
  const plusProches = candidates.filter((item) => ecart(item) === Math.min(...candidates.map(ecart)));
  // À niveau égal, on varie les compétences (grammaire puis compréhension écrite)
  return plusProches.find((item) => session.scoresCompetences[item.competence].total === 0) ?? plusProches[0] ?? null;
}

function sansCorrection({ bonneReponse: _bonneReponse, ...question }: QuestionMock) {
  return question;
}

function creerScoresCompetences(): SessionMock["scoresCompetences"] {
  return {
    grammaire: { score: 0, total: 0 },
    lecture: { score: 0, total: 0 },
    ecoute: { score: 0, total: 0 },
    ecrit: { score: 0, total: 0 },
    oral: { score: 0, total: 0 },
  };
}

/** Résultat d'après les réponses données jusqu'ici (fin normale ou temps écoulé). */
function calculerResultat(session: SessionMock): ResultatTest {
  const repondues = session.niveauxVises.length;
  const valeursNiveau = [...session.niveauxVises.slice(-5), session.niveauVise];
  const indexNiveau = Math.round(valeursNiveau.reduce((sum, value) => sum + value, 0) / valeursNiveau.length);
  const niveau = repondues > 0 && session.score === repondues
    ? session.niveaux[session.niveaux.length - 1]
    : session.score === 0
      ? session.niveaux[0]
      : session.niveaux[indexNiveau];
  const evaluees = COMPETENCES_TEST.filter((competence) => session.scoresCompetences[competence].total > 0);
  return {
    niveau,
    score: session.score,
    // Les questions sans réponse (temps écoulé) comptent comme fausses
    total: session.total,
    competences: evaluees.map<CompetenceResultat>((competence) => ({ competence, ...session.scoresCompetences[competence] })),
    lacunes: evaluees.filter((competence) => {
      const { score, total } = session.scoresCompetences[competence];
      return score / total < 0.5;
    }),
  };
}

export const testDiagnosticMockService = {
  async langues(): Promise<LangueDiagnostic[]> {
    return LANGUES.map(({ code, libelle }) => {
      const cadre = cadreDeLangue(code);
      const nombreQuestions = totalDu(planPour(banqueDe(code)));
      return { code, libelle, cadre, niveaux: [...ECHELLES[cadre]], nombreQuestions, disponible: nombreQuestions > 0 };
    });
  },

  async demarrer(langue: string, _objectif: ObjectifFormation, _creneaux: string[]): Promise<SessionTest> {
    const banque = banqueDe(langue);
    const plan = planPour(banque);
    if (plan.length === 0) throw new ApiError(404, "Aucune question n'est disponible pour cette langue.");
    // Niveaux de la banque, du plus bas au plus haut, en suivant l'échelle du référentiel
    const niveaux = ECHELLES[cadreDeLangue(langue)].filter((niveau) => banque.some((q) => q.niveau === niveau));

    const id = `test-${prochainId++}`;
    const session: SessionMock = {
      id,
      langue,
      banque,
      niveaux,
      plan,
      total: totalDu(plan),
      questionCourante: banque[0],
      dejaPosees: new Set(),
      // Le test commence au milieu de l'échelle, puis s'adapte
      niveauVise: Math.floor((niveaux.length - 1) / 2),
      niveauxVises: [],
      score: 0,
      scoresCompetences: creerScoresCompetences(),
      terminee: false,
      derniereReponse: null,
    };
    const premiere = choisirQuestion(session);
    if (!premiere) throw new ApiError(404, "Aucune question n'est disponible pour cette langue.");
    session.questionCourante = premiere;
    session.dejaPosees.add(premiere.id);
    sessions.set(id, session);

    return {
      id,
      langue,
      niveaux,
      numeroQuestion: 1,
      totalQuestions: session.total,
      plan,
      question: sansCorrection(premiere),
    };
  },

  async repondre(
    idSession: string,
    idQuestion: string,
    reponse: ReponseTest,
    _valeurChoix?: string,
    _progression?: { numeroQuestion: number; totalQuestions: number; questionSuivante: Question | null },
  ): Promise<RetourReponse> {
    const session = sessions.get(idSession);
    if (!session) throw new ApiError(404, "Session de test introuvable.");
    if (session.derniereReponse?.idQuestion === idQuestion) {
      const precedente = session.derniereReponse.reponse;
      const identique = precedente.type === reponse.type && (
        precedente.type === "choix" && reponse.type === "choix" ? precedente.choix === reponse.choix
          : precedente.type === "texte" && reponse.type === "texte" ? precedente.texte === reponse.texte
            : precedente.type === "audio" && reponse.type === "audio" ? precedente.audio === reponse.audio
              : false
      );
      if (identique) return session.derniereReponse.retour;
      throw new ApiError(409, "Une autre réponse a déjà été enregistrée pour cette question.");
    }
    if (session.terminee || session.questionCourante.id !== idQuestion) {
      throw new ApiError(409, "Cette question a déjà reçu une réponse.");
    }
    const question = session.questionCourante;
    const choixValide = reponse.type === "choix"
      && Number.isInteger(reponse.choix)
      && reponse.choix >= 0
      && reponse.choix < (question.choix?.length ?? 0);
    const reponseLibreValide = reponse.type === "texte"
      ? Boolean(reponse.texte.trim())
      : reponse.type === "audio" && reponse.audio.size > 0;
    if (question.typeReponse === "choix" && !choixValide
      || question.typeReponse === "texte" && (reponse.type !== "texte" || !reponseLibreValide)
      || question.typeReponse === "audio" && (reponse.type !== "audio" || !reponseLibreValide)) {
      throw new ApiError(422, "La réponse sélectionnée est invalide.");
    }

    const correcte = reponse.type === "choix" && reponse.choix === question.bonneReponse;
    // Démonstration : une réponse libre non vide est considérée comme réussie, en attendant l'évaluation par l'IA
    const reussie = question.typeReponse === "choix" ? correcte : reponseLibreValide;
    session.score += Number(reussie);
    session.scoresCompetences[question.competence].total += 1;
    session.scoresCompetences[question.competence].score += Number(reussie);
    session.niveauxVises.push(session.niveauVise);
    // Seules les réponses à choix font évoluer le niveau estimé
    if (question.typeReponse === "choix") {
      session.niveauVise = Math.max(0, Math.min(session.niveaux.length - 1, session.niveauVise + (reussie ? 1 : -1)));
    }

    const suivante = choisirQuestion(session);
    if (suivante) {
      session.questionCourante = suivante;
      session.dejaPosees.add(suivante.id);
    } else {
      session.terminee = true;
    }

    const suite = {
      numeroQuestion: session.niveauxVises.length,
      totalQuestions: session.total,
      questionSuivante: suivante ? sansCorrection(suivante) : null,
      resultat: suivante ? null : calculerResultat(session),
    };
    const retour: RetourReponse = question.typeReponse === "choix"
      ? { ...suite, typeReponse: "choix", correcte, bonneReponse: question.bonneReponse }
      : { ...suite, typeReponse: question.typeReponse, evaluation: "Réponse enregistrée pour le test." };
    session.derniereReponse = { idQuestion, reponse, retour };
    return retour;
  },

  /** Fin anticipée (temps écoulé) : résultat d'après les réponses déjà données. */
  async terminer(idSession: string): Promise<ResultatTest> {
    const session = sessions.get(idSession);
    if (!session) throw new ApiError(404, "Session de test introuvable.");
    session.terminee = true;
    return calculerResultat(session);
  },
};
