import { ApiError } from "@/lib/api-client";
import { messageErreurParcours } from "@/lib/parcours-personnalise";

// FE-D6 : chaque état d'erreur du parcours a son message, sans détail technique.
describe("FE-D6 — messages d'erreur du parcours", () => {
  it("IA indisponible (503) : le message le dit, sans code ni détail serveur", () => {
    const message = messageErreurParcours(new ApiError(503, "Service", "détail serveur"), "La correction de votre réponse");
    expect(message).toBe("La correction de votre réponse n'est pas disponible pour le moment. Réessayez dans un instant.");
    expect(message).not.toMatch(/503|détail serveur/);
  });

  it("délai dépassé (504 du serveur ou abandon côté navigateur) : message de délai", () => {
    expect(messageErreurParcours(new ApiError(504, "Gateway"), "La correction")).toBe(
      "La correction prend plus de temps que prévu. Réessayez dans un instant.",
    );
    expect(messageErreurParcours(new ApiError(0, "délai", undefined, true), "La correction")).toBe(
      "La correction prend plus de temps que prévu. Réessayez dans un instant.",
    );
  });

  it("réponse invalide (502) : message générique, sans détail", () => {
    const message = messageErreurParcours(new ApiError(502, "Bad gateway", "contrat invalide"), "La correction");
    expect(message).toBe("La correction n'a pas abouti. Réessayez dans un instant.");
    expect(message).not.toMatch(/contrat invalide|502/);
  });
});
