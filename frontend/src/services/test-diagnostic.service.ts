import { apiRequest } from "@/lib/api-client";
import { API_MOCK } from "@/lib/env";
import { testDiagnosticMockService } from "@/mocks/test-diagnostic.mock";
import type { CodeLangue } from "@/types/langue";
import {
  COMPETENCES_TEST,
  type CompetenceResultat,
  type CompetenceTest,
  type ObjectifFormation,
  type Question,
  type ReponseTest,
  type ResultatTest,
  type RetourReponse,
  type SessionTest,
} from "@/types/test-diagnostic";
import { ENDPOINTS } from "./endpoints";

interface QuestionDto {
  id_question: string;
  niveau: string;
  competence: CompetenceTest;
  type_reponse: "choix" | "texte" | "audio";
  enonce: string;
  choix?: string[];
  support?: string | null;
  audio_url?: string | null;
  audio_texte?: string | null;
}

interface SessionTestDto {
  id_session: string;
  code_langue: CodeLangue;
  niveaux: string[];
  numero_question: number;
  total_questions: number;
  question: QuestionDto;
}

interface RetourReponseDto {
  type_reponse: "choix" | "texte" | "audio";
  correcte?: boolean;
  bonne_reponse?: number;
  evaluation?: string;
  score_prononciation?: number;
  numero_question: number;
  total_questions: number;
  question_suivante: QuestionDto | null;
  resultat: ResultatTest | null;
}

export interface TestDiagnosticGateway {
  demarrer(langue: CodeLangue, objectif: ObjectifFormation, creneaux: string[]): Promise<SessionTest>;
  repondre(idSession: string, idQuestion: string, reponse: ReponseTest): Promise<RetourReponse>;
}

const toQuestion = (dto: QuestionDto): Question => ({
  id: dto.id_question,
  niveau: dto.niveau,
  competence: dto.competence,
  typeReponse: dto.type_reponse,
  enonce: dto.enonce,
  choix: dto.choix,
  support: dto.support ?? undefined,
  audioUrl: dto.audio_url ?? undefined,
  audioTexte: dto.audio_texte ?? undefined,
});

const toSession = (dto: SessionTestDto): SessionTest => ({
  id: dto.id_session,
  langue: dto.code_langue,
  niveaux: dto.niveaux,
  numeroQuestion: dto.numero_question,
  totalQuestions: dto.total_questions,
  question: toQuestion(dto.question),
});

const toResultat = (dto: ResultatTest | null): ResultatTest | null => {
  if (!dto) return null;
  const competenceValide = (competence: CompetenceResultat) =>
    COMPETENCES_TEST.includes(competence.competence)
    && Number.isInteger(competence.score)
    && Number.isInteger(competence.total)
    && competence.total > 0
    && competence.score >= 0
    && competence.score <= competence.total;
  if (
    !dto.niveau
    || !Number.isInteger(dto.score)
    || !Number.isInteger(dto.total)
    || dto.total <= 0
    || dto.score < 0
    || dto.score > dto.total
    || !Array.isArray(dto.competences)
    || !dto.competences.every(competenceValide)
    || !Array.isArray(dto.lacunes)
    || !dto.lacunes.every((competence) => COMPETENCES_TEST.includes(competence))
  ) {
    throw new Error("Résultat invalide du serveur pour le test de positionnement.");
  }
  return dto;
};

const toRetour = (dto: RetourReponseDto): RetourReponse => {
  const commun = {
    numeroQuestion: dto.numero_question,
    totalQuestions: dto.total_questions,
  };
  if (Boolean(dto.question_suivante) === Boolean(dto.resultat)) {
    throw new Error("Réponse invalide du serveur pour le test de positionnement.");
  }
  const suite = {
    questionSuivante: dto.question_suivante ? toQuestion(dto.question_suivante) : null,
    resultat: toResultat(dto.resultat),
  };
  if (
    dto.type_reponse === "choix"
    && typeof dto.correcte === "boolean"
    && typeof dto.bonne_reponse === "number"
    && Number.isInteger(dto.bonne_reponse)
  ) {
    return {
      ...commun,
      ...suite,
      typeReponse: "choix",
      correcte: dto.correcte,
      bonneReponse: dto.bonne_reponse,
    };
  }
  if ((dto.type_reponse === "texte" || dto.type_reponse === "audio") && dto.evaluation) {
    return {
      ...commun,
      ...suite,
      typeReponse: dto.type_reponse,
      evaluation: dto.evaluation,
      scorePrononciation: dto.score_prononciation,
    };
  }
  throw new Error("Réponse invalide du serveur pour le test de positionnement.");
};

export const httpTestDiagnosticService = {
  async demarrer(langue: CodeLangue, objectif: ObjectifFormation, creneaux: string[]): Promise<SessionTest> {
    const dto = await apiRequest<SessionTestDto>(ENDPOINTS.testDiagnostic.sessions, {
      method: "POST",
      body: { code_langue: langue, objectif, creneaux },
    });
    return toSession(dto);
  },

  async repondre(idSession: string, idQuestion: string, reponse: ReponseTest): Promise<RetourReponse> {
    const body = reponse.type === "audio"
      ? (() => {
          const formData = new FormData();
          formData.set("id_question", idQuestion);
          formData.set("audio", reponse.audio, "reponse.webm");
          return formData;
        })()
      : {
          id_question: idQuestion,
          ...(reponse.type === "choix" ? { choix: reponse.choix } : { texte: reponse.texte }),
        };
    const dto = await apiRequest<RetourReponseDto>(ENDPOINTS.testDiagnostic.sessionReponses(idSession), {
      method: "POST",
      body,
    });
    return toRetour(dto);
  },
};

/** En mode API simulée, le mock respecte le même contrat de session que le backend. */
export const testDiagnosticService: TestDiagnosticGateway = {
  demarrer: (...args) => API_MOCK
    ? testDiagnosticMockService.demarrer(...args)
    : httpTestDiagnosticService.demarrer(...args),
  repondre: (...args) => API_MOCK
    ? testDiagnosticMockService.repondre(...args)
    : httpTestDiagnosticService.repondre(...args),
};
