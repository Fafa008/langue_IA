/**
 * Implémentation en mémoire de ContenusService (données simulées, perdues au rechargement de la page).
 * Contenus de démonstration pour l'anglais et le mandarin uniquement : textes d'espace réservé, aucun contenu
 * pédagogique réel (les textes sont rédigés par les formateurs référents).
 */
import { LIBELLES_TYPE_ACTIVITE, TYPES_ACTIVITE } from "./libelles";
import { ErreurContenus, type ContenusService } from "./service";
import type {
  Activite,
  ActiviteSaisie,
  Competence,
  ContenusLangue,
  Entite,
  EntitesParType,
  FiltresContenus,
  Langue,
  LangueResume,
  Lecon,
  LeconSaisie,
  Module,
  ModuleSaisie,
  Niveau,
  Parcours,
  ParcoursSaisie,
  Referentiel,
  SaisiesParType,
  Tracabilite,
  TypeActivite,
  TypeEntite,
} from "./types";
import { refusRetrait, validerActivite, validerLecon, validerModule, validerParcours } from "./validation";

export const TEXTE_A_REDIGER = "[Contenu à rédiger par le formateur]";
export const CONSIGNE_A_REDIGER = "[Consigne à rédiger par le formateur]";
export const AUTEUR_DEMO = "Formateur référent (simulé)";
export const AUTEUR_SESSION = "Vous (formateur, simulé)";
const DATE_DEMO = "2026-11-20T09:00:00.000Z";

const CECRL = ["A1", "A2", "B1", "B2", "C1", "C2"];

function niveaux(code: string, referentiel: Referentiel, codes: string[]): Niveau[] {
  return codes.map((c) => ({ id: `${code}-${c.replace(/\s/g, "")}`, code: c, referentiel }));
}

/** Les six langues du centre et leurs niveaux ; l'espagnol n'a aucun niveau. */
export const LANGUES_SIMULEES: Langue[] = [
  { code: "fr", libelle: "Français", niveaux: niveaux("fr", "CECRL", CECRL) },
  { code: "en", libelle: "Anglais", niveaux: niveaux("en", "CECRL", CECRL) },
  { code: "zh", libelle: "Mandarin", niveaux: niveaux("zh", "HSK", ["HSK 1", "HSK 2"]) },
  { code: "it", libelle: "Italien", niveaux: niveaux("it", "CECRL", CECRL) },
  { code: "de", libelle: "Allemand", niveaux: niveaux("de", "CECRL", CECRL.slice(0, 4)) },
  { code: "es", libelle: "Espagnol", niveaux: [] },
];

const COMPETENCE_PAR_TYPE: Record<TypeActivite, Competence> = {
  QCM: "LECTURE",
  ASSOCIATION: "LECTURE",
  TEXTE_A_TROUS: "ECRITURE",
  VRAI_FAUX_NON_MENTIONNE: "ECOUTE",
  REMISE_EN_ORDRE: "LECTURE",
  PRODUCTION_LIBRE: "ECRITURE",
};

const NB_LECONS_DEMO = 8;
/** La dernière leçon de démonstration reste en brouillon (et hors du parcours) pour montrer les deux statuts. */
const DERNIERE_LECON_PUBLIEE = 7;

interface Donnees {
  modules: Module[];
  lecons: Lecon[];
  activites: Activite[];
  parcours: Parcours[];
}

const traceDemo: Tracabilite = { creePar: AUTEUR_DEMO, creeLe: DATE_DEMO, modifiePar: AUTEUR_DEMO, modifieLe: DATE_DEMO };

/** Un module de 8 leçons, chacune avec 6 activités de types différents, et un parcours. */
function contenusDemo(codeLangue: string, niveau: Niveau): Donnees {
  const moduleDemo: Module = { id: `${codeLangue}-mod-1`, codeLangue, titre: "Module 1", ordre: 1, statut: "PUBLIE", ...traceDemo };
  const lecons: Lecon[] = [];
  const activites: Activite[] = [];

  for (let n = 1; n <= NB_LECONS_DEMO; n++) {
    const statut = n <= DERNIERE_LECON_PUBLIEE ? "PUBLIE" : "BROUILLON";
    const idLecon = `${codeLangue}-lec-${n}`;
    lecons.push({ id: idLecon, codeLangue, idModule: moduleDemo.id, idNiveau: niveau.id, titre: `Leçon ${n}`, ordre: n, description: "", statut, ...traceDemo });
    TYPES_ACTIVITE.forEach((type, i) => {
      activites.push({
        id: `${codeLangue}-act-${n}-${i + 1}`,
        codeLangue,
        idLecon,
        type,
        competence: COMPETENCE_PAR_TYPE[type],
        difficulte: 1,
        consigne: CONSIGNE_A_REDIGER,
        contenu: TEXTE_A_REDIGER,
        critereCorrection: TEXTE_A_REDIGER,
        emplacementMedia: COMPETENCE_PAR_TYPE[type] === "ECOUTE" ? "[Emplacement du fichier audio à préciser par le formateur]" : "",
        caracteres: "",
        pinyin: "",
        tonsAttendus: "",
        statut,
        ...traceDemo,
      });
    });
  }

  const parcours: Parcours = {
    id: `${codeLangue}-par-1`,
    codeLangue,
    titre: `Parcours de démonstration ${niveau.code}`,
    idNiveauCible: niveau.id,
    statut: "PUBLIE",
    elements: lecons.filter((l) => l.statut === "PUBLIE").map((l) => ({ type: "lecon", id: l.id })),
    ...traceDemo,
  };

  return { modules: [moduleDemo], lecons, activites, parcours: [parcours] };
}

