import { ApiError } from "@/lib/api-client";

/** Ce que l'apprenant était en train de faire quand l'erreur est survenue. */
export type ActionDiagnostic = "langues" | "demarrage" | "reponse" | "analyse";

const PANNE: Record<ActionDiagnostic, string> = {
  langues: "Les langues n'ont pas pu être chargées.",
  demarrage: "Le test n'a pas pu démarrer.",
  reponse: "Votre réponse n'a pas pu être envoyée.",
  analyse: "L'analyse de vos réponses n'a pas pu aboutir.",
};

/** Le service d'analyse (LLM) répond lentement ou pas du tout : on rassure et on invite à réessayer. */
const DELAI_DEPASSE: Record<ActionDiagnostic, string> = {
  langues: "Le serveur met trop de temps à répondre.",
  demarrage: "Le serveur met trop de temps à répondre.",
  reponse: "L'envoi de votre réponse prend plus de temps que prévu.",
  analyse: "L'analyse de vos réponses prend plus de temps que prévu.",
};

/**
 * Message d'erreur à afficher pendant le test. Il ne contient jamais de détail technique :
 * ni message du backend (`detail`), ni message JavaScript, ni code HTTP.
 */
export function messageErreurDiagnostic(error: unknown, action: ActionDiagnostic): string {
  if (!(error instanceof ApiError)) return `${PANNE[action]} Une erreur inattendue est survenue.`;
  if (error.delaiDepasse) return `${DELAI_DEPASSE[action]} Réessayez dans un instant.`;
  if (error.status === 0) {
    return `${PANNE[action]} Le service est injoignable pour le moment : vérifiez votre connexion internet, puis réessayez.`;
  }
  if (error.status === 401) return "Votre session a expiré. Reconnectez-vous pour reprendre le test.";
  if (error.status === 403) return "Votre compte ne permet pas de passer ce test.";
  if (error.status === 404) return `${PANNE[action]} Ce test n'est plus disponible : recommencez-le depuis l'accueil.`;
  if (error.status === 409) return `${PANNE[action]} Réessayez dans un instant.`;
  if (error.status === 422) return `${PANNE[action]} Vérifiez votre réponse, puis réessayez.`;
  if (error.status === 429) return `${PANNE[action]} Trop de demandes en peu de temps : patientez un instant.`;
  return `${PANNE[action]} Le service est momentanément indisponible.`;
}

/** Une panne ou un délai dépassé peut se résoudre en réessayant ; une session expirée, non. */
export const erreurReessayable = (error: unknown) =>
  !(error instanceof ApiError) || ![401, 403].includes(error.status);
