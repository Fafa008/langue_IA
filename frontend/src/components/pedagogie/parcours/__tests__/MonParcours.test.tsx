import { fireEvent, screen, within } from "@testing-library/react";
import MonParcours from "@/components/pedagogie/parcours/MonParcours";
import { choisirScenarioParcoursMock } from "@/mocks/parcours-personnalise.mock";
import { afficher as afficherAvecClient } from "@/test/rendu-avec-query";

jest.mock("@/mocks/delay", () => ({ delay: () => Promise.resolve() }));
// Les composants lisent les données simulées, comme avec NEXT_PUBLIC_API_MOCK=true
jest.mock("@/services/parcours-personnalise.service", () => {
  const actuel = jest.requireActual("@/services/parcours-personnalise.service");
  return { ...actuel, parcoursPersonnaliseService: actuel.mockParcoursPersonnaliseService };
});
jest.mock("@/hooks/useSession", () => ({
  useSession: () => ({ ready: true, isAuthenticated: true, utilisateur: { prenom: "Rova" } }),
}));

const afficher = () => afficherAvecClient(<MonParcours />);

beforeEach(() => choisirScenarioParcoursMock("passif"));

describe("Mon parcours (US41)", () => {
  it("affiche le parcours, la leçon atteinte et le mode passif", async () => {
    afficher();

    expect(await screen.findByRole("heading", { level: 1, name: "Bonjour, Rova !" })).toBeInTheDocument();
    expect(screen.getByText("Parcours en cours")).toBeInTheDocument();
    expect(screen.getByText("Leçon 23", { selector: "p" })).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Niveaux du CECRL" })).getByText("B1").closest("li")).toHaveAttribute(
      "aria-current",
      "step",
    );

    const phases = screen.getByRole("list", { name: "Phases du parcours" });
    expect(within(phases).getByText("Votre mode actuel").closest("li")).toHaveTextContent("Mode passif");
    expect(screen.getByText("Encore 27 leçons avant le mode actif.")).toBeInTheDocument();
  });

  it("signale le mode actif et la leçon de révision", async () => {
    choisirScenarioParcoursMock("actif");
    afficher();

    const phases = await screen.findByRole("list", { name: "Phases du parcours" });
    expect(within(phases).getByText("Votre mode actuel").closest("li")).toHaveTextContent("Mode actif");
    expect(screen.getByText("Leçon de révision")).toBeInTheDocument();
    expect(screen.queryByText(/avant le mode actif/)).not.toBeInTheDocument();
  });

  it("invite à passer le test quand il n'y a pas encore de parcours", async () => {
    choisirScenarioParcoursMock("sans-parcours");
    afficher();
    expect(await screen.findByRole("link", { name: "Passer le test de positionnement" })).toHaveAttribute(
      "href",
      "/espace/apprenant/test-diagnostic",
    );
  });

  it("propose de réessayer après une erreur serveur", async () => {
    choisirScenarioParcoursMock("erreur-serveur");
    afficher();
    expect(await screen.findByRole("alert")).toHaveTextContent("Le chargement de votre parcours n'a pas abouti.");
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });
});

describe("Exercices du parcours (US42)", () => {
  it("liste les exercices de la leçon du jour avec leur statut et l'avancement", async () => {
    afficher();

    const lecon = await screen.findByRole("list", { name: "Exercices de la leçon du jour" });
    const lignes = within(lecon).getAllByRole("listitem");
    expect(lignes).toHaveLength(6);
    expect(lignes[0]).toHaveTextContent("Réussi");
    expect(lignes[0]).toHaveTextContent("90/100");
    expect(lignes[1]).toHaveTextContent("À faire");
    expect(screen.getByRole("progressbar", { name: "Avancement de la leçon 23" })).toHaveAttribute(
      "aria-valuetext",
      "1 exercice fait sur 6",
    );
    expect(screen.getByRole("link", { name: /Continuer la leçon/ })).toHaveAttribute("href", "/espace/apprenant/parcours/lecons/23");
  });

  it("filtre tous les exercices du parcours par statut", async () => {
    afficher();
    await screen.findByRole("heading", { name: "Tous les exercices du parcours" });

    const aRevoir = screen.getByRole("button", { name: /À revoir/ });
    fireEvent.click(aRevoir);
    expect(aRevoir).toHaveAttribute("aria-pressed", "true");

    // Les leçons trouvées s'ouvrent et ne contiennent que des exercices à revoir
    const filtrees = screen.getAllByRole("list", { name: /^Exercices de la leçon \d+$/ });
    expect(filtrees.length).toBeGreaterThan(0);
    for (const liste of filtrees) {
      for (const ligne of within(liste).getAllByRole("listitem")) expect(ligne).toHaveTextContent("À revoir");
    }
  });

  it("affiche les leçons récentes puis les précédentes à la demande", async () => {
    afficher();
    await screen.findByRole("heading", { name: "Tous les exercices du parcours" });

    const resumes = () => screen.getAllByText(/^Leçon \d+$/, { selector: "summary span" });
    expect(resumes().map((r) => r.textContent)).toEqual(["Leçon 23", "Leçon 22", "Leçon 21", "Leçon 20", "Leçon 19"]);
    fireEvent.click(screen.getByRole("button", { name: "Afficher les 18 leçons précédentes" }));
    expect(resumes()).toHaveLength(23);
  });

  it("présente les modules et mène à la page de chacun", async () => {
    afficher();
    const lien = await screen.findByRole("link", { name: /Module 4.*Loisirs et goûts/ });
    expect(lien).toHaveAttribute("href", "/espace/apprenant/parcours/modules/4");
    expect(lien).toHaveTextContent("En cours");
    expect(screen.getByRole("link", { name: /Module 1.*Premiers contacts/ })).toHaveTextContent("Terminé");
    expect(screen.getByRole("link", { name: /Module 5/ })).toHaveTextContent("À venir");
  });

  it("garde le parcours affiché si seuls les exercices ne se chargent pas", async () => {
    choisirScenarioParcoursMock("exercices-indisponibles");
    afficher();

    expect(await screen.findByRole("alert")).toHaveTextContent("Le chargement des exercices n'a pas abouti.");
    expect(screen.getByText("Leçon 23", { selector: "p" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Tous les exercices du parcours" })).not.toBeInTheDocument();
  });
});
