import { apiRequest } from "@/lib/api-client";
import { PARCOURS_MOCK } from "@/lib/env";
import { sessionChatbotCourante } from "@/lib/session-chatbot";
import { parcoursPersonnaliseMock } from "@/mocks/parcours-personnalise.mock";
import type {
  CorrectionExercice,
  CorrectionSepareeChatbot,
  ExerciceCibleChatbot,
  ExerciceParcours,
  LeconParcours,
  MessageChatbot,
  ParcoursPersonnalise,
  RecommandationParcours,
  ReponseChatbot,
  ReponseExercice,
  TraductionSepareeChatbot,
  TypeErreurChatbot,
} from "@/types/parcours-personnalise";
import { ENDPOINTS } from "./endpoints";
import {
  toCorrectionExercice,
  toCorrectionSepareeChatbot,
  toExerciceCibleChatbot,
  toExerciceParcours,
  toLeconParcours,
  toParcoursPersonnalise,
  toRecommandationParcours,
  toReponseChatbot,
  toTraductionSepareeChatbot,
  type CorrectionExerciceDto,
  type CorrectionSepareeChatbotDto,
  type ExerciceCibleChatbotDto,
  type ExerciceParcoursDto,
  type LeconParcoursDto,
  type MessageChatbotDto,
  type ParcoursPersonnaliseDto,
  type RecommandationParcoursDto,
  type ReponseChatbotDto,
  type TraductionSepareeChatbotDto,
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
  /** Recommandations pédagogiques : POST explicite, idempotent ; PARTIEL se traduit par une liste vide. */
  recommandations(idParcours: number): Promise<RecommandationParcours>;
  /** Message au tuteur IA, avec l'historique récent de la conversation. */
  chatbot(message: string, historique: MessageChatbot[]): Promise<ReponseChatbot>;
  /** Correction séparée du dernier message, via l'agent dédié relayé par le backend. */
  corrigerChatbot(message: string, historique: MessageChatbot[]): Promise<CorrectionSepareeChatbot>;
  /** Traduction séparée d'une réponse du tuteur ; `idMessage` sert de clé de cache côté IA. */
  traduireChatbot(idMessage: string, message: string): Promise<TraductionSepareeChatbot>;
  /** Exercice ciblé généré depuis une erreur, enregistré en brouillon par le backend. */
  exerciceChatbot(typeErreur: TypeErreurChatbot, erreur: string): Promise<ExerciceCibleChatbot>;
  /** Ferme la session en cours : le backend supprime l'historique et le quota (le journal reste anonyme). */
  fermerSession(): Promise<void>;
}

const parLecon = (a: ExerciceParcours, b: ExerciceParcours) =>
  a.numeroLecon - b.numeroLecon || a.idParcoursExercice - b.idParcoursExercice;

const corpsReponse = (reponse: ReponseExercice) =>
  reponse.format === "conversation" ? { format: reponse.format, messages: reponse.messages } : reponse;

const corpsChatbot = (message: string, historique: MessageChatbot[]): MessageChatbotDto => ({
  message,
  identifiant_session: sessionChatbotCourante(),
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
  async recommandations(idParcours) {
    const dto = await apiRequest<RecommandationParcoursDto>(ENDPOINTS.parcours.recommandations(idParcours), {
      method: "POST",
      timeoutMs: DELAI_IA_MS,
    });
    return toRecommandationParcours(dto);
  },
  async chatbot(message, historique) {
    const dto = await apiRequest<ReponseChatbotDto>(ENDPOINTS.chatbot.message, {
      method: "POST",
      body: corpsChatbot(message, historique),
      timeoutMs: DELAI_IA_MS,
    });
    return toReponseChatbot(dto);
  },
  async corrigerChatbot(message, historique) {
    const dto = await apiRequest<CorrectionSepareeChatbotDto>(ENDPOINTS.chatbot.correction, {
      method: "POST",
      body: corpsChatbot(message, historique),
      timeoutMs: DELAI_IA_MS,
    });
    return toCorrectionSepareeChatbot(dto);
  },
  async traduireChatbot(idMessage, message) {
    const dto = await apiRequest<TraductionSepareeChatbotDto>(ENDPOINTS.chatbot.traduction, {
      method: "POST",
      body: {
        identifiant_session: sessionChatbotCourante(),
        id_message: idMessage,
        message,
      },
      timeoutMs: DELAI_IA_MS,
    });
    return toTraductionSepareeChatbot(dto);
  },
  async exerciceChatbot(typeErreur, erreur) {
    const dto = await apiRequest<ExerciceCibleChatbotDto>(ENDPOINTS.chatbot.exercice, {
      method: "POST",
      body: {
        identifiant_session: sessionChatbotCourante(),
        type_erreur: typeErreur,
        erreur,
      },
      timeoutMs: DELAI_IA_MS,
    });
    return toExerciceCibleChatbot(dto);
  },
  async fermerSession() {
    await apiRequest<void>(ENDPOINTS.chatbot.fermerSession(sessionChatbotCourante()), { method: "DELETE" });
  },
};

export const mockParcoursPersonnaliseService: ParcoursPersonnaliseService = {
  enCours: async () => toParcoursPersonnalise(await parcoursPersonnaliseMock.enCours()),
  exercices: async (idParcours) =>
    (await parcoursPersonnaliseMock.exercices(idParcours)).map(toExerciceParcours).sort(parLecon),
  lecon: async (idParcours, numeroLecon) => toLeconParcours(await parcoursPersonnaliseMock.lecon(idParcours, numeroLecon)),
  corriger: async (idParcours, idParcoursExercice, reponse) =>
    toCorrectionExercice(await parcoursPersonnaliseMock.corriger(idParcours, idParcoursExercice, reponse)),
  recommandations: async (idParcours) => toRecommandationParcours(await parcoursPersonnaliseMock.recommandations(idParcours)),
  chatbot: async (message, historique) =>
    toReponseChatbot(await parcoursPersonnaliseMock.chatbot(corpsChatbot(message, historique))),
  corrigerChatbot: async (message, historique) =>
    toCorrectionSepareeChatbot(await parcoursPersonnaliseMock.corrigerChatbot(corpsChatbot(message, historique))),
  traduireChatbot: async (idMessage, message) =>
    toTraductionSepareeChatbot(await parcoursPersonnaliseMock.traduireChatbot(idMessage, message)),
  exerciceChatbot: async (typeErreur, erreur) =>
    toExerciceCibleChatbot(await parcoursPersonnaliseMock.exerciceChatbot(typeErreur, erreur)),
  fermerSession: async () => undefined,
};

export const parcoursPersonnaliseService = PARCOURS_MOCK ? mockParcoursPersonnaliseService : httpParcoursPersonnaliseService;
