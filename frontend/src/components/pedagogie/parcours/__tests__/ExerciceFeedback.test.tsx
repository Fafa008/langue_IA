import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import AppSidebar from "@/components/layout/AppSidebar";
import LeconVue from "@/components/pedagogie/parcours/LeconVue";
import { ApiError } from "@/lib/api-client";
import { choisirScenarioParcoursMock } from "@/mocks/parcours-personnalise.mock";
import { mockParcoursPersonnaliseService } from "@/services/parcours-personnalise.service";
import { afficher } from "@/test/rendu-avec-query";

jest.mock("@/mocks/delay", () => ({ delay: () => Promise.resolve() }));
jest.mock("@/services/parcours-personnalise.service", () => {
  const actuel = jest.requireActual("@/services/parcours-personnalise.service");
  return { ...actuel, parcoursPersonnaliseService: actuel.mockParcoursPersonnaliseService };
});
let pathname = "/espace/apprenant/parcours/modules/4";
jest.mock("next/navigation", () => ({ usePathname: () => pathname }));
jest.mock("@/hooks/useSession", () => ({
  useSession: () => ({ ready: true, isAuthenticated: true, utilisateur: { prenom: "Rova", nom: "Rakoto", role: "APPRENANT" } }),
}));

beforeEach(() => {
  choisirScenarioParcoursMock("passif");
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});
afterEach(() => jest.restoreAllMocks());

describe("US43/US44 — QCM corrigé automatiquement", () => {
  it("signale la réponse donnée, la bonne réponse et l'explication, puis permet de réessayer", async () => {
    afficher(<LeconVue numero={23} />);
    const exercice = await screen.findByRole("region", { name: "Comprendre un message" });
    fireEvent.click(within(exercice).getByRole("radio", { name: "Au café" }));
    fireEvent.click(within(exercice).getByRole("button", { name: "Valider ma réponse" }));

    const retour = await within(exercice).findByRole("region", { name: "Correction" });
    expect(retour).toHaveTextContent("À revoir · 0/100");
    expect(retour).toHaveTextContent("Correction automatique");
    expect(retour).toHaveTextContent("Bonne réponse : À la gare");
    expect(retour).toHaveTextContent("Le message dit « devant la gare ».");
    expect(within(exercice).getByRole("radio", { name: /^Au café/ }).closest("label")).toHaveTextContent("Votre réponse");
    expect(within(exercice).getByRole("radio", { name: /^À la gare/ }).closest("label")).toHaveTextContent("Bonne réponse");
    expect(within(exercice).getByRole("group")).toBeDisabled();

    fireEvent.click(within(retour).getByRole("button", { name: "Réessayer" }));
    await waitFor(() => expect(within(exercice).getByRole("group")).not.toBeDisabled());
    fireEvent.click(within(exercice).getByRole("radio", { name: /^À la gare/ }));
    fireEvent.click(within(exercice).getByRole("button", { name: "Valider ma réponse" }));
    expect(await within(exercice).findByText("Réussi · 100/100")).toBeInTheDocument();
    expect(within(exercice).getByRole("radio", { name: /^À la gare/ }).closest("label")).toHaveTextContent("Votre réponse, juste");
  });
});

