import { apiRequest } from "@/lib/api-client";
import { API_MOCK } from "@/lib/env";
import { testDiagnosticMockService } from "@/mocks/test-diagnostic.mock";
import type { CodeLangue } from "@/types/langue";
import {
  type CompetenceTest,
  type ObjectifFormation,
  type Question,
  type ReponseTest,
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
  id_tentative: number;
  code_langue: CodeLangue;
  code_niveau: string;
}

interface ReponseDto {
  id_reponse: number;
  id_tentative: number;
  id_question: string;
  reponse_fournie: string;
}

export interface ReponseProgression {
  numeroQuestion: number;
  totalQuestions: number;
  questionSuivante: Question | null;
}

export interface TestDiagnosticGateway {
  demarrer(langue: CodeLangue, objectif: ObjectifFormation, creneaux: string[]): Promise<SessionTest>;
  repondre(
    idSession: string,
    idQuestion: string,
    reponse: ReponseTest,
    valeurChoix?: string,
    progression?: ReponseProgression,
  ): Promise<RetourReponse>;
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

export const httpTestDiagnosticService = {
  async demarrer(langue: CodeLangue, _objectif: ObjectifFormation, _creneaux: string[]): Promise<SessionTest> {
    const tentative = await apiRequest<SessionTestDto>(ENDPOINTS.diagnostic.tentatives, {
      method: "POST",
      body: { code_langue: langue },
    });
    const params = new URLSearchParams({
      code_langue: tentative.code_langue,
      code_niveau: tentative.code_niveau,
    });
    const questionDtos = await apiRequest<QuestionDto[]>(`${ENDPOINTS.diagnostic.questions}?${params}`);
    const questions = questionDtos.filter((question) => question.type_reponse !== "audio").map(toQuestion);
    if (questions.length === 0) {
      throw new Error("Aucune question textuelle ou à choix n'est disponible pour cette tentative.");
    }
    return {
      id: String(tentative.id_tentative),
      langue: tentative.code_langue,
      niveaux: [tentative.code_niveau],
      numeroQuestion: 1,
      totalQuestions: questions.length,
      question: questions[0],
      questions,
    };
  },

  async repondre(
    idSession: string,
    idQuestion: string,
    reponse: ReponseTest,
    valeurChoix?: string,
    progression: ReponseProgression = { numeroQuestion: 1, totalQuestions: 1, questionSuivante: null },
  ): Promise<RetourReponse> {
    if (reponse.type === "audio") {
      throw new Error("L'enregistrement des réponses audio sera disponible après la mise en place du stockage des médias.");
    }
    const reponseFournie = reponse.type === "choix" ? valeurChoix : reponse.texte;
    if (!reponseFournie?.trim()) {
      throw new Error("La réponse à enregistrer est vide ou invalide.");
    }
    const tentativeId = Number(idSession);
    if (!Number.isSafeInteger(tentativeId) || tentativeId <= 0) {
      throw new Error("Identifiant de tentative invalide.");
    }
    const dto = await apiRequest<ReponseDto>(ENDPOINTS.diagnostic.reponse, {
      method: "POST",
      body: {
        id_tentative: tentativeId,
        id_question: idQuestion,
        reponse_fournie: reponseFournie,
      },
    });
    if (dto.id_tentative !== tentativeId || dto.id_question !== idQuestion || !dto.id_reponse) {
      throw new Error("Confirmation invalide du serveur pour la réponse enregistrée.");
    }
    return {
      typeReponse: "en_attente",
      numeroQuestion: progression.numeroQuestion,
      totalQuestions: progression.totalQuestions,
      questionSuivante: progression.questionSuivante,
      resultat: null,
    };
  },
};

/** En mode API simulée, le mock conserve l'évaluation de démonstration. */
export const testDiagnosticService: TestDiagnosticGateway = {
  demarrer: (...args) => API_MOCK
    ? testDiagnosticMockService.demarrer(...args)
    : httpTestDiagnosticService.demarrer(...args),
  repondre: (...args) => API_MOCK
    ? testDiagnosticMockService.repondre(...args)
    : httpTestDiagnosticService.repondre(...args),
};
