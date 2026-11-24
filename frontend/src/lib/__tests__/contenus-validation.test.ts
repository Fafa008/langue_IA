import type {
  Activite,
  ActiviteSaisie,
  ContenusLangue,
  Langue,
  Lecon,
  LeconSaisie,
  Module,
  ModuleSaisie,
  Parcours,
  ParcoursSaisie,
} from "@/lib/contenus/types";
import {
  lireEntierPositif,
  peutEtreAjouteAuParcours,
  phaseAssimil,
  retraitsPossibles,
  statutsAccessibles,
  validerActivite,
  validerLecon,
  validerModule,
  validerParcours,
} from "@/lib/contenus/validation";

// USPxx : règles de gestion des contenus (docs/gestion-pedagogique.md), cas valide et invalide pour chaque règle.

const trace = { creePar: "test", creeLe: "2026-11-01T00:00:00Z", modifiePar: "test", modifieLe: "2026-11-01T00:00:00Z" };

const ANGLAIS: Langue = {
  code: "en",
  libelle: "Anglais",
  niveaux: [
    { id: "en-A1", code: "A1", referentiel: "CECRL" },
    { id: "en-A2", code: "A2", referentiel: "CECRL" },
  ],
};

const module_ = (id: string, ordre: number, statut: Module["statut"] = "PUBLIE"): Module => ({ id, codeLangue: "en", titre: `Module ${ordre}`, ordre, statut, ...trace });

const lecon = (id: string, ordre: number, extra: Partial<Lecon> = {}): Lecon => ({
  id,
  codeLangue: "en",
  idModule: "m1",
  idNiveau: "en-A1",
  titre: `Leçon ${ordre}`,
  ordre,
  description: "",
  statut: "PUBLIE",
  ...trace,
  ...extra,
});

const activite = (id: string, idLecon: string, extra: Partial<Activite> = {}): Activite => ({
  id,
  codeLangue: "en",
  idLecon,
  type: "QCM",
  competence: "LECTURE",
  difficulte: 1,
  consigne: "Consigne",
  contenu: "",
  critereCorrection: "",
  emplacementMedia: "",
  caracteres: "",
  pinyin: "",
  tonsAttendus: "",
  statut: "PUBLIE",
  ...trace,
  ...extra,
});

const parcours = (id: string, elements: Parcours["elements"], extra: Partial<Parcours> = {}): Parcours => ({
  id,
  codeLangue: "en",
  titre: "Parcours",
  idNiveauCible: "en-A1",
  elements,
  statut: "BROUILLON",
  ...trace,
  ...extra,
});

/** L1 publiée (activité A1 publiée), L2 en brouillon (activité A2 en brouillon), L3 archivée ; parcours P1 avec L1. */
function contexte(extra: Partial<ContenusLangue> = {}): ContenusLangue {
  return {
    langue: ANGLAIS,
    modules: [module_("m1", 1), module_("m2", 2, "ARCHIVE")],
    lecons: [lecon("l1", 1), lecon("l2", 2, { statut: "BROUILLON" }), lecon("l3", 3, { statut: "ARCHIVE" })],
    activites: [activite("a1", "l1"), activite("a2", "l2", { statut: "BROUILLON" }), activite("a3", "l3", { statut: "ARCHIVE" })],
    parcours: [parcours("p1", [{ type: "lecon", id: "l1" }])],
    ...extra,
  };
}

