import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import ActivitePanel from "@/components/formateur/contenus/panels/ActivitePanel";
import LeconPanel from "@/components/formateur/contenus/panels/LeconPanel";
import ModulePanel from "@/components/formateur/contenus/panels/ModulePanel";
import ParcoursPanel from "@/components/formateur/contenus/panels/ParcoursPanel";
import { afficherContenus, contenusDe, nouveauService } from "@/test/contenus";

// USPxx : formulaires de module, leçon, activité et parcours (soumission valide et invalide, accessibilité des erreurs).

const enregistrer = () => fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
const saisir = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

/** Le champ est marqué invalide et son message d'erreur lui est relié. */
function expectErreur(label: string | RegExp, message: string | RegExp) {
  const champ = screen.getByLabelText(label);
  expect(champ).toHaveAttribute("aria-invalid", "true");
  expect(champ).toHaveAccessibleDescription(message);
}

async function preparer(code = "en") {
  const service = nouveauService();
  return { service, ctx: await contenusDe(service, code) };
}

describe("formulaire de module", () => {
  it("refuse un titre vide et un numéro déjà utilisé (RG-GP-01)", async () => {
    const { service, ctx } = await preparer();
    const onSaved = jest.fn();
    afficherContenus(<ModulePanel ctx={ctx} existant={null} onClose={jest.fn()} onSaved={onSaved} />, service);

    expect(screen.getByLabelText("Titre *")).toHaveFocus();
    saisir("Numéro d'ordre *", "1");
    enregistrer();

    expectErreur("Titre *", "Le titre est requis.");
    expectErreur("Numéro d'ordre *", "Le numéro 1 est déjà utilisé par un autre module de cette langue.");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("enregistre un module valide", async () => {
    const { service, ctx } = await preparer();
    const onSaved = jest.fn();
    afficherContenus(<ModulePanel ctx={ctx} existant={null} onClose={jest.fn()} onSaved={onSaved} />, service);

    // Numéro proposé : le suivant du dernier module
    expect(screen.getByLabelText("Numéro d'ordre *")).toHaveValue(2);
    saisir("Titre *", "Module 2");
    enregistrer();

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ titre: "Module 2", ordre: 2, statut: "BROUILLON" })));
    expect(await service.listModules("en")).toHaveLength(2);
  });
});

describe("formulaire de leçon", () => {
  it("affiche la phase Assimil calculée depuis le numéro, en lecture seule", async () => {
    const { ctx } = await preparer();
    afficherContenus(<LeconPanel ctx={ctx} existant={null} onClose={jest.fn()} onSaved={jest.fn()} />);

    const phase = screen.getByLabelText("Phase Assimil");
    expect(phase).toHaveAttribute("readonly");
    saisir("Numéro d'ordre *", "49");
    expect(phase).toHaveValue("Passive");
    saisir("Numéro d'ordre *", "50");
    expect(phase).toHaveValue("Active");
  });

  it("refuse les champs manquants et la publication sans activité publiée (RG-GP-03)", async () => {
    const { ctx } = await preparer();
    const onSaved = jest.fn();
    afficherContenus(<LeconPanel ctx={ctx} existant={null} onClose={jest.fn()} onSaved={onSaved} />);

    saisir("Statut *", "PUBLIE");
    enregistrer();

    expectErreur("Module *", "Choisissez le module de la leçon.");
    expectErreur("Niveau *", "Choisissez le niveau de la leçon.");
    expectErreur("Titre *", "Le titre est requis.");
    expectErreur("Statut *", /^Publication refusée : une leçon publiée doit contenir au moins une activité publiée/);
    await waitFor(() => expect(screen.getByLabelText("Module *")).toHaveFocus());
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("enregistre une leçon valide en brouillon", async () => {
    const { service, ctx } = await preparer();
    const onSaved = jest.fn();
    afficherContenus(<LeconPanel ctx={ctx} existant={null} onClose={jest.fn()} onSaved={onSaved} />, service);

    saisir("Module *", "en-mod-1");
    saisir("Niveau *", "en-A2");
    saisir("Titre *", "Leçon 9");
    enregistrer();

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ titre: "Leçon 9", ordre: 9, idNiveau: "en-A2", statut: "BROUILLON" })));
  });
});