describe("US43/US44 — réponse libre corrigée par l'IA", () => {
  it("affiche le retour du professeur IA : erreurs relevées, points forts et conseil", async () => {
    afficher(<LeconVue numero={23} />);
    const exercice = await screen.findByRole("region", { name: "Expression écrite : écrire à un ami" });
    const zone = within(exercice).getByLabelText(/Écrivez un court message à un ami/);
    fireEvent.change(zone, { target: { value: "salut, samedi j'ai allé au cinéma mais il faut que je vais au marché" } });
    expect(within(exercice).getByText("14 mots · 25 conseillés")).toBeInTheDocument();
    fireEvent.click(within(exercice).getByRole("button", { name: "Envoyer au professeur IA" }));

    const retour = await within(exercice).findByRole("region", { name: "Correction" });
    expect(retour).toHaveTextContent("Corrigé par le professeur IA");
    // US157 — phase passive (leçon 23) : quatre erreurs dans le texte, seules les trois essentielles sont relevées
    expect(retour).toHaveTextContent("Mode passif (leçon 23) : seules les erreurs essentielles sont relevées.");
    expect(retour).toHaveTextContent("3 points à corriger");
    expect(retour).not.toHaveTextContent("Version corrigée");
    const erreur = within(retour).getByText("j'ai allé").closest("li");
    expect(erreur).toHaveTextContent("je suis allé(e)");
    expect(erreur).toHaveTextContent("« Aller » se conjugue avec l'auxiliaire être");
    expect(retour).toHaveTextContent("Points forts");
    expect(retour).toHaveTextContent("Conseil : Développez davantage : écrivez au moins 25 mots (il en manque 11).");
    // Le texte reste dans la zone pour être retravaillé
    expect(zone).toHaveValue("salut, samedi j'ai allé au cinéma mais il faut que je vais au marché");
    expect(zone).toHaveAttribute("readonly");
  });

  it("US157 — en phase active, relève toutes les erreurs et donne la version corrigée", async () => {
    choisirScenarioParcoursMock("actif");
    afficher(<LeconVue numero={56} />);
    const exercice = await screen.findByRole("region", { name: /^Expression écrite/ });
    fireEvent.change(within(exercice).getByRole("textbox"), {
      target: { value: "salut, samedi j'ai allé au cinéma mais il faut que je vais au marché" },
    });
    fireEvent.click(within(exercice).getByRole("button", { name: "Envoyer au professeur IA" }));

    const retour = await within(exercice).findByRole("region", { name: "Correction" });
    expect(retour).toHaveTextContent("Mode actif (leçon 56) : votre texte est corrigé en détail.");
    expect(retour).toHaveTextContent("4 points à corriger");
    expect(within(retour).getByRole("heading", { name: "Version corrigée" })).toBeInTheDocument();
    expect(retour).toHaveTextContent("Salut, samedi je suis allé(e) au cinéma mais il faut que j'aille au marché.");
  });

  it("garde la réponse et propose de la renvoyer si la correction échoue", async () => {
    jest.spyOn(mockParcoursPersonnaliseService, "corriger").mockRejectedValueOnce(new ApiError(0, "délai", undefined, true));
    afficher(<LeconVue numero={23} />);
    const exercice = await screen.findByRole("region", { name: "Expression écrite : écrire à un ami" });
    const zone = within(exercice).getByLabelText(/Écrivez un court message/);
    fireEvent.change(zone, { target: { value: "Salut Paul, on va au cinéma samedi ?" } });
    fireEvent.click(within(exercice).getByRole("button", { name: "Envoyer au professeur IA" }));

    expect(await within(exercice).findByRole("alert")).toHaveTextContent(
      "La correction de votre réponse prend plus de temps que prévu. Réessayez dans un instant. Votre réponse est conservée",
    );
    expect(zone).toHaveValue("Salut Paul, on va au cinéma samedi ?");
    expect(within(exercice).getByRole("button", { name: "Envoyer au professeur IA" })).toBeEnabled();
  });
});

describe("Barre latérale — modules du parcours", () => {
  it("développe et réduit le sous-menu des modules", async () => {
    afficher(<AppSidebar />);
    const bouton = screen.getByRole("button", { name: "Réduire les modules" });
    expect(bouton).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByRole("list", { name: "Modules du parcours" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mon parcours" })).toHaveAttribute("aria-current", "true");

    fireEvent.click(bouton);
    expect(screen.queryByRole("list", { name: "Modules du parcours" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Développer les modules" })).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "Développer les modules" }));
    expect(screen.getByRole("list", { name: "Modules du parcours" })).toBeInTheDocument();
  });

  it("garde le sous-menu replié hors du parcours, et le développe à la demande", async () => {
    pathname = "/espace/apprenant";
    afficher(<AppSidebar />);
    expect(screen.queryByRole("list", { name: "Modules du parcours" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Développer les modules" }));
    expect(await screen.findByRole("list", { name: "Modules du parcours" })).toBeInTheDocument();
    pathname = "/espace/apprenant/parcours/modules/4";
  });
});