const saisieModule = (extra: Partial<ModuleSaisie> = {}): ModuleSaisie => ({ titre: "Module", ordre: "3", statut: "BROUILLON", ...extra });
const saisieLecon = (extra: Partial<LeconSaisie> = {}): LeconSaisie => ({
  idModule: "m1",
  idNiveau: "en-A1",
  titre: "Leçon",
  ordre: "10",
  description: "",
  statut: "BROUILLON",
  ...extra,
});
const saisieActivite = (extra: Partial<ActiviteSaisie> = {}): ActiviteSaisie => ({
  idLecon: "l1",
  type: "ASSOCIATION",
  competence: "LECTURE",
  difficulte: "3",
  consigne: "Consigne",
  contenu: "",
  critereCorrection: "",
  emplacementMedia: "",
  caracteres: "",
  pinyin: "",
  tonsAttendus: "",
  statut: "BROUILLON",
  ...extra,
});
const saisieParcours = (extra: Partial<ParcoursSaisie> = {}): ParcoursSaisie => ({
  titre: "Parcours",
  idNiveauCible: "en-A1",
  elements: [{ type: "lecon", id: "l1" }],
  statut: "BROUILLON",
  ...extra,
});

describe("saisies valides", () => {
  it("n'ont aucune erreur", () => {
    const ctx = contexte();
    expect(validerModule(saisieModule(), ctx)).toEqual({});
    expect(validerLecon(saisieLecon(), ctx)).toEqual({});
    expect(validerActivite(saisieActivite(), ctx)).toEqual({});
    expect(validerParcours(saisieParcours(), ctx)).toEqual({});
  });

  it("signalent les champs obligatoires manquants", () => {
    const ctx = contexte();
    expect(validerModule(saisieModule({ titre: " ", ordre: "" }), ctx)).toEqual({ titre: "Le titre est requis.", ordre: "Le numéro d'ordre est requis." });
    expect(Object.keys(validerLecon(saisieLecon({ idModule: "", idNiveau: "", titre: "" }), ctx)).sort()).toEqual(["idModule", "idNiveau", "titre"]);
    expect(Object.keys(validerActivite(saisieActivite({ type: "", competence: "", consigne: "" }), ctx)).sort()).toEqual(["competence", "consigne", "type"]);
  });

  it("refuse une difficulté hors de 1 à 5 et un numéro d'ordre non entier positif", () => {
    const ctx = contexte();
    for (const difficulte of ["0", "6", "2.5", "-1", "abc"]) expect(validerActivite(saisieActivite({ difficulte }), ctx).difficulte).toBeDefined();
    for (const difficulte of ["1", "5"]) expect(validerActivite(saisieActivite({ difficulte }), ctx).difficulte).toBeUndefined();
    for (const ordre of ["0", "-3", "1.5", "x"]) expect(validerModule(saisieModule({ ordre }), ctx).ordre).toBe("Le numéro d'ordre doit être un entier positif.");
    expect(lireEntierPositif(" 12 ")).toBe(12);
  });
});

describe("RG-GP-01 : numéro d'ordre unique par langue (modules et leçons)", () => {
  const ctx = contexte();

  it("refuse un numéro déjà pris par un autre module ou une autre leçon", () => {
    expect(validerModule(saisieModule({ ordre: "1" }), ctx).ordre).toBe("Le numéro 1 est déjà utilisé par un autre module de cette langue.");
    expect(validerLecon(saisieLecon({ ordre: "2" }), ctx).ordre).toBe("Le numéro 2 est déjà utilisé par une autre leçon de cette langue.");
  });

  it("accepte un numéro libre, ou le numéro de l'entité modifiée elle-même", () => {
    expect(validerModule(saisieModule({ ordre: "3" }), ctx).ordre).toBeUndefined();
    expect(validerModule(saisieModule({ ordre: "1", statut: "PUBLIE" }), ctx, ctx.modules[0]).ordre).toBeUndefined();
    expect(validerLecon(saisieLecon({ ordre: "2" }), ctx, ctx.lecons[1]).ordre).toBeUndefined();
  });
});

