import { apiRequest } from "@/lib/api-client";
import { PARCOURS_MOCK } from "@/lib/env";
import { parcoursPersonnaliseMock } from "@/mocks/parcours-personnalise.mock";
import type {
  CorrectionExercice,
  ExerciceParcours,
  LeconParcours,
  MessageChatbot,
  ParcoursPersonnalise,
  ReponseExercice,
} from "@/types/parcours-personnalise";
import { ENDPOINTS } from "./endpoints";
import {
  toCorrectionExercice,
  toExerciceParcours,
  toLeconParcours,
  toParcoursPersonnalise,
  type CorrectionExerciceDto,
  type ExerciceParcoursDto,
  type LeconParcoursDto,
  type MessageChatbotDto,
  type ParcoursPersonnaliseDto,
  type ReponseChatbotDto,
} from "./parcours-personnalise.mapper";

/** Correction et chatbot passent par le LLM : délai plus long que les autres requêtes (budget IA de 30 s). */
export const DELAI_IA_MS = 45_000;
/** Le service IA n'accepte que les 20 derniers tours de parole (ia-service/app/schemas/chatbot.py). */
export const HISTORIQUE_CHATBOT_MAX = 20;

export interface ParcoursPersonnaliseService {
  /** Parcours en cours de l'apprenant connecté. */
  enCours(): Promise<ParcoursPersonnalise>;
  /** Exercices du parcours, toutes leçons confondues, triés par leçon. */
  exercices(idParcours: number): Promise<ExerciceParcours[]>;
  /** Une leçon et le contenu de ses exercices (403 si elle n'est pas encore atteinte). */
  lecon(idParcours: number, numeroLecon: number): Promise<LeconParcours>;
  corriger(idParcours: number, idParcoursExercice: number, reponse: ReponseExercice): Promise<CorrectionExercice>;
  /** Message au professeur IA, avec l'historique récent de la conversation. */
  chatbot(message: string, historique: MessageChatbot[]): Promise<string>;
}

const parLecon = (a: ExerciceParcours, b: ExerciceParcours) =>
  a.numeroLecon - b.numeroLecon || a.idParcoursExercice - b.idParcoursExercice;

const corpsReponse = (reponse: ReponseExercice) =>
  reponse.format === "conversation" ? { format: reponse.format, messages: reponse.messages } : reponse;

const identifiantSessionChatbot =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const corpsChatbot = (message: string, historique: MessageChatbot[]): MessageChatbotDto => ({
  message,
  identifiant_session: identifiantSessionChatbot,
  historique: historique.slice(-HISTORIQUE_CHATBOT_MAX).map(({ role, contenu }) => ({ role, contenu })),
});

export const httpParcoursPersonnaliseService: ParcoursPersonnaliseService = {
  async enCours() {
    return toParcoursPersonnalise(await apiRequest<ParcoursPersonnaliseDto>(ENDPOINTS.parcours.enCours));
  },
  async exercices(idParcours) {
    const dto = await apiRequest<ExerciceParcoursDto[]>(ENDPOINTS.parcours.exercices(idParcours));
    return dto.map(toExerciceParcours).sort(parLecon);
  },
  async lecon(idParcours, numeroLecon) {
    return toLeconParcours(await apiRequest<LeconParcoursDto>(ENDPOINTS.parcours.lecon(idParcours, numeroLecon)));
  },
  async corriger(idParcours, idParcoursExercice, reponse) {
    const dto = await apiRequest<CorrectionExerciceDto>(ENDPOINTS.parcours.reponse(idParcours, idParcoursExercice), {
      method: "POST",
      body: corpsReponse(reponse),
      timeoutMs: DELAI_IA_MS,
    });
    return toCorrectionExercice(dto);
  },
  async chatbot(message, historique) {
    const dto = await apiRequest<ReponseChatbotDto>(ENDPOINTS.chatbot.message, {
      method: "POST",
      body: corpsChatbot(message, historique),
      timeoutMs: DELAI_IA_MS,
    });
    return dto.reponse;
  },
};

export const mockParcoursPersonnaliseService: ParcoursPersonnaliseService = {
  enCours: async () => toParcoursPersonnalise(await parcoursPersonnaliseMock.enCours()),
  exercices: async (idParcours) =>
    (await parcoursPersonnaliseMock.exercices(idParcours)).map(toExerciceParcours).sort(parLecon),
  lecon: async (idParcours, numeroLecon) => toLeconParcours(await parcoursPersonnaliseMock.lecon(idParcours, numeroLecon)),
  corriger: async (idParcours, idParcoursExercice, reponse) =>
    toCorrectionExercice(await parcoursPersonnaliseMock.corriger(idParcours, idParcoursExercice, reponse)),
  chatbot: async (message, historique) => (await parcoursPersonnaliseMock.chatbot(corpsChatbot(message, historique))).reponse,
};

export const parcoursPersonnaliseService = PARCOURS_MOCK ? mockParcoursPersonnaliseService : httpParcoursPersonnaliseService;
