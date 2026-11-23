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

  it("404 : affiche le détail renvoyé par le backend au lieu du message générique", () => {
    expect(
      messageErreurParcours(
        new ApiError(404, "Not Found", "Aucun parcours en cours. Passez le test de positionnement."),
        "Le chargement de votre parcours",
      ),
    ).toBe("Aucun parcours en cours. Passez le test de positionnement.");
    expect(messageErreurParcours(new ApiError(404, "Not Found"), "Le chargement")).toBe("Ce contenu n'existe pas.");
  });

  it("quota du chat atteint (429) : invite à ouvrir une nouvelle conversation", () => {
    const message = messageErreurParcours(new ApiError(429, "Too many requests"), "Votre message");
    expect(message).toBe("Le quota de messages est atteint pour cette session. Commencez une nouvelle conversation.");
    expect(message).not.toMatch(/429/);
  });
});