describe("RG-GP-02 : le niveau appartient à la langue", () => {
  const ctx = contexte();

  it("refuse un niveau d'une autre langue pour une leçon ou un parcours", () => {
    expect(validerLecon(saisieLecon({ idNiveau: "zh-HSK1" }), ctx).idNiveau).toBe("Ce niveau n'est pas ouvert pour la langue Anglais.");
    expect(validerParcours(saisieParcours({ idNiveauCible: "fr-C2" }), ctx).idNiveauCible).toBe("Ce niveau n'est pas ouvert pour la langue Anglais.");
  });

  it("refuse une activité dont la leçon n'est pas de la langue, ou dont le niveau n'y est pas ouvert", () => {
    expect(validerActivite(saisieActivite({ idLecon: "zh-lec-1" }), ctx).idLecon).toBe("Cette leçon n'appartient pas à cette langue.");
    const horsLangue = contexte({ lecons: [lecon("l1", 1, { idNiveau: "de-B2" })] });
    expect(validerActivite(saisieActivite(), horsLangue).idLecon).toBe("Le niveau de cette leçon n'est pas ouvert pour la langue Anglais.");
  });

  it("accepte un niveau de la langue", () => {
    expect(validerLecon(saisieLecon({ idNiveau: "en-A2" }), ctx).idNiveau).toBeUndefined();
    expect(validerParcours(saisieParcours({ idNiveauCible: "en-A2" }), ctx).idNiveauCible).toBeUndefined();
    expect(validerActivite(saisieActivite(), ctx).idLecon).toBeUndefined();
  });
});

describe("RG-GP-03 : une leçon publiée contient au moins une activité publiée", () => {
  const ctx = contexte();

  it("refuse de publier une leçon sans activité publiée, avec un message explicite", () => {
    expect(validerLecon(saisieLecon({ ordre: "2", statut: "PUBLIE" }), ctx, ctx.lecons[1]).statut).toMatch(/^Publication refusée : une leçon publiée doit contenir au moins une activité publiée/);
    // Une leçon nouvelle n'a encore aucune activité
    expect(validerLecon(saisieLecon({ statut: "PUBLIE" }), ctx).statut).toMatch(/^Publication refusée/);
  });

  it("accepte une leçon qui a une activité publiée, ou une leçon en brouillon", () => {
    expect(validerLecon(saisieLecon({ ordre: "1", statut: "PUBLIE" }), ctx, ctx.lecons[0]).statut).toBeUndefined();
    expect(validerLecon(saisieLecon({ ordre: "2", statut: "BROUILLON" }), ctx, ctx.lecons[1]).statut).toBeUndefined();
  });
});

describe("RG-GP-04 : une activité de production libre a un critère de correction", () => {
  const ctx = contexte();

  it("refuse une production libre sans critère", () => {
    expect(validerActivite(saisieActivite({ type: "PRODUCTION_LIBRE", critereCorrection: "  " }), ctx).critereCorrection).toBe(
      "Une activité de production libre doit avoir une réponse de référence ou un critère de correction.",
    );
  });

  it("accepte une production libre avec critère, et les autres types sans critère", () => {
    expect(validerActivite(saisieActivite({ type: "PRODUCTION_LIBRE", critereCorrection: "Critère" }), ctx).critereCorrection).toBeUndefined();
    expect(validerActivite(saisieActivite({ type: "TEXTE_A_TROUS", critereCorrection: "" }), ctx).critereCorrection).toBeUndefined();
  });
});

describe("RG-GP-05 : un parcours contient au moins un élément", () => {
  it("refuse un parcours vide et accepte un parcours d'un élément", () => {
    const ctx = contexte();
    expect(validerParcours(saisieParcours({ elements: [] }), ctx).elements).toBe("Un parcours contient au moins un élément (leçon ou activité).");
    expect(validerParcours(saisieParcours({ elements: [{ type: "activite", id: "a1" }] }), ctx).elements).toBeUndefined();
  });
});

