import { fireEvent, screen, within } from "@testing-library/react";
import LeconVue from "@/components/pedagogie/parcours/LeconVue";
import { ApiError } from "@/lib/api-client";
import { choisirScenarioParcoursMock } from "@/mocks/parcours-personnalise.mock";
import { mockParcoursPersonnaliseService } from "@/services/parcours-personnalise.service";
import { afficher } from "@/test/rendu-avec-query";

// FE-D6 : états d'erreur de la correction par le professeur IA sur le parcours de démo.
// La réponse reste dans la zone de saisie et peut être renvoyée.
jest.mock("@/mocks/delay", () => ({ delay: () => Promise.resolve() }));
jest.mock("@/services/parcours-personnalise.service", () => {
  const actuel = jest.requireActual("@/services/parcours-personnalise.service");
  return { ...actuel, parcoursPersonnaliseService: actuel.mockParcoursPersonnaliseService };
});
jest.mock("next/navigation", () => ({ usePathname: () => "/espace/apprenant/parcours/lecons/23" }));
jest.mock("@/hooks/useSession", () => ({
  useSession: () => ({ ready: true, isAuthenticated: true, utilisateur: { prenom: "Rova", nom: "Rakoto", role: "APPRENANT" } }),
}));

beforeEach(() => {
  choisirScenarioParcoursMock("passif");
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});
afterEach(() => jest.restoreAllMocks());

async function soumettreRedaction(texte: string) {
  const exercice = await screen.findByRole("region", { name: "Expression écrite : écrire à un ami" });
  fireEvent.change(within(exercice).getByLabelText(/Écrivez un court message à un ami/), { target: { value: texte } });
  fireEvent.click(within(exercice).getByRole("button", { name: "Envoyer au professeur IA" }));
  return exercice;
}

describe("FE-D6 — correction par le professeur IA : états d'erreur", () => {
  it.each([
    [new ApiError(503, "Service indisponible"), "n'est pas disponible pour le moment"],
    [new ApiError(504, "Délai"), "prend plus de temps que prévu"],
    [new ApiError(502, "Réponse invalide"), "n'a pas abouti"],
  ])("affiche un message dédié (statut %#) et conserve la réponse", async (erreur, attendu) => {
    jest.spyOn(mockParcoursPersonnaliseService, "corriger").mockRejectedValueOnce(erreur);
    afficher(<LeconVue numero={23} />);
    const exercice = await soumettreRedaction("Salut Paul, on va au cinéma samedi ?");

    const alerte = await within(exercice).findByRole("alert");
    expect(alerte).toHaveTextContent(attendu);
    expect(alerte).toHaveTextContent("Votre réponse est conservée : vous pouvez la renvoyer.");
    expect(alerte.textContent).not.toMatch(/50[234]|Service indisponible|Réponse invalide/);
    expect(within(exercice).getByLabelText(/Écrivez un court message à un ami/)).toHaveValue("Salut Paul, on va au cinéma samedi ?");
    expect(within(exercice).getByRole("button", { name: "Envoyer au professeur IA" })).toBeEnabled();
  });
});
