import { ApiError } from "@/lib/api-client";
import { QUESTIONS_TEST, type QuestionMock } from "@/mocks/questions-test.mock";
import type { CodeLangue } from "@/types/langue";
import {
  COMPETENCES_TEST,
  type CompetenceResultat,
  type CompetenceTest,
  type ObjectifFormation,
  type ReponseTest,
  type RetourReponse,
  type SessionTest,
} from "@/types/test-diagnostic";

const MAX_QUESTIONS = 10;

interface SessionMock {
  id: string;
  langue: CodeLangue;
  banque: QuestionMock[];
  niveaux: string[];
  total: number;
  questionCourante: QuestionMock;
  dejaPosees: Set<string>;
  niveauVise: number;
  niveauxVises: number[];
  score: number;
  scoresCompetences: Record<CompetenceTest, { score: number; total: number }>;
  terminee: boolean;
  derniereReponse: { idQuestion: string; reponse: ReponseTest; retour: RetourReponse } | null;
}

const sessions = new Map<string, SessionMock>();
let prochainId = 1;

function choisirQuestion(session: SessionMock): QuestionMock | null {
  for (let distance = 0; distance < session.niveaux.length; distance++) {
    const indices = distance === 0
      ? [session.niveauVise]
      : [session.niveauVise - distance, session.niveauVise + distance];
    for (const index of indices) {
      if (index < 0 || index >= session.niveaux.length) continue;
      const candidates = session.banque.filter(
        (item) => item.niveau === session.niveaux[index] && !session.dejaPosees.has(item.id),
      );
      const question = candidates.find((item) => session.scoresCompetences[item.competence].total === 0)
        ?? candidates[0];
      if (question) return question;
    }
  }
  return null;
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

export const testDiagnosticMockService = {
  async demarrer(langue: CodeLangue, _objectif: ObjectifFormation, _creneaux: string[]): Promise<SessionTest> {
    const banque = QUESTIONS_TEST[langue];
    const niveaux = [...new Set(banque.map((question) => question.niveau))];
    if (banque.length === 0 || niveaux.length === 0) {
      throw new ApiError(404, "Aucune question n'est disponible pour cette langue.");
    }

    const id = `test-${prochainId++}`;
    const session: SessionMock = {
      id,
      langue,
      banque,
      niveaux,
      total: Math.min(MAX_QUESTIONS, banque.length),
      questionCourante: banque[0],
      dejaPosees: new Set(),
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
      question: sansCorrection(premiere),
    };
  },

  async repondre(idSession: string, idQuestion: string, reponse: ReponseTest): Promise<RetourReponse> {
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
    const choixValide = reponse.type === "choix"
      && Number.isInteger(reponse.choix)
      && reponse.choix >= 0
      && reponse.choix < (session.questionCourante.choix?.length ?? 0);
    const reponseLibreValide = reponse.type === "texte"
      ? Boolean(reponse.texte.trim())
      : reponse.type === "audio" && reponse.audio.size > 0;
    if (session.questionCourante.typeReponse === "choix" && !choixValide
      || session.questionCourante.typeReponse === "texte" && (reponse.type !== "texte" || !reponseLibreValide)
      || session.questionCourante.typeReponse === "audio" && (reponse.type !== "audio" || !reponseLibreValide)) {
      throw new ApiError(422, "La réponse sélectionnée est invalide.");
    }

    const typeReponse = session.questionCourante.typeReponse;
    const correcte = reponse.type === "choix" && reponse.choix === session.questionCourante.bonneReponse;
    const bonneReponse = session.questionCourante.bonneReponse;
    const evalueeCorrectement = typeReponse === "choix" ? correcte : reponseLibreValide;
    const competence = session.questionCourante.competence;
    session.score += Number(evalueeCorrectement);
    session.scoresCompetences[competence].total += 1;
    session.scoresCompetences[competence].score += Number(evalueeCorrectement);
    session.niveauxVises.push(session.niveauVise);
    session.niveauVise = Math.max(
      0,
      Math.min(session.niveaux.length - 1, session.niveauVise + (evalueeCorrectement ? 1 : -1)),
    );

    const suivante = session.niveauxVises.length < session.total ? choisirQuestion(session) : null;
    if (suivante) {
      session.questionCourante = suivante;
      session.dejaPosees.add(suivante.id);
    } else {
      session.terminee = true;
    }

    const valeursNiveau = [...session.niveauxVises.slice(-5), session.niveauVise];
    const indexNiveauFinal = Math.round(valeursNiveau.reduce((sum, value) => sum + value, 0) / valeursNiveau.length);
    const suite = { numeroQuestion: session.niveauxVises.length, totalQuestions: session.total };
    if (suivante) {
      const retour: RetourReponse = typeReponse === "choix"
        ? { ...suite, typeReponse: "choix", correcte, bonneReponse, questionSuivante: sansCorrection(suivante), resultat: null }
        : { ...suite, typeReponse, evaluation: "Réponse enregistrée pour le test.", questionSuivante: sansCorrection(suivante), resultat: null };
      session.derniereReponse = { idQuestion, reponse, retour };
      return retour;
    }
    const niveauFinal = session.score === session.total
      ? session.niveaux[session.niveaux.length - 1]
      : session.score === 0
        ? session.niveaux[0]
        : session.niveaux[indexNiveauFinal];
    const resultat = {
      niveau: niveauFinal,
      score: session.score,
      total: session.niveauxVises.length,
      competences: COMPETENCES_TEST.reduce<CompetenceResultat[]>((competences, nomCompetence) => {
        const scoreCompetence = session.scoresCompetences[nomCompetence];
        if (scoreCompetence.total > 0) {
          competences.push({ competence: nomCompetence, ...scoreCompetence });
        }
        return competences;
      }, []),
      lacunes: COMPETENCES_TEST.filter((nomCompetence) => {
        const scoreCompetence = session.scoresCompetences[nomCompetence];
        return scoreCompetence.total > 0 && scoreCompetence.score / scoreCompetence.total < 0.5;
      }),
    };
    const retour: RetourReponse = typeReponse === "choix"
      ? { ...suite, typeReponse: "choix", correcte, bonneReponse, questionSuivante: null, resultat }
      : { ...suite, typeReponse, evaluation: "Réponse enregistrée pour le test.", questionSuivante: null, resultat };
    session.derniereReponse = { idQuestion, reponse, retour };
    return retour;
  },
};
