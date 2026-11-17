import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import SousMenuModules from "@/components/layout/SousMenuModules";
import LeconVue from "@/components/pedagogie/parcours/LeconVue";
import ModuleVue from "@/components/pedagogie/parcours/ModuleVue";
import { choisirScenarioParcoursMock } from "@/mocks/parcours-personnalise.mock";
import { afficher } from "@/test/rendu-avec-query";

jest.mock("@/mocks/delay", () => ({ delay: () => Promise.resolve() }));
jest.mock("@/services/parcours-personnalise.service", () => {
  const actuel = jest.requireActual("@/services/parcours-personnalise.service");
  return { ...actuel, parcoursPersonnaliseService: actuel.mockParcoursPersonnaliseService };
});

/** Reconnaissance vocale simulée : le test décide de ce que « dit » l'apprenant. */
class FausseReconnaissance {
  static derniere: FausseReconnaissance | null = null;
  lang = "";
  interimResults = false;
  continuous = false;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = jest.fn(() => (FausseReconnaissance.derniere = this));
  stop = jest.fn(() => this.onend?.());
  abort = jest.fn();
  dire(texte: string) {
    this.onresult?.({ results: { length: 1, 0: { length: 1, 0: { transcript: texte } } } });
    this.onend?.();
  }
}

beforeEach(() => {
  choisirScenarioParcoursMock("passif");
  (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition = FausseReconnaissance;
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});
afterEach(() => {
  delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
});

describe("Sous-menu des modules (barre latérale)", () => {
  it("affiche un lien par module et met en évidence le module de la leçon ouverte", async () => {
    afficher(<SousMenuModules pathname="/espace/apprenant/parcours/lecons/23" />);
    const menu = await screen.findByRole("list", { name: "Modules du parcours" });
    const liens = within(menu).getAllByRole("link");
    expect(liens).toHaveLength(8);
    expect(liens[0]).toHaveAttribute("href", "/espace/apprenant/parcours/modules/1");
    expect(liens[3]).toHaveAttribute("aria-current", "page");
    expect(liens[3]).toHaveAccessibleName("Module 4 : Loisirs et goûts, en cours");
  });
});

describe("Page d'un module", () => {
  it("liste ses leçons avec leur statut et n'ouvre pas les leçons à venir", async () => {
    afficher(<ModuleVue numero={4} />);
    expect(await screen.findByRole("heading", { level: 1, name: "Loisirs et goûts" })).toBeInTheDocument();
    expect(screen.getByText("Module 4 · Leçons 22 à 28")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Revoir la leçon 22" })).toHaveAttribute("href", "/espace/apprenant/parcours/lecons/22");
    expect(screen.getByRole("link", { name: "Continuer la leçon 23" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /leçon 24/ })).not.toBeInTheDocument();
    expect(screen.getByText("S'ouvrira après la leçon 23.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Module 5 : Travail et études/ })).toHaveAttribute("href", "/espace/apprenant/parcours/modules/5");
  });

  it("signale un module inexistant", async () => {
    afficher(<ModuleVue numero={42} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Le module 42 n'existe pas dans votre parcours.");
  });
});

describe("Page d'une leçon", () => {
  it("corrige une phrase à compléter et propose de réessayer", async () => {
    afficher(<LeconVue numero={23} />);
    const exercice = await screen.findByRole("region", { name: "Les salutations" });
    fireEvent.change(within(exercice).getByLabelText("Votre réponse"), { target: { value: "Merci" } });
    fireEvent.click(within(exercice).getByRole("button", { name: "Valider ma réponse" }));
    expect(await within(exercice).findByText("Vous pouvez réessayer.")).toBeInTheDocument();
    expect(within(exercice).getByText("Réponse attendue : Bonjour")).toBeInTheDocument();
  });

  it("transcrit la prononciation avec la reconnaissance vocale puis la note", async () => {
    afficher(<LeconVue numero={23} />);
    const exercice = await screen.findByRole("region", { name: "Demander son chemin" });
    fireEvent.click(within(exercice).getByRole("button", { name: "Lire à voix haute" }));
    expect(FausseReconnaissance.derniere?.lang).toBe("fr-FR");
    act(() => FausseReconnaissance.derniere?.dire("Excusez-moi où se trouve la gare"));
    expect(within(exercice).getByTestId("transcription")).toHaveTextContent("Excusez-moi où se trouve la gare");
    fireEvent.click(within(exercice).getByRole("button", { name: "Valider ma réponse" }));
    expect(await within(exercice).findByText(/Très bonne prononciation/)).toBeInTheDocument();
  });

  it("propose la saisie au clavier quand le navigateur n'a pas de reconnaissance vocale", async () => {
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    afficher(<LeconVue numero={23} />);
    const exercice = await screen.findByRole("region", { name: "Demander son chemin" });
    expect(within(exercice).getByText(/reconnaissance vocale n'est pas disponible/)).toBeInTheDocument();
    expect(within(exercice).getByLabelText("Votre phrase")).toBeInTheDocument();
  });

  it("converse avec le professeur IA (écrit et dictée) puis fait évaluer l'échange", async () => {
    afficher(<LeconVue numero={23} />);
    const exercice = await screen.findByRole("region", { name: "Faire connaissance" });
    const log = within(exercice).getByRole("log", { name: "Conversation avec le professeur IA" });
    expect(log).toHaveTextContent("Comment vous appelez-vous ?");
    const terminer = within(exercice).getByRole("button", { name: "Terminer et évaluer la conversation" });
    expect(terminer).toBeDisabled();

    fireEvent.change(within(exercice).getByLabelText("Votre message"), { target: { value: "Je m'appelle Rova" } });
    fireEvent.click(within(exercice).getByRole("button", { name: "Envoyer" }));
    expect(await within(log).findByText("Très bien ! Enchanté ! D'où venez-vous ?")).toBeInTheDocument();

    // Dictée : la reconnaissance vocale remplit la zone de saisie
    fireEvent.click(within(exercice).getByRole("button", { name: "Dicter" }));
    act(() => FausseReconnaissance.derniere?.dire("Je viens de Madagascar"));
    expect(within(exercice).getByLabelText("Votre message")).toHaveValue("Je viens de Madagascar");
    fireEvent.click(within(exercice).getByRole("button", { name: "Envoyer" }));
    await within(log).findByText(/que faites-vous dans la vie/);

    fireEvent.click(terminer);
    expect(await within(exercice).findByText(/Belle conversation/)).toBeInTheDocument();
  });

  it("ouvre la leçon suivante une fois tous les exercices faits", async () => {
    afficher(<LeconVue numero={22} />);
    expect(await screen.findByRole("heading", { name: "Leçon terminée !" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Leçon 23/ })).toHaveAttribute("href", "/espace/apprenant/parcours/lecons/23");
  });

  it("explique qu'une leçon pas encore atteinte est fermée", async () => {
    afficher(<LeconVue numero={30} />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Cette leçon s'ouvrira quand vous aurez terminé"));
  });
});
