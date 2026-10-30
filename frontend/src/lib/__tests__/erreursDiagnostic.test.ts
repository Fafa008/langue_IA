import { ApiError } from "@/lib/api-client";
import { erreurReessayable, messageErreurDiagnostic } from "@/lib/erreursDiagnostic";

const SECRET = "Traceback: LLMTimeoutError (OPENAI_API_KEY=sk-secret)";

describe("messages d'erreur du diagnostic", () => {
  it("explique un délai dépassé sans parler de code ni de serveur", () => {
    const message = messageErreurDiagnostic(new ApiError(0, "Le serveur ne répond pas.", undefined, true), "analyse");
    expect(message).toBe("L'analyse de vos réponses prend plus de temps que prévu. Réessayez dans un instant.");
  });

  it("ne montre jamais le détail renvoyé par le backend ni le message technique", () => {
    for (const status of [400, 404, 409, 422, 429, 500, 502, 503]) {
      const message = messageErreurDiagnostic(new ApiError(status, SECRET, SECRET), "reponse");
      expect(message).not.toContain("Traceback");
      expect(message).not.toContain("sk-secret");
      expect(message).not.toContain(String(status));
      expect(message.startsWith("Votre réponse n'a pas pu être envoyée.")).toBe(true);
    }
    expect(messageErreurDiagnostic(new Error(SECRET), "analyse")).toBe(
      "L'analyse de vos réponses n'a pas pu aboutir. Une erreur inattendue est survenue.",
    );
  });

  it("distingue une coupure réseau d'un service indisponible", () => {
    expect(messageErreurDiagnostic(new ApiError(0, "Impossible de joindre le serveur."), "reponse")).toBe(
      "Votre réponse n'a pas pu être envoyée. Le service est injoignable pour le moment : vérifiez votre connexion internet, puis réessayez.",
    );
    expect(messageErreurDiagnostic(new ApiError(503, "Indisponible"), "analyse")).toContain(
      "Le service est momentanément indisponible",
    );
  });

  it("ne propose pas de réessayer quand la session a expiré ou que les droits manquent", () => {
    expect(erreurReessayable(new ApiError(401, "Session expirée"))).toBe(false);
    expect(erreurReessayable(new ApiError(403, "Interdit"))).toBe(false);
    expect(erreurReessayable(new ApiError(0, "Délai", undefined, true))).toBe(true);
    expect(erreurReessayable(new ApiError(503, "Indisponible"))).toBe(true);
    expect(erreurReessayable(new Error("inattendue"))).toBe(true);
  });
});
