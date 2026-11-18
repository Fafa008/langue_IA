import type {
  CompetenceResultat,
  CompetenceTest,
  DomaineFaiblesse,
  PhaseAssimil,
  PointFaible,
  ResultatTest,
} from "@/types/test-diagnostic";

export const LIBELLES_DOMAINES: Record<DomaineFaiblesse, string> = {
  grammaire: "Grammaire",
  vocabulaire: "Vocabulaire",
  comprehension_ecrite: "Compréhension écrite",
  comprehension_orale: "Compréhension orale",
  expression_ecrite: "Expression écrite",
  expression_orale: "Expression orale",
};

export const DOMAINES = Object.keys(LIBELLES_DOMAINES) as DomaineFaiblesse[];

export const PHASES_ASSIMIL: Record<PhaseAssimil, { libelle: string; description: string }> = {
  impregnation: {
    libelle: "Imprégnation",
    description: "Phase passive : écouter, lire et répéter pour s'approprier la langue sans chercher à produire.",
  },
  activation: {
    libelle: "Activation",
    description: "Phase active : reformuler et produire vous-même des phrases à partir de ce que vous avez assimilé.",
  },
};

export const PHASES = Object.keys(PHASES_ASSIMIL) as PhaseAssimil[];

/** Compétences en lacune : moins de la moitié des points obtenus (même règle que l'évaluation simulée). */
export const lacunesDe = (competences: CompetenceResultat[]): CompetenceTest[] =>
  competences.filter(({ score, total }) => total > 0 && score / total < 0.5).map(({ competence }) => competence);

/** Domaine correspondant à une compétence du test (la grammaire couvre aussi le vocabulaire dans le QCM). */
const DOMAINE_DE_COMPETENCE: Record<CompetenceTest, DomaineFaiblesse> = {
  grammaire: "grammaire",
  lecture: "comprehension_ecrite",
  ecoute: "comprehension_orale",
  ecrit: "expression_ecrite",
  oral: "expression_orale",
};

/**
 * Points faibles à afficher : ceux détaillés par l'analyse, sinon ceux déduits des compétences en lacune.
 * null si l'on ne sait pas encore (ni analyse détaillée, ni score par compétence).
 */
export function pointsFaiblesDe(resultat: ResultatTest): PointFaible[] | null {
  if (resultat.pointsFaibles) return resultat.pointsFaibles;
  if (resultat.competences.length === 0) return null;
  return resultat.lacunes.map((competence) => ({ domaine: DOMAINE_DE_COMPETENCE[competence] }));
}

export type InformationManquante = "competences" | "points_faibles" | "phase" | "justification";

/** Parties du résultat que l'analyse n'a pas (encore) fournies : l'écran le dit au lieu de les inventer. */
export function informationsManquantes(resultat: ResultatTest): InformationManquante[] {
  const manquantes: InformationManquante[] = [];
  if (resultat.competences.length === 0) manquantes.push("competences");
  if (pointsFaiblesDe(resultat) === null) manquantes.push("points_faibles");
  if (!resultat.phaseAssimil) manquantes.push("phase");
  if (!resultat.justification?.resume) manquantes.push("justification");
  return manquantes;
}

/** Seuls les liens http(s) sont ouverts : un lien `javascript:` venu de l'API ne doit jamais être cliquable. */
export function estLienSur(url: string | undefined): url is string {
  if (!url) return false;
  try {
    return ["http:", "https:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}
