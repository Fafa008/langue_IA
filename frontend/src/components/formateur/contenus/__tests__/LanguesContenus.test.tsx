import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import LangueContenusView from "@/components/formateur/contenus/LangueContenusView";
import LanguesContenusView from "@/components/formateur/contenus/LanguesContenusView";
import { NAVIGATION, estActif } from "@/lib/navigation";
import { ROUTES } from "@/lib/routes";
import { afficherContenus } from "@/test/contenus";
import { mockFetch } from "@/test/fetch-mock";

// USPxx : liste des langues, onglets d'une langue, langue sans niveau, archivage avec confirmation.

describe("liste des langues (rubrique Contenus)", () => {
  it("affiche les six langues et l'étiquette « Données simulées », sans appel réseau", async () => {
    const fetch = mockFetch();
    afficherContenus(<LanguesContenusView />);

    const lignes = await screen.findAllByRole("row");
    const enTetes = screen.getAllByRole("rowheader");
    const attendues = ["Français", "Anglais", "Mandarin", "Italien", "Allemand", "Espagnol"];
    expect(enTetes).toHaveLength(attendues.length);
    // Nom accessible : le code affiché à la place d'un drapeau manquant (« ES ») est masqué aux lecteurs d'écran
    attendues.forEach((nom, i) => expect(enTetes[i]).toHaveAccessibleName(nom));
    expect(screen.getByTestId("donnees-simulees")).toHaveTextContent("Données simulées");

    const espagnol = lignes.find((r) => r.textContent?.includes("Espagnol"))!;
    expect(within(espagnol).getByText("Aucun niveau")).toBeInTheDocument();
    expect(within(espagnol).getByRole("link", { name: "Gérer les contenus : Espagnol" })).toHaveAttribute("href", ROUTES.formateur.contenus.langue("es"));
    const anglais = lignes.find((r) => r.textContent?.includes("Anglais"))!;
    expect(within(anglais).getAllByRole("cell").map((c) => c.textContent)).toEqual(expect.arrayContaining(["1", "8", "48"]));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("est accessible depuis le menu du formateur, en évidence sur ses sous-pages, sans le sous-menu des modules du parcours", () => {
    const entree = NAVIGATION.FORMATEUR.find((i) => i.href === ROUTES.formateur.contenus.accueil)!;
    expect(entree.sousPages).toBeUndefined();
    expect(estActif(entree, ROUTES.formateur.contenus.lecon("en", "en-lec-1"))).toBe(true);
    expect(estActif(entree, ROUTES.formateur.apprenants)).toBe(false);
  });
});

describe("contenus d'une langue", () => {
  it("espagnol : aucun niveau, donc aucune création possible", async () => {
    afficherContenus(<LangueContenusView code="es" />);

    expect(await screen.findByRole("heading", { name: "Espagnol" })).toBeInTheDocument();
    for (const onglet of ["Modules", "Leçons", "Exercices", "Parcours"]) {
      fireEvent.click(screen.getByRole("tab", { name: new RegExp(onglet) }));
      expect(screen.getByRole("tabpanel")).toHaveTextContent("Ajoutez d'abord des niveaux pour cette langue.");
      expect(screen.queryByRole("button", { name: /^Ajouter/ })).not.toBeInTheDocument();
    }
  });

  it("français : onglets accessibles mais vides, avec un état vide explicite", async () => {
    afficherContenus(<LangueContenusView code="fr" />);

    expect(await screen.findByText("Aucun module pour la langue Français.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ajouter un module" })).toBeEnabled();
    fireEvent.click(screen.getByRole("tab", { name: /Leçons/ }));
    expect(await screen.findByText("Aucune leçon pour la langue Français.")).toBeInTheDocument();
    // Pas de leçon sans module
    expect(screen.getByRole("button", { name: "Ajouter une leçon" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ajouter une leçon" })).toHaveAccessibleDescription("Créez d'abord un module (onglet Modules).");
  });

  it("navigation au clavier entre les onglets (flèches, Début, Fin)", async () => {
    afficherContenus(<LangueContenusView code="en" ongletInitial="lecons" />);

    const lecons = await screen.findByRole("tab", { name: /Leçons/ });
    expect(lecons).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(lecons, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Exercices/ })).toHaveFocus();
    expect(screen.getByRole("tab", { name: /Exercices/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(screen.getByRole("tab", { name: /Exercices/ }), { key: "Home" });
    expect(screen.getByRole("tab", { name: /Modules/ })).toHaveFocus();
  });

  it("une leçon utilisée dans un parcours s'archive après confirmation, sans proposer la suppression (RG-GP-08)", async () => {
    afficherContenus(<LangueContenusView code="en" ongletInitial="lecons" />);

    const actions = await screen.findByRole("group", { name: "Actions pour « Leçon 1 »" });
    expect(within(actions).queryByRole("button", { name: "Supprimer" })).not.toBeInTheDocument();
    fireEvent.click(within(actions).getByRole("button", { name: "Archiver" }));

    const dialogue = await screen.findByRole("dialog", { name: "Archiver cette leçon ?" });
    expect(dialogue).toHaveTextContent("est utilisée dans 1 parcours et contient 6 activités : elle sera archivée, pas supprimée.");
    fireEvent.click(within(dialogue).getByRole("button", { name: "Archiver" }));

    expect(await screen.findByRole("status")).toHaveTextContent("La leçon « Leçon 1 » a été archivée.");
    await waitFor(() => expect(within(screen.getByRole("group", { name: "Actions pour « Leçon 1 »" })).getByRole("button", { name: "Modifier" })).toBeDisabled());
  });

  it("ouvre le formulaire dans le panneau latéral et rend le focus au bouton à la fermeture", async () => {
    afficherContenus(<LangueContenusView code="en" />);

    const ajouter = await screen.findByRole("button", { name: "Ajouter un module" });
    ajouter.focus();
    fireEvent.click(ajouter);
    const panneau = screen.getByRole("dialog", { name: "Ajouter un module" });
    expect(within(panneau).getByLabelText("Titre *")).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Ajouter un module" })).not.toBeInTheDocument();
    await waitFor(() => expect(ajouter).toHaveFocus());
  });
});