describe("formulaire d'activité", () => {
  it("n'affiche les champs caractères, pinyin et tons que pour le mandarin", async () => {
    const { ctx } = await preparer("en");
    const { unmount } = afficherContenus(<ActivitePanel ctx={ctx} existant={null} onClose={jest.fn()} onSaved={jest.fn()} />);
    expect(screen.queryByLabelText("Caractères")).not.toBeInTheDocument();
    unmount();

    const zh = await preparer("zh");
    afficherContenus(<ActivitePanel ctx={zh.ctx} existant={null} onClose={jest.fn()} onSaved={jest.fn()} />, zh.service);
    const groupe = screen.getByRole("group", { name: "Champs du mandarin" });
    expect(within(groupe).getByLabelText("Caractères")).toBeInTheDocument();
    expect(within(groupe).getByLabelText("Pinyin")).toBeInTheDocument();
    expect(within(groupe).queryByLabelText("Tons attendus")).not.toBeInTheDocument();
    saisir("Compétence *", "ORAL");
    expect(within(groupe).getByLabelText("Tons attendus")).toBeInTheDocument();
  });

  it("refuse une production libre sans critère (RG-GP-04) et une difficulté hors de 1 à 5", async () => {
    const { ctx } = await preparer();
    const onSaved = jest.fn();
    afficherContenus(<ActivitePanel ctx={ctx} existant={null} onClose={jest.fn()} onSaved={onSaved} />);

    saisir("Leçon *", "en-lec-1");
    saisir("Type *", "PRODUCTION_LIBRE");
    saisir("Compétence *", "ECRITURE");
    saisir("Difficulté *", "7");
    saisir("Consigne *", "Consigne");
    enregistrer();

    expectErreur("Réponse de référence ou critère de correction *", "Une activité de production libre doit avoir une réponse de référence ou un critère de correction.");
    expectErreur("Difficulté *", "La difficulté est un entier de 1 à 5.");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("enregistre une activité mandarin valide, dans la leçon imposée", async () => {
    const { service, ctx } = await preparer("zh");
    const onSaved = jest.fn();
    afficherContenus(<ActivitePanel ctx={ctx} existant={null} idLeconImposee="zh-lec-2" onClose={jest.fn()} onSaved={onSaved} />, service);

    expect(screen.queryByLabelText("Leçon *")).not.toBeInTheDocument();
    saisir("Type *", "VRAI_FAUX_NON_MENTIONNE");
    saisir("Compétence *", "ECOUTE");
    saisir("Consigne *", "Consigne de l'activité");
    saisir("Caractères", "你好");
    saisir("Pinyin", "nǐ hǎo");
    enregistrer();

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ idLecon: "zh-lec-2", type: "VRAI_FAUX_NON_MENTIONNE", caracteres: "你好", pinyin: "nǐ hǎo" })));
  });
});

describe("formulaire de parcours", () => {
  it("refuse un parcours sans élément (RG-GP-05)", async () => {
    const { ctx } = await preparer();
    const onSaved = jest.fn();
    afficherContenus(<ParcoursPanel ctx={ctx} existant={null} onClose={jest.fn()} onSaved={onSaved} />);

    saisir("Titre *", "Parcours A2");
    saisir("Niveau cible *", "en-A2");
    enregistrer();

    expectErreur("Élément à ajouter", "Un parcours contient au moins un élément (leçon ou activité).");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("ne propose pas les éléments archivés (RG-GP-06)", async () => {
    const { service } = await preparer();
    await service.archive("activite", "en-act-8-1");
    const ctx = await contenusDe(service, "en");
    afficherContenus(<ParcoursPanel ctx={ctx} existant={null} onClose={jest.fn()} onSaved={jest.fn()} />, service);

    const valeurs = within(screen.getByLabelText("Élément à ajouter")).getAllByRole("option").map((o) => (o as HTMLOptionElement).value);
    expect(valeurs).toContain("activite:en-act-8-2");
    expect(valeurs).not.toContain("activite:en-act-8-1");
  });

  it("refuse de publier avec un élément non publié (RG-GP-07)", async () => {
    const { ctx } = await preparer();
    afficherContenus(<ParcoursPanel ctx={ctx} existant={null} onClose={jest.fn()} onSaved={jest.fn()} />);

    saisir("Titre *", "Parcours");
    saisir("Niveau cible *", "en-A1");
    saisir("Élément à ajouter", "lecon:en-lec-8");
    fireEvent.click(screen.getByRole("button", { name: "Ajouter au parcours" }));
    saisir("Statut *", "PUBLIE");
    enregistrer();

    expectErreur("Élément à ajouter", /^Publication refusée : un parcours publié ne contient que des éléments publiés/);
  });

  it("ajoute, ordonne et retire des éléments, puis enregistre", async () => {
    const { service, ctx } = await preparer();
    const onSaved = jest.fn();
    afficherContenus(<ParcoursPanel ctx={ctx} existant={null} onClose={jest.fn()} onSaved={onSaved} />, service);

    saisir("Titre *", "Parcours A1 bis");
    saisir("Niveau cible *", "en-A1");
    for (const valeur of ["lecon:en-lec-1", "lecon:en-lec-2", "activite:en-act-3-1"]) {
      saisir("Élément à ajouter", valeur);
      fireEvent.click(screen.getByRole("button", { name: "Ajouter au parcours" }));
    }
    const liste = () => within(screen.getByRole("list", { name: "Éléments du parcours, dans l'ordre" })).getAllByRole("listitem");
    expect(liste()).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "Monter « Leçon 2 – Leçon 2 »" }));
    expect(liste()[0]).toHaveTextContent("Leçon 2 – Leçon 2");
    expect(screen.getByRole("button", { name: "Monter « Leçon 2 – Leçon 2 »" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /^Retirer « Activité/ }));
    expect(liste()).toHaveLength(2);

    enregistrer();
    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          titre: "Parcours A1 bis",
          elements: [
            { type: "lecon", id: "en-lec-2" },
            { type: "lecon", id: "en-lec-1" },
          ],
        }),
      ),
    );
  });
});
