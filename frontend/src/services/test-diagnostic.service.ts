import { apiRequest } from "@/lib/api-client";
import { API_MOCK } from "@/lib/env";
import { testDiagnosticMockService } from "@/mocks/test-diagnostic.mock";
import {
  type CadreReference,
  type CompetenceTest,
  type LangueDiagnostic,
  type ObjectifFormation,
  type Question,
  type ReponseTest,
  type RetourReponse,
  type ResultatTest,
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

interface LangueDiagnosticDto {
  code: string;
  libelle: string;
  cadre: CadreReference;
  niveaux: string[];
  nombre_questions: number;
  disponible: boolean;
}

interface SessionTestDto {
  id_tentative: number;
  code_langue: string;
  code_niveau: string;
}

interface ReponseDto {
  id_reponse: number;
  id_tentative: number;
  id_question: string;
  reponse_fournie: string;
}

interface ScoreDiagnosticDto {
  id_tentative: number;
  score: number;
  max_score: number;
  percentage: number;
  level: string;
  framework: CadreReference;
}

export interface ReponseProgression {
  numeroQuestion: number;
  totalQuestions: number;
  questionSuivante: Question | null;
}

export interface TestDiagnosticGateway {
  /** Langues proposées sur l'écran d'accueil, avec leur échelle et leur disponibilité. */
  langues(): Promise<LangueDiagnostic[]>;
  demarrer(langue: string, objectif: ObjectifFormation, creneaux: string[]): Promise<SessionTest>;
  repondre(
    idSession: string,
    idQuestion: string,
    reponse: ReponseTest,
    valeurChoix?: string,
    progression?: ReponseProgression,
  ): Promise<RetourReponse>;
  terminer(idSession: string): Promise<ResultatTest>;
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

const toLangue = (dto: LangueDiagnosticDto): LangueDiagnostic => ({
  code: dto.code,
  libelle: dto.libelle,
  cadre: dto.cadre,
  niveaux: dto.niveaux,
  nombreQuestions: dto.nombre_questions,
  // Une langue sans question ne peut pas être évaluée, quoi qu'en dise le drapeau
  disponible: dto.disponible && dto.nombre_questions > 0,
});

export const httpTestDiagnosticService = {
  async langues(): Promise<LangueDiagnostic[]> {
    const dtos = await apiRequest<LangueDiagnosticDto[]>(ENDPOINTS.diagnostic.langues);
    return dtos.map(toLangue);
  },

  async demarrer(langue: string, _objectif: ObjectifFormation, _creneaux: string[]): Promise<SessionTest> {
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

  async terminer(idSession: string): Promise<ResultatTest> {
    const tentativeId = Number(idSession);
    if (!Number.isSafeInteger(tentativeId) || tentativeId <= 0) {
      throw new Error("Identifiant de tentative invalide.");
    }
    const dto = await apiRequest<ScoreDiagnosticDto>(ENDPOINTS.diagnostic.terminerTentative(tentativeId), {
      method: "POST",
    });
    if (
      dto.id_tentative !== tentativeId
      || !Number.isFinite(dto.score)
      || !Number.isFinite(dto.percentage)
      || !Number.isFinite(dto.max_score)
      || dto.score !== dto.percentage
      || dto.max_score !== 100
      || dto.percentage < 0
      || dto.percentage > 100
      || !dto.level
      || (dto.framework !== "CECRL" && dto.framework !== "HSK")
    ) {
      throw new Error("Le résultat de scoring renvoyé par le serveur est invalide.");
    }
    return {
      niveau: dto.level,
      score: dto.percentage,
      total: dto.max_score,
      cadre: dto.framework,
      competences: [],
      lacunes: [],
    };
  },
};

/** En mode API simulée, le mock conserve l'évaluation de démonstration. */
export const testDiagnosticService: TestDiagnosticGateway = {
  langues: () => API_MOCK ? testDiagnosticMockService.langues() : httpTestDiagnosticService.langues(),
  demarrer: (...args) => API_MOCK
    ? testDiagnosticMockService.demarrer(...args)
    : httpTestDiagnosticService.demarrer(...args),
  repondre: (...args) => API_MOCK
    ? testDiagnosticMockService.repondre(...args)
    : httpTestDiagnosticService.repondre(...args),
  terminer: (...args) => API_MOCK
    ? Promise.reject(new Error("Le mode démonstration renvoie le résultat à la dernière réponse."))
    : httpTestDiagnosticService.terminer(...args),
};