function donneesInitiales(): Donnees {
  const en = contenusDemo("en", LANGUES_SIMULEES[1].niveaux[0]);
  const zh = contenusDemo("zh", LANGUES_SIMULEES[2].niveaux[0]);
  return {
    modules: [...en.modules, ...zh.modules],
    lecons: [...en.lecons, ...zh.lecons],
    activites: [...en.activites, ...zh.activites],
    parcours: [...en.parcours, ...zh.parcours],
  };
}

/* ------------------------------------------------------------------------------------------------------------ */

const COLLECTION: Record<TypeEntite, keyof Donnees> = { module: "modules", lecon: "lecons", activite: "activites", parcours: "parcours" };

/** Copie profonde : l'appelant ne modifie jamais les données du service par mégarde. */
const copie = <T>(valeur: T): T => JSON.parse(JSON.stringify(valeur)) as T;

/** Minuscules, sans accents : « Leçon » est trouvée en tapant « lecon ». */
const normaliser = (texte: string) =>
  texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function filtrer<T extends Entite>(items: T[], filtres: FiltresContenus | undefined, texte: (item: T) => string): T[] {
  const recherche = normaliser(filtres?.recherche?.trim() ?? "");
  return items.filter((item) => (!recherche || normaliser(texte(item)).includes(recherche)) && (!filtres?.statut || item.statut === filtres.statut));
}

const ERREUR_FORMULAIRE = "Le formulaire contient des erreurs : corrigez les champs signalés.";

interface OptionsServiceSimule {
  /** Latence simulée en millisecondes (0 dans les tests). */
  latence?: number;
  /** Horloge, remplaçable dans les tests. */
  maintenant?: () => Date;
  auteur?: string;
}