describe("RG-GP-06 : un élément archivé ne peut pas être ajouté à un parcours", () => {
  const ctx = contexte();

  it("refuse d'ajouter une leçon ou une activité archivée", () => {
    expect(peutEtreAjouteAuParcours(ctx.lecons[2])).toBe(false);
    expect(validerParcours(saisieParcours({ elements: [{ type: "lecon", id: "l3" }] }), ctx).elements).toBe("« Leçon 3 » est archivée : elle ne peut pas être ajoutée au parcours.");
    expect(validerParcours(saisieParcours({ elements: [{ type: "activite", id: "a3" }] }), ctx).elements).toMatch(/est archivée/);
  });

  it("accepte un élément non archivé, et tolère dans un brouillon un élément archivé après son ajout", () => {
    expect(peutEtreAjouteAuParcours(ctx.lecons[1])).toBe(true);
    const existant = parcours("p2", [{ type: "lecon", id: "l3" }]);
    expect(validerParcours(saisieParcours({ elements: existant.elements }), contexte({ parcours: [existant] }), existant).elements).toBeUndefined();
  });
});

describe("RG-GP-07 : un parcours publié ne référence que des éléments publiés", () => {
  const ctx = contexte();

  it("refuse de publier un parcours qui contient un élément non publié", () => {
    const elements: ParcoursSaisie["elements"] = [
      { type: "lecon", id: "l1" },
      { type: "activite", id: "a2" },
    ];
    expect(validerParcours(saisieParcours({ elements, statut: "PUBLIE" }), ctx).elements).toBe(
      "Publication refusée : un parcours publié ne contient que des éléments publiés (1 élément non publié).",
    );
  });

  it("accepte un parcours publié dont tous les éléments sont publiés, et un brouillon quelconque", () => {
    expect(validerParcours(saisieParcours({ statut: "PUBLIE" }), ctx).elements).toBeUndefined();
    expect(validerParcours(saisieParcours({ elements: [{ type: "lecon", id: "l2" }] }), ctx).elements).toBeUndefined();
  });
});

describe("RG-GP-08 et RG-GP-09 : archiver ce qui est utilisé, supprimer le reste", () => {
  const ctx = contexte();

  it("une leçon utilisée dans un parcours s'archive seulement", () => {
    expect(retraitsPossibles("lecon", ctx.lecons[0], ctx)).toEqual(["archiver"]);
  });

  it("une activité non utilisée peut être archivée ou supprimée ; archivée, elle peut encore être supprimée", () => {
    const libre = contexte({ activites: [activite("a9", "l1")], lecons: [lecon("l1", 1)], parcours: [] });
    expect(retraitsPossibles("activite", libre.activites[0], libre)).toEqual(["archiver", "supprimer"]);
    expect(retraitsPossibles("activite", ctx.activites[2], ctx)).toEqual(["supprimer"]);
  });

  it("un module qui contient des leçons s'archive seulement", () => {
    expect(retraitsPossibles("module", ctx.modules[0], ctx)).toEqual(["archiver"]);
  });
});

describe("Cycle de vie et phase Assimil", () => {
  it("Brouillon → Publié → Archivé, sans retour en arrière", () => {
    expect(statutsAccessibles(null)).toEqual(["BROUILLON", "PUBLIE"]);
    expect(statutsAccessibles("PUBLIE")).toEqual(["PUBLIE"]);
    const ctx = contexte();
    expect(validerModule(saisieModule({ ordre: "1", statut: "BROUILLON" }), ctx, ctx.modules[0]).statut).toMatch(/Passage de « Publié » à « Brouillon » impossible/);
    expect(validerModule(saisieModule({ statut: "ARCHIVE" }), ctx).statut).toBe("L'archivage se fait avec l'action « Archiver ».");
  });

  it("phase passive de 1 à 49, active à partir de 50", () => {
    expect(phaseAssimil(1)).toBe("passive");
    expect(phaseAssimil(49)).toBe("passive");
    expect(phaseAssimil(50)).toBe("active");
    expect(phaseAssimil(null)).toBeNull();
  });
});