export function creerServiceContenusSimule({ latence = 150, maintenant = () => new Date(), auteur = AUTEUR_SESSION }: OptionsServiceSimule = {}): ContenusService {
  const donnees = donneesInitiales();
  let compteur = 0;

  const attendre = () => (latence > 0 ? new Promise((r) => setTimeout(r, latence)) : Promise.resolve());

  function langue(code: string): Langue {
    const l = LANGUES_SIMULEES.find((x) => x.code === code);
    if (!l) throw new ErreurContenus("Langue inconnue.");
    return l;
  }

  function contexte(codeLangue: string): ContenusLangue {
    const deLaLangue = <T extends { codeLangue: string }>(items: T[]) => items.filter((i) => i.codeLangue === codeLangue);
    return {
      langue: langue(codeLangue),
      modules: deLaLangue(donnees.modules),
      lecons: deLaLangue(donnees.lecons),
      activites: deLaLangue(donnees.activites),
      parcours: deLaLangue(donnees.parcours),
    };
  }

  const collection = (type: TypeEntite) => donnees[COLLECTION[type]] as Entite[];

  function trouver(type: TypeEntite, id: string): Entite {
    const entite = collection(type).find((e) => e.id === id);
    if (!entite) throw new ErreurContenus("Cet élément n'existe plus.");
    return entite;
  }

  /** Valide la saisie et la convertit en champs d'entité (sans identifiant ni traçabilité). */
  function preparer(type: TypeEntite, saisie: SaisiesParType[TypeEntite], ctx: ContenusLangue, existant: Entite | null): Partial<Entite> {
    if (ctx.langue.niveaux.length === 0) throw new ErreurContenus("Ajoutez d'abord des niveaux pour cette langue.");
    const estZh = ctx.langue.code === "zh";
    switch (type) {
      case "module": {
        const s = saisie as ModuleSaisie;
        lever(validerModule(s, ctx, existant as Module | null));
        return { titre: s.titre.trim(), ordre: Number(s.ordre), statut: s.statut };
      }
      case "lecon": {
        const s = saisie as LeconSaisie;
        lever(validerLecon(s, ctx, existant as Lecon | null));
        return { idModule: s.idModule, idNiveau: s.idNiveau, titre: s.titre.trim(), ordre: Number(s.ordre), description: s.description.trim(), statut: s.statut } as Partial<Lecon>;
      }
      case "activite": {
        const s = saisie as ActiviteSaisie;
        lever(validerActivite(s, ctx, existant as Activite | null));
        return {
          idLecon: s.idLecon,
          type: s.type as TypeActivite,
          competence: s.competence as Competence,
          difficulte: Number(s.difficulte),
          consigne: s.consigne.trim(),
          contenu: s.contenu.trim(),
          critereCorrection: s.critereCorrection.trim(),
          emplacementMedia: s.emplacementMedia.trim(),
          // Champs mandarin : enregistrés pour la langue ZH seulement ; tons attendus pour la compétence orale
          caracteres: estZh ? s.caracteres.trim() : "",
          pinyin: estZh ? s.pinyin.trim() : "",
          tonsAttendus: estZh && s.competence === "ORAL" ? s.tonsAttendus.trim() : "",
          statut: s.statut,
        } as Partial<Activite>;
      }
      case "parcours": {
        const s = saisie as ParcoursSaisie;
        lever(validerParcours(s, ctx, existant as Parcours | null));
        return { titre: s.titre.trim(), idNiveauCible: s.idNiveauCible, elements: copie(s.elements), statut: s.statut } as Partial<Parcours>;
      }
    }
  }

  function lever(erreurs: Record<string, string | undefined>) {
    const champs = Object.fromEntries(Object.entries(erreurs).filter(([, v]) => v)) as Record<string, string>;
    if (Object.keys(champs).length > 0) throw new ErreurContenus(ERREUR_FORMULAIRE, champs);
  }

  /** RG-GP-10 : auteur et date de la modification. */
  const trace = () => ({ modifiePar: auteur, modifieLe: maintenant().toISOString() });

  const parOrdre = <T extends { ordre: number }>(items: T[]) => [...items].sort((a, b) => a.ordre - b.ordre);

  return {
    async listLangues() {
      await attendre();
      return LANGUES_SIMULEES.map((l): LangueResume => {
        const ctx = contexte(l.code);
        return {
          ...copie(l),
          compteurs: { modules: ctx.modules.length, lecons: ctx.lecons.length, activites: ctx.activites.length, parcours: ctx.parcours.length },
        };
      });
    },

    async listModules(code, filtres) {
      await attendre();
      return copie(parOrdre(filtrer(contexte(code).modules, filtres, (m) => m.titre)));
    },

    async listLecons(code, filtres) {
      await attendre();
      return copie(parOrdre(filtrer(contexte(code).lecons, filtres, (l) => l.titre)));
    },

    async listActivites(code, filtres) {
      await attendre();
      const ctx = contexte(code);
      const ordreLecon = new Map(ctx.lecons.map((l) => [l.id, l.ordre]));
      const activites = filtrer(ctx.activites, filtres, (a) => `${a.consigne} ${LIBELLES_TYPE_ACTIVITE[a.type]}`).filter((a) => !filtres?.idLecon || a.idLecon === filtres.idLecon);
      return copie(
        activites.sort(
          (a, b) =>
            (ordreLecon.get(a.idLecon) ?? 0) - (ordreLecon.get(b.idLecon) ?? 0) ||
            TYPES_ACTIVITE.indexOf(a.type) - TYPES_ACTIVITE.indexOf(b.type) ||
            a.creeLe.localeCompare(b.creeLe),
        ),
      );
    },

    async listParcours(code, filtres) {
      await attendre();
      return copie(filtrer(contexte(code).parcours, filtres, (p) => p.titre).sort((a, b) => a.titre.localeCompare(b.titre, "fr")));
    },

    async get(type, id) {
      await attendre();
      const entite = collection(type).find((e) => e.id === id);
      return entite ? (copie(entite) as EntitesParType[typeof type]) : null;
    },

    async create(type, codeLangue, saisie) {
      await attendre();
      const ctx = contexte(codeLangue);
      const champs = preparer(type, saisie, ctx, null);
      const date = maintenant().toISOString();
      compteur += 1;
      const entite = { ...champs, id: `${codeLangue}-${type}-nouveau-${compteur}`, codeLangue, creePar: auteur, creeLe: date, modifiePar: auteur, modifieLe: date } as Entite;
      collection(type).push(entite);
      return copie(entite) as EntitesParType[typeof type];
    },

    async update(type, id, saisie) {
      await attendre();
      const existant = trouver(type, id);
      const champs = preparer(type, saisie, contexte(existant.codeLangue), existant);
      Object.assign(existant, champs, trace());
      return copie(existant) as EntitesParType[typeof type];
    },

    async archive(type, id) {
      await attendre();
      const entite = trouver(type, id);
      const refus = refusRetrait("archiver", type, entite, contexte(entite.codeLangue));
      if (refus) throw new ErreurContenus(refus);
      Object.assign(entite, { statut: "ARCHIVE" }, trace());
    },

    async remove(type, id) {
      await attendre();
      const entite = trouver(type, id);
      const refus = refusRetrait("supprimer", type, entite, contexte(entite.codeLangue));
      if (refus) throw new ErreurContenus(refus);
      const liste = collection(type);
      liste.splice(liste.indexOf(entite), 1);
    },
  };
}
